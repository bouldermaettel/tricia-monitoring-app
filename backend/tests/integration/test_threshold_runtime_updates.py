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
