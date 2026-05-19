import json

from sqlalchemy import text


def _admin_headers(client):
    login = client.post(
        '/api/v1/auth/session',
        json={'username': 'bootstrap-admin', 'password': 'bootstrap-admin-pass'},
    )
    assert login.status_code == 200
    token = login.json()['access_token']
    return {'Authorization': f'Bearer {token}'}


def test_case_scores_can_be_updated_via_vk_number_path(client):
    payload = {
        'vk_number': 'Vk_20260512_001',
        'device_name': 'dev-update-vk',
        'tricia_s': 1,
        'tricia_p': 1,
        'tricia_d': 5,
        'user_s': 1,
        'user_d': 5,
        'validation_status': 'saved',
    }

    create = client.post('/api/v1/cases', json=payload)
    assert create.status_code == 201

    update = client.put(
        f"/api/v1/cases/{payload['vk_number']}",
        json={'tricia_s': 8, 'user_s': 10, 'user_d': 10},
    )
    assert update.status_code == 200

    listed = client.get('/api/v1/cases', params={'vk_number': payload['vk_number']})
    assert listed.status_code == 200
    rows = listed.json()['items']
    assert len(rows) == 1
    assert rows[0]['tricia_s'] == 8
    assert rows[0]['user_s'] == 10
    assert rows[0]['user_d'] == 10


def test_case_scores_can_be_created_when_snapshot_is_missing(client, db_session):
    payload = {
        'vk_number': 'Vk_20260512_001',
        'device_name': 'dev-missing-snapshot',
        'tricia_s': 1,
        'tricia_p': 1,
        'tricia_d': 5,
        'user_s': 1,
        'user_d': 5,
        'validation_status': 'saved',
    }

    create = client.post('/api/v1/cases', json=payload)
    assert create.status_code == 201

    case_id = create.json()['id']
    db_session.execute(
        text('DELETE FROM classification_snapshots WHERE case_id = :case_id'),
        {'case_id': case_id},
    )
    db_session.commit()

    update = client.put(
        f"/api/v1/cases/{payload['vk_number']}",
        json={'tricia_s': 8, 'tricia_p': 10, 'tricia_d': 10, 'user_s': 10, 'user_d': 10},
    )
    assert update.status_code == 200

    listed = client.get('/api/v1/cases', params={'vk_number': payload['vk_number']})
    assert listed.status_code == 200
    rows = listed.json()['items']
    assert len(rows) == 1
    assert rows[0]['tricia_s'] == 8
    assert rows[0]['tricia_p'] == 10
    assert rows[0]['tricia_d'] == 10
    assert rows[0]['user_s'] == 10
    assert rows[0]['user_d'] == 10


def test_case_can_be_deleted_via_vk_number_path(client):
    payload = {
        'vk_number': 'Vk_20260519_999',
        'device_name': 'dev-delete-vk',
        'tricia_s': 3,
        'tricia_p': 1,
        'tricia_d': 5,
        'user_s': 3,
        'user_d': 5,
        'validation_status': 'saved',
    }

    create = client.post('/api/v1/cases', json=payload)
    assert create.status_code == 201

    deleted = client.delete(f"/api/v1/cases/{payload['vk_number']}", headers=_admin_headers(client))
    assert deleted.status_code == 204

    listed = client.get('/api/v1/cases', params={'vk_number': payload['vk_number']})
    assert listed.status_code == 200
    assert listed.json()['total'] == 0


def test_case_scores_are_derived_from_audit_when_snapshot_missing(client, db_session):
    payload = {
        'vk_number': 'Vk_20260520_101',
        'device_name': 'dev-derived-scores',
        'tricia_s': 1,
        'tricia_p': 1,
        'tricia_d': 5,
        'user_s': 1,
        'user_d': 5,
        'validation_status': 'saved',
    }

    create = client.post('/api/v1/cases', json=payload)
    assert create.status_code == 201

    first_update = client.put(
        f"/api/v1/cases/{payload['vk_number']}",
        json={'tricia_s': 8, 'tricia_p': 10, 'tricia_d': 10, 'user_s': 8, 'user_d': 10},
    )
    assert first_update.status_code == 200

    case_id = create.json()['id']
    db_session.execute(
        text('DELETE FROM classification_snapshots WHERE case_id = :case_id'),
        {'case_id': case_id},
    )
    db_session.commit()

    listed = client.get('/api/v1/cases', params={'vk_number': payload['vk_number']})
    assert listed.status_code == 200
    rows = listed.json()['items']
    assert len(rows) == 1
    assert rows[0]['tricia_s'] == 8
    assert rows[0]['tricia_p'] == 10
    assert rows[0]['tricia_d'] == 10
    assert rows[0]['user_s'] == 8
    assert rows[0]['user_d'] == 10

    second_update = client.put(
        f"/api/v1/cases/{payload['vk_number']}",
        json={'user_s': 10},
    )
    assert second_update.status_code == 200

    snapshot_rows = db_session.execute(
        text('SELECT COUNT(*) FROM classification_snapshots WHERE case_id = :case_id'),
        {'case_id': case_id},
    ).scalar_one()
    assert snapshot_rows == 1

    listed_again = client.get('/api/v1/cases', params={'vk_number': payload['vk_number']})
    assert listed_again.status_code == 200
    rows_again = listed_again.json()['items']
    assert len(rows_again) == 1
    assert rows_again[0]['tricia_s'] == 8
    assert rows_again[0]['tricia_p'] == 10
    assert rows_again[0]['tricia_d'] == 10
    assert rows_again[0]['user_s'] == 10
    assert rows_again[0]['user_d'] == 10


def test_case_partial_score_edit_without_audit_trail(client, db_session):
    payload = {
        'vk_number': 'Vk_20260520_202',
        'device_name': 'dev-partial-no-audit',
        'tricia_s': 1,
        'tricia_p': 1,
        'tricia_d': 5,
        'user_s': 1,
        'user_d': 5,
        'validation_status': 'saved',
    }

    create = client.post('/api/v1/cases', json=payload)
    assert create.status_code == 201

    case_id = create.json()['id']
    db_session.execute(
        text('DELETE FROM classification_snapshots WHERE case_id = :case_id'),
        {'case_id': case_id},
    )
    db_session.execute(
        text('DELETE FROM case_audit_events WHERE case_id = :case_id'),
        {'case_id': case_id},
    )
    db_session.commit()

    update = client.put(
        f"/api/v1/cases/{payload['vk_number']}",
        json={'tricia_p': 5},
    )
    assert update.status_code == 200

    listed = client.get('/api/v1/cases', params={'vk_number': payload['vk_number']})
    assert listed.status_code == 200
    rows = listed.json()['items']
    assert len(rows) == 1
    assert rows[0]['tricia_p'] == 5
    assert rows[0]['tricia_s'] == 1
    assert rows[0]['tricia_d'] == 1
    assert rows[0]['user_s'] == 1
    assert rows[0]['user_d'] == 1

    audit_rows = db_session.execute(
        text(
            """
            SELECT action, changes
            FROM case_audit_events
            WHERE case_id = :case_id
            ORDER BY id
            """
        ),
        {'case_id': case_id},
    ).fetchall()
    assert len(audit_rows) == 1
    assert audit_rows[0][0] == 'updated'
    changes = audit_rows[0][1]
    if isinstance(changes, str):
        changes = json.loads(changes)
    assert changes['tricia_p'] == {'from': 1, 'to': 5}
