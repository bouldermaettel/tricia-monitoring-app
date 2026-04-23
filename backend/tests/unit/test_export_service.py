from src.api.schemas.cases import CaseCreateRequest
from src.services.case_service import CaseService
from src.services.export_service import ExportService


def test_export_csv_and_xlsx(db_session):
    CaseService(db_session).create_case(
        CaseCreateRequest(
            vk_number='VK-20260423-040',
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
    exporter = ExportService(db_session)
    assert b'vk_number' in exporter.to_csv()
    assert b'TRI-S' in exporter.to_csv()
    assert b'WIMI-S' in exporter.to_csv()
    assert len(exporter.to_xlsx()) > 100
