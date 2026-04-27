from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from src.api.dependencies import get_db
from src.api.schemas.control import ControlQueueResponse
from src.services.control_service import ControlService

router = APIRouter()


@router.get("/queue", response_model=ControlQueueResponse)
def get_control_queue(
    status: str | None = Query(default=None),
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    review_window_days: int = Query(default=28, ge=1),
    db: Session = Depends(get_db),
) -> ControlQueueResponse:
    from datetime import date

    parsed_start = date.fromisoformat(start_date) if start_date else None
    parsed_end = date.fromisoformat(end_date) if end_date else None
    return ControlService(db).get_queue(
        status=status,
        start_date=parsed_start,
        end_date=parsed_end,
        review_window_days=review_window_days,
    )
