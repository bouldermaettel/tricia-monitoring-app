from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from src.api.dependencies import get_db
from src.api.schemas.matrices import ConfusionMatrixResponse
from src.services.matrix_service import MatrixService

router = APIRouter()


@router.get("/confusion", response_model=ConfusionMatrixResponse)
def get_confusion(
    include_excluded: bool = Query(default=False),
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    problematic_only: bool | None = Query(default=None),
    risk_level: str | None = Query(default=None),
    threshold_key: str = Query(default="default"),
    db: Session = Depends(get_db),
) -> ConfusionMatrixResponse:
    from datetime import date

    parsed_start = date.fromisoformat(start_date) if start_date else None
    parsed_end = date.fromisoformat(end_date) if end_date else None
    return MatrixService(db).get_confusion_matrix(
        include_excluded=include_excluded,
        threshold_key=threshold_key,
        start_date=parsed_start,
        end_date=parsed_end,
        problematic_only=problematic_only,
        risk_level=risk_level,
    )
