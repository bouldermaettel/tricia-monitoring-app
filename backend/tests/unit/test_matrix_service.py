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
            tricia_d=5,
            user_s=1,
            user_d=5,
            validation_status='saved',
        ),
        actor_id='tester',
    )
    matrix = MatrixService(db_session).get_confusion_matrix()
    assert len(matrix.cells) >= 1
    assert len(matrix.matrices.detectability) >= 1


def test_matrix_service_uses_wimi_as_ground_truth(db_session):
    CaseService(db_session).create_case(
        CaseCreateRequest(
            vk_number='VK-20260423-021',
            device_name='dev',
            tricia_s=1,
            tricia_p=1,
            tricia_d=5,
            user_s=1,
            user_d=10,
            validation_status='saved',
        ),
        actor_id='tester',
    )

    matrix = MatrixService(db_session).get_confusion_matrix()
    assert any(cell.expected_value == 1 and cell.observed_value == 1 for cell in matrix.matrices.severity)
    assert any(cell.expected_value == 10 and cell.observed_value == 5 for cell in matrix.matrices.detectability)


def test_matrix_service_returns_product_matrix_with_wimi_p_equal_tricia_p(db_session):
    CaseService(db_session).create_case(
        CaseCreateRequest(
            vk_number='VK-20260423-022',
            device_name='dev',
            tricia_s=1,
            tricia_p=5,
            tricia_d=5,
            user_s=8,
            user_d=10,
            validation_status='saved',
        ),
        actor_id='tester',
    )

    matrix = MatrixService(db_session).get_confusion_matrix()
    assert any(cell.expected_value == 400 and cell.observed_value == 25 for cell in matrix.matrices.product)


def test_matrix_service_filters_dimensions_by_selected_product_cells(db_session):
    CaseService(db_session).create_case(
        CaseCreateRequest(
            vk_number='VK-20260423-023',
            device_name='dev',
            tricia_s=1,
            tricia_p=5,
            tricia_d=5,
            user_s=8,
            user_d=10,
            validation_status='saved',
        ),
        actor_id='tester',
    )
    CaseService(db_session).create_case(
        CaseCreateRequest(
            vk_number='VK-20260423-024',
            device_name='dev',
            tricia_s=10,
            tricia_p=5,
            tricia_d=10,
            user_s=10,
            user_d=10,
            validation_status='saved',
        ),
        actor_id='tester',
    )

    matrix = MatrixService(db_session).get_confusion_matrix(product_cells=[(400, 25)])

    assert len(matrix.matrices.product) == 1
    assert matrix.matrices.product[0].expected_value == 400
    assert matrix.matrices.product[0].observed_value == 25
    assert len(matrix.matrices.severity) == 1
    assert matrix.matrices.severity[0].expected_value == 8
    assert matrix.matrices.severity[0].observed_value == 1
    assert len(matrix.matrices.detectability) == 1
    assert matrix.matrices.detectability[0].expected_value == 10
    assert matrix.matrices.detectability[0].observed_value == 5
