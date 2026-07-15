"""Account request/response schemas."""
from pydantic import BaseModel, ConfigDict


class AccountCreate(BaseModel):
    name: str
    institution: str | None = None
    currency: str = "USD"


class AccountRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    institution: str | None
    currency: str
