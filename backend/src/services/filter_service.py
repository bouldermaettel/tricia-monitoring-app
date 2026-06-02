from datetime import date

from sqlalchemy import Select, and_, case, func, select

from src.models.case import Case, CaseReview
from src.models.classification_snapshot import ClassificationSnapshot


def _risk_class_expr(product_expr, risk_categories: list[dict[str, int | str]]) -> object:
    whens = []
    for index, category in enumerate(sorted(risk_categories, key=lambda item: int(item["min_value"]))):
        min_value = int(category["min_value"])
        max_value = int(category["max_value"])
        whens.append((and_(product_expr >= min_value, product_expr <= max_value), index + 1))
    return case(*whens, else_=0)


def build_problematic_case_condition(
    acceptance_threshold: int,
    risk_categories: list[dict[str, int | str]],
):
    expected_product = ClassificationSnapshot.user_s * ClassificationSnapshot.user_d * ClassificationSnapshot.tricia_p
    observed_product = ClassificationSnapshot.tricia_s * ClassificationSnapshot.tricia_d * ClassificationSnapshot.tricia_p

    expected_class = _risk_class_expr(expected_product, risk_categories)
    observed_class = _risk_class_expr(observed_product, risk_categories)

    return and_(
        expected_class > 0,
        observed_class > 0,
        func.abs(expected_class - observed_class) > acceptance_threshold,
    )


def build_risk_direction_condition(
    risk_direction: str,
    risk_categories: list[dict[str, int | str]],
):
    expected_product = ClassificationSnapshot.user_s * ClassificationSnapshot.user_d * ClassificationSnapshot.tricia_p
    observed_product = ClassificationSnapshot.tricia_s * ClassificationSnapshot.tricia_d * ClassificationSnapshot.tricia_p

    expected_class = _risk_class_expr(expected_product, risk_categories)
    observed_class = _risk_class_expr(observed_product, risk_categories)

    if risk_direction == "false_low":
        return and_(expected_class > 0, observed_class > 0, expected_class > observed_class)
    if risk_direction == "false_high":
        return and_(expected_class > 0, observed_class > 0, expected_class < observed_class)
    return None


def apply_case_filters(
    query: Select,
    start_date: date | None = None,
    end_date: date | None = None,
    expected_value: int | None = None,
    observed_value: int | None = None,
    matrix_dimension: str = "detectability",
    problematic_only: bool | None = None,
    problem_threshold: int | None = None,
    acceptance_threshold: int | None = None,
    risk_categories: list[dict[str, int | str]] | None = None,
    include_excluded: bool = False,
    risk_level: str | None = None,
    risk_direction: str | None = None,
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
        if acceptance_threshold is not None and risk_categories:
            query = query.where(
                Case.id.in_(
                    select(ClassificationSnapshot.case_id).where(
                        build_problematic_case_condition(
                            acceptance_threshold=acceptance_threshold,
                            risk_categories=risk_categories,
                        )
                    )
                )
            )
        elif problem_threshold is not None:
            query = query.where(
                Case.id.in_(
                    select(ClassificationSnapshot.case_id).where(
                        func.abs(ClassificationSnapshot.user_d - ClassificationSnapshot.tricia_d) > problem_threshold
                    )
                )
            )
        else:
            query = query.where(Case.id.in_(select(ClassificationSnapshot.case_id).where(ClassificationSnapshot.problem_flag.is_(True))))
    if not include_excluded:
        query = query.where((CaseReview.is_excluded.is_(False)) | (CaseReview.is_excluded.is_(None)))
    if risk_level:
        query = query.where(CaseReview.risk_level == risk_level)
    if risk_direction and risk_categories:
        condition = build_risk_direction_condition(risk_direction=risk_direction, risk_categories=risk_categories)
        if condition is not None:
            query = query.where(
                Case.id.in_(
                    select(ClassificationSnapshot.case_id).where(condition)
                )
            )
    return query
