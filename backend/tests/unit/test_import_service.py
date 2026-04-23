from src.services.import_service import ImportService


def test_import_service_counts_rows(db_session):
    csv_payload = b'vk_number,device_name\nVK-1,dev-1\nVK-2,dev-2\n'
    job = ImportService(db_session).process_file('sample.csv', csv_payload, 'tester')
    assert job.total_rows == 2
    assert job.imported_rows == 2
