from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.budget import Budget
from app.models.user import User
from app.schemas.budget import BudgetOut, BulkBudgetUpsert, CopyBudgetsRequest

router = APIRouter(prefix="/budgets", tags=["budgets"])


def _month_start(d: date) -> date:
    return date(d.year, d.month, 1)


async def _fetch_budgets(db: AsyncSession, user_id, month: date) -> list[Budget]:
    result = await db.execute(
        select(Budget)
        .where(Budget.user_id == user_id, Budget.month == _month_start(month))
        .options(selectinload(Budget.category))
        .order_by(Budget.category_id)
    )
    return result.scalars().all()


# ── Get budgets for a month ────────────────────────────────────────────────────

@router.get("", response_model=list[BudgetOut])
async def get_budgets(
    month: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not month:
        today = date.today()
        month = date(today.year, today.month, 1)
    return await _fetch_budgets(db, current_user.id, month)


# ── Upsert all budgets for a month ────────────────────────────────────────────

@router.put("", response_model=list[BudgetOut])
async def upsert_budgets(
    body: BulkBudgetUpsert,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    month = _month_start(body.month)

    for b in body.budgets:
        stmt = (
            pg_insert(Budget)
            .values(
                user_id=current_user.id,
                category_id=b.category_id,
                month=month,
                amount=b.amount,
                rollover=b.rollover,
            )
            .on_conflict_do_update(
                index_elements=["user_id", "category_id", "month"],
                set_={"amount": b.amount, "rollover": b.rollover},
            )
        )
        await db.execute(stmt)

    await db.commit()
    return await _fetch_budgets(db, current_user.id, month)


# ── Copy budgets from one month to another ─────────────────────────────────────

@router.post("/copy", response_model=list[BudgetOut])
async def copy_budgets(
    body: CopyBudgetsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    source = await _fetch_budgets(db, current_user.id, body.from_month)
    to_month = _month_start(body.to_month)

    for b in source:
        stmt = (
            pg_insert(Budget)
            .values(
                user_id=current_user.id,
                category_id=b.category_id,
                month=to_month,
                amount=b.amount,
                rollover=b.rollover,
            )
            .on_conflict_do_update(
                index_elements=["user_id", "category_id", "month"],
                set_={"amount": b.amount, "rollover": b.rollover},
            )
        )
        await db.execute(stmt)

    await db.commit()
    return await _fetch_budgets(db, current_user.id, to_month)
