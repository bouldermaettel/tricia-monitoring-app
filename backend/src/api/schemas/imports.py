from pydantic import BaseModel
from typing import Literal


class ImportPreviewCase(BaseModel):
    vk_number: str
    device_name: str
    analysis_date: str
    input_timestamp: str | None = None
    wimi_shortcut: str | None = None
    validation_status: str = "saved"
    tricia_s: int
    tricia_p: int
    tricia_d: int
    user_s: int
    user_d: int
    category_code: str | None = None
    risk_level: str | None = None
    is_excluded: bool = False
    is_reviewed: bool = False


class ImportPreviewControlItem(BaseModel):
    vk_number: str
    analysis_date: str
    input_timestamp: str | None = None
    wimi_shortcut: str | None = None
    user_id: str | None = None
    validation_status: str
    delay_bucket: str


class ImportPreviewResponse(BaseModel):
    total_rows: int
    cases: list[ImportPreviewCase]
    control_items: list[ImportPreviewControlItem]


class ImportJobResponse(BaseModel):
    job_id: str
    status: str
    total_rows: int
    imported_rows: int
    error_rows: int
    replaced_rows: int = 0
    skipped_rows: int = 0


ImportDuplicateAction = Literal["error", "replace", "skip"]
