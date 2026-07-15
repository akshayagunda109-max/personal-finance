"""Parsing and column-detection for bulk bank-statement uploads.

Bank statement exports vary by institution: header names differ, and some
split debits/credits into two columns instead of one signed amount. This
module guesses a column mapping from headers, and turns a confirmed mapping
into normalized transaction rows.
"""
from __future__ import annotations

import hashlib
import io
import re
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation

import pandas as pd

from app.schemas.statement import ColumnMapping

DATE_ALIASES = ["date", "transactiondate", "txndate", "valuedate", "postingdate", "trandate"]
DESCRIPTION_ALIASES = [
    "description", "narration", "particulars", "details",
    "transactiondetails", "memo", "remarks",
]
AMOUNT_ALIASES = ["amount", "transactionamount", "amt"]
DEBIT_ALIASES = ["debit", "withdrawal", "withdrawalamt", "withdrawalamount", "debitamount", "dr"]
CREDIT_ALIASES = ["credit", "deposit", "depositamt", "depositamount", "creditamount", "cr"]


def _normalize(header: str) -> str:
    return re.sub(r"[^a-z0-9]", "", header.strip().lower())


def _find_column(columns: list[str], aliases: list[str]) -> str | None:
    normalized = {_normalize(c): c for c in columns}
    for alias in aliases:
        if alias in normalized:
            return normalized[alias]
    return None


def read_table(content: bytes, filename: str) -> pd.DataFrame:
    """Parse an uploaded CSV or XLSX file into a DataFrame of strings."""
    lower = filename.lower()
    if lower.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(content), dtype=str, keep_default_na=False)
    elif lower.endswith((".xlsx", ".xls")):
        df = pd.read_excel(io.BytesIO(content), dtype=str)
        df = df.fillna("")
    else:
        raise ValueError(f"Unsupported file type: {filename}")
    df.columns = [str(c).strip() for c in df.columns]
    return df


def suggest_mapping(columns: list[str]) -> ColumnMapping | None:
    """Guess a column mapping from headers; None if date/description can't be found."""
    date_col = _find_column(columns, DATE_ALIASES)
    desc_col = _find_column(columns, DESCRIPTION_ALIASES)
    amount_col = _find_column(columns, AMOUNT_ALIASES)
    debit_col = _find_column(columns, DEBIT_ALIASES)
    credit_col = _find_column(columns, CREDIT_ALIASES)

    if not date_col or not desc_col:
        return None

    if amount_col:
        return ColumnMapping(
            date_column=date_col, description_column=desc_col,
            amount_mode="single", amount_column=amount_col,
        )
    if debit_col and credit_col:
        return ColumnMapping(
            date_column=date_col, description_column=desc_col,
            amount_mode="debit_credit", debit_column=debit_col, credit_column=credit_col,
        )
    return None


_ISO_DATE_RE = re.compile(r"^\d{4}-\d{1,2}-\d{1,2}")


def _looks_like_date_attempt(raw_value: str) -> bool:
    """Cheap filter for footer/disclaimer prose that isn't a real data row.

    A genuine date cell is short and has digits in it; a stray sentence that
    spilled into the date column because of an unescaped comma elsewhere in
    the row is long and has no reason to look date-shaped.
    """
    value = raw_value.strip()
    if not value or len(value) > 20:
        return False
    return any(ch.isdigit() for ch in value)


def _parse_date(value: str) -> date | None:
    value = value.strip()
    if not value:
        return None

    # Unambiguous YYYY-MM-DD - parse directly, never apply dayfirst swapping to it.
    if _ISO_DATE_RE.match(value):
        try:
            return pd.Timestamp(value).date()
        except (ValueError, TypeError):
            pass

    # Ambiguous formats (DD/MM/YYYY vs MM/DD/YYYY): try dayfirst (most non-US banks), then fall back.
    parsed = pd.to_datetime(value, dayfirst=True, errors="coerce")
    if pd.isna(parsed):
        parsed = pd.to_datetime(value, dayfirst=False, errors="coerce")
    if pd.isna(parsed):
        return None
    return parsed.date()


def _parse_decimal(value: str) -> Decimal | None:
    value = value.strip().replace(",", "").replace("$", "").replace("₹", "")
    if not value:
        return None
    negative = value.startswith("(") and value.endswith(")")
    if negative:
        value = value[1:-1]
    try:
        amount = Decimal(value)
    except InvalidOperation:
        return None
    return -amount if negative else amount


@dataclass
class ParsedTransaction:
    date: date
    description: str
    amount: Decimal
    raw_row: dict


@dataclass
class ParseResult:
    transactions: list[ParsedTransaction] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def parse_rows(df: pd.DataFrame, mapping: ColumnMapping) -> ParseResult:
    """Apply a confirmed column mapping, producing normalized rows. Money in is
    positive, money out is negative."""
    result = ParseResult()

    for idx, row in df.iterrows():
        raw_row = row.to_dict()
        row_num = idx + 2  # +1 for header row, +1 for 1-indexing

        if not any(str(v).strip() for v in raw_row.values()):
            continue  # fully blank row (common trailing rows in exports)

        raw_date_value = str(row.get(mapping.date_column, ""))
        if not _looks_like_date_attempt(raw_date_value):
            # Trailing document text (disclaimers, branch address, legend) often
            # contains stray commas that shift it into other columns, making it
            # look like a broken transaction. The date cell not even resembling
            # a date is the reliable signal that this was never a data row.
            continue

        parsed_date = _parse_date(raw_date_value)
        description = str(row.get(mapping.description_column, "")).strip()

        if mapping.amount_mode == "single":
            amount = _parse_decimal(row.get(mapping.amount_column, ""))
        else:
            debit = _parse_decimal(row.get(mapping.debit_column, "")) or Decimal("0")
            credit = _parse_decimal(row.get(mapping.credit_column, "")) or Decimal("0")
            amount = credit - debit

        if parsed_date is None or not description or amount is None:
            result.errors.append(f"Row {row_num}: could not parse date/description/amount")
            continue

        result.transactions.append(
            ParsedTransaction(date=parsed_date, description=description, amount=amount, raw_row=raw_row)
        )

    return result


def compute_dedup_hash(account_id: int, txn_date: date, amount: Decimal, description: str) -> str:
    normalized_desc = re.sub(r"\s+", " ", description.strip().lower())
    payload = f"{account_id}|{txn_date.isoformat()}|{amount}|{normalized_desc}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
