from fastapi import APIRouter, Depends, HTTPException, status
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
        risk_categories=config.risk_categories,
        effective_from=config.effective_from,
    )


@router.put("/thresholds", response_model=ThresholdConfig)
def update_thresholds(
    payload: ThresholdConfigUpdateRequest,
    db: Session = Depends(get_db),
    actor_id: str = Depends(get_actor_id),
) -> ThresholdConfig:
    try:
        config = ThresholdService(db).update(payload, actor_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return ThresholdConfig(
        config_key=config.config_key,
        acceptance_threshold=config.acceptance_threshold,
        problem_threshold=config.problem_threshold,
        include_excluded_default=config.include_excluded_default,
        risk_categories=config.risk_categories,
        effective_from=config.effective_from,
    )
