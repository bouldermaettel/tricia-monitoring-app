from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.api.dependencies import get_actor_id, get_db
from src.api.schemas.config import ThresholdConfig, ThresholdConfigUpdateRequest
from src.services.threshold_service import ThresholdService

router = APIRouter()


@router.get("/thresholds", response_model=ThresholdConfig)
def get_thresholds(db: Session = Depends(get_db)) -> ThresholdConfig:
    config = ThresholdService(db).get("default")
    return ThresholdConfig(
        config_key=config.config_key,
        acceptance_threshold=config.acceptance_threshold,
        problem_threshold=config.problem_threshold,
        include_excluded_default=config.include_excluded_default,
        effective_from=config.effective_from,
    )


@router.put("/thresholds", response_model=ThresholdConfig)
def update_thresholds(
    payload: ThresholdConfigUpdateRequest,
    db: Session = Depends(get_db),
    actor_id: str = Depends(get_actor_id),
) -> ThresholdConfig:
    config = ThresholdService(db).update(payload, actor_id)
    return ThresholdConfig(
        config_key=config.config_key,
        acceptance_threshold=config.acceptance_threshold,
        problem_threshold=config.problem_threshold,
        include_excluded_default=config.include_excluded_default,
        effective_from=config.effective_from,
    )
