import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class BankAccount(Base):
    __tablename__ = "bank_accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False)          # e.g. "HDFC Salary"
    bank_name: Mapped[str] = mapped_column(String(100), nullable=False)     # e.g. "HDFC Bank"
    account_type: Mapped[str] = mapped_column(String(30), default="savings")  # savings|current|credit_card|wallet
    last_4_digits: Mapped[str | None] = mapped_column(String(4))
    color: Mapped[str] = mapped_column(String(7), default="#8b5cf6")        # hex colour for card
    icon: Mapped[str] = mapped_column(String(10), default="🏦")             # emoji
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    expenses = relationship("Expense", back_populates="bank_account", foreign_keys="Expense.bank_account_id")

    def __repr__(self) -> str:
        return f"<BankAccount {self.name} ({self.bank_name})>"
