"""
Recurring expense management.

GET    /recurring           — list all (active + inactive)
POST   /recurring           — create a new recurring expense
PUT    /recurring/{id}      — update description, amount, category, frequency, etc.
DELETE /recurring/{id}      — hard delete
POST   /recurring/{id}/mark-paid — mark as paid:
                                   • creates an Expense record (today's date)
                                   • advances next_due_date by frequency
"""

from __future__ import annotations

import calendar
import uuid
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.category import Category
from app.models.expense import Expense
from app.models.recurring_expense import RecurringExpense
from app.models.user import User

router = APIRouter(prefix="/recurring", tags=["recurring"])

FREQUENCIES = {"weekly", "monthly", "quarterly", "yearly"}


# ── Schemas ───────────────────────────────────────────────────────────────────

class RecurringIn(BaseModel):
    description: str
    amount: float
    category_id: int | None = None
    payment_method: str | None = "UPI"
    frequency: str = "monthly"          # weekly | monthly | quarterly
    day_of_month: int | None = None     # 1–28 (used for monthly/quarterly)
    next_due_date: date
    is_active: bool = True


class RecurringUpdate(BaseModel):
    description: str | None = None
    amount: float | None = None
    category_id: int | None = None
    payment_method: str | None = None
    frequency: str | None = None
    day_of_month: int | None = None
    next_due_date: date | None = None
    is_active: bool | None = None


class CategoryOut(BaseModel):
    id: int
    name: str
    slug: str
    icon: str | None

    model_config = {"from_attributes": True}


class RecurringOut(BaseModel):
    id: str
    description: str
    amount: float
    category: CategoryOut | None
    payment_method: str | None
    frequency: str
    day_of_month: int | None
    next_due_date: date
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class MarkPaidResponse(BaseModel):
    expense_id: str
    next_due_date: date


# ── Helpers ───────────────────────────────────────────────────────────────────

def _advance_due_date(current: date, frequency: str, day_of_month: int | None) -> date:
    """Calculate next_due_date after marking paid."""
    if frequency == "weekly":
        return current + timedelta(weeks=1)

    elif frequency == "monthly":
        # Move to same day next month
        m = current.month + 1
        y = current.year
        if m > 12:
            m, y = 1, y + 1
        dom = day_of_month or current.day
        dom = min(dom, calendar.monthrange(y, m)[1])   # clamp for Feb etc.
        return date(y, m, dom)

    elif frequency == "quarterly":
        # 3 months forward
        m = current.month + 3
        y = current.year + (m - 1) // 12
        m = (m - 1) % 12 + 1
        dom = day_of_month or current.day
        dom = min(dom, calendar.monthrange(y, m)[1])
        return date(y, m, dom)

    elif frequency == "yearly":
        y = current.year + 1
        dom = day_of_month or current.day
        dom = min(dom, calendar.monthrange(y, current.month)[1])
        return date(y, current.month, dom)

    return current + timedelta(days=30)     # fallback


def _to_out(rec: RecurringExpense) -> RecurringOut:
    return RecurringOut(
        id=str(rec.id),
        description=rec.description,
        amount=float(rec.amount),
        category=CategoryOut(
            id=rec.category.id,
            name=rec.category.name,
            slug=rec.category.slug,
            icon=rec.category.icon,
        ) if rec.category else None,
        payment_method=rec.payment_method,
        frequency=rec.frequency,
        day_of_month=rec.day_of_month,
        next_due_date=rec.next_due_date,
        is_active=rec.is_active,
        created_at=rec.created_at,
    )


