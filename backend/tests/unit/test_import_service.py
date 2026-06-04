from datetime import date
from types import SimpleNamespace

import pytest

from src.models.case import Case, CaseAuditEvent, CaseComment, CaseReview
from src.models.classification_snapshot import ClassificationSnapshot
from src.models.user import User
from src.services.import_service import DuplicateVkConflictError, ImportService


def test_import_service_counts_rows(db_session):
    csv_payload = b'vk_number,device_name,TRI-S,TRI-P,TRI-D,WIMI-S,WIMI-D\nVk_20240523_001,dev-1,1,1,5,1,5\nVk_20240524_002,dev-2,3,1,5,3,5\n'
    job = ImportService(db_session).process_file('sample.csv', csv_payload, 'tester')
    assert job.total_rows == 2
    assert job.imported_rows == 2


def test_import_service_derives_missing_metadata(db_session):
    csv_payload = b'vk_number,device_name,TRI-S,TRI-P,TRI-D,WIMI-S,WIMI-D\nVk_20240523_001,Device-1,1,1,5,3,5\n'
    service = ImportService(db_session)

    preview = service.preview_file('sample.csv', csv_payload, 'bootstrap-admin')

    assert preview['total_rows'] == 1
    assert preview['cases'][0]['analysis_date'] == '2024-05-23'
    assert preview['cases'][0]['wimi_shortcut'] == 'adm'
    assert preview['cases'][0]['validation_status'] == 'saved'
    assert preview['control_items'][0]['wimi_shortcut'] == 'adm'

    job = service.process_file('sample.csv', csv_payload, 'bootstrap-admin')

    assert job.total_rows == 1
    assert job.imported_rows == 1

    case = db_session.query(Case).one()
    snapshot = db_session.query(ClassificationSnapshot).one()
    review = db_session.query(CaseReview).one()

    assert case.vk_number == 'Vk_20240523_001'
    assert case.device_name == 'Device-1'
    assert case.analysis_date == date(2024, 5, 23)
    assert case.wimi_shortcut == 'adm'
    assert case.validation_status == 'saved'
    assert case.input_timestamp is not None
    assert snapshot.tricia_s == 1
    assert snapshot.tricia_p == 1
    assert snapshot.tricia_d == 5
    assert snapshot.user_s == 3
    assert snapshot.user_d == 5
    assert review.is_excluded is False


def test_import_service_resolves_actor_by_external_key(db_session):
    db_session.add(
        User(
            id='user-123',
            external_key='688561e7-e6ae-4e5d-af3a-4b01a3aa5951',
            shortcut='pat',
            password_hash='hash',
            display_name='Patrick',
            role='user',
            is_active=True,
        )
    )
    db_session.commit()

    csv_payload = b'vk_number,device_name,TRI-S,TRI-P,TRI-D,WIMI-S,WIMI-D\nVk_20240523_001,Device-1,1,1,5,3,5\n'
    job = ImportService(db_session).process_file('sample.csv', csv_payload, '688561e7-e6ae-4e5d-af3a-4b01a3aa5951')

    assert job.imported_rows == 1

    case = db_session.query(Case).one()
    assert case.created_by_user_id == 'user-123'
    assert case.wimi_shortcut == 'pat'


def test_import_service_leaves_unknown_actor_shortcut_empty(db_session):
    csv_payload = b'vk_number,device_name,TRI-S,TRI-P,TRI-D,WIMI-S,WIMI-D\nVk_20240523_001,Device-1,1,1,5,3,5\n'
    unknown_actor_id = '688561e7-e6ae-4e5d-af3a-4b01a3aa5951'

    preview = ImportService(db_session).preview_file('sample.csv', csv_payload, unknown_actor_id)
    assert preview['cases'][0]['wimi_shortcut'] is None

    job = ImportService(db_session).process_file('sample.csv', csv_payload, unknown_actor_id)

    assert job.imported_rows == 1

    case = db_session.query(Case).one()
    assert case.created_by_user_id is None
    assert case.wimi_shortcut is None


def test_import_service_rejects_wrong_columns(db_session):
    csv_payload = b'vk_number,device_name,analysis_date,TRI-S,TRI-P,TRI-D,WIMI-S,WIMI-D\nVK-1,dev-1,2024-05-23,1,1,5,1,5\n'
    service = ImportService(db_session)

    with pytest.raises(ValueError, match='Invalid import file format'):
        service.preview_file('sample.csv', csv_payload, 'bootstrap-admin')

    with pytest.raises(ValueError, match='Invalid import file format'):
        service.process_file('sample.csv', csv_payload, 'bootstrap-admin')


