"""
Detect recurring expenses from a batch of imported transactions.

Logic:
  1. Keep only transactions in "recurring-likely" categories.
  2. Normalise the narration to a merchant key (strip UPI/NACH prefixes).
  3. Group by merchant key.
  4. For each group, emit one RecurringCandidate using the most recent
     transaction's date/amount and computing next_due_date.

The caller is responsible for deduplication against existing recurring_expenses.
"""

from __future__ import annotations

import calendar
import re
from dataclasses import dataclass, field
from datetime import date, timedelta


# Categories whose transactions are strong signals for a recurring item.
# slug → (frequency, min_confidence_to_auto_create)
RECURRING_CATEGORY_FREQ: dict[str, tuple[str, int]] = {
    "loan_emi":          ("monthly",   85),
    "credit_card_bill":  ("monthly",   80),
    "insurance":         ("monthly",   75),
    "savings":           ("monthly",   85),   # Gullak / gold SIP
    "savings_investment":("monthly",   80),   # MF SIP
    "ott_subscriptions": ("monthly",   75),
    "housing":           ("monthly",   80),   # rent / PG
    "utilities":         ("monthly",   65),   # mobile bill, broadband
    "fitness":           ("monthly",   70),   # gym
}

# Prefixes to strip before deriving merchant key
_STRIP_PREFIXES = [
    r"^UPI[-/]",
    r"^NACH\s+DR[-/]?\s*",
    r"^ACH\s+D[-/]?\s*",
    r"^NEFT[-/]\s*",
    r"^IMPS[-/]\s*",
    r"^ATW[-/]?\s*",
    r"^RTGS[-/]\s*",
]
_STRIP_RE = re.compile("|".join(_STRIP_PREFIXES), re.IGNORECASE)

# After stripping prefix, cut at first @ or second - to get merchant name
_CUT_RE = re.compile(r"[@].*$")


def _merchant_key(description: str) -> str:
    """Normalise to a short, stable merchant identifier."""
    d = _STRIP_RE.sub("", description).strip()
    d = _CUT_RE.sub("", d).strip()
    # Collapse multiple spaces, take first 60 chars, lowercase
    d = re.sub(r"\s+", " ", d)
    return d[:60].lower()


def _advance_one_month(d: date) -> date:
    m = d.month + 1
    y = d.year
    if m > 12:
        m, y = 1, y + 1
    last = calendar.monthrange(y, m)[1]
    return date(y, m, min(d.day, last))


@dataclass
class RecurringCandidate:
    merchant_key: str          # dedup key
    description: str           # human-readable (from most recent txn)
    amount: float
    category_slug: str
    category_id: int | None
    frequency: str
    day_of_month: int
    next_due_date: date
    occurrences: int           # how many times seen in this import


@dataclass
class _Group:
    slug: str
    category_id: int | None
    frequency: str
    dates: list[date] = field(default_factory=list)
    amounts: list[float] = field(default_factory=list)
    descriptions: list[str] = field(default_factory=list)


def detect_recurring(
    transactions: list,           # list of ConfirmTransaction (has .date, .description, .amount, .category_slug, .txn_type)
    slug_map: dict[str, int],     # slug → category_id
) -> list[RecurringCandidate]:
    """
    Analyse a batch of imported transactions and return detected recurring items.
    Only debit transactions in recurring-likely categories are considered.
    """
    groups: dict[str, _Group] = {}

    for txn in transactions:
        if txn.txn_type != "debit":
            continue
        slug = txn.category_slug
        if slug not in RECURRING_CATEGORY_FREQ:
            continue

        freq, _min_conf = RECURRING_CATEGORY_FREQ[slug]
        key = _merchant_key(txn.description)
        if not key:
            continue

        if key not in groups:
            groups[key] = _Group(
                slug=slug,
                category_id=slug_map.get(slug),
                frequency=freq,
            )
        g = groups[key]
        g.dates.append(txn.date)
        g.amounts.append(txn.amount)
        g.descriptions.append(txn.description)

    candidates: list[RecurringCandidate] = []

    for key, g in groups.items():
        # Sort by date
        paired = sorted(zip(g.dates, g.amounts, g.descriptions), key=lambda x: x[0])
        last_date, last_amount, last_desc = paired[-1]

        # Use median amount (most stable value for EMIs etc.)
        sorted_amounts = sorted(g.amounts)
        mid = len(sorted_amounts) // 2
        median_amount = sorted_amounts[mid]

        # day_of_month from the most recent occurrence
        dom = last_date.day

        # next_due_date = one month after the most recent occurrence
        next_due = _advance_one_month(last_date)

        candidates.append(RecurringCandidate(
            merchant_key=key,
            description=last_desc,
            amount=round(median_amount, 2),
            category_slug=g.slug,
            category_id=g.category_id,
            frequency=g.frequency,
            day_of_month=dom,
            next_due_date=next_due,
            occurrences=len(paired),
        ))

    # Sort: more occurrences first, then by amount descending
    candidates.sort(key=lambda c: (-c.occurrences, -c.amount))
    return candidates
