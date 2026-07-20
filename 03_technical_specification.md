# Technical Specification
## SpendSmart — Personal Expense Tracker & Financial Advisor
**Version:** 1.0 | **Last Updated:** July 2026

---

## 1. System Architecture

### 1.1 Architecture Overview

SpendSmart follows a three-tier architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                               │
│         React 18 + TypeScript SPA (Vite)                     │
│         TailwindCSS + Recharts + shadcn/ui                   │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS / REST + WebSocket
┌──────────────────────────▼──────────────────────────────────┐
│                    API LAYER                                  │
│         FastAPI (Python 3.11+) — async                       │
│         Celery Workers (statement parsing, email, tips)      │
│         Redis (task queue + caching)                         │
└─────────┬────────────────────────────────────┬──────────────┘
          │                                    │
┌─────────▼──────────┐             ┌───────────▼──────────────┐
│   PRIMARY DB        │             │   OBJECT STORE            │
│   PostgreSQL 15     │             │   Local disk (dev)        │
│   (all user data)   │             │   S3-compatible (prod)    │
└─────────────────────┘             └──────────────────────────┘
```

### 1.2 Technology Stack

| Layer | Technology | Version | Rationale |
|---|---|---|---|
| Frontend | React + TypeScript | 18 / 5.x | Component model, ecosystem |
| Frontend Build | Vite | 5.x | Fast HMR, optimized builds |
| Styling | TailwindCSS + shadcn/ui | 3.x | Utility-first, accessible |
| Charts | Recharts | 2.x | React-native, customizable |
| State Management | TanStack Query | 5.x | Server state, cache, mutations |
| HTTP Client | Axios | 1.x | Interceptors for auth token |
| Backend | FastAPI | 0.111+ | Async, auto OpenAPI, Pydantic |
| ORM | SQLAlchemy | 2.x | Async sessions, migrations via Alembic |
| Database | PostgreSQL | 15 | JSONB, full-text search |
| Cache / Queue | Redis | 7.x | Celery broker + result backend |
| Task Queue | Celery | 5.x | Async statement parsing, email |
| Authentication | JWT (PyJWT) + bcrypt | — | Stateless, secure |
| File Parsing | pdfplumber, openpyxl, pandas | — | Multi-format statement parsing |
| ML Categorization | scikit-learn (TF-IDF + SVM) | 1.x | Lightweight, explainable |
| Email | FastAPI-Mail + Jinja2 templates | — | HTML emails with charts |
| PDF Generation | WeasyPrint | — | HTML-to-PDF for reports |
| Container | Docker + Docker Compose | — | Local dev + cloud deploy |

---

## 2. Database Schema

### 2.1 Entity Relationship Overview

```
users ──< expenses >── categories
  │          │
  │         statement_imports
  │
  ├──< budgets
  ├──< recurring_expenses
  ├──< saving_tips
  └──< notification_preferences
```

### 2.2 Table Definitions

#### `users`
```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    monthly_income  NUMERIC(12, 2),
    is_active       BOOLEAN DEFAULT TRUE,
    is_verified     BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(64),
    reset_otp       VARCHAR(6),
    reset_otp_expires_at TIMESTAMPTZ,
    failed_login_attempts INT DEFAULT 0,
    locked_until    TIMESTAMPTZ,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

