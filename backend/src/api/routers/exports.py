from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from src.api.dependencies import get_db
from src.api.schemas.exports import TableExportRequest
from src.services.export_service import ExportService

router = APIRouter()


@router.get("/cases.csv")
def export_cases_csv(
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
    db: Session = Depends(get_db)
):
    filters = {
        "start_date": start_date, "end_date": end_date, "vk_number": vk_number,
        "vk_number_contains": vk_number_contains, "expected_value": expected_value,
        "observed_value": observed_value, "matrix_dimension": matrix_dimension,
        "problematic_only": problematic_only, "include_excluded": include_excluded,
        "risk_level": risk_level, "risk_direction": risk_direction, "wimi_shortcut": wimi_shortcut,
        "device_name": device_name, "tricia_p": tricia_p, "tricia_s": tricia_s,
        "user_s": user_s, "tricia_d": tricia_d, "user_d": user_d,
        "category_code": category_code, "comment_text": comment_text,
        "is_excluded": is_excluded, "is_reviewed": is_reviewed, "has_edits": has_edits,
        "date_reported_from": date_reported_from, "date_reported_to": date_reported_to,
        "product_cells": product_cells, "severity_cells": severity_cells,
        "detectability_cells": detectability_cells
    }
    content = ExportService(db).filtered_table_to_csv([], filters)
    return Response(content=content, media_type="text/csv")


@router.get("/cases.xlsx")
def export_cases_xlsx(
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
    db: Session = Depends(get_db)
):
    filters = {
        "start_date": start_date, "end_date": end_date, "vk_number": vk_number,
        "vk_number_contains": vk_number_contains, "expected_value": expected_value,
        "observed_value": observed_value, "matrix_dimension": matrix_dimension,
        "problematic_only": problematic_only, "include_excluded": include_excluded,
        "risk_level": risk_level, "risk_direction": risk_direction, "wimi_shortcut": wimi_shortcut,
        "device_name": device_name, "tricia_p": tricia_p, "tricia_s": tricia_s,
        "user_s": user_s, "tricia_d": tricia_d, "user_d": user_d,
        "category_code": category_code, "comment_text": comment_text,
        "is_excluded": is_excluded, "is_reviewed": is_reviewed, "has_edits": has_edits,
        "date_reported_from": date_reported_from, "date_reported_to": date_reported_to,
        "product_cells": product_cells, "severity_cells": severity_cells,
        "detectability_cells": detectability_cells
    }
    content = ExportService(db).filtered_table_to_xlsx([], filters)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@router.post("/table.csv")
def export_table_csv(payload: TableExportRequest, db: Session = Depends(get_db)):
    if payload.filters is not None:
        content = ExportService(db).filtered_table_to_csv(payload.columns, payload.filters)
    else:
        content = ExportService.table_to_csv(payload.columns, payload.rows or [])
    return Response(content=content, media_type="text/csv")


@router.post("/table.xlsx")
def export_table_xlsx(payload: TableExportRequest, db: Session = Depends(get_db)):
    if payload.filters is not None:
        content = ExportService(db).filtered_table_to_xlsx(payload.columns, payload.filters)
    else:
        content = ExportService.table_to_xlsx(payload.columns, payload.rows or [])
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
