from src.api.schemas.cases import CaseCreateRequest
from src.services.case_service import CaseService
from src.services.matrix_service import MatrixService


def test_matrix_service_returns_cells(db_session):
    CaseService(db_session).create_case(
        CaseCreateRequest(
            vk_number='VK-20260423-020',
            device_name='dev',
            tricia_s=1,
            tricia_p=1,
            tricia_d=2,
            user_s=1,
            user_d=2,
            validation_status='saved',
        ),
        actor_id='tester',
    )
    matrix = MatrixService(db_session).get_confusion_matrix()
    assert len(matrix.cells) >= 1
