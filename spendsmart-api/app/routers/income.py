"""
Manual income CRUD + analytics endpoints.
"""
from __future__ import annotations

import calendar
import uuid
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import extract, func, select, text
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


class IncomeSummary(BaseModel):
    this_month_total: float
    last_month_total: float
    ytd_total: float
    avg_monthly: float
    this_month_count: int
    ytd_count: int


class IncomeByType(BaseModel):
    income_type: str
    total: float
    count: int
    pct: float


class IncomeMonthlyTrend(BaseModel):
    year: int
    month: int
    total: float
    count: int


# ── Helpers ───────────────────────────────────────────────────────────────────

def _month_range(year: int, month: int):
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day)


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


# ── Analytics ─────────────────────────────────────────────────────────────────

@router.get("/summary", response_model=IncomeSummary)
async def income_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    tm_start, tm_end = _month_range(today.year, today.month)

    lm_year = today.year if today.month > 1 else today.year - 1
    lm_month = today.month - 1 if today.month > 1 else 12
    lm_start, lm_end = _month_range(lm_year, lm_month)

    ytd_start = date(today.year, 1, 1)

    uid = current_user.id

    def _sum_q(from_d, to_d):
        return select(
            func.coalesce(func.sum(Income.amount), 0).label("total"),
            func.count(Income.id).label("cnt"),
        ).where(
            Income.user_id == uid,
            Income.date >= from_d,
            Income.date <= to_d,
        )

    tm = (await db.execute(_sum_q(tm_start, tm_end))).one()
    lm = (await db.execute(_sum_q(lm_start, lm_end))).one()
    ytd = (await db.execute(_sum_q(ytd_start, today))).one()

    # Average over months that actually have income
    months_with_income_q = select(func.count()).select_from(
        select(
            extract("year", Income.date).label("y"),
            extract("month", Income.date).label("m"),
        )
        .where(Income.user_id == uid)
        .group_by("y", "m")
        .subquery()
    )
    months_count = (await db.execute(months_with_income_q)).scalar_one() or 1
    all_total_q = select(func.coalesce(func.sum(Income.amount), 0)).where(Income.user_id == uid)
    all_total = (await db.execute(all_total_q)).scalar_one()

    return IncomeSummary(
        this_month_total=float(tm.total),
        last_month_total=float(lm.total),
        ytd_total=float(ytd.total),
        avg_monthly=float(all_total) / months_count,
        this_month_count=int(tm.cnt),
        ytd_count=int(ytd.cnt),
    )


@router.get("/by-type", response_model=list[IncomeByType])
async def income_by_type(
    year: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    yr = year or today.year
    from_d = date(yr, 1, 1)
    to_d = date(yr, 12, 31)

    q = (
        select(
            Income.income_type,
            func.sum(Income.amount).label("total"),
            func.count(Income.id).label("cnt"),
        )
        .where(
            Income.user_id == current_user.id,
            Income.date >= from_d,
            Income.date <= to_d,
        )
        .group_by(Income.income_type)
        .order_by(func.sum(Income.amount).desc())
    )
    rows = (await db.execute(q)).all()
    grand = sum(float(r.total) for r in rows) or 1
    return [
        IncomeByType(
            income_type=r.income_type,
            total=float(r.total),
            count=int(r.cnt),
            pct=round(float(r.total) / grand * 100, 1),
        )
        for r in rows
    ]


@router.get("/monthly-trend", response_model=list[IncomeMonthlyTrend])
async def income_monthly_trend(
    months: int = Query(12, ge=1, le=36),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()

    # Build list of N months going back from current month
    result_months = []
    for i in range(months - 1, -1, -1):
        m = today.month - i
        y = today.year
        while m <= 0:
            m += 12
            y -= 1
        result_months.append((y, m))

    from_d = date(result_months[0][0], result_months[0][1], 1)

    q = (
        select(
            extract("year", Income.date).label("y"),
            extract("month", Income.date).label("m"),
            func.sum(Income.amount).label("total"),
            func.count(Income.id).label("cnt"),
        )
        .where(
            Income.user_id == current_user.id,
            Income.date >= from_d,
            Income.date <= today,
        )
        .group_by("y", "m")
    )
    db_rows = {(int(r.y), int(r.m)): r for r in (await db.execute(q)).all()}

    return [
        IncomeMonthlyTrend(
            year=y,
            month=m,
            total=float(db_rows[(y, m)].total) if (y, m) in db_rows else 0.0,
            count=int(db_rows[(y, m)].cnt) if (y, m) in db_rows else 0,
        )
        for y, m in result_months
    ]
