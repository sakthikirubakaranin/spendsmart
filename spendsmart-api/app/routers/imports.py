"""
Bank statement import endpoints.

POST /imports/upload   — parse file, return preview (no DB write yet)
POST /imports/confirm  — user reviewed, save expenses + income to DB
GET  /imports/history  — past imports for this user
DELETE /imports/history/{id} — remove a history record
"""

from __future__ import annotations

import calendar
import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.expense import Expense
from app.models.income import Income
from app.models.recurring_expense import RecurringExpense
from app.models.statement_import import StatementImport
from app.models.user import User
from app.services.categorizer import categorize, classify_income
from app.services.recurring_detector import detect_recurring, _merchant_key
from app.services.statement_parser import parse_statement

router = APIRouter(prefix="/imports", tags=["imports"])

MAX_FILE_MB = 25
ALLOWED_EXTENSIONS = {"xls", "xlsx", "xlsm", "csv", "pdf"}

# Salary credited in the last N days of a month is attributed to the next month
SALARY_LAST_DAYS_THRESHOLD = 3


def _income_period_month(txn_date: date, income_type: str) -> date:
    """
    For salary arriving in the last few days of a month, return the 1st of
    next month so the income is counted in the period it's meant to cover.
    For everything else, return the 1st of the transaction's own month.
    """
    last_day = calendar.monthrange(txn_date.year, txn_date.month)[1]
    if income_type == "salary" and txn_date.day >= last_day - SALARY_LAST_DAYS_THRESHOLD + 1:
        # Shift to next month
        if txn_date.month == 12:
            return date(txn_date.year + 1, 1, 1)
        return date(txn_date.year, txn_date.month + 1, 1)
    return date(txn_date.year, txn_date.month, 1)


# ── Schemas ───────────────────────────────────────────────────────────────────

class PreviewTransaction(BaseModel):
    temp_id: str
    date: date
    description: str
    amount: float
    txn_type: str           # debit | credit
    payment_method: str
    category_slug: str      # for debits
    income_type: str        # for credits: salary|freelance|refund|transfer|other
    confidence: int
    row_hash: str
    is_duplicate: bool = False   # True = already imported in a previous upload


class UploadResponse(BaseModel):
    import_id: str
    bank: str
    filename: str
    total_found: int
    new_count: int           # transactions not yet in DB
    duplicate_count: int     # already imported
    debits: list[PreviewTransaction]
    credits: list[PreviewTransaction]
    parse_error: str | None


class ConfirmTransaction(BaseModel):
    temp_id: str
    date: date
    description: str
    amount: float
    payment_method: str
    category_slug: str
    income_type: str
    txn_type: str
    row_hash: str


class ConfirmRequest(BaseModel):
    import_id: str
    transactions: list[ConfirmTransaction]
    bank_account_id: str | None = None   # optional — link imported expenses to an account


class ConfirmResponse(BaseModel):
    expenses_imported: int
    income_imported: int
    duplicates_skipped: int
    recurring_detected: int   # new RecurringExpense records auto-created


class ImportHistoryItem(BaseModel):
    id: uuid.UUID
    filename: str
    bank_name: str | None
    status: str
    total_rows: int | None
    imported_rows: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _slug_to_id(slug: str, db: AsyncSession) -> int | None:
    row = await db.execute(
        text("SELECT id FROM categories WHERE slug = :slug LIMIT 1"),
        {"slug": slug},
    )
    result = row.fetchone()
    return result[0] if result else None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=UploadResponse)
