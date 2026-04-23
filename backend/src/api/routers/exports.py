from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from src.api.dependencies import get_db
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
