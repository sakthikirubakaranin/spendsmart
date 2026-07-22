import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    auth_provider: Mapped[str] = mapped_column(String(20), nullable=False, server_default="local")
    monthly_income: Mapped[float | None] = mapped_column(Numeric(12, 2))

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verification_token: Mapped[str | None] = mapped_column(String(64))

    # AI Assistant — BYOK settings (optional; falls back to server key)
    ai_provider: Mapped[str | None] = mapped_column(String(20))           # gemini | openai | anthropic | groq
    ai_api_key_encrypted: Mapped[str | None] = mapped_column(Text)        # Fernet-encrypted BYOK key

    reset_otp: Mapped[str | None] = mapped_column(String(6))
    reset_otp_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    bank_accounts = relationship("BankAccount", cascade="all, delete-orphan",
                                  foreign_keys="BankAccount.user_id",
                                  primaryjoin="User.id == BankAccount.user_id")
    expenses = relationship("Expense", back_populates="user", cascade="all, delete-orphan")
    incomes = relationship("Income", back_populates="user", cascade="all, delete-orphan")
    budgets = relationship("Budget", back_populates="user", cascade="all, delete-orphan")
    imports = relationship("StatementImport", back_populates="user", cascade="all, delete-orphan")
    recurring_expenses = relationship("RecurringExpense", back_populates="user", cascade="all, delete-orphan")
    saving_tips = relationship("SavingTip", back_populates="user", cascade="all, delete-orphan")
    notification_preference = relationship("NotificationPreference", back_populates="user", uselist=False, cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<User {self.email}>"