#### `categories`
```sql
CREATE TABLE categories (
    id          SERIAL PRIMARY KEY,
    slug        VARCHAR(64) UNIQUE NOT NULL,  -- e.g. "food_dining"
    name        VARCHAR(128) NOT NULL,         -- e.g. "Food & Dining"
    icon        VARCHAR(16),                   -- emoji: "🍽️"
    parent_id   INT REFERENCES categories(id), -- null = top-level
    sort_order  INT DEFAULT 0,
    is_system   BOOLEAN DEFAULT TRUE,          -- false = user-created
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

#### `expenses`
```sql
CREATE TABLE expenses (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date                DATE NOT NULL,
    amount              NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    description         VARCHAR(512) NOT NULL,
    category_id         INT REFERENCES categories(id),
    sub_category_id     INT REFERENCES categories(id),
    payment_method      VARCHAR(32),  -- CASH, UPI, CREDIT_CARD, DEBIT_CARD, NET_BANKING
    notes               TEXT,
    source              VARCHAR(32) DEFAULT 'manual',  -- manual | statement_import
    import_id           UUID REFERENCES statement_imports(id),
    category_confidence SMALLINT,    -- 0-100, null for manual entries
    narration_hash      VARCHAR(64), -- SHA-256(date+amount+description) for dedup
    is_deleted          BOOLEAN DEFAULT FALSE,
    deleted_at          TIMESTAMPTZ,
    recurring_id        UUID REFERENCES recurring_expenses(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_expenses_user_date ON expenses(user_id, date DESC) WHERE NOT is_deleted;
CREATE INDEX idx_expenses_category   ON expenses(user_id, category_id) WHERE NOT is_deleted;
CREATE INDEX idx_expenses_hash       ON expenses(user_id, narration_hash);
```

#### `statement_imports`
```sql
CREATE TABLE statement_imports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename        VARCHAR(255) NOT NULL,
    file_format     VARCHAR(16),    -- PDF, CSV, XLSX, OFX
    bank_name       VARCHAR(128),
    statement_from  DATE,
    statement_to    DATE,
    total_rows      INT,
    imported_rows   INT,
    skipped_rows    INT,
    status          VARCHAR(32) DEFAULT 'pending',  -- pending|processing|completed|failed
    error_message   TEXT,
    task_id         VARCHAR(255),   -- Celery task ID
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);
```

#### `budgets`
```sql
CREATE TABLE budgets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id INT NOT NULL REFERENCES categories(id),
    month       DATE NOT NULL,           -- always 1st of month: 2026-07-01
    amount      NUMERIC(12, 2) NOT NULL,
    rollover    BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, category_id, month)
);
```

#### `recurring_expenses`
```sql
CREATE TABLE recurring_expenses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    description     VARCHAR(512) NOT NULL,
    amount          NUMERIC(12, 2) NOT NULL,
    category_id     INT REFERENCES categories(id),
    payment_method  VARCHAR(32),
    frequency       VARCHAR(16) NOT NULL,   -- weekly | monthly | quarterly
    day_of_month    SMALLINT,               -- 1-28 (for monthly)
    day_of_week     SMALLINT,               -- 0=Mon (for weekly)
    is_active       BOOLEAN DEFAULT TRUE,
    next_due_date   DATE NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

