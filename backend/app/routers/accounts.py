"""Account endpoints - scoped to the authenticated user."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Account, User
from app.schemas.account import AccountCreate, AccountRead

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountRead])
def list_accounts(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stmt = select(Account).where(Account.user_id == user.id).order_by(Account.name)
    return db.execute(stmt).scalars().all()


@router.post("", response_model=AccountRead, status_code=201)
def create_account(
    payload: AccountCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    account = Account(**payload.model_dump(), user_id=user.id)
    db.add(account)
    db.commit()
    db.refresh(account)
    return account