def test_import_service_rejects_invalid_vk_number(db_session):
    csv_payload = b'vk_number,device_name,TRI-S,TRI-P,TRI-D,WIMI-S,WIMI-D\nVk_20251503_001,Device-1,1,1,5,2,4\n'
    service = ImportService(db_session)

    with pytest.raises(ValueError, match="VK-NR 'Vk_20251503_001' is invalid"):
        service.preview_file('sample.csv', csv_payload, 'bootstrap-admin')


def test_import_service_rejects_invalid_severity_score(db_session):
    csv_payload = b'vk_number,device_name,TRI-S,TRI-P,TRI-D,WIMI-S,WIMI-D\nVk_20240523_001,Device-1,2,1,5,2,4\n'
    service = ImportService(db_session)

    with pytest.raises(ValueError, match=r"column 'TRI-S' must be one of \[1, 3, 5, 8, 10\]"):
        service.preview_file('sample.csv', csv_payload, 'bootstrap-admin')


def test_import_service_aggregates_all_row_validation_errors(db_session):
    csv_payload = (
        b'vk_number,device_name,TRI-S,TRI-P,TRI-D,WIMI-S,WIMI-D\n'
        b'Vk_20251503_001,,2,2,7,4,6\n'
        b'bad,Device-2,11,3,0,9,12\n'
    )
    service = ImportService(db_session)

    with pytest.raises(ValueError) as exc_info:
        service.preview_file('sample.csv', csv_payload, 'bootstrap-admin')

    message = str(exc_info.value)
    assert "Row 2: VK-NR 'Vk_20251503_001' is invalid" in message
    assert "Row 2: column 'device_name' is required." in message
    assert "Row 2: column 'TRI-S' must be one of [1, 3, 5, 8, 10]." in message
    assert "Row 2: column 'TRI-P' must be one of [1, 5, 10]." in message
    assert "Row 2: column 'TRI-D' must be one of [1, 5, 10]." in message
    assert "Row 2: column 'WIMI-S' must be one of [1, 3, 5, 8, 10]." in message
    assert "Row 2: column 'WIMI-D' must be one of [1, 5, 10]." in message
    assert "Row 3: VK-NR 'bad' is invalid" in message
    assert "Row 3: column 'TRI-S' must be one of [1, 3, 5, 8, 10]." in message
    assert "Row 3: column 'TRI-P' must be one of [1, 5, 10]." in message
    assert "Row 3: column 'TRI-D' must be one of [1, 5, 10]." in message
    assert "Row 3: column 'WIMI-S' must be one of [1, 3, 5, 8, 10]." in message
    assert "Row 3: column 'WIMI-D' must be one of [1, 5, 10]." in message


def test_import_service_rejects_vk_numbers_already_in_database(db_session):
    existing_payload = b'vk_number,device_name,TRI-S,TRI-P,TRI-D,WIMI-S,WIMI-D\nVk_20240523_001,Device-1,1,1,5,3,5\n'
    duplicate_payload = b'vk_number,device_name,TRI-S,TRI-P,TRI-D,WIMI-S,WIMI-D\nVk_20240523_001,Device-2,1,1,5,3,5\n'
    service = ImportService(db_session)

    service.process_file('existing.csv', existing_payload, 'bootstrap-admin')

    with pytest.raises(DuplicateVkConflictError) as exc_info:
        service.process_file('duplicate.csv', duplicate_payload, 'bootstrap-admin')

    assert exc_info.value.duplicates == ['Vk_20240523_001']


def test_import_service_skips_duplicate_vk_numbers_when_requested(db_session):
    existing_payload = b'vk_number,device_name,TRI-S,TRI-P,TRI-D,WIMI-S,WIMI-D\nVk_20240523_001,Device-1,1,1,5,3,5\n'
    mixed_payload = (
        b'vk_number,device_name,TRI-S,TRI-P,TRI-D,WIMI-S,WIMI-D\n'
        b'Vk_20240523_001,Device-1-changed,3,5,10,8,10\n'
        b'Vk_20240524_002,Device-2,3,1,5,3,5\n'
    )
    service = ImportService(db_session)

    service.process_file('existing.csv', existing_payload, 'bootstrap-admin')
    result = service.process_file('mixed.csv', mixed_payload, 'bootstrap-admin', duplicate_action='skip')

    assert result.job.total_rows == 2
    assert result.job.imported_rows == 1
    assert result.skipped_rows == 1
    assert result.replaced_rows == 0

    existing_case = db_session.query(Case).filter(Case.vk_number == 'Vk_20240523_001').one()
    assert existing_case.device_name == 'Device-1'
    assert db_session.query(Case).count() == 2


