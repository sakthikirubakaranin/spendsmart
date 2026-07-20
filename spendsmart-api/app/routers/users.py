"""
User profile management.

GET    /users/profile         — current user's profile + account stats
PUT    /users/profile         — update full_name / monthly_income
PUT    /users/change-password — change password (requires current_password)
DELETE /users/account         — hard-delete current user + all their data (cascades)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import hash_password, verify_password
from app.models.expense import Expense
from app.models.income import Income
from app.models.user import User

router = APIRouter(prefix="/users", tags=["users"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class ProfileOut(BaseModel):
    id: str
    full_name: str
    email: str
    monthly_income: float | None
    is_verified: bool
    created_at: datetime
    expense_count: int
    income_count: int


class UpdateProfileRequest(BaseModel):
    full_name: str | None = None
    monthly_income: float | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class MessageResponse(BaseModel):
    message: str


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _build_profile(user: User, db: AsyncSession) -> ProfileOut:
    exp_result = await db.execute(
        select(func.count()).select_from(Expense).where(Expense.user_id == user.id)
    )
    inc_result = await db.execute(
        select(func.count()).select_from(Income).where(Income.user_id == user.id)
    )
    return ProfileOut(
        id=str(user.id),
        full_name=user.full_name,
        email=user.email,
        monthly_income=float(user.monthly_income) if user.monthly_income is not None else None,
        is_verified=user.is_verified,
        created_at=user.created_at,
        expense_count=exp_result.scalar() or 0,
        income_count=inc_result.scalar() or 0,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/profile", response_model=ProfileOut)
async def get_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _build_profile(current_user, db)


@router.put("/profile", response_model=ProfileOut)
async def update_profile(
    body: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.full_name is not None:
        name = body.full_name.strip()
        if not name:
            raise HTTPException(status_code=422, detail="Full name cannot be empty")
        current_user.full_name = name

    if body.monthly_income is not None:
        if body.monthly_income < 0:
            raise HTTPException(status_code=422, detail="Monthly income cannot be negative")
        current_user.monthly_income = body.monthly_income

    await db.commit()
    await db.refresh(current_user)
    return await _build_profile(current_user, db)


@router.put("/change-password", response_model=MessageResponse)
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if len(body.new_password) < 8:
        raise HTTPException(status_code=422, detail="New password must be at least 8 characters")

    if body.new_password == body.current_password:
        raise HTTPException(status_code=422, detail="New password must be different from your current password")

    current_user.password_hash = hash_password(body.new_password)
    await db.commit()
    return MessageResponse(message="Password changed successfully")


@router.delete("/account", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Hard-delete the current user. SQLAlchemy cascade removes all related data."""
    await db.delete(current_user)
    await db.commit()
