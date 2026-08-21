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
    user_p: ProbabilityValue | None = None
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
    text: str


class CaseRecord(BaseModel):
    id: str
    vk_number: str
    device_name: str
    wimi_shortcut: str | None = None
    date_reported: date
    analysis_date: date
    validation_status: str
    tricia_s: int | None = None
    tricia_p: int | None = None
    tricia_d: int | None = None
    user_s: int | None = None
    user_p: int | None = None
    user_d: int | None = None
    tri_risk: int | None = None
    wimi_risk: int | None = None
    risk_level: str | None = None
    category_code: str | None = None
    is_excluded: bool = False
    is_reviewed: bool = False
    comment_count: int = 0
    comment_text: str | None = None
    has_edits: bool = False


class CaseListResponse(BaseModel):
    items: list[CaseRecord]
    page: int
    page_size: int
    total: int


class CaseUpdateRequest(BaseModel):
    device_name: str | None = None
    analysis_date: date | None = None
    validation_status: str | None = None
    tricia_s: SeverityValue | None = None
    tricia_p: ProbabilityValue | None = None
    tricia_d: DetectabilityValue | None = None
    user_s: SeverityValue | None = None
    user_p: ProbabilityValue | None = None
    user_d: DetectabilityValue | None = None


class BulkDeleteRequest(BaseModel):
    case_ids: list[str]


class CaseAuditEventRecord(BaseModel):
    id: int
    case_id: str
    action: str
    actor_id: str | None = None
    changes: dict
    created_at: datetime


class CaseAuditTrailResponse(BaseModel):
    items: list[CaseAuditEventRecord]


class CaseReviewResponse(BaseModel):
    case_id: str
    category_code: str | None = None
    is_excluded: bool
    is_reviewed: bool
    risk_level: str
    updated_at: datetime
