def test_matrix_endpoint_with_filters(client):
    response = client.get('/api/v1/matrices/confusion?include_excluded=false&threshold_key=default')
    assert response.status_code == 200
    assert 'cells' in response.json()
    assert 'matrices' in response.json()


def test_matrix_problem_case_count_uses_current_acceptance_threshold(client):
    client.put(
        '/api/v1/config/thresholds',
        json={
            'config_key': 'default',
            'acceptance_threshold': 3,
            'problematic_case_thresholds': {'3M': 10, '6M': 20, '12M': 40},
            'include_excluded_default': False,
        },
    )

    create = client.post(
        '/api/v1/cases',
        json={
            'vk_number': 'VK-MTX-001',
            'device_name': 'matrix-device',
            'tricia_s': 1,
            'tricia_p': 10,
            'tricia_d': 1,
            'user_s': 10,
            'user_d': 10,
            'validation_status': 'saved',
        },
    )
    assert create.status_code == 201

    matrix_high = client.get('/api/v1/matrices/confusion?threshold_key=default')
    assert matrix_high.status_code == 200
    high_problem_count = sum(cell['problem_case_count'] for cell in matrix_high.json()['matrices']['detectability'])
    assert high_problem_count == 0

    client.put(
        '/api/v1/config/thresholds',
        json={
            'config_key': 'default',
            'acceptance_threshold': 1,
            'problematic_case_thresholds': {'3M': 10, '6M': 20, '12M': 40},
            'include_excluded_default': False,
        },
    )

    matrix_low = client.get('/api/v1/matrices/confusion?threshold_key=default')
    assert matrix_low.status_code == 200
    low_problem_count = sum(cell['problem_case_count'] for cell in matrix_low.json()['matrices']['detectability'])
    assert low_problem_count == 1


def test_matrix_endpoint_filters_severity_and_detectability_by_product_cells(client):
    create_1 = client.post(
        '/api/v1/cases',
        json={
            'vk_number': 'VK-MTX-FLT-001',
            'device_name': 'matrix-filter-device-1',
            'tricia_s': 1,
            'tricia_p': 5,
            'tricia_d': 5,
            'user_s': 8,
            'user_d': 10,
            'validation_status': 'saved',
        },
    )
    assert create_1.status_code == 201

    create_2 = client.post(
        '/api/v1/cases',
        json={
            'vk_number': 'VK-MTX-FLT-002',
            'device_name': 'matrix-filter-device-2',
            'tricia_s': 10,
            'tricia_p': 5,
            'tricia_d': 10,
            'user_s': 10,
            'user_d': 10,
            'validation_status': 'saved',
        },
    )
    assert create_2.status_code == 201

    response = client.get('/api/v1/matrices/confusion?threshold_key=default&product_cells=400:25')
    assert response.status_code == 200
    payload = response.json()

    assert payload['matrices']['product'] == [
        {
            'expected_value': 400,
            'observed_value': 25,
            'case_count': 1,
            'excluded_case_count': 0,
            'problem_case_count': 0,
            'within_threshold': False,
        }
    ]
    assert payload['matrices']['severity'] == [
        {
            'expected_value': 8,
            'observed_value': 1,
            'case_count': 1,
            'excluded_case_count': 0,
            'problem_case_count': 0,
            'within_threshold': False,
        }
    ]
    assert payload['matrices']['detectability'] == [
        {
            'expected_value': 10,
            'observed_value': 5,
            'case_count': 1,
            'excluded_case_count': 0,
            'problem_case_count': 0,
            'within_threshold': False,
        }
    ]
