"""
AI NLP query & BYOK settings router.

POST   /api/v1/ai/query        — ask a natural-language question over expense data
GET    /api/v1/ai/settings     — get user's current AI provider config
PUT    /api/v1/ai/settings     — save a BYOK provider + API key
DELETE /api/v1/ai/settings     — remove BYOK config (revert to server default)
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.services.ai_query import encrypt_api_key, query_expenses

router = APIRouter(prefix="/ai", tags=["ai"])

_VALID_PROVIDERS = {"gemini", "openai", "anthropic", "groq"}

# ── Schemas ───────────────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    question: str
    months: int = 6          # how many months of history to include


class QueryResponse(BaseModel):
    answer: str
    model_used: str


class AISettingsOut(BaseModel):
    provider: Optional[str] = None
    has_key: bool = False
    using_default: bool = True   # True  = server Gemini key; False = user's BYOK


class AISettingsUpdate(BaseModel):
    provider: str    # gemini | openai | anthropic | groq
    api_key: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/query", response_model=QueryResponse)
async def query_ai(
    body: QueryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Ask a natural-language question about the authenticated user's expenses."""
    q = (body.question or "").strip()
    if not q:
        raise HTTPException(status_code=422, detail="Question cannot be empty")
    if not 1 <= body.months <= 24:
        raise HTTPException(status_code=422, detail="months must be between 1 and 24")

    try:
        result = await query_expenses(
            question=q,
            user=current_user,
            db=db,
            months=body.months,
        )
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI service error: {exc}")

    return QueryResponse(**result)


@router.get("/settings", response_model=AISettingsOut)
async def get_ai_settings(
    current_user: User = Depends(get_current_user),
):
    """Return the user's current AI provider configuration (key value is never returned)."""
    has_key = bool(current_user.ai_api_key_encrypted)
    return AISettingsOut(
        provider=current_user.ai_provider,
        has_key=has_key,
        using_default=not has_key,
    )


@router.put("/settings", response_model=AISettingsOut)
async def update_ai_settings(
    body: AISettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save a BYOK API key. The key is Fernet-encrypted before storage."""
    if body.provider not in _VALID_PROVIDERS:
        raise HTTPException(
            status_code=422,
            detail=f"provider must be one of: {', '.join(sorted(_VALID_PROVIDERS))}",
        )
    if not body.api_key.strip():
        raise HTTPException(status_code=422, detail="api_key cannot be empty")

    try:
        current_user.ai_provider = body.provider
        current_user.ai_api_key_encrypted = encrypt_api_key(body.api_key.strip())
        await db.commit()
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return AISettingsOut(provider=current_user.ai_provider, has_key=True, using_default=False)


@router.delete("/settings", response_model=AISettingsOut)
async def delete_ai_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove BYOK config — the user reverts to the server's default Gemini key."""
    current_user.ai_provider = None
    current_user.ai_api_key_encrypted = None
    await db.commit()
    return AISettingsOut(provider=None, has_key=False, using_default=True)
