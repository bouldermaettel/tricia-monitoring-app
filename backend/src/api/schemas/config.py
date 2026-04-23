from datetime import datetime

from pydantic import BaseModel


class ThresholdConfig(BaseModel):
    config_key: str
    acceptance_threshold: int
    problem_threshold: int
    include_excluded_default: bool
    effective_from: datetime


class ThresholdConfigUpdateRequest(BaseModel):
    config_key: str
    acceptance_threshold: int
    problem_threshold: int
    include_excluded_default: bool
