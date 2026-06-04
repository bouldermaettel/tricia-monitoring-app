def test_import_rejects_wrong_columns(client):
    csv_payload = 'vk_number,device_name,analysis_date,TRI-S,TRI-P,TRI-D,WIMI-S,WIMI-D\nVK-1,dev-1,2024-05-23,1,1,5,1,5\n'
    files = {'file': ('bad-import.csv', csv_payload, 'text/csv')}

    response = client.post('/api/v1/imports', files=files)

    assert response.status_code == 422
    assert 'Invalid import file format' in response.text


def test_import_preview_rejects_wrong_columns(client):
    csv_payload = 'vk_number,device_name,analysis_date,TRI-S,TRI-P,TRI-D,WIMI-S,WIMI-D\nVK-1,dev-1,2024-05-23,1,1,5,1,5\n'
    files = {'file': ('bad-import.csv', csv_payload, 'text/csv')}

    response = client.post('/api/v1/imports/preview', files=files)

    assert response.status_code == 422
    assert 'Invalid import file format' in response.text


def test_import_returns_structured_duplicate_conflict(client):
    csv_payload = 'vk_number,device_name,TRI-S,TRI-P,TRI-D,WIMI-S,WIMI-D\nVk_20240523_001,dev-1,1,1,5,1,5\n'
    files = {'file': ('import.csv', csv_payload, 'text/csv')}

    first = client.post('/api/v1/imports', files=files)
    assert first.status_code == 202

    second = client.post('/api/v1/imports', files=files)
    assert second.status_code == 409
    body = second.json()
    assert body['error']['code'] == 'duplicate_vk_conflict'
    assert body['error']['details']['duplicates'] == ['Vk_20240523_001']


def test_import_duplicate_action_skip_and_replace(client):
    existing_payload = 'vk_number,device_name,TRI-S,TRI-P,TRI-D,WIMI-S,WIMI-D\nVk_20240523_001,dev-1,1,1,5,1,5\n'
    mixed_payload = (
        'vk_number,device_name,TRI-S,TRI-P,TRI-D,WIMI-S,WIMI-D\n'
        'Vk_20240523_001,dev-1-updated,8,5,10,10,5\n'
        'Vk_20240524_002,dev-2,3,1,5,3,5\n'
    )

    first = client.post('/api/v1/imports', files={'file': ('existing.csv', existing_payload, 'text/csv')})
    assert first.status_code == 202

    skip_response = client.post(
        '/api/v1/imports',
        files={
            'file': ('mixed.csv', mixed_payload, 'text/csv'),
            'duplicate_action': (None, 'skip'),
        },
    )
    assert skip_response.status_code == 202
    skip_body = skip_response.json()
    assert skip_body['imported_rows'] == 1
    assert skip_body['skipped_rows'] == 1
    assert skip_body['replaced_rows'] == 0

    replace_payload = 'vk_number,device_name,TRI-S,TRI-P,TRI-D,WIMI-S,WIMI-D\nVk_20240523_001,dev-1-replaced,8,5,10,10,5\n'
    replace_response = client.post(
        '/api/v1/imports',
        files={
            'file': ('replace.csv', replace_payload, 'text/csv'),
            'duplicate_action': (None, 'replace'),
        },
    )
    assert replace_response.status_code == 202
    replace_body = replace_response.json()
    assert replace_body['imported_rows'] == 1
    assert replace_body['replaced_rows'] == 1
    assert replace_body['skipped_rows'] == 0
