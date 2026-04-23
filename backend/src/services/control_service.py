from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.api.schemas.control import ControlQueueItem, ControlQueueResponse
from src.models.case import Case


class ControlService:
    def __init__(self, db: Session):
        self.db = db

    def get_queue(self, status: str | None = None) -> ControlQueueResponse:
        query = select(Case)
        if status:
            query = query.where(Case.validation_status == status)
        items = []
        now = datetime.utcnow()
        for record in self.db.scalars(query).all():
            age_hours = (now - record.input_timestamp).total_seconds() / 3600
            delay_bucket = "on_time" if age_hours < 24 else "delayed_24h"
            if age_hours >= 72:
                delay_bucket = "delayed_72h"
            items.append(
                ControlQueueItem(
                    vk_number=record.vk_number,
                    analysis_date=record.analysis_date,
                    input_timestamp=record.input_timestamp,
                    created_by_user_id=record.created_by_user_id,
                    validation_status=record.validation_status,
                    delay_bucket=delay_bucket,
                )
            )
        return ControlQueueResponse(items=items)
