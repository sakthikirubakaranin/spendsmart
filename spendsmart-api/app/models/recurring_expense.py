import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, SmallInteger, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class RecurringExpense(Base):
    __tablename__ = "recurring_expenses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    description: Mapped[str] = mapped_column(String(512), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    category_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("categories.id"))
    payment_method: Mapped[str | None] = mapped_column(String(32))
    frequency: Mapped[str] = mapped_column(String(16), nullable=False)   # weekly | monthly | quarterly
    day_of_month: Mapped[int | None] = mapped_column(SmallInteger)        # 1–28
    day_of_week: Mapped[int | None] = mapped_column(SmallInteger)         # 0=Mon
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    next_due_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="recurring_expenses")
    category = relationship("Category")
