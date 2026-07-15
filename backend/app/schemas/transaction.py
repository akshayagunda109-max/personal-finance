"""Transaction response schemas."""
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    date: date
    description: str
    display_name: str | None
    amount: Decimal
    currency: str
    source_file: str
    category: str | None
    created_at: datetime


class TransactionCategoryUpdate(BaseModel):
    # Any user-defined name is allowed (not just the built-in set) - capped to
    # match the transactions.category column width.
    category: str = Field(min_length=1, max_length=40)

    @field_validator("category")
    @classmethod
    def strip_category(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("category cannot be blank")
        return stripped


class CategoryBreakdownEntry(BaseModel):
    count: int
    total_amount: Decimal


class CategorizeResponse(BaseModel):
    categorized: int
    breakdown: dict[str, CategoryBreakdownEntry]


class CategorySummaryResponse(BaseModel):
    total_transactions: int
    breakdown: dict[str, CategoryBreakdownEntry]


class MonthlySummaryEntry(BaseModel):
    month: str  # YYYY-MM
    total_spend: Decimal  # positive - money out
    total_income: Decimal  # positive - money in


class MonthlySummaryResponse(BaseModel):
    months: list[MonthlySummaryEntry]


class CategoryInsightResponse(BaseModel):
    category: str
    transaction_count: int
    summary: str
