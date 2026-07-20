from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app.core.config import settings
from app.core.database import Base, engine
import app.models  # noqa: F401 — ensures ALL models register with Base.metadata before create_all
from app.routers import analytics, auth, bank_accounts, budgets, categories, expenses, groups, imports, income, ocr, recurring, users

# ── Rate limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])


# ── Category seed data ────────────────────────────────────────────────────────
# (slug, name, icon, sort_order)
CATEGORY_SEEDS: list[tuple[str, str, str, int]] = [
    ("food_dining",       "Food & Dining",       "🍽️",  10),
    ("grocery",           "Grocery",             "🛒",  20),
    ("transport",         "Transport",           "🚗",  30),
    ("fuel",              "Fuel",                "⛽",  40),
    ("utilities",         "Utilities",           "💡",  50),
    ("housing",           "Housing & Rent",      "🏠",  60),
    ("health_medical",    "Health & Medical",    "💊",  70),
    ("personal_care",     "Personal Care",       "💅",  80),
    ("online_shopping",   "Online Shopping",     "🛍️",  90),
    ("entertainment",     "Entertainment",       "🎭", 100),
    ("ott_subscriptions", "OTT & Subscriptions", "📺", 110),
    ("cloud_services",    "Cloud & Dev Tools",   "☁️", 120),
    ("education",         "Education",           "📚", 130),
    ("fitness",           "Fitness",             "💪", 140),
    ("travel",            "Travel",              "✈️", 150),
    ("insurance",         "Insurance",           "🛡️", 160),
    ("loan_emi",          "Loan & EMI",          "🏦", 170),
    ("tax",               "Tax",                 "📋", 180),
    ("credit_card_bill",  "Credit Card Bill",    "💳", 190),
    ("savings",           "Savings & Gold",      "🪙", 200),
    ("savings_investment","Investments",         "📈", 210),
    ("family_transfer",   "Family & Friends",    "👨‍👩‍👧", 220),
    ("others",            "Others",              "📦", 999),
]


# ── Lifespan: create tables on startup (Alembic handles production migrations) ─
@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        # In production use `alembic upgrade head` instead.
        # This is a safety net for first run / dev.
        await conn.run_sync(Base.metadata.create_all)

        # Seed system categories — idempotent (ON CONFLICT DO NOTHING)
        for slug, name, icon, sort_order in CATEGORY_SEEDS:
            await conn.execute(
                __import__("sqlalchemy").text(
                    "INSERT INTO categories (slug, name, icon, sort_order, is_system) "
                    "VALUES (:slug, :name, :icon, :sort_order, true) "
                    "ON CONFLICT (slug) DO NOTHING"
                ),
                {"slug": slug, "name": name, "icon": icon, "sort_order": sort_order},
            )

    yield
    await engine.dispose()


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="SpendSmart API",
    version="1.0.0",
    description="Expense tracking backend — JWT auth, analytics, budgets, bank statement import.",
    docs_url="/docs" if settings.APP_ENV != "production" else None,
    redoc_url="/redoc" if settings.APP_ENV != "production" else None,
    lifespan=lifespan,
)

# ── Rate limiting middleware ──────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# ── CORS — must be added LAST so it wraps everything and runs first ───────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
API_PREFIX = "/api/v1"

app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(bank_accounts.router, prefix=API_PREFIX)
app.include_router(expenses.router, prefix=API_PREFIX)
app.include_router(categories.router, prefix=API_PREFIX)
app.include_router(budgets.router, prefix=API_PREFIX)
app.include_router(analytics.router, prefix=API_PREFIX)
app.include_router(imports.router, prefix=API_PREFIX)
app.include_router(income.router, prefix=API_PREFIX)
app.include_router(users.router, prefix=API_PREFIX)
app.include_router(recurring.router, prefix=API_PREFIX)
app.include_router(groups.router, prefix=API_PREFIX)
app.include_router(ocr.router, prefix=API_PREFIX)


# ── Health check ─────────────────────────────────────────────────────────────
@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok", "version": "1.0.0"}
