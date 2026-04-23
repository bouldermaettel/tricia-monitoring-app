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
    matrix_dimension: str = "detectability",
    problematic_only: bool | None = None,
    include_excluded: bool = False,
    risk_level: str | None = None,
) -> Select:
    if start_date:
        query = query.where(Case.analysis_date >= start_date)
    if end_date:
        query = query.where(Case.analysis_date <= end_date)
    if matrix_dimension == "severity":
        expected_field = ClassificationSnapshot.user_s
        observed_field = ClassificationSnapshot.tricia_s
    elif matrix_dimension == "product":
        expected_field = ClassificationSnapshot.user_s * ClassificationSnapshot.user_d * ClassificationSnapshot.tricia_p
        observed_field = ClassificationSnapshot.tricia_s * ClassificationSnapshot.tricia_d * ClassificationSnapshot.tricia_p
    else:
        expected_field = ClassificationSnapshot.user_d
        observed_field = ClassificationSnapshot.tricia_d

    if expected_value is not None:
        query = query.where(Case.id.in_(select(ClassificationSnapshot.case_id).where(expected_field == expected_value)))
    if observed_value is not None:
        query = query.where(Case.id.in_(select(ClassificationSnapshot.case_id).where(observed_field == observed_value)))
    if problematic_only:
        query = query.where(Case.id.in_(select(ClassificationSnapshot.case_id).where(ClassificationSnapshot.problem_flag.is_(True))))
    if not include_excluded:
        query = query.where((CaseReview.is_excluded.is_(False)) | (CaseReview.is_excluded.is_(None)))
    if risk_level:
        query = query.where(CaseReview.risk_level == risk_level)
    return query
