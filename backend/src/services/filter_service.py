from datetime import date

from sqlalchemy import Select, select

from src.models.case import Case, CaseReview
from src.models.classification_snapshot import ClassificationSnapshot


def apply_case_filters(
    query: Select,
    start_date: date | None = None,
    end_date: date | None = None,
    expected_value: int | None = None,
    observed_value: int | None = None,
    problematic_only: bool | None = None,
    include_excluded: bool = False,
    risk_level: str | None = None,
) -> Select:
    if start_date:
        query = query.where(Case.analysis_date >= start_date)
    if end_date:
        query = query.where(Case.analysis_date <= end_date)
    if expected_value is not None:
        query = query.where(Case.id.in_(select(ClassificationSnapshot.case_id).where(ClassificationSnapshot.tricia_d == expected_value)))
    if observed_value is not None:
        query = query.where(Case.id.in_(select(ClassificationSnapshot.case_id).where(ClassificationSnapshot.user_d == observed_value)))
    if problematic_only:
        query = query.where(Case.id.in_(select(ClassificationSnapshot.case_id).where(ClassificationSnapshot.problem_flag.is_(True))))
    if not include_excluded:
        query = query.where((CaseReview.is_excluded.is_(False)) | (CaseReview.is_excluded.is_(None)))
    if risk_level:
        query = query.where(CaseReview.risk_level == risk_level)
    return query