def test_import_service_replaces_duplicate_and_preserves_review_comment_history(db_session):
    existing_payload = b'vk_number,device_name,TRI-S,TRI-P,TRI-D,WIMI-S,WIMI-D\nVk_20240523_001,Device-1,1,1,5,3,5\n'
    replacement_payload = b'vk_number,device_name,TRI-S,TRI-P,TRI-D,WIMI-S,WIMI-D\nVk_20240523_001,Device-1-replaced,8,5,10,10,5\n'
    service = ImportService(db_session)

    service.process_file('existing.csv', existing_payload, 'bootstrap-admin')
    case = db_session.query(Case).filter(Case.vk_number == 'Vk_20240523_001').one()
    review = db_session.query(CaseReview).filter(CaseReview.case_id == case.id).one()
    review.category_code = 'cat-a'
    review.is_excluded = True
    review.is_reviewed = True
    review.risk_level = 'high'
    db_session.add(
        CaseComment(
            case_id=case.id,
            comment_text='keep me',
            created_by_user_id='bootstrap-admin',
        )
    )
    db_session.commit()

    result = service.process_file('replace.csv', replacement_payload, 'bootstrap-admin', duplicate_action='replace')

    assert result.job.total_rows == 1
    assert result.job.imported_rows == 1
    assert result.replaced_rows == 1
    assert result.skipped_rows == 0

    replaced_case = db_session.query(Case).filter(Case.vk_number == 'Vk_20240523_001').one()
    replaced_snapshot = db_session.query(ClassificationSnapshot).filter(ClassificationSnapshot.case_id == replaced_case.id).one()
    replaced_review = db_session.query(CaseReview).filter(CaseReview.case_id == replaced_case.id).one()

    assert replaced_case.device_name == 'Device-1-replaced'
    assert replaced_snapshot.tricia_s == 8
    assert replaced_snapshot.tricia_p == 5
    assert replaced_snapshot.tricia_d == 10
    assert replaced_snapshot.user_s == 10
    assert replaced_snapshot.user_d == 5

    assert replaced_review.category_code == 'cat-a'
    assert replaced_review.is_excluded is True
    assert replaced_review.is_reviewed is True
    assert replaced_review.risk_level == 'high'
    assert db_session.query(CaseComment).filter(CaseComment.case_id == replaced_case.id).count() == 1

    audit_events = db_session.query(CaseAuditEvent).filter(CaseAuditEvent.case_id == replaced_case.id).all()
    assert any(event.action == 'import_replaced' for event in audit_events)


def test_import_service_syncs_snapshot_sequence_before_insert(db_session, monkeypatch):
    csv_payload = b'vk_number,device_name,TRI-S,TRI-P,TRI-D,WIMI-S,WIMI-D\nVk_20240523_001,dev-1,1,1,5,1,5\n'
    called = False

    def _fake_sync_pk_sequence(_db):
        nonlocal called
        called = True

    monkeypatch.setattr(ClassificationSnapshot, 'sync_pk_sequence', staticmethod(_fake_sync_pk_sequence))

    ImportService(db_session).process_file('sample.csv', csv_payload, 'tester')

    assert called is True


def test_classification_snapshot_sync_pk_sequence_uses_setval_on_postgres():
    class FakeSession:
        def __init__(self):
            self.executed = None

        def get_bind(self):
            return SimpleNamespace(dialect=SimpleNamespace(name='postgresql'))

        def execute(self, statement):
            self.executed = str(statement)

    fake_db = FakeSession()
    ClassificationSnapshot.sync_pk_sequence(fake_db)

    assert fake_db.executed is not None
    assert 'setval' in fake_db.executed.lower()


def test_classification_snapshot_sync_pk_sequence_skips_non_postgres():
    class FakeSession:
        def __init__(self):
            self.executed = None

        def get_bind(self):
            return SimpleNamespace(dialect=SimpleNamespace(name='sqlite'))

        def execute(self, statement):
            self.executed = statement

    fake_db = FakeSession()
    ClassificationSnapshot.sync_pk_sequence(fake_db)

    assert fake_db.executed is None
