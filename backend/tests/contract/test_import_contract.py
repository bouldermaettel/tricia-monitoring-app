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
