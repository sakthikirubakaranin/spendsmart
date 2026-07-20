"""
One-time migration script:
  1. Seeds the categories table (idempotent — safe to run multiple times)
  2. Re-categorizes all expenses that currently have NULL category_id

Run from the spendsmart-api/ directory:
    python3 migrate_categories.py

Requires:  pip install asyncpg python-dotenv --break-system-packages
"""

import asyncio
import os
import sys

import asyncpg
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "")
if not DATABASE_URL:
    sys.exit("❌  DATABASE_URL not set in environment / .env")

# ── Same categorizer logic (inline to avoid import path issues) ───────────────
import re

RULES = [
    ("savings", [
        "gullak", "gullakmoney", "gullak money", "gullak-money",
        "digital gold", "safe gold", "mmtc.*gold",
        "autopay.*sip", "mf sip", "sip.*mutual", "nps contribution",
        "ppf transfer", "recurring deposit", "rd instalment",
    ], 95),
    ("savings_investment", [
        "mutual fund", "zerodha", "groww", "upstox", "kuvera",
        "axis mf", "sbi mf", "hdfc mf", "icici pru", "nippon mf",
        "parag parikh", "motilal oswal", "smallcase",
        "nps", "ppf", "dividend", "angel broking", "5paisa",
    ], 88),
    ("loan_emi", [
        "emi ", "nach dr", "ach d-", "nach debit", "ach debit",
        "home loan", "car loan", "personal loan", "auto loan",
        "two wheeler", "vehicle loan",
        "idfc first bank", "eduvanz", "aditya birla finance",
        "bajaj finserv", "fullerton", "credila",
        "razorpaysoftwarepriv-eduvanz",
        "loan repayment", "emi payment",
    ], 90),
    ("insurance", [
        "lic of india", "lic premium",
        "hdfc life", "icici prudential", "max life",
        "star health", "niva bupa", "care health",
        "bajaj allianz", "reliance general", "new india assurance",
        "policybazaar", "insurance premium", "insurance payment",
        "digit insurance", "go digit", "acko",
    ], 90),
    ("tax", [
        "cbdt tin", "income tax", "tds payment", "advance tax",
        "gst payment", "tax payment", "e-tax",
    ], 92),
    ("credit_card_bill", [
        "scapia", "credit card bill", "hdfc cc", "icici cc",
        "axis cc", "sbi card", "amex", "citibank cc",
        "onecard", "credit card", "cc payment", "card payment",
    ], 88),
    ("ott_subscriptions", [
        "netflix", "spotify", "amazon prime", "disney hotstar", "hotstar",
        "jiocinema", "sonyliv", "sony liv", "zee5", "mxplayer", "hungama",
        "apple music", "apple subscription", "youtube premium",
        "apple media services", "apple.com/bill", "applemedia",
        "adobe", "microsoft 365", "office 365", "dropbox", "notion",
        "chatgpt", "openai", "xaillc", "grok",
        "canva", "figma", "jetbrains",
        "google one", "google storage",
    ], 88),
    ("cloud_services", [
        "google cloud", "aws india", "amazonaws", "azure",
        "digitalocean", "hetzner", "vercel", "cloudflare",
        "google india digital", "goog-",
    ], 87),
    ("utilities", [
        "bescom", "tata power", "torrent power", "adani electricity",
        "msedcl", "bses", "electricity bill", "water bill",
        "piped gas", "gas bill", "tneb", "kseb", "tangedco",
        "airtel", "jio recharge", "vodafone", "vi payment", "bsnl",
        "broadband", "fiber", "recharge", "mobile bill",
        "atria convergence", "actcorp", "hathway",
        "dth recharge", "tatasky", "dish tv", "sun direct",
        "airtelcommonpool", "fasttag", "toll payment",
    ], 85),
    ("grocery", [
        "swiggyinstamart", "swiggy instamart",
        "bigbasket", "grofers", "blinkit", "zepto", "dunzo",
        "dmart", "reliance fresh", "reliance smart", "more supermarket",
        "nilgiris", "nature basket", "star bazaar",
        "safal", "grocery", "kirana", "jiomart",
        "zptmktp",
    ], 85),
    ("food_dining", [
        "swiggy", "swiggyupi", "upiswiggy", "swiggy-upi",
        "swiggy ltd", "swiggy-swiggy",
        "zomato",
        "dominos", "dominospizza", "pizza hut", "kfc", "mcdonald",
        "subway", "burger king", "starbucks",
        "cafe coffee day", "ccd", "costa coffee", "dunkin",
        "haldiram", "barbeque nation",
        "adyar ananda bhavan", "ananda bhavan",
        "restaurant", "biryani", "food court",
        "hotel bfst", "hotel lnch", "canteen",
        "rayalaseema spice", "rasikas restaurant",
    ], 82),
    ("fuel", [
        "hpcl", "bpcl", "iocl", "indian oil", "bharat petroleum",
        "hindustan petroleum", "shell", "nayara", "essar oil",
        "petro agency", "petrol pump", "hp petrol",
        "pms petro", "p m s petro", "fuel servi", "five road fuel",
    ], 87),
    ("transport", [
        "ola cabs", "uber", "rapido", "namma yatri",
        "metro card", "dmrc", "bmtc", "best bus",
        "irctc", "railway", "rail ticket", "redbus",
        "yulu", "bounce", "vogo", "zoomcar",
    ], 80),
    ("online_shopping", [
        "amazon", "amazonupi", "amazon india", "amazon pay",
        "flipkart", "myntra", "ajio",
        "nykaa", "meesho", "snapdeal", "tata cliq",
        "reliance digital", "croma", "vijay sales",
        "h&m", "zara", "max fashion", "westside", "lifestyle", "shopsy",
    ], 82),
    ("health_medical", [
        "apollo pharmacy", "medplus", "1mg", "pharmeasy", "netmeds",
        "practo", "mfine", "tata health",
        "hospital", "nursing home", "diagnostic", "clinic",
        "pharmacy", "medcare", "healthspring",
        "manipal", "fortis", "max healthcare",
        "gokulam", "sri gokulam",
    ], 82),
    ("personal_care", [
        "salon", "saloon", "barbershop", "barber", "haircut",
        "spa", "beauty", "nails", "grooming",
        "restoration centre",
    ], 80),
    ("education", [
        "coursera", "udemy", "byju", "unacademy", "vedantu", "upgrad",
        "simplilearn", "great learning", "linkedin learning",
        "school fees", "college fees", "tuition", "coaching",
        "fee payment", "exam fee", "university",
    ], 82),
    ("housing", [
        "rent payment", "house rent", "flat rent", "apartment rent",
        "society maintenance", "maintenance charges",
        "landlord", "pg rent", "hostel fees",
        "happenstance pg", "paying guest",
    ], 82),
    ("fitness", [
        "cult fit", "cultfit", "gold gym", "anytime fitness",
        "fitness first", "crossfit", "yoga studio", "decathlon",
    ], 80),
    ("others", [
        "atm wdl", "atw-", "atm withdrawal", "cash withdrawal",
        "cash deposit", "branch cash",
    ], 70),
]

