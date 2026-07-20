import asyncio
import asyncpg

DB = "postgresql://neondb_owner:npg_HnLK0vTD6SQw@ep-round-dew-ao1xq4oj-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

async def migrate():
    conn = await asyncpg.connect(DB)

    await conn.execute("""
        DO $$ BEGIN
            CREATE TYPE group_role AS ENUM ('admin', 'member');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)

    await conn.execute("""
        DO $$ BEGIN
            CREATE TYPE split_type AS ENUM ('equal', 'custom');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)

    await conn.execute("""
        CREATE TABLE IF NOT EXISTS groups (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(120) NOT NULL,
            description TEXT,
            created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)

    await conn.execute("""
        CREATE TABLE IF NOT EXISTS group_members (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role group_role NOT NULL DEFAULT 'member',
            joined_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(group_id, user_id)
        )
    """)

    await conn.execute("""
        CREATE TABLE IF NOT EXISTS group_expenses (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
            paid_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            description VARCHAR(255) NOT NULL,
            amount NUMERIC(12,2) NOT NULL,
            split_type split_type NOT NULL DEFAULT 'equal',
            expense_date TIMESTAMPTZ DEFAULT NOW(),
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)

    await conn.execute("""
        CREATE TABLE IF NOT EXISTS group_expense_splits (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            expense_id UUID NOT NULL REFERENCES group_expenses(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            amount NUMERIC(12,2) NOT NULL
        )
    """)

    await conn.close()
    print("Groups migration done!")

asyncio.run(migrate())
