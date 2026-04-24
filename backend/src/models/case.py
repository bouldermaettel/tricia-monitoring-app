from datetime import date, datetime
from uuid import uuid4

from sqlalchemy import JSON, Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.db.base import Base


class Case(Base):
    __tablename__ = "cases"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    vk_number: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    device_name: Mapped[str] = mapped_column(String(128))
    analysis_date: Mapped[date] = mapped_column(Date, index=True)
    input_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    source_type: Mapped[str] = mapped_column(String(32), default="manual")
    created_by_user_id: Mapped[str | None] = mapped_column(String(64), ForeignKey("users.id"), nullable=True)
    wimi_shortcut: Mapped[str | None] = mapped_column(String(32), nullable=True)
    validation_status: Mapped[str] = mapped_column(String(32), default="draft")


class CaseCategory(Base):
    __tablename__ = "case_categories"

    code: Mapped[str] = mapped_column(String(64), primary_key=True)
    label: Mapped[str] = mapped_column(String(128))
    description: Mapped[str] = mapped_column(Text, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class CaseReview(Base):
    __tablename__ = "case_reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    case_id: Mapped[str] = mapped_column(String(36), ForeignKey("cases.id"), unique=True)
    category_code: Mapped[str | None] = mapped_column(String(64), ForeignKey("case_categories.code"), nullable=True)
    is_excluded: Mapped[bool] = mapped_column(Boolean, default=False)
    is_reviewed: Mapped[bool] = mapped_column(Boolean, default=False)
    risk_level: Mapped[str] = mapped_column(String(32), default="none")
    updated_by_user_id: Mapped[str | None] = mapped_column(String(64), ForeignKey("users.id"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class CaseComment(Base):
    __tablename__ = "case_comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    case_id: Mapped[str] = mapped_column(String(36), ForeignKey("cases.id"), index=True)
    comment_text: Mapped[str] = mapped_column(Text)
    created_by_user_id: Mapped[str | None] = mapped_column(String(64), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class CaseAuditEvent(Base):
    __tablename__ = "case_audit_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    case_id: Mapped[str] = mapped_column(String(36), ForeignKey("cases.id"), index=True)
    action: Mapped[str] = mapped_column(String(32))
    actor_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    changes: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, index=True)
