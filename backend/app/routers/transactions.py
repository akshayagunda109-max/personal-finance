"""Transaction listing, AI categorization, and per-account summaries.

Every endpoint is scoped to the authenticated user - an account id belonging
to someone else reads as "not found".
"""
from collections import Counter, defaultdict
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, get_owned_account
from app.models import Account, Transaction, User
from app.schemas.transaction import (
    CategorizeResponse,
    CategoryBreakdownEntry,
    CategoryInsightResponse,
    CategorySummaryResponse,
    MonthlySummaryEntry,
    MonthlySummaryResponse,
    TransactionCategoryUpdate,
    TransactionRead,
)
from app.services.categorizer import categorize_batch
from app.services.insights import generate_category_insight

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


@router.get("", response_model=list[TransactionRead])
def list_transactions(
    account_id: int | None = Query(default=None),
    category: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = (
        select(Transaction)
        .join(Account, Transaction.account_id == Account.id)
        .where(Account.user_id == user.id)
        .order_by(Transaction.date.desc())
    )
    if account_id is not None:
        get_owned_account(account_id, user, db)
        stmt = stmt.where(Transaction.account_id == account_id)
    if category is not None:
        stmt = stmt.where(Transaction.category == category)
    return db.execute(stmt).scalars().all()


@router.post("/categorize", response_model=CategorizeResponse)
def categorize_transactions(
    account_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Classify (and derive a display name for) transactions missing either
    field, via the Gemini API. Rows that already have both a category and a
    display name are left untouched - including ones a user manually
    recategorized, so a later re-run never overwrites that choice."""
    get_owned_account(account_id, user, db)

    stmt = select(Transaction).where(
        Transaction.account_id == account_id,
        or_(Transaction.category.is_(None), Transaction.display_name.is_(None)),
    )
    pending = db.execute(stmt).scalars().all()

    if not pending:
        return CategorizeResponse(categorized=0, breakdown={})

    pairs = [(t.id, t.description) for t in pending]
    classifications = categorize_batch(pairs)

    by_id = {t.id: t for t in pending}
    counts: Counter[str] = Counter()
    totals: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    for txn_id, classification in classifications.items():
        txn = by_id[txn_id]
        txn.category = classification.category
        txn.display_name = classification.display_name
        counts[classification.category] += 1
        totals[classification.category] += txn.amount

    db.commit()
    breakdown = {
        category: CategoryBreakdownEntry(count=counts[category], total_amount=totals[category])
        for category in counts
    }
    return CategorizeResponse(categorized=len(classifications), breakdown=breakdown)


@router.patch("/{transaction_id}", response_model=TransactionRead)
def update_transaction_category(
    transaction_id: int,
    payload: TransactionCategoryUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Manually override a transaction's category - either one of the built-in
    categories or a user-defined one (validation just guards against blank/
    oversized names; the fixed set is only enforced for AI auto-categorization)."""
    txn = db.get(Transaction, transaction_id)
    if txn is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    # Ownership lives on the parent account, so check it there.
    get_owned_account(txn.account_id, user, db)

    txn.category = payload.category
    db.commit()
    db.refresh(txn)
    return txn


@router.get("/category-summary", response_model=CategorySummaryResponse)
def category_summary(
    account_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Category totals across every categorized transaction in the account,
    regardless of when it was imported or categorized - so re-uploading an
    already-imported statement still shows the account's full breakdown."""
    get_owned_account(account_id, user, db)

    stmt = select(Transaction).where(
        Transaction.account_id == account_id, Transaction.category.isnot(None)
    )
    transactions = db.execute(stmt).scalars().all()

    counts: Counter[str] = Counter()
    totals: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    for txn in transactions:
        counts[txn.category] += 1
        totals[txn.category] += txn.amount

    breakdown = {
        category: CategoryBreakdownEntry(count=counts[category], total_amount=totals[category])
        for category in counts
    }
    return CategorySummaryResponse(total_transactions=len(transactions), breakdown=breakdown)


@router.get("/monthly-summary", response_model=MonthlySummaryResponse)
def monthly_summary(
    account_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Total spend and income per calendar month, for a spending-over-time trend."""
    get_owned_account(account_id, user, db)

    stmt = select(Transaction).where(Transaction.account_id == account_id)
    transactions = db.execute(stmt).scalars().all()

    buckets: dict[str, dict[str, Decimal]] = defaultdict(
        lambda: {"spend": Decimal("0"), "income": Decimal("0")}
    )
    for txn in transactions:
        key = f"{txn.date.year:04d}-{txn.date.month:02d}"
        if txn.amount < 0:
            buckets[key]["spend"] += -txn.amount
        else:
            buckets[key]["income"] += txn.amount

    months = [
        MonthlySummaryEntry(month=month, total_spend=values["spend"], total_income=values["income"])
        for month, values in sorted(buckets.items())
    ]
    return MonthlySummaryResponse(months=months)


@router.get("/category-insight", response_model=CategoryInsightResponse)
def category_insight(
    account_id: int,
    category: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """AI-generated summary of what's driving one category: merchants, notable
    transactions, timing patterns."""
    get_owned_account(account_id, user, db)

    stmt = select(Transaction).where(
        Transaction.account_id == account_id, Transaction.category == category
    ).order_by(Transaction.date)
    transactions = db.execute(stmt).scalars().all()

    if not transactions:
        return CategoryInsightResponse(
            category=category, transaction_count=0, summary="No transactions in this category yet."
        )

    payload = [
        {"date": t.date.isoformat(), "description": t.description, "amount": str(t.amount)}
        for t in transactions
    ]
    summary = generate_category_insight(category, payload)
    return CategoryInsightResponse(category=category, transaction_count=len(transactions), summary=summary)
