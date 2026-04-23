from src.api.schemas.cases import CaseCreateRequest
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
    assert queue.items[0].delay_bucket in {'on_time', 'delayed_24h', 'delayed_72h'}
