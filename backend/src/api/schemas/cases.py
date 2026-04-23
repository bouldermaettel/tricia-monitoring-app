from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel

SeverityValue = Literal[1, 3, 5, 8, 10]
DetectabilityValue = Literal[1, 5, 10]
ProbabilityValue = Literal[1, 5, 10]


class CaseValidationRequest(BaseModel):
    vk_number: str
    device_name: str
    tricia_s: SeverityValue
    tricia_p: ProbabilityValue
    tricia_d: DetectabilityValue
    user_s: SeverityValue
    user_d: DetectabilityValue | None = None


class CaseValidationResponse(BaseModel):
    analysis_date: date
    inferred_user_id: str | None = None
    auto_fill: dict[str, int]
    duplicate: bool


class CaseCreateRequest(CaseValidationRequest):
    validation_status: str = "saved"


class CaseReviewUpdateRequest(BaseModel):
    category_code: str | None = None
    is_excluded: bool | None = None
    is_reviewed: bool | None = None
    risk_level: str | None = None


class CommentCreateRequest(BaseModel):
    comment_text: str


class CaseRecord(BaseModel):
    id: str
    vk_number: str
    device_name: str
    wimi_shortcut: str | None = None
    date_reported: date
    analysis_date: date
    validation_status: str
    category_code: str | None = None
    is_excluded: bool = False
    is_reviewed: bool = False
    comment_count: int = 0


class CaseListResponse(BaseModel):
    items: list[CaseRecord]
    page: int
    page_size: int
    total: int


class CaseReviewResponse(BaseModel):
    case_id: str
    category_code: str | None = None
    is_excluded: bool
    is_reviewed: bool
    risk_level: str
    updated_at: datetime
