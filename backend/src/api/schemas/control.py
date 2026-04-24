from datetime import date, datetime

from pydantic import BaseModel


class ControlQueueItem(BaseModel):
    vk_number: str
    analysis_date: date
    input_timestamp: datetime
    created_by_user_id: str | None = None
    user_id: str | None = None
    validation_status: str
    delay_bucket: str


class ControlQueueResponse(BaseModel):
    items: list[ControlQueueItem]
