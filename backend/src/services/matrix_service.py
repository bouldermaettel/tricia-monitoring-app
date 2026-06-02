from datetime import date, datetime

from sqlalchemy import case, func, select, tuple_
from sqlalchemy.orm import Session

from src.api.schemas.matrices import ConfusionMatrixResponse, MatrixCell, MatrixDimensionSet
from src.models.case import Case
from src.models.case import CaseReview
from src.models.classification_snapshot import ClassificationSnapshot
from src.models.threshold_config import ThresholdConfig
from src.services.filter_service import apply_case_filters, build_problematic_case_condition
from src.services.threshold_service import DEFAULT_RISK_CATEGORIES


class MatrixService:
    def __init__(self, db: Session):
        self.db = db

    def _filtered_case_ids(
        self,
        include_excluded: bool,
        start_date: date | None,
        end_date: date | None,
        problematic_only: bool | None,
        acceptance_threshold: int,
        risk_categories: list[dict[str, int | str]],
        risk_level: str | None,
        risk_direction: str | None,
        product_cells: list[tuple[int, int]] | None,
        severity_cells: list[tuple[int, int]] | None = None,
        detectability_cells: list[tuple[int, int]] | None = None,
    ):
        base_query = (
            select(ClassificationSnapshot.case_id)
            .select_from(Case)
            .join(CaseReview, CaseReview.case_id == Case.id, isouter=True)
            .join(ClassificationSnapshot, ClassificationSnapshot.case_id == Case.id)
        )
        filtered_query = apply_case_filters(
            base_query,
            start_date=start_date,
            end_date=end_date,
            problematic_only=problematic_only,
            acceptance_threshold=acceptance_threshold,
            risk_categories=risk_categories,
            include_excluded=include_excluded,
            risk_level=risk_level,
            risk_direction=risk_direction,
        )
        if product_cells:
            expected_product = ClassificationSnapshot.user_s * ClassificationSnapshot.user_d * ClassificationSnapshot.tricia_p
            observed_product = ClassificationSnapshot.tricia_s * ClassificationSnapshot.tricia_d * ClassificationSnapshot.tricia_p
            filtered_query = filtered_query.where(tuple_(expected_product, observed_product).in_(product_cells))
        if severity_cells:
            filtered_query = filtered_query.where(
                tuple_(ClassificationSnapshot.user_s, ClassificationSnapshot.tricia_s).in_(severity_cells)
            )
        if detectability_cells:
            filtered_query = filtered_query.where(
                tuple_(ClassificationSnapshot.user_d, ClassificationSnapshot.tricia_d).in_(detectability_cells)
            )
        return filtered_query.subquery()

    def _get_cells_for_dimension(
        self,
        expected_expr,
        observed_expr,
        include_excluded: bool,
        acceptance: int,
        risk_categories: list[dict[str, int | str]],
        filtered_case_ids,
    ) -> list[MatrixCell]:
        problematic_condition = build_problematic_case_condition(
            acceptance_threshold=acceptance,
            risk_categories=risk_categories,
        )

        query = (
            select(
                expected_expr.label("expected_value"),
                observed_expr.label("observed_value"),
                func.count().label("case_count"),
                func.sum(case((CaseReview.is_excluded.is_(True), 1), else_=0)).label("excluded_case_count"),
                func.sum(case((problematic_condition, 1), else_=0)).label("problem_case_count"),
            )
            .select_from(ClassificationSnapshot)
            .join(CaseReview, CaseReview.case_id == ClassificationSnapshot.case_id, isouter=True)
            .where(ClassificationSnapshot.case_id.in_(select(filtered_case_ids.c.case_id)))
            .group_by(expected_expr, observed_expr)
        )

        rows = self.db.execute(query).all()
        return [
            MatrixCell(
                expected_value=r.expected_value,
                observed_value=r.observed_value,
                case_count=r.case_count,
                excluded_case_count=r.excluded_case_count or 0,
                problem_case_count=r.problem_case_count or 0,
                within_threshold=abs(r.expected_value - r.observed_value) <= acceptance,
            )
            for r in rows
        ]

    def get_confusion_matrix(
        self,
        include_excluded: bool = False,
        threshold_key: str = "default",
        start_date: date | None = None,
        end_date: date | None = None,
        problematic_only: bool | None = None,
        risk_level: str | None = None,
        risk_direction: str | None = None,
        product_cells: list[tuple[int, int]] | None = None,
        severity_cells: list[tuple[int, int]] | None = None,
        detectability_cells: list[tuple[int, int]] | None = None,
    ) -> ConfusionMatrixResponse:
        threshold = self.db.scalar(select(ThresholdConfig).where(ThresholdConfig.config_key == threshold_key))
        acceptance = threshold.acceptance_threshold if threshold else 1
        risk_categories = threshold.risk_categories if threshold else DEFAULT_RISK_CATEGORIES
        filtered_case_ids = self._filtered_case_ids(
            include_excluded=include_excluded,
            start_date=start_date,
            end_date=end_date,
            problematic_only=problematic_only,
            acceptance_threshold=acceptance,
            risk_categories=risk_categories,
            risk_level=risk_level,
            risk_direction=risk_direction,
            product_cells=product_cells,
            severity_cells=severity_cells,
            detectability_cells=detectability_cells,
        )

        severity_cells = self._get_cells_for_dimension(
            ClassificationSnapshot.user_s,
            ClassificationSnapshot.tricia_s,
            include_excluded,
            acceptance,
            risk_categories,
            filtered_case_ids,
        )
        detectability_cells = self._get_cells_for_dimension(
            ClassificationSnapshot.user_d,
            ClassificationSnapshot.tricia_d,
            include_excluded,
            acceptance,
            risk_categories,
            filtered_case_ids,
        )
        # WIMI-P is treated as TRI-P, so both expected and observed products use tricia_p.
        product_cells = self._get_cells_for_dimension(
            ClassificationSnapshot.user_s * ClassificationSnapshot.user_d * ClassificationSnapshot.tricia_p,
            ClassificationSnapshot.tricia_s * ClassificationSnapshot.tricia_d * ClassificationSnapshot.tricia_p,
            include_excluded,
            acceptance,
            risk_categories,
            filtered_case_ids,
        )

        return ConfusionMatrixResponse(
            generated_at=datetime.utcnow(),
            threshold_key=threshold_key,
            cells=detectability_cells,
            matrices=MatrixDimensionSet(
                severity=severity_cells,
                detectability=detectability_cells,
                product=product_cells,
            ),
        )
