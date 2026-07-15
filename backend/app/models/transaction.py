"""Transaction ORM model."""
from datetime import date as date_type
from datetime import datetime
from decimal import Decimal

from sqlalchemy import JSON, Date, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date: Mapped[date_type] = mapped_column(Date, nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    source_file: Mapped[str] = mapped_column(String(255), nullable=False)
    # Hash of (account, date, amount, normalized description) - guards against re-importing the same row.
    dedup_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    raw_row: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    category: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    # Short human-readable name (e.g. "Swiggy") derived from the raw bank
    # description (e.g. "UPI/P2M/.../Swiggy Limited/UPI/AXIS BANK") by the AI
    # categorizer, so the UI doesn't have to show cryptic UPI strings.
    display_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    account: Mapped["Account"] = relationship(back_populates="transactions")
