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
            'password': 'admin-new-pass',
            'display_name': 'Admin New User',
            'role': 'operator',
            'is_active': True,
        },
        headers=headers,
    )
    assert response.status_code == 201
    payload = response.json()
    assert payload['external_key'] == 'admin.new.user'
    assert payload['display_name'] == 'Admin New User'
    assert payload['role'] == 'operator'
    assert payload['is_active'] is True


def test_auth_session_contract(client):
    headers = _admin_headers(client)
    client.post(
        '/api/v1/users',
        json={
            'external_key': 'admin.contract.login',
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
            'password': 'update-contract-pass',
            'display_name': 'Update Contract User',
            'role': 'operator',
            'is_active': True,
        },
        headers=headers,
    )
    user_id = created.json()['id']

    response = client.patch(
        f'/api/v1/users/{user_id}',
        json={'role': 'analyst', 'is_active': False},
        headers=headers,
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload['role'] == 'analyst'
    assert payload['is_active'] is False
