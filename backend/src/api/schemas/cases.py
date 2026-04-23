from datetime import date, datetime

from pydantic import BaseModel


class CaseValidationRequest(BaseModel):
    vk_number: str
    device_name: str
    tricia_s: int
    tricia_p: int
    tricia_d: int
    user_s: int
    user_d: int | None = None


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
