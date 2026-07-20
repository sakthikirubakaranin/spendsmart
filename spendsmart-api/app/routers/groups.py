from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.group import Group, GroupExpense, GroupExpenseSplit, GroupMember
from app.models.user import User

router = APIRouter(prefix="/groups", tags=["groups"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = None


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class MemberInvite(BaseModel):
    email: str


class SplitItem(BaseModel):
    user_id: UUID
    amount: Decimal


class ExpenseCreate(BaseModel):
    description: str
    amount: Decimal
    paid_by: UUID
    split_type: str = "equal"  # "equal" | "custom"
    splits: Optional[list[SplitItem]] = None  # required for custom
    expense_date: Optional[datetime] = None


class UserOut(BaseModel):
    id: UUID
    full_name: str
    email: str
    model_config = {"from_attributes": True}


class MemberOut(BaseModel):
    id: UUID
    user_id: UUID
    role: str
    joined_at: datetime
    user: UserOut
    model_config = {"from_attributes": True}


class SplitOut(BaseModel):
    id: UUID
    user_id: UUID
    amount: Decimal
    user: UserOut
    model_config = {"from_attributes": True}


class ExpenseOut(BaseModel):
    id: UUID
    description: str
    amount: Decimal
    split_type: str
    expense_date: datetime
    paid_by: UUID
    payer: UserOut
    splits: list[SplitOut]
    model_config = {"from_attributes": True}


class GroupOut(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    created_by: UUID
    created_at: datetime
    members: list[MemberOut]
    expenses: list[ExpenseOut]
    model_config = {"from_attributes": True}


class GroupListOut(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    created_by: UUID
    created_at: datetime
    member_count: int
    total_expenses: Decimal
    model_config = {"from_attributes": True}


class SettlementItem(BaseModel):
    from_user: UserOut
    to_user: UserOut
    amount: Decimal


class SettlementOut(BaseModel):
    settlements: list[SettlementItem]
    balances: dict  # user_id -> net balance


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_group_with_access(
    group_id: UUID,
    user: User,
    db: AsyncSession,
    require_admin: bool = False,
) -> Group:
    result = await db.execute(
        select(Group)
        .where(Group.id == group_id)
        .options(
            selectinload(Group.members).selectinload(GroupMember.user),
            selectinload(Group.expenses)
            .selectinload(GroupExpense.splits)
            .selectinload(GroupExpenseSplit.user),
            selectinload(Group.expenses).selectinload(GroupExpense.payer),
        )
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    member = next((m for m in group.members if m.user_id == user.id), None)
    if not member:
        raise HTTPException(status_code=403, detail="You are not a member of this group")
    if require_admin and member.role != "admin":
        raise HTTPException(status_code=403, detail="Only the group admin can do this")

    return group


def _calculate_settlement(
    members: list[GroupMember],
    expenses: list[GroupExpense],
) -> SettlementOut:
    """Debt simplification — O(n log n) greedy algorithm."""
    # net_balance[user_id] = total_paid - total_owed (positive = owed money back)
    net: dict[UUID, Decimal] = {m.user_id: Decimal("0") for m in members}
    user_map: dict[UUID, User] = {m.user_id: m.user for m in members}

    for exp in expenses:
        net[exp.paid_by] = net.get(exp.paid_by, Decimal("0")) + exp.amount
        for split in exp.splits:
            net[split.user_id] = net.get(split.user_id, Decimal("0")) - split.amount

    # Round to 2dp
    net = {k: round(v, 2) for k, v in net.items()}

    creditors = sorted(
        [(uid, bal) for uid, bal in net.items() if bal > 0],
        key=lambda x: x[1], reverse=True
    )
    debtors = sorted(
        [(uid, -bal) for uid, bal in net.items() if bal < 0],
        key=lambda x: x[1], reverse=True
    )

    settlements = []
    ci, di = 0, 0
    creditors = list(creditors)
    debtors = list(debtors)

    while ci < len(creditors) and di < len(debtors):
        cred_id, cred_amt = creditors[ci]
        debt_id, debt_amt = debtors[di]
        pay = min(cred_amt, debt_amt)
        if pay > Decimal("0.01"):
            settlements.append(SettlementItem(
                from_user=UserOut.model_validate(user_map[debt_id]),
                to_user=UserOut.model_validate(user_map[cred_id]),
                amount=round(pay, 2),
            ))
        creditors[ci] = (cred_id, cred_amt - pay)
        debtors[di] = (debt_id, debt_amt - pay)
        if creditors[ci][1] <= Decimal("0.01"):
            ci += 1
        if debtors[di][1] <= Decimal("0.01"):
            di += 1

    balances = {str(uid): float(bal) for uid, bal in net.items()}
    return SettlementOut(settlements=settlements, balances=balances)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_group(
    body: GroupCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = Group(
        name=body.name.strip(),
        description=body.description,
        created_by=current_user.id,
    )
    db.add(group)
    await db.flush()

    # Creator becomes admin
    db.add(GroupMember(group_id=group.id, user_id=current_user.id, role="admin"))
    await db.commit()
    await db.refresh(group)
    return {"id": str(group.id), "name": group.name, "message": "Group created"}


@router.get("")
async def list_groups(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Group)
        .join(GroupMember, GroupMember.group_id == Group.id)
        .where(GroupMember.user_id == current_user.id)
        .options(
            selectinload(Group.members),
            selectinload(Group.expenses),
        )
        .order_by(Group.created_at.desc())
    )
    groups = result.scalars().all()

    out = []
    for g in groups:
        total = sum(e.amount for e in g.expenses)
        out.append({
            "id": str(g.id),
            "name": g.name,
            "description": g.description,
            "created_by": str(g.created_by),
            "created_at": g.created_at.isoformat(),
            "member_count": len(g.members),
            "total_expenses": float(total),
        })
    return out


@router.get("/{group_id}")
async def get_group(
    group_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = await _get_group_with_access(group_id, current_user, db)
    return GroupOut.model_validate(group)


@router.patch("/{group_id}")
async def update_group(
    group_id: UUID,
    body: GroupUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = await _get_group_with_access(group_id, current_user, db, require_admin=True)
    if body.name is not None:
        group.name = body.name.strip()
    if body.description is not None:
        group.description = body.description
    await db.commit()
    return {"message": "Group updated"}


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    group_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = await _get_group_with_access(group_id, current_user, db, require_admin=True)
    await db.delete(group)
    await db.commit()


# ── Members ───────────────────────────────────────────────────────────────────

@router.post("/{group_id}/members")
async def invite_member(
    group_id: UUID,
    body: MemberInvite,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_group_with_access(group_id, current_user, db, require_admin=True)

    # Find user by email
    result = await db.execute(select(User).where(User.email == body.email.lower().strip()))
    invitee = result.scalar_one_or_none()
    if not invitee:
        raise HTTPException(status_code=404, detail="No SpendSmart account found with that email")

    # Check already member
    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == invitee.id,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User is already a member")

    db.add(GroupMember(group_id=group_id, user_id=invitee.id, role="member"))
    await db.commit()
    return {"message": f"{invitee.full_name} added to the group"}


@router.delete("/{group_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    group_id: UUID,
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = await _get_group_with_access(group_id, current_user, db, require_admin=True)

    if user_id == group.created_by:
        raise HTTPException(status_code=400, detail="Cannot remove the group creator")

    await db.execute(
        delete(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id,
        )
    )
    await db.commit()


# ── Expenses ──────────────────────────────────────────────────────────────────

@router.post("/{group_id}/expenses", status_code=status.HTTP_201_CREATED)
async def add_expense(
    group_id: UUID,
    body: ExpenseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = await _get_group_with_access(group_id, current_user, db)
    member_ids = {m.user_id for m in group.members}

    if body.paid_by not in member_ids:
        raise HTTPException(status_code=400, detail="Payer must be a group member")

    expense = GroupExpense(
        group_id=group_id,
        paid_by=body.paid_by,
        description=body.description.strip(),
        amount=body.amount,
        split_type=body.split_type,
        expense_date=body.expense_date or datetime.now(timezone.utc),
    )
    db.add(expense)
    await db.flush()

    if body.split_type == "equal":
        share = round(body.amount / len(member_ids), 2)
        for uid in member_ids:
            db.add(GroupExpenseSplit(expense_id=expense.id, user_id=uid, amount=share))
    else:
        if not body.splits:
            raise HTTPException(status_code=400, detail="Custom split requires splits array")
        total_split = sum(s.amount for s in body.splits)
        if abs(total_split - body.amount) > Decimal("0.02"):
            raise HTTPException(status_code=400, detail="Split amounts must sum to total expense amount")
        for s in body.splits:
            if s.user_id not in member_ids:
                raise HTTPException(status_code=400, detail=f"Split user {s.user_id} is not a group member")
            db.add(GroupExpenseSplit(expense_id=expense.id, user_id=s.user_id, amount=s.amount))

    await db.commit()
    return {"id": str(expense.id), "message": "Expense added"}


@router.delete("/{group_id}/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(
    group_id: UUID,
    expense_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = await _get_group_with_access(group_id, current_user, db)

    result = await db.execute(
        select(GroupExpense).where(
            GroupExpense.id == expense_id,
            GroupExpense.group_id == group_id,
        )
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    # Allow payer or admin to delete
    member = next((m for m in group.members if m.user_id == current_user.id), None)
    if expense.paid_by != current_user.id and member.role != "admin":
        raise HTTPException(status_code=403, detail="Only the payer or admin can delete this expense")

    await db.delete(expense)
    await db.commit()


# ── Settlement ────────────────────────────────────────────────────────────────

@router.get("/{group_id}/settlement", response_model=SettlementOut)
async def get_settlement(
    group_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = await _get_group_with_access(group_id, current_user, db)
    return _calculate_settlement(group.members, group.expenses)
