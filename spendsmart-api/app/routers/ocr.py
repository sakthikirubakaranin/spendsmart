"""
Receipt / bill scanning endpoint using Google Gemini Vision.

POST /ocr/scan-receipt
  - Accepts an image (JPEG/PNG/WEBP/HEIC) or PDF
  - Extracts merchant, amount, date, items using Gemini 1.5 Flash
  - Suggests a category using the existing categoriser
  - Returns structured JSON the frontend uses to pre-fill the expense form
"""

import base64
import json
import re
from datetime import date as date_type
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.models.user import User
from app.services.categorizer import categorize

router = APIRouter(prefix="/ocr", tags=["ocr"])

# ── Allowed MIME types ────────────────────────────────────────────────────────
ALLOWED = {
    "image/jpeg", "image/jpg", "image/png", "image/webp",
    "image/heic", "image/heif", "application/pdf",
}

# ── Gemini prompt ─────────────────────────────────────────────────────────────
_PROMPT = """
You are scanning an Indian bill or receipt. Extract the following fields:

1. merchant   — business name (restaurant, shop, service provider)
2. amount     — the final total amount paid in INR (just the number, no ₹ or commas)
3. date       — transaction date in YYYY-MM-DD format
4. description — a short human-readable label, e.g. "Swiggy food delivery" or "Apollo pharmacy"
5. items      — list of line items if clearly visible (max 5), each with "name" and "amount"

Return ONLY valid JSON with exactly these keys. Use null for fields not found.

Example:
{
  "merchant": "Swiggy",
  "amount": 450.50,
  "date": "2024-03-15",
  "description": "Swiggy food delivery",
  "items": [{"name": "Butter Chicken", "amount": 320}, {"name": "Delivery fee", "amount": 30}]
}
""".strip()


# ── Response schema ───────────────────────────────────────────────────────────
class ScannedItem(BaseModel):
    name: str
    amount: float


class ScanResult(BaseModel):
    merchant: Optional[str] = None
    amount: Optional[float] = None
    date: Optional[str] = None
    description: Optional[str] = None
    items: list[ScannedItem] = []
    suggested_category_slug: Optional[str] = None
    suggested_category_name: Optional[str] = None
    confidence: str = "low"   # low | medium | high
    raw_text: Optional[str] = None   # for debugging


# ── Helper: parse Gemini response ─────────────────────────────────────────────
def _parse_gemini(text: str) -> dict:
    """Extract JSON from Gemini's response (it sometimes wraps in markdown)."""
    # Strip ```json ... ``` fences if present
    text = re.sub(r"```(?:json)?\s*", "", text).strip()
    text = text.rstrip("`").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to find the first {...} block
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            return json.loads(m.group())
        return {}


# ── Endpoint ──────────────────────────────────────────────────────────────────
@router.post("/scan-receipt", response_model=ScanResult)
async def scan_receipt(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    if not settings.GOOGLE_AI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Receipt scanning is not configured. Add GOOGLE_AI_API_KEY to the server environment.",
        )

    # Validate type
    content_type = file.content_type or ""
    if content_type not in ALLOWED:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {content_type}. Use JPEG, PNG, WEBP, HEIC, or PDF.",
        )

    # Size limit (10 MB)
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max 10 MB.")

    # ── Call Gemini ──────────────────────────────────────────────────────────
    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.GOOGLE_AI_API_KEY)
        model = genai.GenerativeModel("gemini-1.5-flash")

        b64 = base64.b64encode(content).decode("utf-8")

        # PDF: use first page only (Gemini supports PDF natively)
        mime = content_type if content_type != "application/pdf" else "application/pdf"

        response = model.generate_content(
            [
                _PROMPT,
                {"mime_type": mime, "data": b64},
            ]
        )
        raw = response.text.strip()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"OCR service error: {exc}")

    # ── Parse response ───────────────────────────────────────────────────────
    data = _parse_gemini(raw)

    # Sanitise amount
    amount = data.get("amount")
    if isinstance(amount, str):
        amount = float(re.sub(r"[^\d.]", "", amount) or 0) or None

    # Sanitise date
    raw_date = data.get("date")
    parsed_date: Optional[str] = None
    if raw_date:
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d %b %Y", "%B %d, %Y"):
            try:
                from datetime import datetime
                parsed_date = datetime.strptime(str(raw_date), fmt).date().isoformat()
                break
            except ValueError:
                pass
        if not parsed_date:
            parsed_date = str(date_type.today())

    merchant  = data.get("merchant") or None
    desc      = data.get("description") or merchant or "Scanned receipt"

    # ── Categorise ───────────────────────────────────────────────────────────
    cat_slug, cat_name = None, None
    if desc:
        slug, _conf = categorize(desc)
        if slug and slug != "others":
            cat_slug = slug
            # Map slug → display name (best effort)
            SLUG_NAMES = {
                "food_dining": "Food & Dining", "grocery": "Grocery",
                "transport": "Transport", "fuel": "Fuel",
                "utilities": "Utilities", "housing": "Housing & Rent",
                "health_medical": "Health & Medical", "personal_care": "Personal Care",
                "online_shopping": "Online Shopping", "entertainment": "Entertainment",
                "ott_subscriptions": "OTT & Subscriptions",
                "cloud_services": "Cloud & Dev Tools", "education": "Education",
                "fitness": "Fitness", "travel": "Travel",
                "insurance": "Insurance", "loan_emi": "Loan & EMI",
                "tax": "Tax", "credit_card_bill": "Credit Card Bill",
                "savings": "Savings & Gold", "savings_investment": "Investments",
                "family_transfer": "Family & Friends", "others": "Others",
            }
            cat_name = SLUG_NAMES.get(slug, slug)

    # Confidence heuristic
    found = sum(1 for v in [merchant, amount, parsed_date] if v)
    confidence = "high" if found == 3 else ("medium" if found >= 2 else "low")

    # Parse items
    raw_items = data.get("items") or []
    items = []
    for it in raw_items[:5]:
        if isinstance(it, dict) and it.get("name"):
            items.append(ScannedItem(
                name=str(it["name"]),
                amount=float(re.sub(r"[^\d.]", "", str(it.get("amount", 0))) or 0),
            ))

    return ScanResult(
        merchant=merchant,
        amount=amount,
        date=parsed_date or str(date_type.today()),
        description=desc,
        items=items,
        suggested_category_slug=cat_slug,
        suggested_category_name=cat_name,
        confidence=confidence,
        raw_text=raw[:500] if raw else None,
    )
