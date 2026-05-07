def test_thresholds_contract(client):
    get_response = client.get('/api/v1/config/thresholds')
    assert get_response.status_code == 200
    payload = {
        'config_key': 'default',
        'acceptance_threshold': 2,
        'problem_threshold': 4,
        'include_excluded_default': True,
    }
    put_response = client.put('/api/v1/config/thresholds', json=payload)
    assert put_response.status_code == 200
    assert put_response.json()['acceptance_threshold'] == 2


def test_thresholds_reject_overlapping_risk_categories(client):
    payload = {
        'config_key': 'default',
        'acceptance_threshold': 2,
        'problem_threshold': 4,
        'include_excluded_default': True,
        'risk_categories': [
            {'label': 'A', 'min_value': 0, 'max_value': 100},
            {'label': 'B', 'min_value': 50, 'max_value': 200},
        ],
    }

    response = client.put('/api/v1/config/thresholds', json=payload)

    assert response.status_code == 422
    body = response.json()
    assert 'overlap' in str(body).lower()


def test_exports_contract(client):
    csv_response = client.get('/api/v1/exports/cases.csv')
    assert csv_response.status_code == 200
    xlsx_response = client.get('/api/v1/exports/cases.xlsx')
    assert xlsx_response.status_code == 200
    payload = {
        'columns': ['vk_number', 'device_name', 'has_edits'],
        'rows': [{'vk_number': 'VK-1', 'device_name': 'Device A', 'has_edits': True}],
    }
    table_csv_response = client.post('/api/v1/exports/table.csv', json=payload)
    assert table_csv_response.status_code == 200
    table_xlsx_response = client.post('/api/v1/exports/table.xlsx', json=payload)
    assert table_xlsx_response.status_code == 200
