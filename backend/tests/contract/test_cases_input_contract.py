def test_cases_validate_contract(client):
    payload = {
        'vk_number': 'VK-20260423-001',
        'device_name': 'dev-a',
        'tricia_s': 1,
        'tricia_p': 1,
        'tricia_d': 1,
        'user_s': 1,
        'user_d': 1,
    }
    response = client.post('/api/v1/cases/validate', json=payload)
    assert response.status_code == 200
    body = response.json()
    assert 'analysis_date' in body
    assert 'auto_fill' in body
    assert 'duplicate' in body


def test_cases_create_contract(client):
    payload = {
        'vk_number': 'VK-20260423-002',
        'device_name': 'dev-b',
        'tricia_s': 1,
        'tricia_p': 1,
        'tricia_d': 5,
        'user_s': 1,
        'user_d': 5,
        'validation_status': 'saved',
    }
    response = client.post('/api/v1/cases', json=payload)
    assert response.status_code == 201
    assert 'id' in response.json()
