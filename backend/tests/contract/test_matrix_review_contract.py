def test_confusion_contract(client):
    response = client.get('/api/v1/matrices/confusion')
    assert response.status_code == 200
    assert 'cells' in response.json()


def test_patch_review_contract(client):
    create_payload = {
        'vk_number': 'VK-20260423-003',
        'device_name': 'dev-c',
        'tricia_s': 1,
        'tricia_p': 1,
        'tricia_d': 1,
        'user_s': 1,
        'user_d': 1,
        'validation_status': 'saved',
    }
    create = client.post('/api/v1/cases', json=create_payload)
    case_id = create.json()['id']
    response = client.patch(f'/api/v1/cases/{case_id}/review', json={'is_reviewed': True, 'risk_level': 'false_low'})
    assert response.status_code == 200
    assert response.json()['is_reviewed'] is True
