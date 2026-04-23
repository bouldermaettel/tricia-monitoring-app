from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from src.api.dependencies import get_db
from src.api.schemas.matrices import ConfusionMatrixResponse
from src.services.matrix_service import MatrixService

router = APIRouter()


@router.get("/confusion", response_model=ConfusionMatrixResponse)
def get_confusion(
    include_excluded: bool = Query(default=False),
    threshold_key: str = Query(default="default"),
    db: Session = Depends(get_db),
) -> ConfusionMatrixResponse:
    return MatrixService(db).get_confusion_matrix(include_excluded=include_excluded, threshold_key=threshold_key)
