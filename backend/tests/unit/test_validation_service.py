from src.api.schemas.cases import CaseValidationRequest
from src.services.validation_service import ValidationService


def test_validation_derives_analysis_date(db_session):
    payload = CaseValidationRequest(
        vk_number='VK_20260423_010',
        device_name='dev',
        tricia_s=1,
        tricia_p=1,
        tricia_d=5,
        user_s=1,
        user_d=5,
    )
    result = ValidationService(db_session).validate(payload)
    assert str(result.analysis_date) == '2026-04-23'


def test_validation_autofills_user_d_when_missing(db_session):
    payload = CaseValidationRequest(
        vk_number='VK_20260423_011',
        device_name='dev',
        tricia_s=1,
        tricia_p=1,
        tricia_d=5,
        user_s=1,
        user_d=None,
    )
    result = ValidationService(db_session).validate(payload)
    assert result.auto_fill['user_d'] == 5
