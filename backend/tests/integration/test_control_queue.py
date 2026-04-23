def test_control_queue_filters(client):
    response = client.get('/api/v1/control/queue?status=saved')
    assert response.status_code == 200
    assert 'items' in response.json()
