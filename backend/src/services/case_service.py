from datetime import datetime

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from src.api.schemas.cases import CaseAuditTrailResponse, CaseAuditEventRecord, CaseCreateRequest, CaseListResponse, CaseRecord, CaseReviewUpdateRequest, CaseUpdateRequest
from src.models.case import Case, CaseAuditEvent, CaseComment, CaseReview
from src.models.classification_snapshot import ClassificationSnapshot
from src.models.user import User
from src.services.filter_service import apply_case_filters
from src.services.threshold_service import ThresholdService
from src.services.validation_service import ValidationService


class CaseService:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _score_fields() -> tuple[str, ...]:
        return ('tricia_s', 'tricia_p', 'tricia_d', 'user_s', 'user_d')

    def _resolve_case(self, case_ref: str) -> Case | None:
        normalized_ref = case_ref.strip()
        if not normalized_ref:
            return None
        by_id = self.db.scalar(select(Case).where(Case.id == normalized_ref))
        if by_id is not None:
            return by_id
        return self.db.scalar(select(Case).where(Case.vk_number == normalized_ref))

    def _derive_scores_from_audit_trail(self, case_id: str) -> dict[str, int] | None:
        scores: dict[str, int] = {}
        events = self.db.execute(
            select(CaseAuditEvent)
            .where(CaseAuditEvent.case_id == case_id)
            .order_by(CaseAuditEvent.created_at.asc(), CaseAuditEvent.id.asc())
        ).scalars().all()
        for event in events:
            for field in self._score_fields():
                delta = (event.changes or {}).get(field)
                if not isinstance(delta, dict):
                    continue
                value = delta.get('to')
                if value is None:
                    continue
                try:
                    scores[field] = int(value)
                except (TypeError, ValueError):
                    continue
        return scores or None

    def _load_or_derive_snapshot(self, case_id: str) -> ClassificationSnapshot | None:
        snapshot = self.db.scalar(
            select(ClassificationSnapshot).where(ClassificationSnapshot.case_id == case_id)
            .order_by(ClassificationSnapshot.created_at.desc())
        )
        if snapshot is not None:
            return snapshot

        derived_scores = self._derive_scores_from_audit_trail(case_id)
        if derived_scores is None:
            return None

        return ClassificationSnapshot(
            case_id=case_id,
            tricia_s=derived_scores.get('tricia_s', 1),
            tricia_p=derived_scores.get('tricia_p', 1),
            tricia_d=derived_scores.get('tricia_d', 1),
            user_s=derived_scores.get('user_s', 1),
            user_d=derived_scores.get('user_d', 1),
            deviation_s=abs(derived_scores.get('user_s', 1) - derived_scores.get('tricia_s', 1)),
            deviation_d=abs(derived_scores.get('user_d', 1) - derived_scores.get('tricia_d', 1)),
            problem_flag=False,
        )

    def _get_threshold_context(self) -> tuple[int, list[dict[str, int | str]]]:
        config = ThresholdService(self.db).get("default")
        return config.acceptance_threshold, config.risk_categories

    def _resolve_risk_class(self, score: int, categories: list[dict[str, int | str]]) -> int | None:
        for index, category in enumerate(sorted(categories, key=lambda item: int(item["min_value"]))):
            if int(category["min_value"]) <= score <= int(category["max_value"]):
                return index + 1
        return None

    def _is_problematic_case(
        self,
        tricia_s: int,
        tricia_p: int,
        tricia_d: int,
        user_s: int,
        user_d: int,
        acceptance_threshold: int,
        risk_categories: list[dict[str, int | str]],
    ) -> bool:
        expected_class = self._resolve_risk_class(user_s * user_d * tricia_p, risk_categories)
        observed_class = self._resolve_risk_class(tricia_s * tricia_d * tricia_p, risk_categories)
        if expected_class is None or observed_class is None:
            return False
        return abs(expected_class - observed_class) > acceptance_threshold

    def _resolve_actor_acronym(self, actor_id: str) -> str:
        actor = self.db.scalar(select(User).where(User.id == actor_id))
        if actor and actor.shortcut:
            return actor.shortcut
        return actor_id

    def _resolve_actor_user_id(self, actor_id: str) -> str | None:
        actor = self.db.scalar(select(User.id).where(User.id == actor_id))
        return actor if actor is not None else None

    def create_case(self, payload: CaseCreateRequest, actor_id: str) -> Case:
        validator = ValidationService(self.db)
        checked = validator.validate(payload)
        if checked.duplicate:
            raise ValueError("Duplicate vk_number")

        wimi_shortcut = self._resolve_actor_acronym(actor_id)

        case = Case(
            vk_number=payload.vk_number,
            device_name=payload.device_name,
            analysis_date=checked.analysis_date,
            source_type="manual",
            created_by_user_id=self._resolve_actor_user_id(actor_id),
            wimi_shortcut=wimi_shortcut,
            validation_status=payload.validation_status,
        )
        self.db.add(case)
        self.db.flush()

        ClassificationSnapshot.sync_pk_sequence(self.db)
        acceptance_threshold, risk_categories = self._get_threshold_context()
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
            problem_flag=self._is_problematic_case(
                tricia_s=payload.tricia_s,
                tricia_p=payload.tricia_p,
                tricia_d=payload.tricia_d,
                user_s=payload.user_s,
                user_d=user_d,
                acceptance_threshold=acceptance_threshold,
                risk_categories=risk_categories,
            ),
        )
        self.db.add(snapshot)
        self.db.add(
            CaseReview(
                case_id=case.id,
                updated_by_user_id=self._resolve_actor_user_id(actor_id),
                updated_at=datetime.utcnow(),
            )
        )
        self.db.add(
            CaseAuditEvent(
                case_id=case.id,
                action='created',
                actor_id=self._resolve_actor_acronym(actor_id),
                changes={'vk_number': {'from': None, 'to': payload.vk_number}},
            )
        )
        self.db.commit()
        self.db.refresh(case)
        return case

    def add_comment(self, case_id: str, text: str, actor_id: str) -> CaseComment:
        case = self._resolve_case(case_id)
        if case is None:
            raise ValueError(f"Case {case_id} not found")

        comment_text = text.strip()
        if not comment_text:
            raise ValueError("Comment text cannot be empty")

        comment = CaseComment(
            case_id=case.id,
            comment_text=comment_text,
            created_by_user_id=self._resolve_actor_user_id(actor_id),
        )
        self.db.add(comment)
        self.db.add(
            CaseAuditEvent(
                case_id=case.id,
                action='commented',
                actor_id=self._resolve_actor_acronym(actor_id),
                changes={'comment_text': {'from': None, 'to': comment_text}},
            )
        )
        self.db.commit()
        self.db.refresh(comment)
        return comment

    def list_cases(
        self,
        page: int = 1,
        page_size: int = 50,
        start_date=None,
        end_date=None,
        vk_number: str | None = None,
        expected_value=None,
        observed_value=None,
        matrix_dimension: str = "detectability",
        problematic_only=None,
        include_excluded=False,
        risk_level=None,
    ) -> CaseListResponse:
        acceptance_threshold, risk_categories = self._get_threshold_context()
        query = select(Case, CaseReview, ClassificationSnapshot).join(
            CaseReview, CaseReview.case_id == Case.id, isouter=True
        ).join(
            ClassificationSnapshot, ClassificationSnapshot.case_id == Case.id, isouter=True
        )
        query = apply_case_filters(
            query,
            start_date=start_date,
            end_date=end_date,
            expected_value=expected_value,
            observed_value=observed_value,
            matrix_dimension=matrix_dimension,
            problematic_only=problematic_only,
            acceptance_threshold=acceptance_threshold,
            risk_categories=risk_categories,
            include_excluded=include_excluded,
            risk_level=risk_level,
        )
        if vk_number:
            query = query.where(Case.vk_number == vk_number)

        total = self.db.scalar(select(func.count()).select_from(query.subquery())) or 0
        rows = self.db.execute(query.offset((page - 1) * page_size).limit(page_size)).all()

        items = []
        for case, review, snapshot in rows:
            if snapshot is None:
                derived_scores = self._derive_scores_from_audit_trail(case.id)
                if derived_scores is not None:
                    snapshot = ClassificationSnapshot(
                        case_id=case.id,
                        tricia_s=derived_scores.get('tricia_s', 1),
                        tricia_p=derived_scores.get('tricia_p', 1),
                        tricia_d=derived_scores.get('tricia_d', 1),
                        user_s=derived_scores.get('user_s', 1),
                        user_d=derived_scores.get('user_d', 1),
                        deviation_s=abs(derived_scores.get('user_s', 1) - derived_scores.get('tricia_s', 1)),
                        deviation_d=abs(derived_scores.get('user_d', 1) - derived_scores.get('tricia_d', 1)),
                        problem_flag=False,
                    )
            comment_count = self.db.scalar(select(func.count()).select_from(CaseComment).where(CaseComment.case_id == case.id)) or 0
            comment_text = self.db.scalar(
                select(CaseComment.comment_text)
                .where(CaseComment.case_id == case.id)
                .order_by(CaseComment.created_at.desc())
                .limit(1)
            )
            has_edits = (
                self.db.scalar(
                    select(func.count())
                    .select_from(CaseAuditEvent)
                    .where(CaseAuditEvent.case_id == case.id)
                    .where(CaseAuditEvent.action.in_(['update', 'updated']))
                ) or 0
            ) > 0
            items.append(
                CaseRecord(
                    id=case.id,
                    vk_number=case.vk_number,
                    device_name=case.device_name,
                    wimi_shortcut=case.wimi_shortcut,
                    date_reported=case.analysis_date,
                    analysis_date=case.analysis_date,
                    validation_status=case.validation_status,
                    tricia_s=snapshot.tricia_s if snapshot else None,
                    tricia_p=snapshot.tricia_p if snapshot else None,
                    tricia_d=snapshot.tricia_d if snapshot else None,
                    user_s=snapshot.user_s if snapshot else None,
                    user_d=snapshot.user_d if snapshot else None,
                    risk_level=review.risk_level if review else None,
                    category_code=review.category_code if review else None,
                    is_excluded=review.is_excluded if review else False,
                    is_reviewed=review.is_reviewed if review else False,
                    comment_count=comment_count,
                    comment_text=comment_text,
                    has_edits=has_edits,
                )
            )
        return CaseListResponse(items=items, page=page, page_size=page_size, total=total)

    def update_review(self, case_id: str, payload: CaseReviewUpdateRequest, actor_id: str) -> CaseReview:
        case = self._resolve_case(case_id)
        if case is None:
            raise ValueError(f"Case {case_id} not found")

        review = self.db.scalar(select(CaseReview).where(CaseReview.case_id == case.id))
        if review is None:
            review = CaseReview(case_id=case.id)
            self.db.add(review)

        changes: dict = {}
        if payload.category_code is not None:
            if payload.category_code != review.category_code:
                changes['category_code'] = {'from': review.category_code, 'to': payload.category_code}
            review.category_code = payload.category_code
        if payload.is_excluded is not None:
            if payload.is_excluded != review.is_excluded:
                changes['is_excluded'] = {'from': review.is_excluded, 'to': payload.is_excluded}
            review.is_excluded = payload.is_excluded
        if payload.is_reviewed is not None:
            if payload.is_reviewed != review.is_reviewed:
                changes['is_reviewed'] = {'from': review.is_reviewed, 'to': payload.is_reviewed}
            review.is_reviewed = payload.is_reviewed
        if payload.risk_level is not None:
            if payload.risk_level != review.risk_level:
                changes['risk_level'] = {'from': review.risk_level, 'to': payload.risk_level}
            review.risk_level = payload.risk_level
        review.updated_by_user_id = self._resolve_actor_user_id(actor_id)
        review.updated_at = datetime.utcnow()

        if changes:
            self.db.add(
                CaseAuditEvent(
                    case_id=case.id,
                    action='reviewed',
                    actor_id=self._resolve_actor_acronym(actor_id),
                    changes=changes,
                )
            )

        self.db.commit()
        self.db.refresh(review)
        return review

    def update_case(self, case_id: str, payload: CaseUpdateRequest, actor_id: str) -> Case:
        case = self._resolve_case(case_id)
        if case is None:
            raise ValueError(f"Case {case_id} not found")

        changes: dict = {}
        if payload.device_name is not None and payload.device_name != case.device_name:
            changes['device_name'] = {'from': case.device_name, 'to': payload.device_name}
            case.device_name = payload.device_name
        if payload.analysis_date is not None and payload.analysis_date != case.analysis_date:
            changes['analysis_date'] = {'from': str(case.analysis_date), 'to': str(payload.analysis_date)}
            case.analysis_date = payload.analysis_date
        if payload.validation_status is not None:
            changes['validation_status'] = {'from': case.validation_status, 'to': payload.validation_status}
            case.validation_status = payload.validation_status

        snapshot = self._load_or_derive_snapshot(case.id)
        score_fields = self._score_fields()
        score_updates = {field: getattr(payload, field, None) for field in score_fields}
        if snapshot is not None and snapshot.id is None:
            # When reconstructed from audit trail, attach it so updates persist to the database.
            self.db.add(snapshot)
        if snapshot is None and any(value is not None for value in score_updates.values()):
            # Create a baseline snapshot first so score edits are tracked as audit deltas.
            tricia_s = 1
            tricia_p = 1
            tricia_d = 1
            user_s = 1
            user_d = 1
            ClassificationSnapshot.sync_pk_sequence(self.db)
            snapshot = ClassificationSnapshot(
                case_id=case.id,
                tricia_s=tricia_s,
                tricia_p=tricia_p,
                tricia_d=tricia_d,
                user_s=user_s,
                user_d=user_d,
                deviation_s=abs(user_s - tricia_s),
                deviation_d=abs(user_d - tricia_d),
                problem_flag=False,
            )
            self.db.add(snapshot)

        if snapshot is not None:
            acceptance_threshold, risk_categories = self._get_threshold_context()
            for field in score_fields:
                new_val = score_updates[field]
                if new_val is not None and new_val != getattr(snapshot, field):
                    changes[field] = {'from': getattr(snapshot, field), 'to': new_val}
                    setattr(snapshot, field, new_val)
            if any(score_updates[field] is not None for field in score_fields):
                snapshot.deviation_s = abs(snapshot.user_s - snapshot.tricia_s)
                snapshot.deviation_d = abs(snapshot.user_d - snapshot.tricia_d)
                snapshot.problem_flag = self._is_problematic_case(
                    tricia_s=snapshot.tricia_s,
                    tricia_p=snapshot.tricia_p,
                    tricia_d=snapshot.tricia_d,
                    user_s=snapshot.user_s,
                    user_d=snapshot.user_d,
                    acceptance_threshold=acceptance_threshold,
                    risk_categories=risk_categories,
                )

        if changes:
            self.db.add(CaseAuditEvent(
                case_id=case.id,
                action='updated',
                actor_id=self._resolve_actor_acronym(actor_id),
                changes=changes,
            ))

        self.db.commit()
        self.db.refresh(case)
        return case

    def delete_case(self, case_id: str, actor_id: str) -> None:
        case = self._resolve_case(case_id)
        if case is None:
            raise ValueError(f"Case {case_id} not found")
        self.db.execute(delete(ClassificationSnapshot).where(ClassificationSnapshot.case_id == case.id))
        self.db.execute(delete(CaseReview).where(CaseReview.case_id == case.id))
        self.db.execute(delete(CaseComment).where(CaseComment.case_id == case.id))
        self.db.execute(delete(CaseAuditEvent).where(CaseAuditEvent.case_id == case.id))
        self.db.delete(case)
        self.db.commit()

    def bulk_delete_cases(self, case_ids: list[str], actor_id: str) -> int:
        count = 0
        for case_id in case_ids:
            try:
                self.delete_case(case_id, actor_id)
                count += 1
            except ValueError:
                pass
        return count

    def get_audit_trail(self, case_id: str, limit: int = 100) -> CaseAuditTrailResponse:
        case = self._resolve_case(case_id)
        if case is None:
            return CaseAuditTrailResponse(items=[])

        events = self.db.execute(
            select(CaseAuditEvent)
            .where(CaseAuditEvent.case_id == case.id)
            .order_by(CaseAuditEvent.created_at.desc())
            .limit(limit)
        ).scalars().all()
        return CaseAuditTrailResponse(
            items=[
                CaseAuditEventRecord(
                    id=e.id,
                    case_id=e.case_id,
                    action=e.action,
                    actor_id=e.actor_id,
                    changes=e.changes,
                    created_at=e.created_at,
                )
                for e in events
            ]
        )
