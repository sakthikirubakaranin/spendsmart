import asyncio
import asyncpg

DB = "postgresql://neondb_owner:npg_HnLK0vTD6SQw@ep-round-dew-ao1xq4oj-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

async def migrate():
    conn = await asyncpg.connect(DB)
    await conn.execute("ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL")
    await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) NOT NULL DEFAULT 'local'")
    await conn.close()
    print("Migration done!")

asyncio.run(migrate())
