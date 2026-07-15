"""Bulk bank-statement upload: preview column mapping, then confirm import.

Two-step flow, both stateless on the server (files aren't persisted between
calls - the browser sends them again on confirm):
  1. POST /preview - parse headers + a few sample rows per file, suggest a
     column mapping the user can review/adjust.
  2. POST /import  - re-send the same files plus the confirmed mapping;
     rows are parsed fully and inserted, skipping ones already imported.
"""
import json

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Account, Transaction
from app.schemas.statement import (
    ColumnMapping,
    FileImportResult,
    FilePreview,
    ImportResponse,
    PreviewResponse,
)
from app.services.statement_parser import compute_dedup_hash, parse_rows, read_table, suggest_mapping

router = APIRouter(prefix="/api/statements", tags=["statements"])


@router.post("/preview", response_model=PreviewResponse)
async def preview_statements(files: list[UploadFile]):
    previews = []
    for upload in files:
        content = await upload.read()
        try:
            df = read_table(content, upload.filename)
        except ValueError as exc:
            previews.append(FilePreview(
                filename=upload.filename, columns=[], sample_rows=[], row_count=0,
                suggested_mapping=None, warnings=[str(exc)],
            ))
            continue

        columns = list(df.columns)
        mapping = suggest_mapping(columns)
        warnings = [] if mapping else ["Could not auto-detect columns - please map them manually."]

        previews.append(FilePreview(
            filename=upload.filename,
            columns=columns,
            sample_rows=df.head(5).to_dict(orient="records"),
            row_count=len(df),
            suggested_mapping=mapping,
            warnings=warnings,
        ))
    return PreviewResponse(files=previews)


@router.post("/import", response_model=ImportResponse)
async def import_statements(
    files: list[UploadFile],
    account_id: int = Form(...),
    mappings: str = Form(...),
    db: Session = Depends(get_db),
):
    account = db.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    try:
        raw_mappings = json.loads(mappings)
        mapping_by_filename = {m["filename"]: ColumnMapping(**m["mapping"]) for m in raw_mappings}
    except (json.JSONDecodeError, KeyError, TypeError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid mappings payload: {exc}")

    results = []
    total_imported = 0
    total_skipped = 0

    for upload in files:
        mapping = mapping_by_filename.get(upload.filename)
        if mapping is None:
            results.append(FileImportResult(
                filename=upload.filename, imported=0, skipped_duplicates=0,
                errors=["No column mapping provided for this file"],
            ))
            continue

        content = await upload.read()
        df = read_table(content, upload.filename)
        parsed = parse_rows(df, mapping)

        imported = 0
        skipped = 0
        for txn in parsed.transactions:
            dedup_hash = compute_dedup_hash(account_id, txn.date, txn.amount, txn.description)
            exists = db.execute(
                select(Transaction.id).where(Transaction.dedup_hash == dedup_hash)
            ).first()
            if exists:
                skipped += 1
                continue
            db.add(Transaction(
                account_id=account_id,
                date=txn.date,
                description=txn.description,
                amount=txn.amount,
                currency=account.currency,
                source_file=upload.filename,
                dedup_hash=dedup_hash,
                raw_row=txn.raw_row,
            ))
            imported += 1

        db.commit()
        total_imported += imported
        total_skipped += skipped
        results.append(FileImportResult(
            filename=upload.filename, imported=imported, skipped_duplicates=skipped, errors=parsed.errors,
        ))

    return ImportResponse(files=results, total_imported=total_imported, total_skipped=total_skipped)