#### `saving_tips`
```sql
CREATE TABLE saving_tips (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month           DATE NOT NULL,          -- month these tips cover
    tip_type        VARCHAR(64),            -- duplicate_subscription | high_spend | etc.
    category_id     INT REFERENCES categories(id),
    headline        VARCHAR(255) NOT NULL,
    detail          TEXT NOT NULL,
    potential_saving NUMERIC(10, 2),
    is_dismissed    BOOLEAN DEFAULT FALSE,
    rating          SMALLINT,               -- 1=helpful, -1=not helpful, null=unrated
    generated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

#### `category_corrections`
```sql
CREATE TABLE category_corrections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    description     TEXT NOT NULL,           -- original narration
    from_category_id INT REFERENCES categories(id),
    to_category_id  INT NOT NULL REFERENCES categories(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
-- Used as training signal for the ML model
```

#### `notification_preferences`
```sql
CREATE TABLE notification_preferences (
    user_id                 UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    budget_alert            BOOLEAN DEFAULT TRUE,
    budget_alert_pct        SMALLINT DEFAULT 80,
    weekly_summary          BOOLEAN DEFAULT TRUE,
    monthly_tips            BOOLEAN DEFAULT TRUE,
    large_transaction_alert BOOLEAN DEFAULT TRUE,
    large_tx_threshold      NUMERIC(10,2) DEFAULT 5000,
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);
```

#### `audit_log`
```sql
CREATE TABLE audit_log (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID REFERENCES users(id),
    entity      VARCHAR(64),    -- expenses, budgets, etc.
    entity_id   UUID,
    action      VARCHAR(16),    -- INSERT | UPDATE | DELETE
    before_data JSONB,
    after_data  JSONB,
    ip_address  INET,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_user ON audit_log(user_id, created_at DESC);
```

---

## 3. REST API Specification

Base URL: `/api/v1`  
All endpoints require `Authorization: Bearer <JWT>` unless marked [public].

### 3.1 Authentication

| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` [public] | Create account |
| POST | `/auth/login` [public] | Get access + refresh tokens |
| POST | `/auth/refresh` [public] | Rotate refresh token |
| POST | `/auth/logout` | Revoke refresh token |
| POST | `/auth/verify-email` [public] | Verify email with token |
| POST | `/auth/forgot-password` [public] | Send OTP |
| POST | `/auth/reset-password` [public] | Reset with OTP + new password |

**POST /auth/register** Request:
```json
{
  "full_name": "Sakthi Kumar",
  "email": "sakthi@example.com",
  "password": "SecurePass1"
}
```
Response 201:
```json
{
  "message": "Registration successful. Please check your email to verify your account."
}
```

**POST /auth/login** Request:
```json
{ "email": "sakthi@example.com", "password": "SecurePass1" }
```
Response 200:
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 2592000,
  "user": { "id": "uuid", "full_name": "Sakthi Kumar", "email": "sakthi@example.com" }
}
```

---

### 3.2 Expenses

| Method | Path | Description |
|---|---|---|
| GET | `/expenses` | List expenses (paginated, filterable) |
| POST | `/expenses` | Create expense |
| POST | `/expenses/bulk` | Create multiple expenses |
| GET | `/expenses/{id}` | Get single expense |
| PUT | `/expenses/{id}` | Update expense |
| DELETE | `/expenses/{id}` | Soft-delete expense |
| POST | `/expenses/{id}/restore` | Restore soft-deleted expense |

**GET /expenses** Query params:
- `page` (int, default 1), `per_page` (int, default 50, max 200)
- `from_date` (YYYY-MM-DD), `to_date` (YYYY-MM-DD)
- `category_id` (int), `payment_method` (string)
- `source` (manual|statement_import)
- `search` (text search on description)
- `sort` (date_asc|date_desc|amount_asc|amount_desc, default date_desc)

Response 200:
```json
{
  "items": [
    {
      "id": "uuid",
      "date": "2026-07-01",
      "amount": 450.00,
      "description": "Swiggy Order #12345",
      "category": { "id": 1, "slug": "food_dining", "name": "Food & Dining", "icon": "🍽️" },
      "sub_category": { "id": 2, "name": "Food Delivery" },
      "payment_method": "UPI",
      "source": "statement_import",
      "category_confidence": 95,
      "created_at": "2026-07-01T18:30:00Z"
    }
  ],
  "total": 142,
  "page": 1,
  "per_page": 50,
  "pages": 3
}
```

**POST /expenses** Request:
```json
{
  "date": "2026-07-03",
  "amount": 350.00,
  "description": "Lunch at Saravana Bhavan",
  "category_id": 1,
  "sub_category_id": 2,
  "payment_method": "CASH",
  "notes": "Team lunch"
}
```
Response 201: Returns the created expense object.

---

### 3.3 Statement Imports

| Method | Path | Description |
|---|---|---|
| POST | `/imports/upload` | Upload statement file (multipart/form-data) |
| GET | `/imports` | List all imports |
| GET | `/imports/{id}` | Get import status + row preview |
| GET | `/imports/{id}/review` | Get transactions needing review |
| POST | `/imports/{id}/confirm` | Confirm import with reviewed categories |
| DELETE | `/imports/{id}` | Delete import + all its transactions |

**POST /imports/upload** — multipart/form-data with `file` field  
Response 202:
```json
{
  "import_id": "uuid",
  "task_id": "celery-task-uuid",
  "message": "File uploaded. Processing started.",
  "status_url": "/api/v1/imports/uuid"
}
```

**GET /imports/{id}** Response (after processing):
```json
{
  "id": "uuid",
  "filename": "HDFC_Statement_Jun2026.pdf",
  "bank_name": "HDFC Bank",
  "statement_from": "2026-06-01",
  "statement_to": "2026-06-30",
  "total_rows": 87,
  "imported_rows": 79,
  "skipped_rows": 8,
  "status": "completed",
  "needs_review": 12,
  "duplicates_found": 3
}
```

---

### 3.4 Analytics / Dashboard

| Method | Path | Description |
|---|---|---|
| GET | `/analytics/summary` | Summary cards for dashboard |
| GET | `/analytics/by-category` | Spend grouped by category |
| GET | `/analytics/daily` | Daily spend for a date range |
| GET | `/analytics/monthly-trend` | Monthly totals for last N months |
| GET | `/analytics/top-merchants` | Top 10 merchants by spend |
| GET | `/analytics/budget-status` | Budget vs actual per category |

**GET /analytics/summary** Query params: `from_date`, `to_date`  
Response 200:
```json
{
  "total_spent": 42350.75,
  "vs_last_month": { "amount": 38200.00, "change_pct": 10.86, "direction": "up" },
  "largest_expense": { "amount": 12000.00, "description": "Home Loan EMI", "date": "2026-07-01" },
  "days_remaining": 28,
  "projected_month_total": 58750.00,
  "total_transactions": 67
}
```

**GET /analytics/by-category** Response:
```json
{
  "from_date": "2026-07-01",
  "to_date": "2026-07-03",
  "total": 42350.75,
  "categories": [
    { "category_id": 5, "slug": "loan_emi", "name": "Loan EMI", "icon": "🏦", "amount": 15000.00, "pct": 35.4, "count": 1 },
    { "category_id": 1, "slug": "food_dining", "name": "Food & Dining", "icon": "🍽️", "amount": 8200.00, "pct": 19.4, "count": 23 }
  ]
}
```

---

### 3.5 Saving Tips

| Method | Path | Description |
|---|---|---|
| GET | `/tips` | Get tips for a month (defaults to current) |
| POST | `/tips/generate` | Trigger on-demand generation |
| PATCH | `/tips/{id}` | Rate or dismiss a tip |

**POST /tips/generate** Response 202:
```json
{ "task_id": "uuid", "message": "Tips generation started. Check back in a few seconds." }
```

**PATCH /tips/{id}** Request:
```json
{ "rating": 1 }   // 1 = helpful, -1 = not helpful, null = reset
// OR
{ "is_dismissed": true }
```

---

### 3.6 Budgets

| Method | Path | Description |
|---|---|---|
| GET | `/budgets` | Get budgets for a month |
| PUT | `/budgets` | Set/update budgets for a month (bulk upsert) |
| POST | `/budgets/copy` | Copy budgets from one month to another |

---

### 3.7 Categories

| Method | Path | Description |
|---|---|---|
| GET | `/categories` | List all categories (tree structure) |
| POST | `/categories` | Create custom category |

---

### 3.8 Export & Reports

| Method | Path | Description |
|---|---|---|
| GET | `/export/csv` | Export expenses as CSV (streamed) |
| POST | `/export/pdf` | Queue PDF report generation |
| GET | `/export/pdf/{task_id}` | Download generated PDF |

---

## 4. Statement Parsing Engine

### 4.1 Parser Architecture

```
Upload → FileValidator → FormatDetector → BankParser → TransactionNormalizer → Deduplicator → Categorizer → ReviewQueue
```

### 4.2 Supported File Formats

**CSV Parser** (`parsers/csv_parser.py`)
- Auto-detects delimiter (comma, pipe, semicolon)
- Tries multiple date formats: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
- Detects header row by scanning for keywords: "date", "narration", "debit", "credit", "withdrawal", "deposit"
- Maps columns using fuzzy matching: "Tran Date" → date, "Cheque/Ref.No" → reference, "Withdrawal Amt.(INR)" → debit

**PDF Parser** (`parsers/pdf_parser.py`)
- Uses `pdfplumber` for table extraction from digital PDFs
- Falls back to text extraction + regex for non-table PDFs
- Bank-specific regex patterns maintained per bank:
  - HDFC: `r"(\d{2}/\d{2}/\d{2})\s+(.+?)\s+(\d+\.\d{2})\s+(\d+\.\d{2})?"`
  - SBI, ICICI, Axis, Kotak — separate pattern sets
- Ignores header/footer rows, opening/closing balance rows

**Excel Parser** (`parsers/excel_parser.py`)
- Uses `openpyxl` to read .xlsx, `xlrd` for legacy .xls
- Finds the data start row by looking for "Date" or "Transaction" in column headers
- Skips merged header rows automatically

### 4.3 Transaction Normalization

Every parsed row is normalized to:
```python
class NormalizedTransaction:
    date: date
    description: str      # cleaned narration
    debit_amount: Decimal # None if credit
    credit_amount: Decimal # None if debit
    balance: Decimal | None
    reference: str | None
    bank_name: str
```

Cleaning steps on `description`:
1. Strip leading/trailing whitespace and control characters
2. Collapse multiple spaces to single space
3. Remove common noise suffixes: `"/INF"`, `"NEFT-"`, `"UPI-"`, `"IMPS-"`
4. Uppercase for keyword matching

### 4.4 Deduplication

A `narration_hash` is computed as:
```python
import hashlib
hash_input = f"{date}|{amount}|{description[:50].upper().strip()}"
narration_hash = hashlib.sha256(hash_input.encode()).hexdigest()
```
Any expense with the same `user_id + narration_hash` is flagged as duplicate.

---

## 5. Categorization Engine

### 5.1 Two-Stage Pipeline

**Stage 1 — Keyword Matching (fast, deterministic)**
```python
KEYWORD_RULES = {
    "food_dining": ["swiggy", "zomato", "mcdonald", "domino", "kfc", "pizza hut", "uber eats", "restaurant"],
    "grocery": ["bigbasket", "grofers", "blinkit", "dmart", "reliance fresh", "spencer", "nature basket"],
    "petrol_fuel": ["hp petrol", "bpcl", "indian oil", "shell", "iocl", "hpcl", "reliance petro", "hp pump"],
    "ott_subscriptions": ["netflix", "hotstar", "prime video", "spotify", "apple music", "disney", "sony liv", "zee5", "youtube premium"],
    "online_shopping": ["amazon", "flipkart", "myntra", "meesho", "nykaa", "ajio", "tatacliq"],
    "loan_emi": ["emi", "home loan", "hdfc home", "sbi home loan", "lic hfl", "bajaj finance", "lic housing"],
    "edu_loan_emi": ["avanse", "credila", "sbi edu", "hdfc edu", "education loan"],
    "car_loan_emi": ["car emi", "maruti finance", "hyundai finance", "mahindra finance", "car loan"],
    "transport": ["uber", "ola", "rapido", "bmtc", "metro", "irctc", "makemytrip cab", "redbus"],
    "utilities": ["airtel", "jio", "vodafone", "vi recharge", "tata sky", "hathway", "act fibernet"],
    "health_medical": ["apollo pharmacy", "medplus", "1mg", "pharmeasy", "doctor", "hospital", "diagnostics"],
    # ... all 22 categories
}
```
If a keyword match is found, confidence = 90. Category is assigned without ML.

**Stage 2 — ML Model (for ambiguous transactions)**
- If no keyword matches, run TF-IDF + SVM classifier
- Model trained on 50,000 labelled Indian bank transaction descriptions
- Features: TF-IDF trigrams on cleaned description, amount bucket (0-500, 500-2000, 2000-10000, 10000+)
- Confidence = SVM decision function score scaled 0-100
- If confidence < 60, transaction goes to review queue
- User corrections (from `category_corrections` table) are used to retrain the model weekly

### 5.2 Model Storage
- Model persisted as `ml/categorizer_model.pkl` (scikit-learn pipeline pickle)
- Re-training runs as a weekly Celery beat task
- A/B testing: new model validated on held-out set before replacing production model

---

## 6. Saving Tips Engine

### 6.1 Tip Generation Logic (`services/tips_engine.py`)

```python
class TipsEngine:
    def generate(self, user_id: UUID, month: date) -> list[Tip]:
        spend = self._get_month_spend(user_id, month)
        prev_spend = self._get_month_spend(user_id, prev_month(month))
        tips = []
        
        tips += self._check_duplicate_subscriptions(spend)
        tips += self._check_spend_spikes(spend, prev_spend)
        tips += self._check_ott_overlap(spend)
        tips += self._check_food_delivery_excess(spend)
        tips += self._check_petrol_vs_transport(spend)
        tips += self._check_grocery_fragmentation(spend)
        tips += self._check_loan_prepayment_opportunity(spend, user_id)
        tips += self._check_budget_overspend(spend, user_id, month)
        
        tips.sort(key=lambda t: t.potential_saving, reverse=True)
        return tips[:8]
```

### 6.2 Tip Type Definitions

**duplicate_subscription** — Checks if user has > 2 OTT services with combined spend > ₹1,000/month
- Headline: "You're paying for {N} streaming services this month"
- Detail: Lists each service and cost, suggests pausing the least-watched
- Potential saving: cost of lowest-spend subscription

**spend_spike** — Category spend > 130% of prior month average
- Headline: "Your {category} spend jumped {pct}% this month"
- Detail: Shows this month vs. average, identifies top merchants in category
- Potential saving: (this_month - avg_3_month) * 0.5 (50% reduction target)

**food_delivery_excess** — Swiggy/Zomato spend > ₹4,000/month
- Headline: "You spent ₹{amount} on food delivery this month"
- Detail: Average order value, number of orders, cost of cooking at home estimate
- Potential saving: (orders_count * 0.3) * avg_order_value (reduce by 30%)

**grocery_fragmentation** — More than 8 separate grocery transactions in a month
- Headline: "You made {count} grocery trips — bulk shopping could save you money"
- Detail: Total grocery spend, average per trip, bulk-buy saving estimate
- Potential saving: 10% of grocery total

**loan_prepayment** — User has loan EMI + available surplus (income - total_spend > EMI * 0.5)
- Headline: "Pay ₹{extra} extra on your home loan this month"
- Detail: Shows interest saving calculation over loan tenure
- Potential saving: interest saved (simplified calculation)

---

## 7. Celery Background Tasks

### 7.1 Task Definitions (`tasks/`)

```python
# tasks/import_tasks.py
@celery.task(bind=True, max_retries=3)
def process_statement_import(self, import_id: str): ...

# tasks/tip_tasks.py
@celery.task
def generate_monthly_tips(user_id: str, month: str): ...

# tasks/email_tasks.py
@celery.task
def send_monthly_tips_email(user_id: str): ...

@celery.task
def send_budget_alert_email(user_id: str, category_id: int, pct_used: float): ...

@celery.task
def send_weekly_summary_email(user_id: str): ...

# tasks/recurring_tasks.py
@celery.task
def create_recurring_expenses(): ...  # runs daily at midnight

# tasks/ml_tasks.py
@celery.task
def retrain_categorizer_model(): ...  # runs weekly Sunday 2 AM
```

### 7.2 Celery Beat Schedule
```python
CELERYBEAT_SCHEDULE = {
    "create-recurring-expenses": {
        "task": "tasks.recurring_tasks.create_recurring_expenses",
        "schedule": crontab(hour=0, minute=0),  # daily midnight
    },
    "send-monthly-tips": {
        "task": "tasks.email_tasks.send_monthly_tips_email_all",
        "schedule": crontab(hour=9, minute=0, day_of_month=25),
    },
    "send-weekly-summary": {
        "task": "tasks.email_tasks.send_weekly_summary_all",
        "schedule": crontab(hour=20, minute=0, day_of_week=0),  # Sunday 8 PM
    },
    "retrain-model": {
        "task": "tasks.ml_tasks.retrain_categorizer_model",
        "schedule": crontab(hour=2, minute=0, day_of_week=0),  # Sunday 2 AM
    },
}
```

---

## 8. Frontend Architecture

### 8.1 Page Structure

```
src/
├── pages/
│   ├── auth/
│   │   ├── LoginPage.tsx
│   │   ├── RegisterPage.tsx
│   │   ├── ForgotPasswordPage.tsx
│   │   └── ResetPasswordPage.tsx
│   ├── DashboardPage.tsx
│   ├── ExpensesPage.tsx          ← expense list with filters
│   ├── AddExpensePage.tsx         ← single + bulk entry
│   ├── ImportPage.tsx             ← upload + review flow
│   ├── AnalyticsPage.tsx          ← all charts
│   ├── BudgetsPage.tsx
│   ├── TipsPage.tsx
│   ├── ReportsPage.tsx
│   └── SettingsPage.tsx
├── components/
│   ├── charts/
│   │   ├── SpendingDonut.tsx
│   │   ├── MonthlyTrendBar.tsx
│   │   ├── DailyLineChart.tsx
│   │   └── BudgetProgress.tsx
│   ├── expenses/
│   │   ├── ExpenseTable.tsx
│   │   ├── ExpenseForm.tsx
│   │   ├── CategoryBadge.tsx
│   │   └── PaymentMethodIcon.tsx
│   ├── import/
│   │   ├── FileDropzone.tsx
│   │   ├── ImportProgress.tsx
│   │   └── ReviewQueue.tsx
│   ├── tips/
│   │   └── TipCard.tsx
│   └── ui/                        ← shadcn/ui components
├── api/
│   ├── client.ts                  ← axios instance + interceptors
│   ├── expenses.ts                ← CRUD hooks
│   ├── analytics.ts               ← dashboard hooks
│   ├── imports.ts                 ← upload + polling hooks
│   ├── tips.ts
│   └── budgets.ts
├── contexts/
│   ├── AuthContext.tsx
│   └── ThemeContext.tsx
├── hooks/
│   ├── useImportPolling.ts        ← polls import status until complete
│   └── useDebounce.ts
└── utils/
    ├── currency.ts                ← formatINR() helper
    ├── dateUtils.ts
    └── categoryUtils.ts
```

### 8.2 Real-Time Import Progress

During statement parsing, the frontend polls `GET /api/v1/imports/{id}` every 2 seconds until `status === "completed"`. The `ImportProgress` component maps Celery task states to UI steps:

```
Uploading → Validating → Parsing rows → Categorizing → Complete
```

### 8.3 Currency Formatting

All amounts use Indian number formatting:
```typescript
export const formatINR = (amount: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0
  }).format(amount);
