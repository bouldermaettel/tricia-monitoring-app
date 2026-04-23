from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.orm import Session

from src.api.dependencies import get_actor_id, get_db
from src.api.schemas.imports import ImportJobResponse
from src.services.import_service import ImportService

router = APIRouter()


@router.post("", response_model=ImportJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    actor_id: str = Depends(get_actor_id),
) -> ImportJobResponse:
    payload = await file.read()
    job = ImportService(db).process_file(file.filename or "upload.csv", payload, actor_id)
    return ImportJobResponse(
        job_id=str(job.id),
        status=job.status,
        total_rows=job.total_rows,
        imported_rows=job.imported_rows,
        error_rows=job.error_rows,
    )
