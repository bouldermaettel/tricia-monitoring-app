from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.api.schemas.cases import CaseCreateRequest, CaseListResponse, CaseRecord, CaseReviewUpdateRequest
from src.models.case import Case, CaseComment, CaseReview
from src.models.classification_snapshot import ClassificationSnapshot
from src.models.user import User
from src.services.filter_service import apply_case_filters
from src.services.validation_service import ValidationService


class CaseService:
    def __init__(self, db: Session):
        self.db = db

    def create_case(self, payload: CaseCreateRequest, actor_id: str) -> Case:
        validator = ValidationService(self.db)
        checked = validator.validate(payload)
        if checked.duplicate:
            raise ValueError("Duplicate vk_number")

        actor = self.db.scalar(select(User).where(User.id == actor_id))
        wimi_shortcut = actor.shortcut if actor and actor.shortcut else (actor.external_key if actor else actor_id)

        case = Case(
            vk_number=payload.vk_number,
            device_name=payload.device_name,
            analysis_date=checked.analysis_date,
            source_type="manual",
            created_by_user_id=actor_id,
            wimi_shortcut=wimi_shortcut,
            validation_status=payload.validation_status,
        )
        self.db.add(case)
        self.db.flush()

        user_d = payload.user_d if payload.user_d is not None else payload.tricia_d
        snapshot = ClassificationSnapshot(
            case_id=case.id,
            tricia_s=payload.tricia_s,
            tricia_p=payload.tricia_p,
            tricia_d=payload.tricia_d,
            user_s=payload.user_s,
            user_d=user_d,
            deviation_s=abs(payload.user_s - payload.tricia_s),
            deviation_d=abs(user_d - payload.tricia_d),
            problem_flag=abs(user_d - payload.tricia_d) > 2,
        )
        self.db.add(snapshot)
        self.db.add(CaseReview(case_id=case.id, updated_by_user_id=actor_id, updated_at=datetime.utcnow()))
        self.db.commit()
        self.db.refresh(case)
        return case

    def list_cases(
        self,
        page: int = 1,
        page_size: int = 50,
        start_date=None,
        end_date=None,
        expected_value=None,
        observed_value=None,
        matrix_dimension: str = "detectability",
        problematic_only=None,
        include_excluded=False,
        risk_level=None,
    ) -> CaseListResponse:
        query = select(Case, CaseReview).join(CaseReview, CaseReview.case_id == Case.id, isouter=True)
        query = apply_case_filters(
            query,
            start_date=start_date,
            end_date=end_date,
            expected_value=expected_value,
            observed_value=observed_value,
            matrix_dimension=matrix_dimension,
            problematic_only=problematic_only,
            include_excluded=include_excluded,
            risk_level=risk_level,
        )

        total = self.db.scalar(select(func.count()).select_from(query.subquery())) or 0
        rows = self.db.execute(query.offset((page - 1) * page_size).limit(page_size)).all()

        items = []
        for case, review in rows:
            comment_count = self.db.scalar(select(func.count()).select_from(CaseComment).where(CaseComment.case_id == case.id)) or 0
            items.append(
                CaseRecord(
                    id=case.id,
                    vk_number=case.vk_number,
                    device_name=case.device_name,
                    wimi_shortcut=case.wimi_shortcut,
                    date_reported=case.analysis_date,
                    analysis_date=case.analysis_date,
                    validation_status=case.validation_status,
                    category_code=review.category_code if review else None,
                    is_excluded=review.is_excluded if review else False,
                    is_reviewed=review.is_reviewed if review else False,
                    comment_count=comment_count,
                )
            )
        return CaseListResponse(items=items, page=page, page_size=page_size, total=total)

    def update_review(self, case_id: str, payload: CaseReviewUpdateRequest, actor_id: str) -> CaseReview:
        review = self.db.scalar(select(CaseReview).where(CaseReview.case_id == case_id))
        if review is None:
            review = CaseReview(case_id=case_id)
            self.db.add(review)

        if payload.category_code is not None:
            review.category_code = payload.category_code
        if payload.is_excluded is not None:
            review.is_excluded = payload.is_excluded
        if payload.is_reviewed is not None:
            review.is_reviewed = payload.is_reviewed
        if payload.risk_level is not None:
            review.risk_level = payload.risk_level
        review.updated_by_user_id = actor_id
        review.updated_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(review)
        return review