async def upload_statement(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported format .{ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    contents = await file.read()
    if len(contents) / (1024 * 1024) > MAX_FILE_MB:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail=f"File too large. Max {MAX_FILE_MB} MB.")

    user_id_str = str(current_user.id)
    result = parse_statement(contents, file.filename or "upload", user_id_str)

    # Surface parse errors early so the frontend can show a useful message
    if result.error and not result.rows:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=result.error or "Statement could not be parsed. Try a different file or format.",
        )

    # Pre-load existing hashes so we can flag duplicates in the preview
    existing_exp_q = await db.execute(
        text("SELECT narration_hash FROM expenses WHERE user_id=:uid AND narration_hash IS NOT NULL"),
        {"uid": user_id_str},
    )
    existing_inc_q = await db.execute(
        text("SELECT narration_hash FROM incomes WHERE user_id=:uid AND narration_hash IS NOT NULL"),
        {"uid": user_id_str},
    )
    already_imported: set[str] = (
        {r[0] for r in existing_exp_q.fetchall()} |
        {r[0] for r in existing_inc_q.fetchall()}
    )

    import_record = StatementImport(
        id=uuid.uuid4(),
        user_id=current_user.id,
        filename=file.filename or "upload",
        file_format=ext.upper(),
        bank_name=result.bank,
        total_rows=len(result.rows) + result.skipped,
        status="pending",
    )
    db.add(import_record)
    await db.commit()
    await db.refresh(import_record)

    debits: list[PreviewTransaction] = []
    credits: list[PreviewTransaction] = []

    for i, row in enumerate(result.rows):
        is_dup = row.row_hash in already_imported
        if row.txn_type == "debit":
            slug, confidence = categorize(row.description)
            debits.append(PreviewTransaction(
                temp_id=str(i),
                date=row.date,
                description=row.description,
                amount=row.amount,
                txn_type="debit",
                payment_method=row.payment_method,
                category_slug=slug,
                income_type="",
                confidence=confidence,
                row_hash=row.row_hash,
                is_duplicate=is_dup,
            ))
        else:
            itype, confidence = classify_income(row.description)
            credits.append(PreviewTransaction(
                temp_id=str(i),
                date=row.date,
                description=row.description,
                amount=row.amount,
                txn_type="credit",
                payment_method=row.payment_method,
                category_slug="",
                income_type=itype,
                confidence=confidence,
                row_hash=row.row_hash,
                is_duplicate=is_dup,
            ))

    all_txns = debits + credits
    new_count  = sum(1 for t in all_txns if not t.is_duplicate)
    dup_count  = sum(1 for t in all_txns if t.is_duplicate)

    return UploadResponse(
        import_id=str(import_record.id),
        bank=result.bank,
        filename=file.filename or "upload",
        total_found=len(result.rows),
        new_count=new_count,
        duplicate_count=dup_count,
        debits=debits,
        credits=credits,
        parse_error=result.error or None,
    )


