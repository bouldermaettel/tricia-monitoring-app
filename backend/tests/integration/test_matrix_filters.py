def test_matrix_endpoint_with_filters(client):
    response = client.get('/api/v1/matrices/confusion?include_excluded=false&threshold_key=default')
    assert response.status_code == 200
    assert 'cells' in response.json()
