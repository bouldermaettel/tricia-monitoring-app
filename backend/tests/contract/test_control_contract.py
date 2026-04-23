def test_control_queue_contract(client):
    response = client.get('/api/v1/control/queue')
    assert response.status_code == 200
    assert 'items' in response.json()
