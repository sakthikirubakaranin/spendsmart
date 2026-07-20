from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, case, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.budget import Budget
from app.models.category import Category
from app.models.expense import Expense
from app.models.income import Income
from app.models.user import User

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _current_month_range() -> tuple[date, date]:
    today = date.today()
    return date(today.year, today.month, 1), today


# ── Summary cards ─────────────────────────────────────────────────────────────

@router.get("/summary")
async def summary(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not from_date or not to_date:
        from_date, to_date = _current_month_range()

    base = and_(
        Expense.user_id == current_user.id,
        Expense.is_deleted == False,
        Expense.date >= from_date,
        Expense.date <= to_date,
    )

    result = await db.execute(
        select(
            func.coalesce(func.sum(Expense.amount), 0).label("total"),
            func.count(Expense.id).label("count"),
        ).where(base)
    )
    row = result.one()

    # Largest expense
    lx = await db.execute(
        select(Expense.amount, Expense.description, Expense.date)
        .where(base)
        .order_by(Expense.amount.desc())
        .limit(1)
    )
    largest = lx.one_or_none()

    # Previous period total (same duration)
    delta = (to_date - from_date).days
    prev_from = date.fromordinal(from_date.toordinal() - delta - 1)
    prev_to = date.fromordinal(from_date.toordinal() - 1)
    prev_result = await db.execute(
        select(func.coalesce(func.sum(Expense.amount), 0)).where(
            and_(
                Expense.user_id == current_user.id,
                Expense.is_deleted == False,
                Expense.date >= prev_from,
                Expense.date <= prev_to,
            )
        )
    )
    prev_total = float(prev_result.scalar_one())
    total = float(row.total)
    change_pct = round(((total - prev_total) / prev_total * 100) if prev_total else 0, 2)

    days_in_period = (to_date - from_date).days + 1
    days_elapsed = (date.today() - from_date).days + 1
    projected = round((total / days_elapsed * days_in_period) if days_elapsed > 0 else 0, 2)
    days_remaining = max((to_date - date.today()).days, 0)

    # Income: use period_month when set, otherwise fall back to actual date
    period_start = date(from_date.year, from_date.month, 1)
    period_end   = date(to_date.year, to_date.month, 1)
    effective_month = func.coalesce(
        Income.period_month,
        func.date_trunc("month", Income.date).cast(Income.date.type),
    )
    income_result = await db.execute(
        select(
            func.coalesce(func.sum(Income.amount), 0).label("total"),
            func.count(Income.id).label("count"),
        ).where(
            Income.user_id == current_user.id,
            effective_month >= period_start,
            effective_month <= period_end,
        )
    )
    income_row = income_result.one()
    total_income = float(income_row.total)

    return {
        "total_spent": total,
        "total_income": total_income,
        "net_balance": round(total_income - total, 2),
        "vs_last_period": {
            "amount": prev_total,
            "change_pct": abs(change_pct),
            "direction": "up" if change_pct >= 0 else "down",
        },
        "largest_expense": {
            "amount": float(largest.amount) if largest else 0,
            "description": largest.description if largest else None,
            "date": str(largest.date) if largest else None,
        },
        "days_remaining": days_remaining,
        "projected_month_total": projected,
        "total_transactions": row.count,
    }


# ── By category ───────────────────────────────────────────────────────────────

@router.get("/by-category")
async def by_category(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not from_date or not to_date:
        from_date, to_date = _current_month_range()

    result = await db.execute(
        select(
            Category.id,
            Category.slug,
            Category.name,
            Category.icon,
            func.coalesce(func.sum(Expense.amount), 0).label("amount"),
            func.count(Expense.id).label("count"),
        )
        .join(Expense, and_(
            Expense.category_id == Category.id,
            Expense.user_id == current_user.id,
            Expense.is_deleted == False,
            Expense.date >= from_date,
            Expense.date <= to_date,
        ), isouter=True)
        .group_by(Category.id)
        .order_by(func.sum(Expense.amount).desc().nullslast())
    )
    rows = result.all()

    total = sum(float(r.amount) for r in rows)
    categories = [
        {
            "category_id": r.id,
            "slug": r.slug,
            "name": r.name,
            "icon": r.icon,
            "amount": float(r.amount),
            "pct": round(float(r.amount) / total * 100, 1) if total else 0,
            "count": r.count,
        }
        for r in rows
        if float(r.amount) > 0
    ]
    return {"from_date": str(from_date), "to_date": str(to_date), "total": total, "categories": categories}


# ── Daily spend ───────────────────────────────────────────────────────────────

@router.get("/daily")
async def daily(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not from_date or not to_date:
        from_date, to_date = _current_month_range()

    result = await db.execute(
        select(
            Expense.date.label("day"),
            func.sum(Expense.amount).label("amount"),
        )
        .where(
            Expense.user_id == current_user.id,
            Expense.is_deleted == False,
            Expense.date >= from_date,
            Expense.date <= to_date,
        )
        .group_by(Expense.date)
        .order_by(Expense.date)
    )
    rows = result.all()
    daily_map = {str(r.day): float(r.amount) for r in rows}

    # Fill every day in range with 0 if no spend
    from datetime import timedelta
    days = []
    current = from_date
    while current <= to_date:
        days.append({"date": str(current), "amount": daily_map.get(str(current), 0)})
        current += timedelta(days=1)

    return {"from_date": str(from_date), "to_date": str(to_date), "days": days}


# ── Monthly trend ─────────────────────────────────────────────────────────────

@router.get("/monthly-trend")
async def monthly_trend(
    months: int = Query(6, ge=1, le=24),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import date as date_type

    today = date_type.today()

    # Build ordered list of N months ending this month
    month_list: list[tuple[int, int]] = []
    y, m = today.year, today.month
    for _ in range(months):
        month_list.append((y, m))
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    month_list.reverse()

    earliest = date_type(month_list[0][0], month_list[0][1], 1)

    # Expense totals per month
    exp_result = await db.execute(
        select(
            extract("year",  Expense.date).label("year"),
            extract("month", Expense.date).label("month"),
            func.sum(Expense.amount).label("total"),
        )
        .where(
            Expense.user_id == current_user.id,
            Expense.is_deleted == False,
            Expense.date >= earliest,
        )
        .group_by("year", "month")
        .order_by("year", "month")
    )
    expense_map = {(int(r.year), int(r.month)): float(r.total) for r in exp_result.all()}

    # Income totals per month — use period_month when set, else truncate date
    effective_month = func.coalesce(
        Income.period_month,
        func.date_trunc("month", Income.date).cast(Income.date.type),
    )
    inc_result = await db.execute(
        select(
            extract("year",  effective_month).label("year"),
            extract("month", effective_month).label("month"),
            func.sum(Income.amount).label("income_total"),
        )
        .where(
            Income.user_id == current_user.id,
            effective_month >= earliest,
        )
        .group_by("year", "month")
        .order_by("year", "month")
    )
    income_map = {(int(r.year), int(r.month)): float(r.income_total) for r in inc_result.all()}

    return [
        {
            "year":    ym[0],
            "month":   ym[1],
            "total":   expense_map.get(ym, 0),
            "income":  income_map.get(ym, 0),
        }
        for ym in month_list
    ]


# ── Monthly spend by category ─────────────────────────────────────────────────

@router.get("/monthly-by-category")
async def monthly_by_category(
    months: int = Query(6, ge=1, le=24),
    year: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import date as date_type

    today = date_type.today()

    if year:
        # Show all months Jan–Dec for the requested year (capped at today)
        start_month, start_year = 1, year
        end_month = 12 if year < today.year else today.month
        months = end_month  # reuse variable as month count
        from_date = date_type(year, 1, 1)
    else:
        start_month = today.month - months + 1
        start_year  = today.year
        while start_month <= 0:
            start_month += 12
            start_year  -= 1
        from_date = date_type(start_year, start_month, 1)

    result = await db.execute(
        select(
            extract("year",  Expense.date).label("year"),
            extract("month", Expense.date).label("month"),
            Category.slug,
            Category.name,
            Category.icon,
            func.coalesce(func.sum(Expense.amount), 0).label("amount"),
        )
        .join(Category, Expense.category_id == Category.id, isouter=True)
        .where(
            Expense.user_id    == current_user.id,
            Expense.is_deleted == False,
            Expense.date       >= from_date,
        )
        .group_by("year", "month", Category.slug, Category.name, Category.icon)
        .order_by("year", "month")
    )
    rows = result.all()

    MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    total_months = months  # already adjusted above for year mode

    # Build ordered month labels
    month_labels = []
    y, m = start_year, start_month
    for _ in range(total_months):
        month_labels.append(f"{MONTHS[m-1]} {y}")
        m += 1
        if m > 12:
            m = 1; y += 1

    # Pivot rows
    pivot: dict[str, dict] = {ml: {} for ml in month_labels}
    cat_meta: dict[str, dict] = {}

    for r in rows:
        label = f"{MONTHS[int(r.month)-1]} {int(r.year)}"
        slug  = r.slug  or "uncategorized"
        if label in pivot:
            pivot[label][slug] = float(r.amount)
        cat_meta[slug] = {"name": r.name or "Uncategorized", "icon": r.icon or "📦"}

    # Only categories with actual spend
    active = [s for s in cat_meta if any(pivot[ml].get(s, 0) > 0 for ml in month_labels)]

    data_rows = [
        {"month": ml, **{s: pivot[ml].get(s, 0) for s in active}}
        for ml in month_labels
    ]

    return {
        "months": month_labels,
        "categories": [{"slug": s, **cat_meta[s]} for s in active],
        "rows": data_rows,
    }


# ── Category insights ─────────────────────────────────────────────────────────

@router.get("/category-insights")
async def category_insights(
    year: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Per-category stats for a given year (defaults to current year):
    total, avg_per_month, peak_month, active_months, trend (vs prior year).
    """
    from datetime import date as date_type
    import calendar as cal_mod

    today = date_type.today()
    y = year or today.year

    from_date = date_type(y, 1, 1)
    last_day  = cal_mod.monthrange(y, 12)[1]
    to_date   = min(date_type(y, 12, last_day), today)

    # Current year: per-category per-month totals
    result = await db.execute(
        select(
            Category.id,
            Category.slug,
            Category.name,
            Category.icon,
            extract("month", Expense.date).label("month"),
            func.sum(Expense.amount).label("amount"),
        )
        .join(Expense, and_(
            Expense.category_id == Category.id,
            Expense.user_id     == current_user.id,
            Expense.is_deleted  == False,
            Expense.date        >= from_date,
            Expense.date        <= to_date,
        ))
        .group_by(Category.id, "month")
        .order_by(Category.id, "month")
    )
    rows = result.all()

    # Prior year same range for trend
    py_from = date_type(y - 1, 1, 1)
    py_to   = date_type(y - 1, to_date.month, cal_mod.monthrange(y - 1, to_date.month)[1])
    py_result = await db.execute(
        select(
            Category.id,
            func.sum(Expense.amount).label("amount"),
        )
        .join(Expense, and_(
            Expense.category_id == Category.id,
            Expense.user_id     == current_user.id,
            Expense.is_deleted  == False,
            Expense.date        >= py_from,
            Expense.date        <= py_to,
        ))
        .group_by(Category.id)
    )
    prior_totals = {r.id: float(r.amount) for r in py_result.all()}

    MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

    # Aggregate by category
    cat_data: dict = {}
    for r in rows:
        cid = r.id
        if cid not in cat_data:
            cat_data[cid] = {"id": cid, "slug": r.slug, "name": r.name, "icon": r.icon, "months": {}}
        cat_data[cid]["months"][int(r.month)] = float(r.amount)

    insights = []
    for cid, c in cat_data.items():
        monthly = c["months"]
        total   = sum(monthly.values())
        active  = len(monthly)
        avg     = total / active if active else 0
        peak_m  = max(monthly, key=monthly.get)
        prior   = prior_totals.get(cid, 0)
        trend_pct = round(((total - prior) / prior * 100) if prior else 0, 1)
        insights.append({
            "slug":           c["slug"],
            "name":           c["name"],
            "icon":           c["icon"],
            "total":          round(total, 2),
            "avg_per_month":  round(avg, 2),
            "active_months":  active,
            "peak_month":     MONTHS[peak_m - 1],
            "peak_amount":    round(monthly[peak_m], 2),
            "trend_pct":      trend_pct,
            "trend_dir":      "up" if trend_pct > 0 else ("down" if trend_pct < 0 else "flat"),
            "monthly_data":   [{"month": MONTHS[i], "amount": monthly.get(i + 1, 0)} for i in range(12)],
        })

    insights.sort(key=lambda x: x["total"], reverse=True)
    grand_total = sum(i["total"] for i in insights)
    for i in insights:
        i["pct"] = round(i["total"] / grand_total * 100, 1) if grand_total else 0

    return {"year": y, "total": grand_total, "categories": insights}


# ── Top merchants ─────────────────────────────────────────────────────────────

@router.get("/top-merchants")
async def top_merchants(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    limit: int = Query(10, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not from_date or not to_date:
        from_date, to_date = _current_month_range()

    result = await db.execute(
        select(Expense.description, func.sum(Expense.amount).label("total"))
        .where(
            Expense.user_id == current_user.id,
            Expense.is_deleted == False,
            Expense.date >= from_date,
            Expense.date <= to_date,
        )
        .group_by(Expense.description)
        .order_by(func.sum(Expense.amount).desc())
        .limit(limit)
    )
    return [{"description": r.description, "total": float(r.total)} for r in result.all()]


# ── Budget status ─────────────────────────────────────────────────────────────

@router.get("/budget-status")
async def budget_status(
    month: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not month:
        today = date.today()
        month = date(today.year, today.month, 1)

    month_start = date(month.year, month.month, 1)
    import calendar
    last_day = calendar.monthrange(month.year, month.month)[1]
    month_end = date(month.year, month.month, last_day)

    budgets_result = await db.execute(
        select(Budget).where(Budget.user_id == current_user.id, Budget.month == month_start)
    )
    budgets = budgets_result.scalars().all()

    spend_result = await db.execute(
        select(Expense.category_id, func.sum(Expense.amount).label("spent"))
        .where(
            Expense.user_id == current_user.id,
            Expense.is_deleted == False,
            Expense.date >= month_start,
            Expense.date <= month_end,
        )
        .group_by(Expense.category_id)
    )
    spend_map = {r.category_id: float(r.spent) for r in spend_result.all()}

    return [
        {
            "category_id": b.category_id,
            "budget": float(b.amount),
            "spent": spend_map.get(b.category_id, 0),
            "pct": round(spend_map.get(b.category_id, 0) / float(b.amount) * 100, 1) if b.amount else 0,
        }
        for b in budgets
    ]


# ── Financial tips ────────────────────────────────────────────────────────────

@router.get("/financial-tips")
async def financial_tips(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Analyse the last 3 months of real spending data and return
    personalised tips, savings opportunities, and investment suggestions.
    """
    import calendar as cal_mod
    from datetime import date as date_type

    today = date_type.today()

    def month_range(months_ago: int) -> tuple[date_type, date_type]:
        m = today.month - months_ago
        y = today.year
        while m <= 0:
            m += 12; y -= 1
        last = cal_mod.monthrange(y, m)[1]
        return date_type(y, m, 1), date_type(y, m, last)

    cur_from, cur_to     = month_range(0)
    prev_from, prev_to   = month_range(1)
    prev2_from, prev2_to = month_range(2)

    async def cat_totals(from_d, to_d):
        r = await db.execute(
            select(
                Category.slug, Category.name, Category.icon,
                func.sum(Expense.amount).label("total"),
                func.count(Expense.id).label("cnt"),
            )
            .join(Expense, and_(
                Expense.category_id == Category.id,
                Expense.user_id     == current_user.id,
                Expense.is_deleted  == False,
                Expense.date        >= from_d,
                Expense.date        <= to_d,
            ))
            .group_by(Category.slug, Category.name, Category.icon)
        )
        return {row.slug: {"name": row.name, "icon": row.icon, "total": float(row.total), "cnt": row.cnt}
                for row in r.all()}

    cur   = await cat_totals(cur_from, cur_to)
    prev  = await cat_totals(prev_from, prev_to)
    prev2 = await cat_totals(prev2_from, prev2_to)

    # Income for current period
    effective_month = func.coalesce(
        Income.period_month,
        func.date_trunc("month", Income.date).cast(Income.date.type),
    )
    inc_r = await db.execute(
        select(func.coalesce(func.sum(Income.amount), 0))
        .where(
            Income.user_id == current_user.id,
            effective_month >= cur_from,
            effective_month <= cur_to,
        )
    )
    monthly_income = float(inc_r.scalar_one() or 0)

    cur_total  = sum(v["total"] for v in cur.values())
    prev_total = sum(v["total"] for v in prev.values())

    tips = []

    # ── 1. Category spike vs prev month ──────────────────────────────────────
    SPIKE_SLUGS = ["food_dining", "online_shopping", "entertainment", "fuel",
                   "ott_subscriptions", "personal_care", "others"]
    for slug in SPIKE_SLUGS:
        if slug in cur and slug in prev:
            diff  = cur[slug]["total"] - prev[slug]["total"]
            pct   = diff / prev[slug]["total"] * 100 if prev[slug]["total"] else 0
            if pct > 20 and diff > 200:
                icon = cur[slug]["icon"]
                name = cur[slug]["name"]
                saving = round(diff * 0.5)
                tips.append({
                    "id": f"spike_{slug}",
                    "type": "reduce",
                    "priority": "high" if pct > 40 else "medium",
                    "icon": icon, "category": name,
                    "headline": f"{name} spend is up {pct:.0f}% vs last month",
                    "detail": (
                        f"You spent ₹{cur[slug]['total']:,.0f} on {name} this month vs "
                        f"₹{prev[slug]['total']:,.0f} last month — an increase of ₹{diff:,.0f}. "
                        f"Cutting back to last month's level would save ₹{diff:,.0f}/month."
                    ),
                    "potential_saving": saving,
                })

    # ── 2. Food delivery > 50% of food budget ────────────────────────────────
    food_total = cur.get("food_dining", {}).get("total", 0)
    if food_total > 3000:
        home_saving = round(food_total * 0.3)
        tips.append({
            "id": "food_home_cooking",
            "type": "reduce",
            "priority": "medium",
            "icon": "🍳", "category": "Food & Dining",
            "headline": f"You spent ₹{food_total:,.0f} on food — cooking 3× a week saves 30%",
            "detail": (
                "Home meals cost roughly ₹80–120 vs ₹250–400 for delivery. "
                "Swapping 3 delivery orders per week for home-cooked meals can save "
                f"approximately ₹{home_saving:,.0f}/month without lifestyle sacrifice."
            ),
            "potential_saving": home_saving,
        })

    # ── 3. Subscription audit ─────────────────────────────────────────────────
    sub_total = cur.get("ott_subscriptions", {}).get("total", 0)
    if sub_total > 500:
        tips.append({
            "id": "subscription_audit",
            "type": "reduce",
            "priority": "low",
            "icon": "📺", "category": "OTT & Subscriptions",
            "headline": f"₹{sub_total:,.0f}/month on subscriptions — time for an audit",
            "detail": (
                "List every active subscription and cancel ones unused for 2+ weeks. "
                "Family/annual plans often save 30–40%. "
                "Using one streaming service at a time (rotating quarterly) cuts this by half."
            ),
            "potential_saving": round(sub_total * 0.4),
        })

    # ── 4. High total vs income ───────────────────────────────────────────────
    if monthly_income > 0:
        expense_ratio = cur_total / monthly_income
        if expense_ratio > 0.7:
            tips.append({
                "id": "high_expense_ratio",
                "type": "alert",
                "priority": "high",
                "icon": "⚠️", "category": "Overall Spending",
                "headline": f"You spent {expense_ratio*100:.0f}% of your income this month",
                "detail": (
                    f"Total expenses ₹{cur_total:,.0f} vs income ₹{monthly_income:,.0f}. "
                    "The 50-30-20 rule suggests keeping needs ≤50%, wants ≤30%, "
                    "and saving ≥20%. Review the categories above to find quick wins."
                ),
                "potential_saving": round(monthly_income * 0.2 - (monthly_income - cur_total)),
            })

    # ── 5. Savings suggestion ─────────────────────────────────────────────────
    surplus = monthly_income - cur_total if monthly_income > 0 else 0
    if surplus > 2000:
        sip_amt = round(surplus * 0.5 / 500) * 500  # round to nearest 500
        tips.append({
            "id": "sip_suggestion",
            "type": "invest",
            "priority": "high",
            "icon": "📈", "category": "Investments",
            "headline": f"Start a ₹{sip_amt:,.0f}/month SIP with your surplus",
            "detail": (
                f"You have ₹{surplus:,.0f} left after expenses. "
                f"A ₹{sip_amt:,.0f}/month SIP in an index fund (e.g., Nifty 50) "
                "compounding at ~12% p.a. grows to "
                f"₹{sip_amt * 12 * ((1.01**120 - 1) / 0.01):,.0f} in 10 years. "
                "Start with Zerodha Coin, Groww, or any direct-plan MF platform."
            ),
            "potential_saving": sip_amt,
        })

    # ── 6. Emergency fund check ───────────────────────────────────────────────
    if monthly_income > 0:
        tips.append({
            "id": "emergency_fund",
            "type": "save",
            "priority": "medium",
            "icon": "🛡️", "category": "Emergency Fund",
            "headline": "Build 6 months of expenses as an emergency buffer",
            "detail": (
                f"Your monthly expenses are ~₹{cur_total:,.0f}. "
                f"Target an emergency fund of ₹{cur_total * 6:,.0f} "
                "in a high-interest savings account or liquid fund. "
                "This protects you from job loss, medical bills, and unexpected costs."
            ),
            "potential_saving": 0,
        })

    # ── 7. EMI vs income ratio ────────────────────────────────────────────────
    emi_total = cur.get("loan_emi", {}).get("total", 0)
    if emi_total > 0 and monthly_income > 0 and emi_total / monthly_income > 0.4:
        tips.append({
            "id": "emi_heavy",
            "type": "alert",
            "priority": "high",
            "icon": "🏦", "category": "Loan EMI",
            "headline": f"EMIs are {emi_total/monthly_income*100:.0f}% of your income — above safe limit",
            "detail": (
                f"Total EMI outflow: ₹{emi_total:,.0f}/month. "
                "Financial advisors recommend keeping total EMIs under 40% of net income. "
                "Consider prepaying the smallest loan first (debt snowball) to free up cash flow."
            ),
            "potential_saving": 0,
        })

    # Sort: high priority first, then by potential saving
    priority_order = {"high": 0, "medium": 1, "low": 2}
    tips.sort(key=lambda t: (priority_order.get(t["priority"], 9), -t.get("potential_saving", 0)))

    return {
        "month": str(cur_from)[:7],
        "monthly_income": monthly_income,
        "monthly_expenses": cur_total,
        "surplus": round(monthly_income - cur_total, 2) if monthly_income else 0,
        "top_categories": sorted(
            [{"slug": k, "name": v["name"], "icon": v["icon"], "total": round(v["total"], 2)}
             for k, v in cur.items()],
            key=lambda x: x["total"], reverse=True
        )[:5],
        "tips": tips,
    }


# ── Budget alerts ─────────────────────────────────────────────────────────────

@router.get("/alerts")
async def budget_alerts(
    month: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return categories where this month's spending is >= 80% of the set budget.
    status = 'warning' (80–99%) or 'over' (100%+).
    """
    today = date.today()
    if not month:
        month = date(today.year, today.month, 1)
    else:
        month = date(month.year, month.month, 1)

    month_end = date(
        month.year + (1 if month.month == 12 else 0),
        1 if month.month == 12 else month.month + 1,
        1,
    )

    # Fetch budgets for this month
    budgets_result = await db.execute(
        select(Budget, Category)
        .join(Category, Budget.category_id == Category.id)
        .where(
            Budget.user_id == current_user.id,
            Budget.month == month,
            Budget.amount > 0,
        )
    )
    budget_rows = budgets_result.all()

    if not budget_rows:
        return {"month": str(month)[:7], "alert_count": 0, "alerts": []}

    # Aggregate current-month spending per category
    cat_ids = [b.category_id for b, _ in budget_rows]
    spending_result = await db.execute(
        select(
            Expense.category_id,
            func.coalesce(func.sum(Expense.amount), 0).label("spent"),
        )
        .where(
            Expense.user_id == current_user.id,
            Expense.is_deleted == False,
            Expense.date >= month,
            Expense.date < month_end,
            Expense.category_id.in_(cat_ids),
        )
        .group_by(Expense.category_id)
    )
    spent_map: dict[int, float] = {r.category_id: float(r.spent) for r in spending_result}

    alerts = []
    for budget, category in budget_rows:
        budget_amt = float(budget.amount)
        spent = spent_map.get(budget.category_id, 0.0)
        pct = round(spent / budget_amt * 100, 1) if budget_amt > 0 else 0

        if pct < 80:
            continue

        alerts.append({
            "category_id": category.id,
            "category_name": category.name,
            "category_slug": category.slug,
            "category_icon": category.icon or "💰",
            "budget": budget_amt,
            "spent": round(spent, 2),
            "remaining": round(max(budget_amt - spent, 0), 2),
            "pct": pct,
            "status": "over" if pct >= 100 else "warning",
        })

    # Sort: over-budget first, then by pct descending
    alerts.sort(key=lambda a: (0 if a["status"] == "over" else 1, -a["pct"]))

    return {
        "month": str(month)[:7],
        "alert_count": len(alerts),
        "alerts": alerts,
    }
