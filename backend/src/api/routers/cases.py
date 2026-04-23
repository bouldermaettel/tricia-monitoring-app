from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from src.api.dependencies import get_actor_id, get_db
from src.api.schemas.cases import (
    CaseCreateRequest,
    CaseListResponse,
    CaseReviewResponse,
    CaseReviewUpdateRequest,
    CaseValidationRequest,
    CaseValidationResponse,
)
from src.services.case_service import CaseService
from src.services.validation_service import ValidationService

router = APIRouter()


@router.post("/validate", response_model=CaseValidationResponse)
def validate_case(payload: CaseValidationRequest, db: Session = Depends(get_db)) -> CaseValidationResponse:
    return ValidationService(db).validate(payload)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_case(payload: CaseCreateRequest, db: Session = Depends(get_db), actor_id: str = Depends(get_actor_id)):
    try:
        case = CaseService(db).create_case(payload, actor_id)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"id": case.id}


@router.get("", response_model=CaseListResponse)
def list_cases(
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    expected_value: int | None = Query(default=None),
    observed_value: int | None = Query(default=None),
    problematic_only: bool | None = Query(default=None),
    include_excluded: bool = Query(default=False),
    risk_level: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> CaseListResponse:
    from datetime import date

    parsed_start = date.fromisoformat(start_date) if start_date else None
    parsed_end = date.fromisoformat(end_date) if end_date else None
    return CaseService(db).list_cases(
        page=page,
        page_size=page_size,
        start_date=parsed_start,
        end_date=parsed_end,
        expected_value=expected_value,
        observed_value=observed_value,
        problematic_only=problematic_only,
        include_excluded=include_excluded,
        risk_level=risk_level,
    )


@router.patch("/{case_id}/review", response_model=CaseReviewResponse)
def update_case_review(
    case_id: str,
    payload: CaseReviewUpdateRequest,
    db: Session = Depends(get_db),
    actor_id: str = Depends(get_actor_id),
) -> CaseReviewResponse:
    review = CaseService(db).update_review(case_id, payload, actor_id)
    return CaseReviewResponse(
        case_id=case_id,
        category_code=review.category_code,
        is_excluded=review.is_excluded,
        is_reviewed=review.is_reviewed,
        risk_level=review.risk_level,
        updated_at=review.updated_at,
    )