// ₹1,20,450
```

---

## 9. Deployment Architecture

### 9.1 Docker Compose (localhost)

```yaml
services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: spendsmart
      POSTGRES_USER: spendsmart
      POSTGRES_PASSWORD: spendsmart_secret
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  api:
    build: .
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    environment:
      DATABASE_URL: postgresql+asyncpg://spendsmart:spendsmart_secret@db/spendsmart
      REDIS_URL: redis://redis:6379/0
      JWT_SECRET: changeme_in_production
      MAIL_FROM: noreply@spendsmart.app
    depends_on: [db, redis]
    ports:
      - "8000:8000"

  worker:
    build: .
    command: celery -A tasks.celery_app worker --loglevel=info
    depends_on: [api, redis]

  beat:
    build: .
    command: celery -A tasks.celery_app beat --loglevel=info
    depends_on: [worker]

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on: [api]

volumes:
  pgdata:
```

### 9.2 Cloud Deployment (GCP)

- **API**: Cloud Run (auto-scaling, 0 → N instances)
- **Database**: Cloud SQL PostgreSQL 15 (HA with read replica)
- **Cache/Queue**: Memorystore Redis
- **Celery Worker**: Cloud Run Job (always-on 1 instance)
- **Frontend**: Cloud Storage + Cloud CDN (static SPA)
- **File uploads**: Cloud Storage bucket (files deleted after parsing)
- **Secrets**: Secret Manager (JWT secret, DB password, SMTP credentials)

### 9.3 Environment Variables

```env
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@host/spendsmart

