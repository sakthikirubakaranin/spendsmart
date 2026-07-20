"""
Categories endpoints.

GET  /categories              — system + user's custom categories
POST /categories              — create a custom category
PATCH /categories/{id}        — update user's custom category
DELETE /categories/{id}       — delete user's custom category
"""
import uuid as _uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.category import Category
from app.models.user import User
from app.schemas.expense import CategoryOut

router = APIRouter(prefix="/categories", tags=["categories"])

PRESET_COLORS = [
    "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b",
    "#ef4444", "#ec4899", "#3b82f6", "#84cc16",
    "#f97316", "#a855f7", "#14b8a6", "#eab308",
]


class CategoryCreate(BaseModel):
    name: str
    icon: str = "📂"
    color: str = "#8b5cf6"


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[CategoryOut])
async def list_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return system categories + this user's custom categories, sorted."""
    result = await db.execute(
        select(Category)
        .where(
            Category.parent_id == None,
            or_(
                Category.is_system == True,
                Category.user_id == current_user.id,
            ),
        )
        .order_by(Category.is_system.desc(), Category.sort_order, Category.name)
    )
    return result.scalars().all()


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(
    body: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Name cannot be empty")

    # Auto-generate a unique slug: custom_<short_uuid>
    short = str(_uuid.uuid4()).replace("-", "")[:10]
    slug = f"custom_{short}"

    cat = Category(
        slug=slug,
        name=name,
        icon=body.icon,
        color=body.color,
        is_system=False,
        user_id=current_user.id,
        sort_order=500,   # user categories sort after system ones
    )
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat


# ── Update ────────────────────────────────────────────────────────────────────

@router.patch("/{cat_id}", response_model=CategoryOut)
async def update_category(
    cat_id: int,
    body: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Category).where(
            Category.id == cat_id,
            Category.user_id == current_user.id,
            Category.is_system == False,
        )
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Custom category not found")

    if body.name is not None:
        cat.name = body.name.strip()
    if body.icon is not None:
        cat.icon = body.icon
    if body.color is not None:
        cat.color = body.color

    await db.commit()
    await db.refresh(cat)
    return cat


# ── Delete ────────────────────────────────────────────────────────────────────

@router.delete("/{cat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    cat_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Category).where(
            Category.id == cat_id,
            Category.user_id == current_user.id,
            Category.is_system == False,
        )
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Custom category not found")

    await db.delete(cat)
    await db.commit()
