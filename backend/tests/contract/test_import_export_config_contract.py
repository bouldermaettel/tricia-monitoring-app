from src.models.threshold_config import ThresholdConfig


def test_thresholds_contract(client):
    get_response = client.get('/api/v1/config/thresholds')
    assert get_response.status_code == 200
    assert get_response.json()['risk_categories'][0]['label'] == 'Class 1'
    payload = {
        'config_key': 'default',
        'acceptance_threshold': 2,
        'problematic_case_thresholds': {'3M': 4, '6M': 8, '12M': 12},
        'include_excluded_default': True,
    }
    put_response = client.put('/api/v1/config/thresholds', json=payload)
    assert put_response.status_code == 200
    assert put_response.json()['acceptance_threshold'] == 2


def test_thresholds_persist_custom_risk_category_labels(client):
    payload = {
        'config_key': 'default',
        'acceptance_threshold': 2,
        'problematic_case_thresholds': {'3M': 4, '6M': 8, '12M': 12},
        'include_excluded_default': True,
        'risk_categories': [
            {'label': 'Field Review', 'min_value': 0, 'max_value': 10},
            {'label': 'Escalate', 'min_value': 11, 'max_value': 250},
        ],
    }

    response = client.put('/api/v1/config/thresholds', json=payload)

    assert response.status_code == 200
    body = response.json()
    assert [category['label'] for category in body['risk_categories']] == ['Field Review', 'Escalate']


def test_thresholds_backfill_legacy_default_risk_labels(client, db_session):
    db_session.add(
        ThresholdConfig(
            config_key='default',
            acceptance_threshold=1,
            problem_threshold=3,
            problematic_case_thresholds={'3M': 10, '6M': 20, '12M': 40},
            include_excluded_default=False,
            risk_categories=[
                {'label': '0-10', 'min_value': 0, 'max_value': 10},
                {'label': '11-250', 'min_value': 11, 'max_value': 250},
                {'label': '251-500', 'min_value': 251, 'max_value': 500},
                {'label': '501-1000', 'min_value': 501, 'max_value': 1000},
            ],
        )
    )
    db_session.commit()

    response = client.get('/api/v1/config/thresholds')

    assert response.status_code == 200
    assert [category['label'] for category in response.json()['risk_categories']] == [
        'Class 1',
        'Class 2',
        'Class 3',
        'Class 4',
    ]


def test_thresholds_reject_overlapping_risk_categories(client):
    payload = {
        'config_key': 'default',
        'acceptance_threshold': 2,
        'problematic_case_thresholds': {'3M': 4, '6M': 8, '12M': 12},
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
