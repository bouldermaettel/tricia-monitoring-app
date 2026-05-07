from datetime import datetime

from pydantic import BaseModel


class RiskCategoryBoundary(BaseModel):
    label: str
    min_value: int
    max_value: int


class ThresholdConfig(BaseModel):
    config_key: str
    acceptance_threshold: int
    problem_threshold: int
    include_excluded_default: bool
    risk_categories: list[RiskCategoryBoundary]
    effective_from: datetime


class ThresholdConfigUpdateRequest(BaseModel):
    config_key: str
    acceptance_threshold: int
    problem_threshold: int
    include_excluded_default: bool
    risk_categories: list[RiskCategoryBoundary] | None = None
