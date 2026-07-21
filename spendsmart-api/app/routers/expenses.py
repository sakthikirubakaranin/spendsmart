import hashlib
import math
import uuid
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.expense import Expense
from app.models.user import User
from app.schemas.expense import (
    BulkExpenseCreate,
    ExpenseCreate,
    ExpenseListResponse,
    ExpenseOut,
    ExpenseUpdate,
)

router = APIRouter(prefix="/expenses", tags=["expenses"])


def _narration_hash(date_: date, amount: float, description: str) -> str:
    raw = f"{date_}|{amount}|{description[:50].upper().strip()}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _expense_query(user_id: uuid.UUID):
    return (
        select(Expense)
        .where(Expense.user_id == user_id, Expense.is_deleted == False)
        .options(
            selectinload(Expense.category),
            selectinload(Expense.sub_category),
            selectinload(Expense.bank_account),
        )
    )


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=ExpenseListResponse)
async def list_expenses(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    category_id: Optional[int] = None,
    payment_method: Optional[str] = None,
    source: Optional[str] = None,
    search: Optional[str] = None,
    sort: str = Query("date_desc", pattern="^(date_asc|date_desc|amount_asc|amount_desc)$"),
    uncategorized: bool = False,
    bank_account_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = _expense_query(current_user.id)

    if from_date:
        q = q.where(Expense.date >= from_date)
    if to_date:
        q = q.where(Expense.date <= to_date)
    if uncategorized:
        q = q.where(Expense.category_id == None)
    elif category_id:
        q = q.where(Expense.category_id == category_id)
    if payment_method:
        q = q.where(Expense.payment_method == payment_method)
    if source:
        q = q.where(Expense.source == source)
    if search:
        q = q.where(Expense.description.ilike(f"%{search}%"))
    if bank_account_id:
        q = q.where(Expense.bank_account_id == bank_account_id)

    sort_map = {
        "date_desc": Expense.date.desc(),
        "date_asc": Expense.date.asc(),
        "amount_desc": Expense.amount.desc(),
        "amount_asc": Expense.amount.asc(),
    }
    q = q.order_by(sort_map[sort])

    # Count and sum before pagination
    sub = q.subquery()
    total_result = await db.execute(select(func.count()).select_from(sub))
    total = total_result.scalar_one()

    amount_result = await db.execute(
        select(func.coalesce(func.sum(Expense.amount), 0.0))
        .where(Expense.id.in_(select(sub.c.id)))
    )
    total_amount = float(amount_result.scalar_one())

    q = q.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(q)
    items = result.scalars().all()

    return ExpenseListResponse(
        items=items,
        total=total,
        total_amount=total_amount,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 1,
    )


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED)
async def create_expense(
    body: ExpenseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expense = Expense(
        user_id=current_user.id,
        narration_hash=_narration_hash(body.date, body.amount, body.description),
        **body.model_dump(),
    )
    db.add(expense)
    await db.commit()
    await db.refresh(expense)
    result = await db.execute(
        _expense_query(current_user.id).where(Expense.id == expense.id)
    )
    return result.scalar_one()


# ── Bulk create ───────────────────────────────────────────────────────────────

@router.post("/bulk", response_model=list[ExpenseOut], status_code=status.HTTP_201_CREATED)
async def bulk_create(
    body: BulkExpenseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expenses = [
        Expense(
            user_id=current_user.id,
            narration_hash=_narration_hash(e.date, e.amount, e.description),
            **e.model_dump(),
        )
        for e in body.expenses
    ]
    db.add_all(expenses)
    await db.commit()
    ids = [e.id for e in expenses]
    result = await db.execute(
        _expense_query(current_user.id).where(Expense.id.in_(ids))
    )
    return result.scalars().all()


# ── Get one ───────────────────────────────────────────────────────────────────

@router.get("/{expense_id}", response_model=ExpenseOut)
async def get_expense(
    expense_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        _expense_query(current_user.id).where(Expense.id == expense_id)
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return expense


# ── Update ────────────────────────────────────────────────────────────────────

@router.put("/{expense_id}", response_model=ExpenseOut)
async def update_expense(
    expense_id: uuid.UUID,
    body: ExpenseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        _expense_query(current_user.id).where(Expense.id == expense_id)
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(expense, field, value)

    await db.commit()
    result = await db.execute(
        _expense_query(current_user.id).where(Expense.id == expense_id)
    )
    return result.scalar_one()


# ── Soft delete ───────────────────────────────────────────────────────────────

@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(
    expense_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        _expense_query(current_user.id).where(Expense.id == expense_id)
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    expense.is_deleted = True
    expense.deleted_at = datetime.now(timezone.utc)
    await db.commit()


# ── Bulk categorize ───────────────────────────────────────────────────────────
# Used by the "Fix similar" UI: set a category on all uncategorized expenses
# that share the same description keyword, or on a specific list of IDs.

class BulkCategorizeRequest(BaseModel):
    category_id: int | None                   # null = uncategorize
    expense_ids: list[uuid.UUID] | None = None # specific IDs
    description_contains: str | None = None   # keyword match
    all_matching: bool = False                # if True, match all (not just uncategorized)


class BulkCategorizeResponse(BaseModel):
    updated: int


@router.post("/bulk-categorize", response_model=BulkCategorizeResponse)
async def bulk_categorize(
    body: BulkCategorizeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not body.expense_ids and not body.description_contains:
        raise HTTPException(status_code=422, detail="Provide expense_ids or description_contains")

    q = (
        update(Expense)
        .where(Expense.user_id == current_user.id, Expense.is_deleted == False)
        .values(category_id=body.category_id)
    )

    if body.expense_ids:
        q = q.where(Expense.id.in_(body.expense_ids))
    else:
        q = q.where(Expense.description.ilike(f"%{body.description_contains}%"))
        if not body.all_matching:
            # Default: only match uncategorized expenses
            q = q.where(Expense.category_id == None)

    result = await db.execute(q)
    await db.commit()
    return BulkCategorizeResponse(updated=result.rowcount)


# ── Restore ───────────────────────────────────────────────────────────────────

@router.post("/{expense_id}/restore", response_model=ExpenseOut)
async def restore_expense(
    expense_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Expense)
        .where(Expense.id == expense_id, Expense.user_id == current_user.id, Expense.is_deleted == True)
        .options(selectinload(Expense.category), selectinload(Expense.sub_category))
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Deleted expense not found")

    expense.is_deleted = False
    expense.deleted_at = None
    await db.commit()
    return expense
