from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.api.schemas.config import ThresholdConfigUpdateRequest
from src.models.threshold_config import ThresholdConfig


DEFAULT_RISK_CATEGORIES: list[dict[str, int | str]] = [
    {"label": "0-10", "min_value": 0, "max_value": 10},
    {"label": "11-250", "min_value": 11, "max_value": 250},
    {"label": "251-500", "min_value": 251, "max_value": 500},
    {"label": "501-1000", "min_value": 501, "max_value": 1000},
]


class ThresholdService:
    def __init__(self, db: Session):
        self.db = db

    def get(self, config_key: str = "default") -> ThresholdConfig:
        config = self.db.scalar(select(ThresholdConfig).where(ThresholdConfig.config_key == config_key))
        if config:
            config.risk_categories = self._normalize_risk_categories(config.risk_categories)
            self.db.commit()
            self.db.refresh(config)
            return config
        config = ThresholdConfig(
            config_key=config_key,
            acceptance_threshold=1,
            problem_threshold=3,
            include_excluded_default=False,
            risk_categories=self._normalize_risk_categories(DEFAULT_RISK_CATEGORIES),
        )
        self.db.add(config)
        self.db.commit()
        self.db.refresh(config)
        return config

    def update(self, payload: ThresholdConfigUpdateRequest, actor_id: str) -> ThresholdConfig:
        config = self.get(payload.config_key)
        config.acceptance_threshold = payload.acceptance_threshold
        config.problem_threshold = payload.problem_threshold
        config.include_excluded_default = payload.include_excluded_default
        if payload.risk_categories is not None:
            config.risk_categories = self._normalize_risk_categories(payload.risk_categories)
        else:
            config.risk_categories = self._normalize_risk_categories(config.risk_categories)
        config.updated_by_user_id = actor_id
        config.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(config)
        return config

    def _normalize_risk_categories(self, categories: list[Any] | None) -> list[dict[str, int | str]]:
        if not categories:
            categories = DEFAULT_RISK_CATEGORIES

        normalized: list[dict[str, int | str]] = []
        for index, raw in enumerate(categories):
            if isinstance(raw, dict):
                label = str(raw.get("label", "")).strip() or f"Category {index + 1}"
                min_value = raw.get("min_value")
                max_value = raw.get("max_value")
            else:
                label = str(getattr(raw, "label", "")).strip() or f"Category {index + 1}"
                min_value = getattr(raw, "min_value", None)
                max_value = getattr(raw, "max_value", None)

            if not isinstance(min_value, int) or not isinstance(max_value, int):
                raise ValueError("Risk category boundaries must be integers.")
            if min_value < 0 or max_value < 0:
                raise ValueError("Risk category boundaries must be non-negative.")
            if min_value > max_value:
                raise ValueError("Risk category min_value must be less than or equal to max_value.")

            normalized.append(
                {
                    "label": label,
                    "min_value": min_value,
                    "max_value": max_value,
                }
            )

        normalized.sort(key=lambda item: int(item["min_value"]))
        for prev, current in zip(normalized, normalized[1:]):
            if int(prev["max_value"]) >= int(current["min_value"]):
                raise ValueError("Risk category boundaries must not overlap.")

        return normalized
