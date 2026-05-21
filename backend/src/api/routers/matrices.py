from fastapi import APIRouter, Depends, HTTPException, Query
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
    product_cells: str | None = Query(default=None),
    severity_cells: str | None = Query(default=None),
    detectability_cells: str | None = Query(default=None),
    threshold_key: str = Query(default="default"),
    db: Session = Depends(get_db),
) -> ConfusionMatrixResponse:
    from datetime import date

    def _parse_cells(raw: str | None, param_name: str) -> list[tuple[int, int]] | None:
        if not raw:
            return None
        result: list[tuple[int, int]] = []
        for token in raw.split(','):
            token = token.strip()
            if not token:
                continue
            parts = token.split(':', maxsplit=1)
            if len(parts) != 2:
                raise HTTPException(status_code=422, detail=f"{param_name} must be a comma-separated list of expected:observed pairs")
            try:
                result.append((int(parts[0]), int(parts[1])))
            except ValueError as exc:
                raise HTTPException(status_code=422, detail=f"{param_name} values must be integers") from exc
        return result or None

    parsed_start = date.fromisoformat(start_date) if start_date else None
    parsed_end = date.fromisoformat(end_date) if end_date else None
    return MatrixService(db).get_confusion_matrix(
        include_excluded=include_excluded,
        threshold_key=threshold_key,
        start_date=parsed_start,
        end_date=parsed_end,
        problematic_only=problematic_only,
        risk_level=risk_level,
        product_cells=_parse_cells(product_cells, "product_cells"),
        severity_cells=_parse_cells(severity_cells, "severity_cells"),
        detectability_cells=_parse_cells(detectability_cells, "detectability_cells"),
    )
