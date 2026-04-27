def test_threshold_update_reflected_in_matrix(client):
    update = {
        'config_key': 'default',
        'acceptance_threshold': 5,
        'problem_threshold': 7,
        'include_excluded_default': True,
    }
    response = client.put('/api/v1/config/thresholds', json=update)
    assert response.status_code == 200

    matrix = client.get('/api/v1/matrices/confusion?threshold_key=default')
    assert matrix.status_code == 200
    assert matrix.json()['threshold_key'] == 'default'


def test_create_case_uses_configured_problem_threshold(client):
    client.put(
        '/api/v1/config/thresholds',
        json={
            'config_key': 'default',
            'acceptance_threshold': 1,
            'problem_threshold': 5,
            'include_excluded_default': False,
        },
    )

    create = client.post(
        '/api/v1/cases',
        json={
            'vk_number': 'VK-THR-001',
            'device_name': 'threshold-device',
            'tricia_s': 1,
            'tricia_p': 1,
            'tricia_d': 1,
            'user_s': 1,
            'user_d': 5,
            'validation_status': 'saved',
        },
    )
    assert create.status_code == 201

    cases = client.get('/api/v1/cases?problematic_only=true')
    assert cases.status_code == 200
    assert cases.json()['total'] == 0


def test_problematic_only_filter_reacts_to_threshold_updates(client):
    client.put(
        '/api/v1/config/thresholds',
        json={
            'config_key': 'default',
            'acceptance_threshold': 1,
            'problem_threshold': 5,
            'include_excluded_default': False,
        },
    )

    create = client.post(
        '/api/v1/cases',
        json={
            'vk_number': 'VK-THR-002',
            'device_name': 'threshold-device',
            'tricia_s': 1,
            'tricia_p': 1,
            'tricia_d': 1,
            'user_s': 1,
            'user_d': 5,
            'validation_status': 'saved',
        },
    )
    assert create.status_code == 201

    before_update = client.get('/api/v1/cases?problematic_only=true')
    assert before_update.status_code == 200
    assert before_update.json()['total'] == 0

    client.put(
        '/api/v1/config/thresholds',
        json={
            'config_key': 'default',
            'acceptance_threshold': 1,
            'problem_threshold': 3,
            'include_excluded_default': False,
        },
    )

    after_update = client.get('/api/v1/cases?problematic_only=true')
    assert after_update.status_code == 200
    assert after_update.json()['total'] == 1

    matrix = client.get('/api/v1/matrices/confusion?problematic_only=true&threshold_key=default')
    assert matrix.status_code == 200
    detectability_cells = matrix.json()['matrices']['detectability']
    assert sum(cell['case_count'] for cell in detectability_cells) == 1
