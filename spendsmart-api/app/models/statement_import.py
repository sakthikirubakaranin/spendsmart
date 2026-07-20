import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class StatementImport(Base):
    __tablename__ = "statement_imports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_format: Mapped[str | None] = mapped_column(String(16))       # PDF | CSV | XLSX | OFX
    bank_name: Mapped[str | None] = mapped_column(String(128))
    statement_from: Mapped[date | None] = mapped_column(Date)
    statement_to: Mapped[date | None] = mapped_column(Date)
    total_rows: Mapped[int | None] = mapped_column(Integer)
    imported_rows: Mapped[int | None] = mapped_column(Integer)
    skipped_rows: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(32), default="pending")  # pending|processing|completed|failed
    error_message: Mapped[str | None] = mapped_column(Text)
    task_id: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user = relationship("User", back_populates="imports")
