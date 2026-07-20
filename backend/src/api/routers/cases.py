from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from src.api.dependencies import get_actor_id, get_db, require_admin
from src.api.schemas.cases import (
    BulkDeleteRequest,
    CaseAuditTrailResponse,
    CommentCreateRequest,
    CaseCreateRequest,
    CaseListResponse,
    CaseReviewResponse,
    CaseReviewUpdateRequest,
    CaseUpdateRequest,
    CaseValidationRequest,
    CaseValidationResponse,
)
from src.services.case_service import CaseService
from src.services.validation_service import ValidationService
from src.services.export_service import ExportService

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
    vk_number: str | None = Query(default=None),
    vk_number_contains: str | None = Query(default=None),
    expected_value: int | None = Query(default=None),
    observed_value: int | None = Query(default=None),
    matrix_dimension: str = Query(default="detectability"),
    problematic_only: bool | None = Query(default=None),
    include_excluded: bool = Query(default=False),
    risk_level: str | None = Query(default=None),
    risk_direction: str | None = Query(default=None),
    wimi_shortcut: str | None = Query(default=None),
    device_name: str | None = Query(default=None),
    tricia_p: int | None = Query(default=None),
    tricia_s: int | None = Query(default=None),
    user_s: int | None = Query(default=None),
    tricia_d: int | None = Query(default=None),
    user_d: int | None = Query(default=None),
    category_code: str | None = Query(default=None),
    comment_text: str | None = Query(default=None),
    is_excluded: bool | None = Query(default=None),
    is_reviewed: bool | None = Query(default=None),
    has_edits: bool | None = Query(default=None),
    date_reported_from: str | None = Query(default=None),
    date_reported_to: str | None = Query(default=None),
    product_cells: str | None = Query(default=None),
    severity_cells: str | None = Query(default=None),
    detectability_cells: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    all_results: bool = Query(default=False, alias="all"),
    db: Session = Depends(get_db),
) -> CaseListResponse:
    from datetime import date

    def _parse_cells(raw: str | None) -> list[tuple[int, int]] | None:
        if not raw:
            return None
        result: list[tuple[int, int]] = []
        for token in raw.split(','):
            token = token.strip()
            if not token:
                continue
            parts = token.split(':', maxsplit=1)
            if len(parts) == 2:
                try:
                    result.append((int(parts[0]), int(parts[1])))
                except ValueError:
                    pass
        return result or None

    parsed_start = date.fromisoformat(start_date) if start_date else None
    parsed_end = date.fromisoformat(end_date) if end_date else None
    parsed_date_reported_from = date.fromisoformat(date_reported_from) if date_reported_from else None
    parsed_date_reported_to = date.fromisoformat(date_reported_to) if date_reported_to else None
    return CaseService(db).list_cases(
        page=page,
        page_size=page_size,
        all_results=all_results,
        start_date=parsed_start,
        end_date=parsed_end,
        vk_number=vk_number,
        vk_number_contains=vk_number_contains,
        expected_value=expected_value,
        observed_value=observed_value,
        matrix_dimension=matrix_dimension,
        problematic_only=problematic_only,
        include_excluded=include_excluded,
        risk_level=risk_level,
        risk_direction=risk_direction,
        wimi_shortcut=wimi_shortcut,
        device_name=device_name,
        tricia_p=tricia_p,
        tricia_s=tricia_s,
        user_s=user_s,
        tricia_d=tricia_d,
        user_d=user_d,
        category_code=category_code,
        comment_text=comment_text,
        is_excluded=is_excluded,
        is_reviewed=is_reviewed,
        has_edits=has_edits,
        date_reported_from=parsed_date_reported_from,
        date_reported_to=parsed_date_reported_to,
        product_cells=_parse_cells(product_cells),
        severity_cells=_parse_cells(severity_cells),
        detectability_cells=_parse_cells(detectability_cells),
    )


@router.patch("/{case_id}/review", response_model=CaseReviewResponse)
def update_case_review(
    case_id: str,
    payload: CaseReviewUpdateRequest,
    db: Session = Depends(get_db),
    actor_id: str = Depends(get_actor_id),
) -> CaseReviewResponse:
    try:
        review = CaseService(db).update_review(case_id, payload, actor_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return CaseReviewResponse(
        case_id=case_id,
        category_code=review.category_code,
        is_excluded=review.is_excluded,
        is_reviewed=review.is_reviewed,
        risk_level=review.risk_level,
        updated_at=review.updated_at,
    )


@router.put("/{case_id}")
def update_case(
    case_id: str,
    payload: CaseUpdateRequest,
    db: Session = Depends(get_db),
    actor_id: str = Depends(get_actor_id),
):
    try:
        case = CaseService(db).update_case(case_id, payload, actor_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"id": case.id}


@router.post("/{case_id}/comments", status_code=status.HTTP_201_CREATED)
def add_case_comment(
    case_id: str,
    payload: CommentCreateRequest,
    db: Session = Depends(get_db),
    actor_id: str = Depends(get_actor_id),
):
    try:
        comment = CaseService(db).add_comment(case_id, payload.text, actor_id)
    except ValueError as exc:
        message = str(exc)
        status_code = status.HTTP_404_NOT_FOUND if "not found" in message.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=message) from exc
    return {"id": comment.id}


@router.delete("/{case_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_case(
    case_id: str,
    db: Session = Depends(get_db),
    actor_id: str = Depends(get_actor_id),
    _: object = Depends(require_admin),
):
    try:
        CaseService(db).delete_case(case_id, actor_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("", status_code=status.HTTP_200_OK)
def bulk_delete_cases(
    payload: BulkDeleteRequest,
    db: Session = Depends(get_db),
    actor_id: str = Depends(get_actor_id),
    _: object = Depends(require_admin),
):
    count = CaseService(db).bulk_delete_cases(payload.case_ids, actor_id)
    return {"deleted": count}


@router.get("/{case_id}/audit-trail", response_model=CaseAuditTrailResponse)
def get_case_audit_trail(
    case_id: str,
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> CaseAuditTrailResponse:
    return CaseService(db).get_audit_trail(case_id, limit)


@router.get("/{case_id}/audit-trail.xlsx")
def export_case_audit_trail_xlsx(case_id: str, db: Session = Depends(get_db)):
    content = ExportService(db).audit_trail_to_xlsx(case_id)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="audit-trail-{case_id}.xlsx"'},
    )
