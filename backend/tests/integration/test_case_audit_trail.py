def test_case_audit_trail_records_changes(client):
    payload = {
        'vk_number': 'VK-20260424-401',
        'device_name': 'dev-audit',
        'tricia_s': 1,
        'tricia_p': 1,
        'tricia_d': 5,
        'user_s': 1,
        'user_d': 5,
        'validation_status': 'saved',
    }

    create = client.post('/api/v1/cases', json=payload)
    assert create.status_code == 201
    case_id = create.json()['id']

    update = client.put(f'/api/v1/cases/{case_id}', json={'device_name': 'dev-audit-updated', 'user_d': 10})
    assert update.status_code == 200

    review = client.patch(f'/api/v1/cases/{case_id}/review', json={'is_reviewed': True, 'risk_level': 'false_low'})
    assert review.status_code == 200

    comment = client.post(f'/api/v1/cases/{case_id}/comments', json={'text': 'looks suspicious'})
    assert comment.status_code == 201

    listed = client.get('/api/v1/cases', params={'vk_number': payload['vk_number']})
    assert listed.status_code == 200
    rows = listed.json()['items']
    assert len(rows) == 1
    assert rows[0]['comment_count'] == 1
    assert rows[0]['comment_text'] == 'looks suspicious'

    trail = client.get(f'/api/v1/cases/{case_id}/audit-trail')
    assert trail.status_code == 200
    items = trail.json()['items']
    assert len(items) >= 4

    actions = [item['action'] for item in items]
    assert 'created' in actions
    assert 'updated' in actions
    assert 'reviewed' in actions
    assert 'commented' in actions