# Redis / Celery
REDIS_URL=redis://localhost:6379/0

# JWT
JWT_SECRET=your-256-bit-secret
JWT_ALGORITHM=HS256
JWT_EXPIRY_DAYS=30

# Email (SMTP)
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=noreply@spendsmart.app
MAIL_PASSWORD=app-password
MAIL_FROM=SpendSmart <noreply@spendsmart.app>

# App
APP_ENV=production
FRONTEND_URL=https://app.spendsmart.in
MAX_UPLOAD_MB=25
```

---

## 10. Security Implementation

### 10.1 Authentication Flow

```
Login Request
→ Validate credentials
→ Check account not locked
→ bcrypt.verify(password, hash)
→ Issue access_token (JWT, 30d) + refresh_token (JWT, 90d, stored in HttpOnly cookie)
→ On each request: decode JWT → extract user_id → inject into request context
→ Refresh: validate refresh_token → issue new pair → invalidate old refresh_token
```

### 10.2 Rate Limiting

Implemented via Redis + `slowapi` middleware:
```python
limiter = Limiter(key_func=get_remote_address)

@app.post("/auth/login")
@limiter.limit("5/minute")
async def login(...): ...

@app.get("/expenses")
@limiter.limit("100/minute")
async def list_expenses(...): ...
```

### 10.3 File Upload Security

- MIME type validated via `python-magic` (not just file extension)
- File size limit enforced at nginx level (25 MB)
- Uploaded files stored in `/tmp/imports/{uuid}/` and deleted after parsing
- PDF files scanned for embedded scripts before parsing

---

## 11. Testing Strategy

### 11.1 Unit Tests (`tests/unit/`)

- Parsers: test each bank format with fixture files
- Categorizer: 200 labelled test transactions, assert precision > 85%
- Tips engine: mock spend data, assert correct tip types generated
- Auth: password hashing, JWT encode/decode, OTP expiry

### 11.2 Integration Tests (`tests/integration/`)

- Full API endpoint tests using `httpx` + `pytest-asyncio`
- Database: use `pytest-postgres` for isolated test DB per run
- Celery: use `celery --task-always-eager` mode

### 11.3 End-to-End Tests (`tests/e2e/`)

- Playwright tests for critical user journeys:
  - Register → verify email → login → add expense → view dashboard
  - Upload CSV statement → review → confirm → check dashboard updated
  - Generate tips → dismiss tip → verify dismissed

### 11.4 Test Fixtures

```
tests/fixtures/
├── statements/
│   ├── hdfc_sample.pdf       ← 50-row HDFC statement
│   ├── sbi_sample.csv        ← 100-row SBI CSV export
│   ├── icici_sample.xlsx     ← ICICI Excel statement
│   └── axis_sample.csv
└── seed_data/
    ├── categories.json       ← full category taxonomy
    └── sample_expenses.json  ← 6 months of test expenses
```
