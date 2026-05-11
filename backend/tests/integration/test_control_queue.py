def test_control_queue_filters(client):
    response = client.get('/api/v1/control/queue?status=saved')
    assert response.status_code == 200
    assert 'items' in response.json()


def test_control_queue_accepts_review_window_days(client):
    response = client.get('/api/v1/control/queue?review_window_days=14')
    assert response.status_code == 200
    assert 'items' in response.json()


def test_control_queue_accepts_zero_review_window_days(client):
    response = client.get('/api/v1/control/queue?review_window_days=0')
    assert response.status_code == 200
    assert 'items' in response.json()


def test_control_queue_accepts_input_date_basis(client):
    response = client.get('/api/v1/control/queue?date_basis=input')
    assert response.status_code == 200
    assert 'items' in response.json()


def test_control_queue_rejects_unknown_date_basis(client):
    response = client.get('/api/v1/control/queue?date_basis=unknown')
    assert response.status_code == 422
