"""
Bank accounts endpoints.

GET    /bank-accounts          — list user's accounts
POST   /bank-accounts          — create account
PATCH  /bank-accounts/{id}     — update account
DELETE /bank-accounts/{id}     — soft-delete (set is_active=False)
POST   /bank-accounts/{id}/set-default — make this the default account
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.bank_account import BankAccount
from app.models.user import User

router = APIRouter(prefix="/bank-accounts", tags=["bank-accounts"])

ACCOUNT_TYPES = {"savings", "current", "credit_card", "wallet"}


# ── Schemas ───────────────────────────────────────────────────────────────────

class BankAccountCreate(BaseModel):
    name: str
    bank_name: str
    account_type: str = "savings"
    last_4_digits: Optional[str] = None
    color: str = "#8b5cf6"
    icon: str = "🏦"
    is_default: bool = False


class BankAccountUpdate(BaseModel):
    name: Optional[str] = None
    bank_name: Optional[str] = None
    account_type: Optional[str] = None
    last_4_digits: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    is_default: Optional[bool] = None


class BankAccountOut(BaseModel):
    id: uuid.UUID
    name: str
    bank_name: str
    account_type: str
    last_4_digits: Optional[str] = None
    color: str
    icon: str
    is_default: bool
    is_active: bool
    expense_count: int = 0

    model_config = {"from_attributes": True}


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_account(account_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> BankAccount:
    stmt = select(BankAccount).where(
        BankAccount.id == account_id,
        BankAccount.user_id == user_id,
        BankAccount.is_active == True,
    )
    result = await db.execute(stmt)
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    return account


async def _clear_default(user_id: uuid.UUID, db: AsyncSession) -> None:
    """Remove is_default from all accounts for this user."""
    from sqlalchemy import update as sa_update
    await db.execute(
        sa_update(BankAccount)
        .where(BankAccount.user_id == user_id)
        .values(is_default=False)
    )


async def _expense_count(account_id: uuid.UUID, db: AsyncSession) -> int:
    from sqlalchemy import text
    row = await db.execute(
        text("SELECT COUNT(*) FROM expenses WHERE bank_account_id=:aid AND is_deleted=false"),
        {"aid": str(account_id)},
    )
    return row.scalar_one() or 0


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[BankAccountOut])
async def list_accounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(BankAccount)
        .where(BankAccount.user_id == current_user.id, BankAccount.is_active == True)
        .order_by(BankAccount.is_default.desc(), BankAccount.created_at.asc())
    )
    result = await db.execute(stmt)
    accounts = result.scalars().all()

    out = []
    for acc in accounts:
        count = await _expense_count(acc.id, db)
        d = BankAccountOut.model_validate(acc)
        d.expense_count = count
        out.append(d)
    return out


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("", response_model=BankAccountOut, status_code=status.HTTP_201_CREATED)
async def create_account(
    body: BankAccountCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.account_type not in ACCOUNT_TYPES:
        raise HTTPException(status_code=422, detail=f"account_type must be one of {ACCOUNT_TYPES}")

    # If this is the first account or explicitly set as default, clear others
    if body.is_default:
        await _clear_default(current_user.id, db)
    else:
        # Auto-default if no accounts yet
        existing = await db.execute(
            select(BankAccount).where(
                BankAccount.user_id == current_user.id,
                BankAccount.is_active == True,
            ).limit(1)
        )
        if not existing.scalar_one_or_none():
            body = body.model_copy(update={"is_default": True})

    account = BankAccount(
        id=uuid.uuid4(),
        user_id=current_user.id,
        name=body.name.strip(),
        bank_name=body.bank_name.strip(),
        account_type=body.account_type,
        last_4_digits=body.last_4_digits,
        color=body.color,
        icon=body.icon,
        is_default=body.is_default,
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)

    d = BankAccountOut.model_validate(account)
    d.expense_count = 0
    return d


# ── Update ────────────────────────────────────────────────────────────────────

@router.patch("/{account_id}", response_model=BankAccountOut)
async def update_account(
    account_id: uuid.UUID,
    body: BankAccountUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account = await _get_account(account_id, current_user.id, db)

    if body.account_type and body.account_type not in ACCOUNT_TYPES:
        raise HTTPException(status_code=422, detail=f"account_type must be one of {ACCOUNT_TYPES}")

    if body.name is not None:
        account.name = body.name.strip()
    if body.bank_name is not None:
        account.bank_name = body.bank_name.strip()
    if body.account_type is not None:
        account.account_type = body.account_type
    if body.last_4_digits is not None:
        account.last_4_digits = body.last_4_digits
    if body.color is not None:
        account.color = body.color
    if body.icon is not None:
        account.icon = body.icon
    if body.is_default is True:
        await _clear_default(current_user.id, db)
        account.is_default = True

    await db.commit()
    await db.refresh(account)

    count = await _expense_count(account.id, db)
    d = BankAccountOut.model_validate(account)
    d.expense_count = count
    return d


# ── Set default ───────────────────────────────────────────────────────────────

@router.post("/{account_id}/set-default", response_model=BankAccountOut)
async def set_default(
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account = await _get_account(account_id, current_user.id, db)
    await _clear_default(current_user.id, db)
    account.is_default = True
    await db.commit()
    await db.refresh(account)

    count = await _expense_count(account.id, db)
    d = BankAccountOut.model_validate(account)
    d.expense_count = count
    return d


# ── Delete ────────────────────────────────────────────────────────────────────

@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account = await _get_account(account_id, current_user.id, db)
    account.is_active = False
    if account.is_default:
        account.is_default = False
        # Promote the oldest remaining account as default
        remaining = await db.execute(
            select(BankAccount)
            .where(
                BankAccount.user_id == current_user.id,
                BankAccount.is_active == True,
                BankAccount.id != account_id,
            )
            .order_by(BankAccount.created_at.asc())
            .limit(1)
        )
        next_acc = remaining.scalar_one_or_none()
        if next_acc:
            next_acc.is_default = True

    await db.commit()
