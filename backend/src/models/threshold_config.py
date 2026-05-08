from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from src.db.base import Base


def default_risk_categories() -> list[dict[str, int | str]]:
    return [
        {"label": "0-10", "min_value": 0, "max_value": 10},
        {"label": "11-250", "min_value": 11, "max_value": 250},
        {"label": "251-500", "min_value": 251, "max_value": 500},
        {"label": "501-1000", "min_value": 501, "max_value": 1000},
    ]


def default_problematic_case_thresholds() -> dict[str, int]:
    return {
        "3M": 10,
        "6M": 20,
        "12M": 40,
    }


class ThresholdConfig(Base):
    __tablename__ = "threshold_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    config_key: Mapped[str] = mapped_column(String(64), unique=True)
    acceptance_threshold: Mapped[int] = mapped_column(Integer, default=1)
    problem_threshold: Mapped[int] = mapped_column(Integer, default=3)
    problematic_case_thresholds: Mapped[dict[str, int]] = mapped_column(JSON, default=default_problematic_case_thresholds)
    include_excluded_default: Mapped[bool] = mapped_column(Boolean, default=False)
    risk_categories: Mapped[list[dict[str, int | str]]] = mapped_column(JSON, default=default_risk_categories)
    effective_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_by_user_id: Mapped[str | None] = mapped_column(String(64), ForeignKey("users.id"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
