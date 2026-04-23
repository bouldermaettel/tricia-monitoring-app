"""Extended validation and case workflow tests."""
from datetime import date

import pytest
from sqlalchemy.orm import Session

from src.api.schemas.cases import CaseValidationRequest, CaseCreateRequest
from src.models.case import Case
from src.services.validation_service import ValidationService
from src.services.case_service import CaseService


def test_derive_analysis_date_valid_formats(db_session: Session):
    """Test date derivation from various VK number formats."""
    test_cases = [
        ("VK20251225001", date(2025, 12, 25)),
        ("20230615_ABC", date(2023, 6, 15)),
        ("2024010112345", date(2024, 1, 1)),
        ("invalid_date_vk", date.today()),  # Fallback to today
    ]
    for vk_number, expected_date in test_cases:
        result = ValidationService.derive_analysis_date(vk_number)
        assert result == expected_date, f"VK {vk_number}: expected {expected_date}, got {result}"


def test_derive_analysis_date_invalid_month_day():
    """Test date parsing rejects invalid month/day values."""
    invalid_cases = [
        "VK20251301001",  # Month > 12
        "VK20250032001",  # Day > 31
        "VK20250000001",  # Month = 0
    ]
    for vk_number in invalid_cases:
        result = ValidationService.derive_analysis_date(vk_number)
        # Should fallback to today, not crash
        assert result == date.today()


def test_duplicate_detection_fresh_vk(db_session: Session):
    """Test that new VK numbers don't trigger duplicate warnings."""
    payload = CaseValidationRequest(
        vk_number="VK_FRESH_001",
        device_name="Device1",
        tricia_s=3,
        tricia_p=2,
        tricia_d=1,
        user_s=3,
        user_d=1,
    )
    response = ValidationService(db_session).validate(payload)
    assert response.duplicate is False
    assert response.analysis_date is not None


def test_duplicate_detection_after_save(db_session: Session):
    """Test that duplicate detection works after case is saved."""
    vk_number = "VK_DUP_TEST_001"
    
    # First validation should not find duplicate
    payload1 = CaseValidationRequest(
        vk_number=vk_number,
        device_name="Device1",
        tricia_s=3,
        tricia_p=2,
        tricia_d=1,
        user_s=3,
        user_d=1,
    )
    response1 = ValidationService(db_session).validate(payload1)
    assert response1.duplicate is False
    
    # Create the case
    create_payload = CaseCreateRequest(**payload1.model_dump())
    CaseService(db_session).create_case(create_payload, "test_user")
    db_session.commit()
    
    # Second validation should detect duplicate
    response2 = ValidationService(db_session).validate(payload1)
    assert response2.duplicate is True


def test_autofill_user_d_from_tricia_d(db_session: Session):
    """Test that user_d auto-fills from tricia_d when not provided."""
    payload = CaseValidationRequest(
        vk_number="VK_AUTOFILL_001",
        device_name="Device1",
        tricia_s=3,
        tricia_p=2,
        tricia_d=1,
        user_s=3,
        user_d=None,  # Explicitly None
    )
    
    response = ValidationService(db_session).validate(payload)
    assert response.auto_fill["user_d"] == payload.tricia_d


def test_autofill_respects_provided_user_d(db_session: Session):
    """Test that user_d from request is preserved in autofill."""
    payload = CaseValidationRequest(
        vk_number="VK_PRESERVE_001",
        device_name="Device1",
        tricia_s=3,
        tricia_p=2,
        tricia_d=1,
        user_s=3,
        user_d=2,  # Explicitly provided
    )
    
    response = ValidationService(db_session).validate(payload)
    assert response.auto_fill["user_d"] == 2


def test_case_creation_persists_derived_metadata(db_session: Session):
    """Test that created case stores analysis_date correctly."""
    vk_number = "VK20260115_PERSIST"
    payload = CaseCreateRequest(
        vk_number=vk_number,
        device_name="Device1",
        tricia_s=3,
        tricia_p=2,
        tricia_d=1,
        user_s=3,
        user_d=1,
    )
    
    case = CaseService(db_session).create_case(payload, "test_actor")
    db_session.commit()
    
    # Fetch and verify
    saved_case = db_session.query(Case).filter(Case.vk_number == vk_number).first()
    assert saved_case is not None
    assert saved_case.analysis_date == date(2026, 1, 15)
    assert saved_case.validation_status == "saved"


def test_infer_user_id_fallback(monkeypatch):
    """Test user ID inference falls back to 'anonymous' when env is not set."""
    # Clear the environment variable
    monkeypatch.delenv("MONITORING_USER_ID", raising=False)
    
    user_id = ValidationService.infer_user_id()
    assert user_id == "anonymous"


def test_infer_user_id_from_env(monkeypatch):
    """Test user ID inference from environment."""
    monkeypatch.setenv("MONITORING_USER_ID", "patrick_user")
    
    user_id = ValidationService.infer_user_id()
    assert user_id == "patrick_user"
