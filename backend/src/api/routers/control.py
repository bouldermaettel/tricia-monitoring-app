from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from src.api.dependencies import get_db
from src.api.schemas.control import ControlQueueResponse
from src.services.control_service import ControlService

router = APIRouter()


@router.get("/queue", response_model=ControlQueueResponse)
def get_control_queue(status: str | None = Query(default=None), db: Session = Depends(get_db)) -> ControlQueueResponse:
    return ControlService(db).get_queue(status=status)
