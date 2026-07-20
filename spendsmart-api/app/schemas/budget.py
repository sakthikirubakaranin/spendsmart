import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, field_validator

from app.schemas.expense import CategoryOut


class BudgetIn(BaseModel):
    category_id: int
    amount: float
    rollover: bool = False

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Budget amount cannot be negative")
        return v


class BulkBudgetUpsert(BaseModel):
    """Upsert all budgets for a given month in one call."""
    month: date  # client sends YYYY-MM-01
    budgets: list[BudgetIn]


class BudgetOut(BaseModel):
    id: uuid.UUID
    category_id: int
    category: Optional[CategoryOut] = None
    month: date
    amount: float
    rollover: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class CopyBudgetsRequest(BaseModel):
    from_month: date   # source month
    to_month: date     # destination month
