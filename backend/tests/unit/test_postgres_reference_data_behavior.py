from datetime import date

from src.api.schemas.cases import CaseReviewUpdateRequest
from src.api.schemas.config import ThresholdConfigUpdateRequest
from src.db.seeds.case_categories import seed_case_categories
from src.models.case import Case
from src.services.case_service import CaseService
from src.services.threshold_service import ThresholdService


def test_update_review_accepts_seeded_category_codes(db_session):
    seed_case_categories(db_session)
    case = Case(
        vk_number='Vk_20240523_001',
        device_name='Device-1',
        analysis_date=date(2024, 5, 23),
        source_type='manual',
        validation_status='saved',
    )
    db_session.add(case)
    db_session.commit()

    review = CaseService(db_session).update_review(
        case.id,
        CaseReviewUpdateRequest(category_code='no_issue'),
        'bootstrap-admin',
    )

    assert review.category_code == 'no_issue'
    assert review.updated_by_user_id == 'bootstrap-admin'


def test_threshold_update_allows_unresolved_actor_without_fk_violation(db_session):
    service = ThresholdService(db_session)

    config = service.update(
        ThresholdConfigUpdateRequest(
            config_key='default',
            acceptance_threshold=2,
            problematic_case_thresholds={'3M': 4, '6M': 8, '12M': 12},
            include_excluded_default=True,
        ),
        'system',
    )

    assert config.acceptance_threshold == 2
    assert config.updated_by_user_id is None