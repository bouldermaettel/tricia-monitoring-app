def _admin_headers(client):
    login = client.post(
        '/api/v1/auth/session',
        json={'username': 'bootstrap-admin', 'password': 'bootstrap-admin-pass'},
    )
    assert login.status_code == 200
    token = login.json()['access_token']
    return {'Authorization': f'Bearer {token}'}


def test_users_list_requires_admin_header(client):
    response = client.get('/api/v1/users')
    assert response.status_code == 401


def test_users_create_contract(client):
    headers = _admin_headers(client)
    response = client.post(
        '/api/v1/users',
        json={
            'external_key': 'admin.new.user',
            'acronym': 'anu',
            'password': 'admin-new-pass',
            'display_name': 'Admin New User',
            'role': 'user',
            'is_active': True,
        },
        headers=headers,
    )
    assert response.status_code == 201
    payload = response.json()
    assert payload['external_key'] == 'admin.new.user'
    assert payload['acronym'] == 'anu'
    assert payload['display_name'] == 'Admin New User'
    assert payload['role'] == 'user'
    assert payload['is_active'] is True


def test_auth_session_contract(client):
    headers = _admin_headers(client)
    client.post(
        '/api/v1/users',
        json={
            'external_key': 'admin.contract.login',
            'acronym': 'acl',
            'password': 'admin-contract-pass',
            'display_name': 'Admin Contract Login',
            'role': 'admin',
            'is_active': True,
        },
        headers=headers,
    )

    response = client.post(
        '/api/v1/auth/session',
        json={'username': 'admin.contract.login', 'password': 'admin-contract-pass'},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload['external_key'] == 'admin.contract.login'
    assert payload['acronym'] == 'acl'
    assert payload['role'] == 'admin'
    assert payload['access_token']
    assert payload['refresh_token']


def test_auth_refresh_contract(client):
    login = client.post(
        '/api/v1/auth/session',
        json={'username': 'bootstrap-admin', 'password': 'bootstrap-admin-pass'},
    )
    assert login.status_code == 200
    refresh_token = login.json()['refresh_token']

    refreshed = client.post('/api/v1/auth/refresh', json={'refresh_token': refresh_token})
    assert refreshed.status_code == 200
    payload = refreshed.json()
    assert payload['access_token']
    assert payload['refresh_token']


def test_users_update_contract(client):
    headers = _admin_headers(client)
    created = client.post(
        '/api/v1/users',
        json={
            'external_key': 'update.contract.user',
            'acronym': 'ucu',
            'password': 'update-contract-pass',
            'display_name': 'Update Contract User',
            'role': 'user',
            'is_active': True,
        },
        headers=headers,
    )
    user_id = created.json()['id']

    response = client.patch(
        f'/api/v1/users/{user_id}',
        json={'role': 'user', 'is_active': False},
        headers=headers,
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload['role'] == 'user'
    assert payload['is_active'] is False


def test_first_login_requires_password_change_and_can_clear_flag(client):
    headers = _admin_headers(client)
    created = client.post(
        '/api/v1/users',
        json={
            'external_key': 'first.login.user',
            'acronym': 'flu',
            'password': 'temp-pass-123',
            'display_name': 'First Login User',
            'role': 'user',
            'is_active': True,
        },
        headers=headers,
    )
    assert created.status_code == 201

    login = client.post(
        '/api/v1/auth/session',
        json={'username': 'first.login.user', 'password': 'temp-pass-123'},
    )
    assert login.status_code == 200
    login_payload = login.json()
    assert login_payload['must_change_password'] is True

    changed = client.post(
        '/api/v1/auth/change-password',
        json={'current_password': 'temp-pass-123', 'new_password': 'temp-pass-456'},
        headers={'Authorization': f"Bearer {login_payload['access_token']}"},
    )
    assert changed.status_code == 200
    changed_payload = changed.json()
    assert changed_payload['must_change_password'] is False


def test_admin_password_reset_forces_change_on_next_login(client):
    headers = _admin_headers(client)
    created = client.post(
        '/api/v1/users',
        json={
            'external_key': 'reset.check.user',
            'acronym': 'rcu',
            'password': 'reset-start-123',
            'display_name': 'Reset Check User',
            'role': 'user',
            'is_active': True,
        },
        headers=headers,
    )
    assert created.status_code == 201
    user_id = created.json()['id']

    first_login = client.post(
        '/api/v1/auth/session',
        json={'username': 'reset.check.user', 'password': 'reset-start-123'},
    )
    assert first_login.status_code == 200

    changed = client.post(
        '/api/v1/auth/change-password',
        json={'current_password': 'reset-start-123', 'new_password': 'reset-final-123'},
        headers={'Authorization': f"Bearer {first_login.json()['access_token']}"},
    )
    assert changed.status_code == 200
    assert changed.json()['must_change_password'] is False

    reset = client.patch(
        f'/api/v1/users/{user_id}',
        json={'password': 'admin-reset-123'},
        headers=headers,
    )
    assert reset.status_code == 200

    second_login = client.post(
        '/api/v1/auth/session',
        json={'username': 'reset.check.user', 'password': 'admin-reset-123'},
    )
    assert second_login.status_code == 200
    assert second_login.json()['must_change_password'] is True
