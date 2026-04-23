def test_openapi_contains_required_paths(client):
    response = client.get('/openapi.json')
    assert response.status_code == 200
    paths = response.json()['paths']
    assert '/api/v1/cases/validate' in paths
    assert '/api/v1/cases' in paths
    assert '/api/v1/matrices/confusion' in paths
    assert '/api/v1/control/queue' in paths
    assert '/api/v1/imports' in paths
    assert '/api/v1/config/thresholds' in paths
