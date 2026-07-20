"""
One-time cleanup: remove duplicate recurring_expenses.

Two entries are considered duplicates if their descriptions resolve to the same
merchant_key (after stripping UPI/NACH/reference-number prefixes).

For each duplicate group, the OLDEST entry (first created) is kept and the
rest are deleted.

Run from spendsmart-api/:
    python3 dedup_recurring.py
"""
import asyncio, os, re, sys
import asyncpg
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL", "")
if not DATABASE_URL:
    sys.exit("❌  DATABASE_URL not set")

# ── Same normalisation as recurring_detector._merchant_key ────────────────────
_STRIP_RE = re.compile(
    r"^(UPI[-/]|NACH\s+DR[-/]?\s*|ACH\s+D[-/]?\s*|NEFT[-/]\s*|"
    r"IMPS[-/]\s*|ATW[-/]?\s*|RTGS[-/]\s*)",
    re.IGNORECASE,
)
_CUT_RE = re.compile(r"[@].*$")

def merchant_key(description: str) -> str:
    d = _STRIP_RE.sub("", description).strip()
    d = _CUT_RE.sub("", d).strip()
    d = re.sub(r"\s+", " ", d)
    return d[:60].lower()


async def main():
    url = DATABASE_URL
    for prefix in ("postgresql+asyncpg://", "postgresql+psycopg2://"):
        if url.startswith(prefix):
            url = "postgresql://" + url[len(prefix):]
            break

    print("🔗  Connecting…")
    conn = await asyncpg.connect(url)

    try:
        rows = await conn.fetch(
            "SELECT id, user_id, description, created_at FROM recurring_expenses ORDER BY created_at ASC"
        )
        print(f"   Found {len(rows)} recurring_expense records")

        # Group by (user_id, merchant_key)
        seen: dict[tuple, str] = {}   # (user_id, key) → first id to keep
        to_delete: list[str] = []

        for row in rows:
            key = (str(row["user_id"]), merchant_key(row["description"]))
            if key in seen:
                to_delete.append(str(row["id"]))
            else:
                seen[key] = str(row["id"])

        if not to_delete:
            print("✅  No duplicates found — nothing to do.")
            return

        print(f"\n🗑️   Deleting {len(to_delete)} duplicate(s)…")
        for chunk_start in range(0, len(to_delete), 100):
            chunk = to_delete[chunk_start:chunk_start + 100]
            await conn.execute(
                f"DELETE FROM recurring_expenses WHERE id = ANY($1::uuid[])",
                chunk,
            )

        remaining = await conn.fetchval("SELECT COUNT(*) FROM recurring_expenses")
        print(f"✅  Done. {remaining} recurring expense(s) remain.")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