async def _get_rec(rec_id: str, user_id, db: AsyncSession) -> RecurringExpense:
    result = await db.execute(
        select(RecurringExpense)
        .options(selectinload(RecurringExpense.category))
        .where(RecurringExpense.id == uuid.UUID(rec_id), RecurringExpense.user_id == user_id)
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Recurring expense not found")
    return rec


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[RecurringOut])
async def list_recurring(
    active_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(RecurringExpense)
        .options(selectinload(RecurringExpense.category))
        .where(RecurringExpense.user_id == current_user.id)
    )
    if active_only:
        q = q.where(RecurringExpense.is_active == True)
    q = q.order_by(RecurringExpense.next_due_date.asc())
    result = await db.execute(q)
    return [_to_out(r) for r in result.scalars().all()]


@router.post("", response_model=RecurringOut, status_code=status.HTTP_201_CREATED)
async def create_recurring(
    body: RecurringIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.frequency not in FREQUENCIES:
        raise HTTPException(status_code=422, detail=f"frequency must be one of: {', '.join(FREQUENCIES)}")
    if body.amount <= 0:
        raise HTTPException(status_code=422, detail="amount must be positive")

    rec = RecurringExpense(
        id=uuid.uuid4(),
        user_id=current_user.id,
        description=body.description.strip(),
        amount=body.amount,
        category_id=body.category_id,
        payment_method=body.payment_method,
        frequency=body.frequency,
        day_of_month=body.day_of_month,
        next_due_date=body.next_due_date,
        is_active=body.is_active,
    )
    db.add(rec)
    await db.commit()

    # Re-fetch with category
    result = await db.execute(
        select(RecurringExpense)
        .options(selectinload(RecurringExpense.category))
        .where(RecurringExpense.id == rec.id)
    )
    return _to_out(result.scalar_one())


@router.put("/{rec_id}", response_model=RecurringOut)
async def update_recurring(
    rec_id: str,
    body: RecurringUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rec = await _get_rec(rec_id, current_user.id, db)

    if body.description is not None:
        rec.description = body.description.strip()
    if body.amount is not None:
        if body.amount <= 0:
            raise HTTPException(status_code=422, detail="amount must be positive")
        rec.amount = body.amount
    if body.category_id is not None:
        rec.category_id = body.category_id
    if body.payment_method is not None:
        rec.payment_method = body.payment_method
    if body.frequency is not None:
        if body.frequency not in FREQUENCIES:
            raise HTTPException(status_code=422, detail=f"frequency must be one of: {', '.join(FREQUENCIES)}")
        rec.frequency = body.frequency
    if body.day_of_month is not None:
        rec.day_of_month = body.day_of_month
    if body.next_due_date is not None:
        rec.next_due_date = body.next_due_date
    if body.is_active is not None:
        rec.is_active = body.is_active

    await db.commit()

    result = await db.execute(
        select(RecurringExpense)
        .options(selectinload(RecurringExpense.category))
        .where(RecurringExpense.id == rec.id)
    )
    return _to_out(result.scalar_one())


@router.delete("/{rec_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recurring(
    rec_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rec = await _get_rec(rec_id, current_user.id, db)
    await db.delete(rec)
    await db.commit()


@router.post("/{rec_id}/mark-paid", response_model=MarkPaidResponse)
async def mark_paid(
    rec_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Mark a recurring expense as paid:
    1. Create an Expense record dated today with the recurring details.
    2. Advance next_due_date by the frequency period.
    """
    rec = await _get_rec(rec_id, current_user.id, db)

    if not rec.is_active:
        raise HTTPException(status_code=400, detail="Recurring expense is inactive")

    today = date.today()
    expense = Expense(
        id=uuid.uuid4(),
        user_id=current_user.id,
        date=today,
        amount=rec.amount,
        description=rec.description,
        category_id=rec.category_id,
        payment_method=rec.payment_method or "UPI",
        source="recurring",
        recurring_id=rec.id,
        notes=f"Auto-logged from recurring ({rec.frequency})",
    )
    db.add(expense)

    rec.next_due_date = _advance_due_date(rec.next_due_date, rec.frequency, rec.day_of_month)
    await db.commit()

    return MarkPaidResponse(expense_id=str(expense.id), next_due_date=rec.next_due_date)
