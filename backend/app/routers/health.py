"""Health-check endpoint that verifies the app and its database are reachable."""
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db

router = APIRouter(tags=["health"])


@router.get("/api/health")
def health(db: Session = Depends(get_db)) -> dict:
    """Return ok plus the result of a trivial DB query to prove connectivity."""
    db_ok = db.execute(text("SELECT 1")).scalar() == 1
    return {"status": "ok", "database": "connected" if db_ok else "error"}
