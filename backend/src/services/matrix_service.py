from datetime import date, datetime

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from src.api.schemas.matrices import ConfusionMatrixResponse, MatrixCell, MatrixDimensionSet
from src.models.case import Case, CaseReview
from src.models.classification_snapshot import ClassificationSnapshot
from src.models.threshold_config import ThresholdConfig


class MatrixService:
    def __init__(self, db: Session):
        self.db = db

    def _get_cells_for_dimension(
        self,
        expected_expr,
        observed_expr,
        include_excluded: bool,
        acceptance: int,
        start_date: date | None = None,
        end_date: date | None = None,
        problematic_only: bool | None = None,
        risk_level: str | None = None,
    ) -> list[MatrixCell]:
        query = (
            select(
                expected_expr.label("expected_value"),
                observed_expr.label("observed_value"),
                func.count().label("case_count"),
                func.sum(case((CaseReview.is_excluded.is_(True), 1), else_=0)).label("excluded_case_count"),
                func.sum(case((ClassificationSnapshot.problem_flag.is_(True), 1), else_=0)).label("problem_case_count"),
            )
            .select_from(ClassificationSnapshot)
            .join(Case, Case.id == ClassificationSnapshot.case_id)
            .join(CaseReview, CaseReview.case_id == ClassificationSnapshot.case_id, isouter=True)
            .group_by(expected_expr, observed_expr)
        )
        if start_date:
            query = query.where(Case.analysis_date >= start_date)
        if end_date:
            query = query.where(Case.analysis_date <= end_date)
        if problematic_only:
            query = query.where(ClassificationSnapshot.problem_flag.is_(True))
        if not include_excluded:
            query = query.where((CaseReview.is_excluded.is_(False)) | (CaseReview.is_excluded.is_(None)))
        if risk_level:
            query = query.where(CaseReview.risk_level == risk_level)

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
    ) -> ConfusionMatrixResponse:
        threshold = self.db.scalar(select(ThresholdConfig).where(ThresholdConfig.config_key == threshold_key))
        acceptance = threshold.acceptance_threshold if threshold else 1

        severity_cells = self._get_cells_for_dimension(
            ClassificationSnapshot.user_s,
            ClassificationSnapshot.tricia_s,
            include_excluded,
            acceptance,
            start_date=start_date,
            end_date=end_date,
            problematic_only=problematic_only,
            risk_level=risk_level,
        )
        detectability_cells = self._get_cells_for_dimension(
            ClassificationSnapshot.user_d,
            ClassificationSnapshot.tricia_d,
            include_excluded,
            acceptance,
            start_date=start_date,
            end_date=end_date,
            problematic_only=problematic_only,
            risk_level=risk_level,
        )
        # WIMI-P is treated as TRI-P, so both expected and observed products use tricia_p.
        product_cells = self._get_cells_for_dimension(
            ClassificationSnapshot.user_s * ClassificationSnapshot.user_d * ClassificationSnapshot.tricia_p,
            ClassificationSnapshot.tricia_s * ClassificationSnapshot.tricia_d * ClassificationSnapshot.tricia_p,
            include_excluded,
            acceptance,
            start_date=start_date,
            end_date=end_date,
            problematic_only=problematic_only,
            risk_level=risk_level,
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
