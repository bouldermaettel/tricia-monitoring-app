def _admin_headers(client):
    login = client.post(
        '/api/v1/auth/session',
        json={'username': 'bootstrap-admin', 'password': 'bootstrap-admin-pass'},
    )
    assert login.status_code == 200
    token = login.json()['access_token']
    return {'Authorization': f'Bearer {token}'}


def test_admin_can_add_and_list_users(client):
    headers = _admin_headers(client)
    create_response = client.post(
        '/api/v1/users',
        json={
            'external_key': 'matrix.analyst.1',
            'acronym': 'ma1',
            'password': 'matrix-analyst-pass',
            'display_name': 'Matrix Analyst',
            'role': 'user',
            'is_active': True,
        },
        headers=headers,
    )
    assert create_response.status_code == 201

    list_response = client.get('/api/v1/users', headers=headers)
    assert list_response.status_code == 200
    items = list_response.json()['items']
    assert any(item['external_key'] == 'matrix.analyst.1' and item['role'] == 'user' for item in items)


def test_admin_can_update_and_delete_user(client):
    headers = _admin_headers(client)
    created = client.post(
        '/api/v1/users',
        json={
            'external_key': 'ops.user.2',
            'acronym': 'ou2',
            'password': 'ops-user-pass',
            'display_name': 'Ops User 2',
            'role': 'user',
            'is_active': True,
        },
        headers=headers,
    )
    user_id = created.json()['id']

    updated = client.patch(
        f'/api/v1/users/{user_id}',
        json={'display_name': 'Ops User Updated', 'role': 'user', 'is_active': False},
        headers=headers,
    )
    assert updated.status_code == 200
    payload = updated.json()
    assert payload['display_name'] == 'Ops User Updated'
    assert payload['role'] == 'user'
    assert payload['is_active'] is False

    deleted = client.delete(
        f'/api/v1/users/{user_id}',
        headers=headers,
    )
    assert deleted.status_code == 204


def test_admin_can_delete_user_referenced_by_case_records(client):
    headers = _admin_headers(client)
    created = client.post(
        '/api/v1/users',
        json={
            'external_key': 'ops.user.3',
            'acronym': 'ou3',
            'password': 'ops-user-pass-3',
            'display_name': 'Ops User 3',
            'role': 'user',
            'is_active': True,
        },
        headers=headers,
    )
    assert created.status_code == 201
    user_id = created.json()['id']

    create_case = client.post(
        '/api/v1/cases',
        json={
            'vk_number': 'Vk_20990101_001',
            'device_name': 'Delete User Regression Device',
            'tricia_s': 1,
            'tricia_p': 1,
            'tricia_d': 1,
            'wimi_s': 1,
            'wimi_d': 1,
            'user_s': 1,
            'user_p': 1,
            'user_d': 1,
        },
        headers={'X-Actor-Key': user_id},
    )
    assert create_case.status_code == 201

    deleted = client.delete(
        f'/api/v1/users/{user_id}',
        headers=headers,
    )
    assert deleted.status_code == 204
