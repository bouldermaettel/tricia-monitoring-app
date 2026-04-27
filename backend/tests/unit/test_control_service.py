from datetime import datetime, timedelta

from sqlalchemy import select

from src.api.schemas.cases import CaseCreateRequest
from src.models.case import Case, CaseReview
from src.services.case_service import CaseService
from src.services.control_service import ControlService


def test_control_delay_bucket(db_session):
    CaseService(db_session).create_case(
        CaseCreateRequest(
            vk_number='VK-20260423-030',
            device_name='dev',
            tricia_s=1,
            tricia_p=1,
            tricia_d=5,
            user_s=1,
            user_d=5,
            validation_status='saved',
        ),
        actor_id='tester',
    )
    queue = ControlService(db_session).get_queue()
    assert queue.items[0].delay_bucket == 'on_time'


def test_control_delay_bucket_delayed_after_four_weeks(db_session):
    CaseService(db_session).create_case(
        CaseCreateRequest(
            vk_number='VK-20260423-031',
            device_name='dev',
            tricia_s=1,
            tricia_p=1,
            tricia_d=5,
            user_s=1,
            user_d=5,
            validation_status='saved',
        ),
        actor_id='tester',
    )

    case = db_session.scalar(select(Case).where(Case.vk_number == 'VK-20260423-031'))
    assert case is not None
    case.input_timestamp = datetime.utcnow() - timedelta(days=29)
    db_session.commit()

    queue = ControlService(db_session).get_queue()
    delayed_case = next(item for item in queue.items if item.vk_number == 'VK-20260423-031')
    assert delayed_case.delay_bucket == 'delayed_72h'


def test_control_delay_bucket_uses_review_timestamp(db_session):
    CaseService(db_session).create_case(
        CaseCreateRequest(
            vk_number='VK-20260423-032',
            device_name='dev',
            tricia_s=1,
            tricia_p=1,
            tricia_d=5,
            user_s=1,
            user_d=5,
            validation_status='saved',
        ),
        actor_id='tester',
    )

    case = db_session.scalar(select(Case).where(Case.vk_number == 'VK-20260423-032'))
    assert case is not None
    case.input_timestamp = datetime.utcnow() - timedelta(days=40)
    review = db_session.scalar(select(CaseReview).where(CaseReview.case_id == case.id))
    assert review is not None
    review.is_reviewed = True
    review.updated_at = datetime.utcnow() - timedelta(days=20)
    db_session.commit()

    queue = ControlService(db_session).get_queue(review_window_days=28)
    reviewed_case = next(item for item in queue.items if item.vk_number == 'VK-20260423-032')
    assert reviewed_case.delay_bucket == 'on_time'
