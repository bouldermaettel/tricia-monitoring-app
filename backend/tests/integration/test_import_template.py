from io import BytesIO

import pytest
from openpyxl import load_workbook

from src.models.classification_snapshot import ClassificationSnapshot


@pytest.mark.parametrize('with_wimi_p', [True, False])
def test_template_upload_and_score_edits_recalculate_risks(client, db_session, with_wimi_p):
    columns = ['vk_number', 'device_name', 'TRI-S', 'TRI-P', 'TRI-D', 'WIMI-S', 'WIMI-P', 'WIMI-D']
    if not with_wimi_p:
        columns.remove('WIMI-P')
    response = client.post('/api/v1/exports/table.xlsx', json={'columns': columns, 'rows': []})
    assert response.status_code == 200
    workbook = load_workbook(BytesIO(response.content))
    sheet = workbook.active
    assert list(next(sheet.values)) == columns
    values = ['Vk_20261022_901', 'Template device', 5, 5, 10, 3, 10, 5]
    if not with_wimi_p:
        values.pop(6)
    sheet.append(values)
    output = BytesIO()
    workbook.save(output)
    files = {'file': ('template.xlsx', output.getvalue(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
    preview = client.post('/api/v1/imports/preview', files=files)
    assert preview.status_code == 200, preview.text
    item = preview.json()['cases'][0]
    probability = 10 if with_wimi_p else 5
    assert item['analysis_date'] == '2026-10-22'
    assert item['validation_status'] == 'saved'
    assert item['user_p'] == probability
    assert item['tri_risk'] == 250
    assert item['wimi_risk'] == 3 * probability * 5
    imported = client.post('/api/v1/imports', files=files)
    assert imported.status_code == 202, imported.text
    assert imported.json()['imported_rows'] == 1
    snapshot = db_session.query(ClassificationSnapshot).one()
    assert snapshot.tri_risk == 250
    assert snapshot.wimi_risk == 3 * probability * 5
    updated = client.put('/api/v1/cases/Vk_20261022_901', json={'tricia_p': 1, 'user_p': 1, 'user_s': 8})
    assert updated.status_code == 200, updated.text
    db_session.refresh(snapshot)
    assert snapshot.tri_risk == 50
    assert snapshot.wimi_risk == 40
