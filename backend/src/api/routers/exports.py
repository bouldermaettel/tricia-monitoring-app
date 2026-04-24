from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from src.api.dependencies import get_db
from src.api.schemas.exports import TableExportRequest
from src.services.export_service import ExportService

router = APIRouter()


@router.get("/cases.csv")
def export_cases_csv(db: Session = Depends(get_db)):
    content = ExportService(db).to_csv()
    return Response(content=content, media_type="text/csv")


@router.get("/cases.xlsx")
def export_cases_xlsx(db: Session = Depends(get_db)):
    content = ExportService(db).to_xlsx()
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@router.post("/table.csv")
def export_table_csv(payload: TableExportRequest):
    content = ExportService.table_to_csv(payload.columns, payload.rows)
    return Response(content=content, media_type="text/csv")


@router.post("/table.xlsx")
def export_table_xlsx(payload: TableExportRequest):
    content = ExportService.table_to_xlsx(payload.columns, payload.rows)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
