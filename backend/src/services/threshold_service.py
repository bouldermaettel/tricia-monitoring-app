from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.api.schemas.config import ThresholdConfigUpdateRequest
from src.models.threshold_config import ThresholdConfig


class ThresholdService:
    def __init__(self, db: Session):
        self.db = db

    def get(self, config_key: str = "default") -> ThresholdConfig:
        config = self.db.scalar(select(ThresholdConfig).where(ThresholdConfig.config_key == config_key))
        if config:
            return config
        config = ThresholdConfig(config_key=config_key, acceptance_threshold=1, problem_threshold=3, include_excluded_default=False)
        self.db.add(config)
        self.db.commit()
        self.db.refresh(config)
        return config

    def update(self, payload: ThresholdConfigUpdateRequest, actor_id: str) -> ThresholdConfig:
        config = self.get(payload.config_key)
        config.acceptance_threshold = payload.acceptance_threshold
        config.problem_threshold = payload.problem_threshold
        config.include_excluded_default = payload.include_excluded_default
        config.updated_by_user_id = actor_id
        config.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(config)
        return config
