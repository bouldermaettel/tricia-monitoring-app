from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.api.schemas.control import ControlQueueItem, ControlQueueResponse
from src.models.case import Case, CaseReview
from src.models.user import User


class ControlService:
    def __init__(self, db: Session):
        self.db = db

    def get_queue(
        self,
        status: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        review_window_days: int = 28,
    ) -> ControlQueueResponse:
        query = (
            select(Case, User.shortcut, CaseReview.is_reviewed, CaseReview.updated_at)
            .select_from(Case)
            .join(User, User.id == Case.created_by_user_id, isouter=True)
            .join(CaseReview, CaseReview.case_id == Case.id, isouter=True)
        )
        if status:
            query = query.where(Case.validation_status == status)
        if start_date:
            query = query.where(Case.analysis_date >= start_date)
        if end_date:
            query = query.where(Case.analysis_date <= end_date)
        review_window_days = max(review_window_days, 1)
        review_window_delta = timedelta(days=review_window_days)
        items = []
        for record, user_shortcut, is_reviewed, reviewed_at in self.db.execute(query).all():
            now = (
                datetime.now(record.input_timestamp.tzinfo)
                if getattr(record.input_timestamp, "tzinfo", None) is not None
                else datetime.utcnow()
            )
            if is_reviewed:
                review_reference = reviewed_at or now
                is_on_time = (review_reference - record.input_timestamp) <= review_window_delta
            else:
                is_on_time = (now - record.input_timestamp) <= review_window_delta
            delay_bucket = "on_time" if is_on_time else "delayed_72h"
            wimi_user = record.wimi_shortcut or user_shortcut or record.created_by_user_id
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
