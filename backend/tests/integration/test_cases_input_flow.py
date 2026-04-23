def test_validate_then_save_then_list(client):
    payload = {
        'vk_number': 'VK-20260423-101',
        'device_name': 'dev-flow',
        'tricia_s': 1,
        'tricia_p': 1,
        'tricia_d': 5,
        'user_s': 1,
        'user_d': 5,
    }
    validate = client.post('/api/v1/cases/validate', json=payload)
    assert validate.status_code == 200

    create = client.post('/api/v1/cases', json={**payload, 'validation_status': 'saved'})
    assert create.status_code == 201

    listing = client.get('/api/v1/cases')
    assert listing.status_code == 200
    assert listing.json()['total'] >= 1
