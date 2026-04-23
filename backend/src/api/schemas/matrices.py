from datetime import datetime

from pydantic import BaseModel


class MatrixCell(BaseModel):
    expected_value: int
    observed_value: int
    case_count: int
    excluded_case_count: int
    problem_case_count: int
    within_threshold: bool


class ConfusionMatrixResponse(BaseModel):
    generated_at: datetime
    threshold_key: str
    cells: list[MatrixCell]