@router.post("/confirm", response_model=ConfirmResponse)
async def confirm_import(
    body: ConfirmRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(StatementImport).where(
        StatementImport.id == uuid.UUID(body.import_id),
        StatementImport.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    import_record = result.scalar_one_or_none()
    if not import_record:
        raise HTTPException(status_code=404, detail="Import record not found")

    # Fetch existing hashes (both expenses and incomes)
    existing_exp = await db.execute(
        text("SELECT narration_hash FROM expenses WHERE user_id=:uid AND narration_hash IS NOT NULL"),
        {"uid": str(current_user.id)},
    )
    existing_inc = await db.execute(
        text("SELECT narration_hash FROM incomes WHERE user_id=:uid AND narration_hash IS NOT NULL"),
        {"uid": str(current_user.id)},
    )
    existing_hashes = (
        {r[0] for r in existing_exp.fetchall()} |
        {r[0] for r in existing_inc.fetchall()}
    )

    # Pre-load ALL category slugs at once — avoids N+1 DB queries (1 query vs 1 per transaction)
    slug_rows = await db.execute(text("SELECT id, slug FROM categories"))
    slug_map: dict[str, int] = {row[1]: row[0] for row in slug_rows.fetchall()}

    expenses_imported = 0
    income_imported = 0
    duplicates = 0
    expenses_to_add: list[Expense] = []
    incomes_to_add: list[Income] = []

    for txn in body.transactions:
        if txn.row_hash and txn.row_hash in existing_hashes:
            duplicates += 1
            continue

        if txn.txn_type == "debit":
            category_id = slug_map.get(txn.category_slug)
            ba_id = uuid.UUID(body.bank_account_id) if body.bank_account_id else None
            expenses_to_add.append(Expense(
                id=uuid.uuid4(),
                user_id=current_user.id,
                date=txn.date,
                amount=txn.amount,
                description=txn.description,
                category_id=category_id,
                payment_method=txn.payment_method,
                source="statement_import",
                import_id=import_record.id,
                narration_hash=txn.row_hash or None,
                bank_account_id=ba_id,
            ))
            expenses_imported += 1
        else:
            itype = txn.income_type or "other"
            period = _income_period_month(txn.date, itype)
            incomes_to_add.append(Income(
                id=uuid.uuid4(),
                user_id=current_user.id,
                date=txn.date,
                period_month=period,
                amount=txn.amount,
                description=txn.description,
                income_type=itype,
                source="statement_import",
                import_id=import_record.id,
                narration_hash=txn.row_hash or None,
            ))
            income_imported += 1

        if txn.row_hash:
            existing_hashes.add(txn.row_hash)

    # Bulk-insert in batches of 200 to keep transactions short
    BATCH = 200
    for i in range(0, len(expenses_to_add), BATCH):
        db.add_all(expenses_to_add[i : i + BATCH])
        await db.flush()
    for i in range(0, len(incomes_to_add), BATCH):
        db.add_all(incomes_to_add[i : i + BATCH])
        await db.flush()

    import_record.imported_rows = expenses_imported + income_imported
    import_record.skipped_rows = duplicates
    import_record.status = "completed"
    import_record.completed_at = datetime.utcnow()
    await db.commit()

    # ── Auto-detect recurring expenses ───────────────────────────────────────
    # Only operate on debit transactions that were actually saved (non-duplicates)
    saved_debits = [t for t in body.transactions if t.txn_type == "debit"]
    candidates = detect_recurring(saved_debits, slug_map)

    recurring_detected = 0
    if candidates:
        # Build a set of merchant_keys already in recurring_expenses for this user.
        # We normalise existing descriptions through _merchant_key() so that
        # "CHDFGC9181NRV5/SBI LIFE INS" (stored) → "sbi life ins" (key)
        # matches any new import of the same merchant regardless of reference numbers.
        existing_rec_q = await db.execute(
            text("SELECT description FROM recurring_expenses WHERE user_id = :uid"),
            {"uid": str(current_user.id)},
        )
        existing_keys: set[str] = {_merchant_key(r[0]) for r in existing_rec_q.fetchall()}

        for c in candidates:
            if c.merchant_key in existing_keys:
                continue   # already tracked — skip

            rec = RecurringExpense(
                id=uuid.uuid4(),
                user_id=current_user.id,
                description=c.description,
                amount=c.amount,
                category_id=c.category_id,
                payment_method="NACH" if c.category_slug == "loan_emi" else "UPI",
                frequency=c.frequency,
                day_of_month=c.day_of_month,
                next_due_date=c.next_due_date,
                is_active=True,
            )
            db.add(rec)
            existing_keys.add(c.merchant_key)   # prevent same-batch dupes too
            recurring_detected += 1

        if recurring_detected:
            await db.commit()

    return ConfirmResponse(
        expenses_imported=expenses_imported,
        income_imported=income_imported,
        duplicates_skipped=duplicates,
        recurring_detected=recurring_detected,
    )


@router.get("/history", response_model=list[ImportHistoryItem])
async def import_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(StatementImport)
        .where(StatementImport.user_id == current_user.id)
        .order_by(StatementImport.created_at.desc())
        .limit(20)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.delete("/history/{import_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_import(
    import_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(StatementImport).where(
        StatementImport.id == uuid.UUID(import_id),
        StatementImport.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Import not found")
    await db.delete(record)
    await db.commit()
