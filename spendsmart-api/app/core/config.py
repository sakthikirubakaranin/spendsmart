from urllib.parse import quote_plus

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database — accepts either a full URL or separate parts
    DATABASE_URL: str = ""
    DB_HOST: str = ""
    DB_PORT: int = 5432
    DB_USER: str = "postgres"
    DB_PASSWORD: str = ""
    DB_NAME: str = "postgres"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_DAYS: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 90

    # Email
    MAIL_SERVER: str = "smtp.gmail.com"
    MAIL_PORT: int = 587
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_FROM: str = "SpendSmart <noreply@spendsmart.app>"
    MAIL_TLS: bool = True
    MAIL_SSL: bool = False

    # Firebase (for social login token verification)
    FIREBASE_PROJECT_ID: str = "spendsmart-8d997"

    # Gemini AI (receipt OCR)
    GOOGLE_AI_API_KEY: str = ""

    # App
    APP_ENV: str = "development"
    FRONTEND_URL: str = "http://localhost:5173"
    MAX_UPLOAD_MB: int = 25
    OTP_EXPIRE_MINUTES: int = 10

    @property
    def async_database_url(self) -> str:
        """Return a properly encoded asyncpg URL regardless of how creds are supplied."""
        if self.DB_HOST:
            # Build from parts — password is safe because we encode it here
            pw = quote_plus(self.DB_PASSWORD)
            return (
                f"postgresql+asyncpg://{self.DB_USER}:{pw}"
                f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
            )
        # Fall back to DATABASE_URL — replace scheme if needed
        url = self.DATABASE_URL
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        return url


settings = Settings()
