"""
AI query service — context-injection approach.

Flow:
  1. Fetch the user's recent expenses from the DB (last N months, up to 500 rows)
  2. Format them as a structured plain-text context block
  3. Send context + user question to the chosen LLM
  4. Return the answer + which model was used

Provider resolution (in order):
  - If the user has saved a BYOK provider + encrypted key → use that
  - Otherwise → use the server's GOOGLE_AI_API_KEY with Gemini 1.5 Flash (free tier)

Supported BYOK providers: gemini | openai | anthropic | groq
"""

from __future__ import annotations

import os
from datetime import date, timedelta
from typing import Optional

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.expense import Expense
from app.models.user import User

# ── Encryption helpers ────────────────────────────────────────────────────────

def _fernet():
    """Return a Fernet instance using AI_ENCRYPTION_KEY from settings."""
    from cryptography.fernet import Fernet
    key = settings.AI_ENCRYPTION_KEY
    if not key:
        raise ValueError(
            "AI_ENCRYPTION_KEY is not configured. "
            "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_api_key(raw_key: str) -> str:
    """Encrypt a plain-text API key for storage."""
    return _fernet().encrypt(raw_key.encode()).decode()


def decrypt_api_key(encrypted: str) -> str:
    """Decrypt a stored API key."""
    return _fernet().decrypt(encrypted.encode()).decode()


# ── Expense context builder ───────────────────────────────────────────────────

async def _build_context(user: User, db: AsyncSession, months: int) -> str:
    """
    Fetch the user's expenses and format them as a compact context block.
    Sends up to 300 individual transactions; for larger datasets the summary
    figures still give the model enough signal for aggregate questions.
    """
    cutoff = date.today() - timedelta(days=months * 30)

    result = await db.execute(
        select(Expense)
        .where(
            and_(
                Expense.user_id == user.id,
                Expense.date >= cutoff,
                Expense.is_deleted == False,  # noqa: E712
            )
        )
        .order_by(Expense.date.desc())
        .limit(500)
    )
    expenses = result.scalars().all()

    if not expenses:
        return f"No expense records found for {user.full_name} in the last {months} months."

    total = sum(float(e.amount) for e in expenses)

    # Category breakdown (use category_id as a proxy — readable slug comes from joins
    # but we skip the join here to keep the query lightweight)
    month_totals: dict[str, float] = {}
    for e in expenses:
        key = e.date.strftime("%Y-%m")
        month_totals[key] = month_totals.get(key, 0) + float(e.amount)

    lines: list[str] = [
        f"=== SpendSmart Expense Data for {user.full_name} ===",
        f"Period: last {months} months (since {cutoff})",
        f"Total spent: ₹{total:,.2f}",
        f"Total transactions: {len(expenses)}",
        "",
        "Monthly breakdown:",
    ]
    for month, amt in sorted(month_totals.items(), reverse=True):
        lines.append(f"  {month}: ₹{amt:,.2f}")

    lines += [
        "",
        "Individual transactions (most recent first, max 300):",
        "DATE        | AMOUNT      | DESCRIPTION                        | PAYMENT",
        "-" * 75,
    ]
    for e in expenses[:300]:
        pm = (e.payment_method or "N/A").upper()
        lines.append(
            f"{e.date}  | ₹{float(e.amount):>9,.2f} | {e.description[:35]:<35} | {pm}"
        )

    return "\n".join(lines)


# ── System prompt ─────────────────────────────────────────────────────────────

_SYSTEM = """You are an AI financial assistant embedded in SpendSmart, a personal expense tracker.
You have access to the user's real expense data provided below. Answer their question using that data.

Rules:
- Format rupee amounts as ₹X,XX,XXX (Indian number system)
- Be concise — 2–4 sentences for simple questions, a structured breakdown for complex ones
- If the data is insufficient to answer precisely, say so and give your best estimate
- Today's date: {today}
"""


# ── LLM callers ───────────────────────────────────────────────────────────────

async def _gemini(prompt: str, api_key: str) -> dict:
    from google import genai
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )
    return {"answer": response.text.strip(), "model_used": "Gemini 2.5 Flash"}


async def _openai(system: str, context: str, question: str, api_key: str) -> dict:
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=api_key)
    resp = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": f"{system}\n\n{context}"},
            {"role": "user", "content": question},
        ],
        max_tokens=600,
        temperature=0.3,
    )
    return {"answer": resp.choices[0].message.content.strip(), "model_used": "GPT-4o Mini"}


async def _anthropic(prompt: str, api_key: str) -> dict:
    import anthropic
    client = anthropic.AsyncAnthropic(api_key=api_key)
    resp = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}],
    )
    return {"answer": resp.content[0].text.strip(), "model_used": "Claude Haiku"}


async def _groq(system: str, context: str, question: str, api_key: str) -> dict:
    from groq import AsyncGroq
    client = AsyncGroq(api_key=api_key)
    resp = await client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": f"{system}\n\n{context}"},
            {"role": "user", "content": question},
        ],
        max_tokens=600,
        temperature=0.3,
    )
    return {"answer": resp.choices[0].message.content.strip(), "model_used": "Llama 3.3 70B (Groq)"}


# ── Public entry point ────────────────────────────────────────────────────────

async def query_expenses(
    question: str,
    user: User,
    db: AsyncSession,
    months: int = 6,
) -> dict:
    """
    Run an NLP question over the user's expense history.
    Returns {"answer": str, "model_used": str}.
    """
    context = await _build_context(user, db, months)
    today = date.today().isoformat()
    system = _SYSTEM.format(today=today)

    # Resolve provider + key
    if user.ai_provider and user.ai_api_key_encrypted:
        provider = user.ai_provider
        api_key = decrypt_api_key(user.ai_api_key_encrypted)
    else:
        provider = "gemini"
        api_key = settings.GOOGLE_AI_API_KEY
        if not api_key:
            raise ValueError(
                "No AI API key configured. Please add GOOGLE_AI_API_KEY to the server "
                "environment or set a personal API key in Settings → AI Assistant."
            )

    if provider == "gemini":
        full_prompt = f"{system}\n\n{context}\n\nUser question: {question}"
        return await _gemini(full_prompt, api_key)
    elif provider == "openai":
        return await _openai(system, context, question, api_key)
    elif provider == "anthropic":
        full_prompt = f"{system}\n\n{context}\n\nUser question: {question}"
        return await _anthropic(full_prompt, api_key)
    elif provider == "groq":
        return await _groq(system, context, question, api_key)
    else:
        raise ValueError(f"Unknown AI provider: {provider!r}")
