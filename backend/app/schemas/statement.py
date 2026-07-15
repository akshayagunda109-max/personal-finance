"""Schemas for the bulk statement upload preview/import flow."""
from pydantic import BaseModel


class ColumnMapping(BaseModel):
    date_column: str
    description_column: str
    amount_mode: str  # "single" or "debit_credit"
    amount_column: str | None = None
    debit_column: str | None = None
    credit_column: str | None = None


class FilePreview(BaseModel):
    filename: str
    columns: list[str]
    sample_rows: list[dict]
    row_count: int
    suggested_mapping: ColumnMapping | None
    warnings: list[str] = []


class PreviewResponse(BaseModel):
    files: list[FilePreview]


class FileImportResult(BaseModel):
    filename: str
    imported: int
    skipped_duplicates: int
    errors: list[str]


class ImportResponse(BaseModel):
    files: list[FileImportResult]
    total_imported: int
    total_skipped: int
