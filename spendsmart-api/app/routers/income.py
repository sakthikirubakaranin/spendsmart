"""
Manual income CRUD endpoints.
"""
from __future__ import annotations

import calendar
import uuid
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.income import Income
from app.models.user import User

router = APIRouter(prefix="/income", tags=["income"])

SALARY_LAST_DAYS = 3


def _period_month(txn_date: date, income_type: str) -> date:
    last_day = calendar.monthrange(txn_date.year, txn_date.month)[1]
    if income_type == "salary" and txn_date.day >= last_day - SALARY_LAST_DAYS + 1:
        if txn_date.month == 12:
            return date(txn_date.year + 1, 1, 1)
        return date(txn_date.year, txn_date.month + 1, 1)
    return date(txn_date.year, txn_date.month, 1)


# ── Schemas ───────────────────────────────────────────────────────────────────

class IncomeCreate(BaseModel):
    date: date
    amount: float
    description: str
    income_type: str = "salary"   # salary|freelance|refund|transfer|government|other


class IncomeUpdate(BaseModel):
    date: Optional[date] = None
    amount: Optional[float] = None
    description: Optional[str] = None
    income_type: Optional[str] = None


class IncomeOut(BaseModel):
    id: str
    date: date
    period_month: Optional[date]
    amount: float
    description: str
    income_type: str
    source: str
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_model(cls, m: Income) -> "IncomeOut":
        return cls(
            id=str(m.id),
            date=m.date,
            period_month=m.period_month,
            amount=float(m.amount),
            description=m.description,
            income_type=m.income_type,
            source=m.source,
            created_at=m.created_at,
        )


class IncomeListResponse(BaseModel):
    items: list[IncomeOut]
    total: int
    page: int
    per_page: int
    pages: int


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=IncomeListResponse)
async def list_income(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    income_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Income).where(Income.user_id == current_user.id)
    if from_date:
        q = q.where(Income.date >= from_date)
    if to_date:
        q = q.where(Income.date <= to_date)
    if income_type:
        q = q.where(Income.income_type == income_type)

    total_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(total_q)).scalar_one()

    q = q.order_by(Income.date.desc()).offset((page - 1) * per_page).limit(per_page)
    rows = (await db.execute(q)).scalars().all()

    return IncomeListResponse(
        items=[IncomeOut.from_orm_model(r) for r in rows],
        total=total,
        page=page,
        per_page=per_page,
        pages=max(1, -(-total // per_page)),
    )


@router.post("", response_model=IncomeOut, status_code=status.HTTP_201_CREATED)
async def create_income(
    body: IncomeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    period = _period_month(body.date, body.income_type)
    entry = Income(
        id=uuid.uuid4(),
        user_id=current_user.id,
        date=body.date,
        period_month=period,
        amount=body.amount,
        description=body.description,
        income_type=body.income_type,
        source="manual",
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return IncomeOut.from_orm_model(entry)


@router.put("/{income_id}", response_model=IncomeOut)
async def update_income(
    income_id: str,
    body: IncomeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Income).where(Income.id == uuid.UUID(income_id), Income.user_id == current_user.id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Income entry not found")

    if body.date is not None:
        entry.date = body.date
    if body.amount is not None:
        entry.amount = body.amount
    if body.description is not None:
        entry.description = body.description
    if body.income_type is not None:
        entry.income_type = body.income_type

    # Recalculate period_month
    entry.period_month = _period_month(entry.date, entry.income_type)
    await db.commit()
    await db.refresh(entry)
    return IncomeOut.from_orm_model(entry)


@router.delete("/{income_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_income(
    income_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Income).where(Income.id == uuid.UUID(income_id), Income.user_id == current_user.id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Income entry not found")
    await db.delete(entry)
    await db.commit()
