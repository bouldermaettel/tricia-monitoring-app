from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from src.api.dependencies import get_actor_id, get_db
from src.api.schemas.imports import ImportDuplicateAction, ImportJobResponse, ImportPreviewResponse
from src.services.import_service import DuplicateVkConflictError, ImportService

router = APIRouter()


@router.post("", response_model=ImportJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_import(
    file: UploadFile = File(...),
    duplicate_action: ImportDuplicateAction = Form("error"),
    db: Session = Depends(get_db),
    actor_id: str = Depends(get_actor_id),
) -> ImportJobResponse:
    payload = await file.read()
    try:
        result = ImportService(db).process_file(
            file.filename or "upload.csv",
            payload,
            actor_id,
            duplicate_action=duplicate_action,
        )
    except DuplicateVkConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "duplicate_vk_conflict",
                "message": "Duplicate VK-NR values found in import file.",
                "duplicates": exc.duplicates,
            },
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return ImportJobResponse(
        job_id=str(result.job.id),
        status=result.job.status,
        total_rows=result.job.total_rows,
        imported_rows=result.job.imported_rows,
        error_rows=result.job.error_rows,
        replaced_rows=result.replaced_rows,
        skipped_rows=result.skipped_rows,
    )


@router.post("/preview", response_model=ImportPreviewResponse)
async def preview_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    actor_id: str = Depends(get_actor_id),
) -> ImportPreviewResponse:
    payload = await file.read()
    try:
        preview = ImportService(db).preview_file(file.filename or "upload.csv", payload, actor_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return ImportPreviewResponse(**preview)