_COMPILED = [
    (slug, re.compile("|".join(re.escape(k) for k in keywords), re.IGNORECASE), conf)
    for slug, keywords, conf in RULES
]


def categorize(narration: str) -> str:
    n = narration.lower()
    for slug, pattern, _ in _COMPILED:
        if pattern.search(n):
            return slug
    return "others"


# ── Category seed rows ───────────────────────────────────────────────────────
CATEGORY_SEEDS = [
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


async def main():
    # Convert postgresql+asyncpg:// → postgresql:// for raw asyncpg
    url = DATABASE_URL
    for prefix in ("postgresql+asyncpg://", "postgresql+psycopg2://"):
        if url.startswith(prefix):
            url = "postgresql://" + url[len(prefix):]
            break

    print(f"🔗  Connecting to database…")
    conn = await asyncpg.connect(url)

    try:
        # ── Step 1: Seed categories ────────────────────────────────────────────
        print("📂  Seeding categories…")
        seeded = 0
        for slug, name, icon, sort_order in CATEGORY_SEEDS:
            result = await conn.execute(
                """
                INSERT INTO categories (slug, name, icon, sort_order, is_system)
                VALUES ($1, $2, $3, $4, true)
                ON CONFLICT (slug) DO NOTHING
                """,
                slug, name, icon, sort_order,
            )
            if result == "INSERT 0 1":
                seeded += 1
        print(f"   ✅  {seeded} categories inserted ({len(CATEGORY_SEEDS) - seeded} already existed)")

        # ── Step 2: Build slug → id map ───────────────────────────────────────
        rows = await conn.fetch("SELECT id, slug FROM categories")
        slug_map: dict[str, int] = {r["slug"]: r["id"] for r in rows}
        print(f"   📋  {len(slug_map)} categories in DB")

        # ── Step 3: Re-categorize NULL category expenses ──────────────────────
        expenses = await conn.fetch(
            "SELECT id, description FROM expenses WHERE category_id IS NULL"
        )
        print(f"\n🔄  Re-categorizing {len(expenses)} uncategorised expenses…")

        updated = 0
        by_slug: dict[str, int] = {}
        for exp in expenses:
            slug = categorize(exp["description"])
            cat_id = slug_map.get(slug)
            if cat_id:
                await conn.execute(
                    "UPDATE expenses SET category_id = $1 WHERE id = $2",
                    cat_id, exp["id"],
                )
                updated += 1
                by_slug[slug] = by_slug.get(slug, 0) + 1

        print(f"   ✅  Updated {updated} expenses")
        if by_slug:
            print("\n   Breakdown by category:")
            for slug, count in sorted(by_slug.items(), key=lambda x: -x[1]):
                print(f"      {slug:<22} {count:>4}")

        # ── Step 4: Verify ────────────────────────────────────────────────────
        remaining = await conn.fetchval(
            "SELECT COUNT(*) FROM expenses WHERE category_id IS NULL"
        )
        print(f"\n🔍  Still uncategorised: {remaining}")
        if remaining:
            print("   (These will show as 'Others' — you can recategorise them manually)")

        print("\n✅  Migration complete!")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
