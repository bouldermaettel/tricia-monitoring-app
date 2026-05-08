from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class RiskCategoryBoundary(BaseModel):
    label: str
    min_value: int
    max_value: int


class ProblematicCaseThresholds(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    three_months: int = Field(alias="3M")
    six_months: int = Field(alias="6M")
    twelve_months: int = Field(alias="12M")


class ThresholdConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    config_key: str
    acceptance_threshold: int
    problematic_case_thresholds: ProblematicCaseThresholds
    include_excluded_default: bool
    risk_categories: list[RiskCategoryBoundary]
    effective_from: datetime


class ThresholdConfigUpdateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    config_key: str
    acceptance_threshold: int
    problematic_case_thresholds: ProblematicCaseThresholds
    include_excluded_default: bool
    risk_categories: list[RiskCategoryBoundary] | None = None
