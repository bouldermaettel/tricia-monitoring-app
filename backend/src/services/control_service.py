from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.api.schemas.control import ControlQueueItem, ControlQueueResponse
from src.models.case import Case
from src.models.user import User


class ControlService:
    def __init__(self, db: Session):
        self.db = db

    def get_queue(
        self,
        status: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> ControlQueueResponse:
        query = (
            select(Case, User.shortcut, User.external_key)
            .select_from(Case)
            .join(User, User.id == Case.created_by_user_id, isouter=True)
        )
        if status:
            query = query.where(Case.validation_status == status)
        if start_date:
            query = query.where(Case.analysis_date >= start_date)
        if end_date:
            query = query.where(Case.analysis_date <= end_date)
        items = []
        now = datetime.utcnow()
        for record, user_shortcut, user_external_key in self.db.execute(query).all():
            age_hours = (now - record.input_timestamp).total_seconds() / 3600
            delay_bucket = "on_time" if age_hours < 24 else "delayed_24h"
            if age_hours >= 72:
                delay_bucket = "delayed_72h"
            wimi_user = record.wimi_shortcut or user_shortcut or user_external_key or record.created_by_user_id
            items.append(
                ControlQueueItem(
                    vk_number=record.vk_number,
                    analysis_date=record.analysis_date,
                    input_timestamp=record.input_timestamp,
                    created_by_user_id=record.created_by_user_id,
                    wimi_shortcut=wimi_user,
                    user_id=wimi_user,
                    validation_status=record.validation_status,
                    delay_bucket=delay_bucket,
                )
            )
        return ControlQueueResponse(items=items)
