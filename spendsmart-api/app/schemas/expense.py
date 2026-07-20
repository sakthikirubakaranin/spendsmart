import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, field_validator


class CategoryOut(BaseModel):
    id: int
    slug: str
    name: str
    icon: Optional[str] = None
    model_config = {"from_attributes": True}


class ExpenseCreate(BaseModel):
    date: date
    amount: float
    description: str
    category_id: Optional[int] = None
    sub_category_id: Optional[int] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Amount must be greater than zero")
        return v

    @field_validator("description")
    @classmethod
    def desc_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Description cannot be empty")
        return v.strip()


class ExpenseUpdate(BaseModel):
    date: Optional[date] = None
    amount: Optional[float] = None
    description: Optional[str] = None
    category_id: Optional[int] = None
    sub_category_id: Optional[int] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None


class ExpenseOut(BaseModel):
    id: uuid.UUID
    date: date
    amount: float
    description: str
    category: Optional[CategoryOut] = None
    sub_category: Optional[CategoryOut] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    source: str
    category_confidence: Optional[int] = None
    is_deleted: bool
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class ExpenseListResponse(BaseModel):
    items: list[ExpenseOut]
    total: int
    page: int
    per_page: int
    pages: int


class BulkExpenseCreate(BaseModel):
    expenses: list[ExpenseCreate]
