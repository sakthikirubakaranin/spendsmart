"""
Run once after first migration to seed the categories table.
    python -m seed.categories
"""
import asyncio

from sqlalchemy import text

from app.core.database import AsyncSessionLocal

CATEGORIES = [
    # (slug, name, icon, sort_order)
    ("food_dining",         "Food & Dining",         "🍽️",  1),
    ("grocery",             "Grocery",               "🛒",  2),
    ("fuel",                "Petrol & Fuel",         "⛽",  3),
    ("transport",           "Transport",             "🚌",  4),
    ("housing",             "Housing",               "🏠",  5),
    ("loan_emi",            "Loan EMI",              "🏦",  6),
    ("insurance",           "Insurance",             "🛡️",  7),
    ("tax",                 "Tax",                   "🧾",  8),
    ("ott_subscriptions",   "OTT & Subscriptions",  "📱",  9),
    ("cloud_services",      "Cloud Services",        "☁️", 10),
    ("online_shopping",     "Online Shopping",       "🛍️", 11),
    ("health_medical",      "Health & Medical",      "🏥", 12),
    ("personal_care",       "Personal Care",         "💈", 13),
    ("education",           "Education",             "📚", 14),
    ("utilities",           "Utilities & Bills",     "📡", 15),
    ("savings",             "Savings (Gullak)",      "🪣", 16),
    ("savings_investment",  "Investments",           "💰", 17),
    ("credit_card_bill",    "Credit Card Bill",      "💳", 18),
    ("travel",              "Travel",                "✈️", 19),
    ("fitness",             "Fitness",               "🏋️", 20),
    ("family_transfer",     "Family Transfer",       "👨‍👩‍👧", 21),
    ("gifts_donations",     "Gifts & Donations",     "🎁", 22),
    ("entertainment",       "Entertainment",         "🎬", 23),
    ("pet_care",            "Pet Care",              "🐾", 24),
    ("others",              "Others",                "📦", 25),
]


async def seed():
    async with AsyncSessionLocal() as db:
        for slug, name, icon, sort_order in CATEGORIES:
            await db.execute(
                text("""
                    INSERT INTO categories (slug, name, icon, sort_order, is_system)
                    VALUES (:slug, :name, :icon, :sort_order, true)
                    ON CONFLICT (slug) DO NOTHING
                """),
                {"slug": slug, "name": name, "icon": icon, "sort_order": sort_order},
            )
        await db.commit()
    print(f"✅  Seeded {len(CATEGORIES)} categories.")


if __name__ == "__main__":
    asyncio.run(seed())
