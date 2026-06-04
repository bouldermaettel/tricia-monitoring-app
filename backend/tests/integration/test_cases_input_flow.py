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


def test_list_cases_all_results_ignores_page_size(client):
    for index in range(3):
        create = client.post(
            '/api/v1/cases',
            json={
                'vk_number': f'VK-ALL-20260423-{index + 1:03d}',
                'device_name': f'flow-device-{index + 1}',
                'tricia_s': 1,
                'tricia_p': 1,
                'tricia_d': 5,
                'user_s': 1,
                'user_d': 5,
                'validation_status': 'saved',
            },
        )
        assert create.status_code == 201

    listing = client.get(
        '/api/v1/cases',
        params={
            'vk_number_contains': 'VK-ALL-20260423-',
            'page_size': 1,
            'all': 'true',
        },
    )

    assert listing.status_code == 200
    body = listing.json()
    assert body['total'] == 3
    assert body['page'] == 1
    assert body['page_size'] == 3
    assert len(body['items']) == 3
