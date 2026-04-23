from datetime import datetime

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from src.api.schemas.matrices import ConfusionMatrixResponse, MatrixCell
from src.models.case import CaseReview
from src.models.classification_snapshot import ClassificationSnapshot
from src.models.threshold_config import ThresholdConfig


class MatrixService:
    def __init__(self, db: Session):
        self.db = db

    def get_confusion_matrix(self, include_excluded: bool = False, threshold_key: str = "default") -> ConfusionMatrixResponse:
        threshold = self.db.scalar(select(ThresholdConfig).where(ThresholdConfig.config_key == threshold_key))
        acceptance = threshold.acceptance_threshold if threshold else 1

        query = (
            select(
                ClassificationSnapshot.tricia_d.label("expected_value"),
                ClassificationSnapshot.user_d.label("observed_value"),
                func.count().label("case_count"),
                func.sum(case((CaseReview.is_excluded.is_(True), 1), else_=0)).label("excluded_case_count"),
                func.sum(case((ClassificationSnapshot.problem_flag.is_(True), 1), else_=0)).label("problem_case_count"),
            )
            .select_from(ClassificationSnapshot)
            .join(CaseReview, CaseReview.case_id == ClassificationSnapshot.case_id, isouter=True)
            .group_by(ClassificationSnapshot.tricia_d, ClassificationSnapshot.user_d)
        )
        if not include_excluded:
            query = query.where((CaseReview.is_excluded.is_(False)) | (CaseReview.is_excluded.is_(None)))

        rows = self.db.execute(query).all()
        cells = [
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
        return ConfusionMatrixResponse(generated_at=datetime.utcnow(), threshold_key=threshold_key, cells=cells)
