from urllib.parse import parse_qs, urlencode, urlparse

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


def _build_engine_args() -> tuple[str, dict]:
    """
    Convert a plain postgresql:// URL to postgresql+asyncpg://,
    strip params asyncpg doesn't understand (channel_binding, sslmode),
    and return (url, connect_args).
    """
    # Always start from the raw URL (before scheme conversion)
    raw = settings.DATABASE_URL
    if not raw:
        # Fallback: build from DB_HOST parts (no SSL needed locally)
        from urllib.parse import quote_plus
        pw = quote_plus(settings.DB_PASSWORD)
        url = (
            f"postgresql+asyncpg://{settings.DB_USER}:{pw}"
            f"@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"
        )
        return url, {}

    parsed = urlparse(raw)
    params = parse_qs(parsed.query, keep_blank_values=True)

    # Strip params asyncpg doesn't support
    params.pop("channel_binding", None)
    sslmode = params.pop("sslmode", ["require"])[0]

    # Rebuild URL with asyncpg scheme
    clean_query = urlencode({k: v[0] for k, v in params.items()})
    clean_url = f"postgresql+asyncpg://{parsed.netloc}{parsed.path}"
    if clean_query:
        clean_url += f"?{clean_query}"

    connect_args = {"ssl": sslmode not in ("disable", "allow")}
    return clean_url, connect_args


_url, _connect_args = _build_engine_args()

engine = create_async_engine(
    _url,
    echo=settings.APP_ENV == "development",
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    connect_args=_connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
