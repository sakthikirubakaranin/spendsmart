import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, SmallInteger, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    budget_alert: Mapped[bool] = mapped_column(Boolean, default=True)
    budget_alert_pct: Mapped[int] = mapped_column(SmallInteger, default=80)
    weekly_summary: Mapped[bool] = mapped_column(Boolean, default=True)
    monthly_tips: Mapped[bool] = mapped_column(Boolean, default=True)
    large_transaction_alert: Mapped[bool] = mapped_column(Boolean, default=True)
    large_tx_threshold: Mapped[float] = mapped_column(Numeric(10, 2), default=5000)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="notification_preference")
