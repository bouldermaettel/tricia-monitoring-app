from sqlalchemy import select

from src.models.case import Case
from src.models.classification_snapshot import ClassificationSnapshot


def test_validate_then_save_then_list(client):
    payload = {
        'vk_number': 'VK-20260423-101',
        'device_name': 'dev-flow',
        'tricia_s': 1,
        'tricia_p': 1,
        'tricia_d': 5,
        'user_s': 1,
        'user_d': 5,
    }
    validate = client.post('/api/v1/cases/validate', json=payload)
    assert validate.status_code == 200

    create = client.post('/api/v1/cases', json={**payload, 'validation_status': 'saved'})
    assert create.status_code == 201

    listing = client.get('/api/v1/cases')
    assert listing.status_code == 200
    assert listing.json()['total'] >= 1


def test_list_cases_accepts_matrix_table_filters(client):
    create = client.post(
        '/api/v1/cases',
        json={
            'vk_number': 'VK-TABLE-FILTER-001',
            'device_name': 'table-filter-device',
            'tricia_s': 1,
            'tricia_p': 5,
            'tricia_d': 5,
            'user_s': 3,
            'user_p': 5,
            'user_d': 10,
            'validation_status': 'saved',
        },
    )
    assert create.status_code == 201

    listing = client.get(
        '/api/v1/cases',
        params={
            'vk_number_contains': 'TABLE-FILTER',
            'user_p': 5,
            'tri_risk': 25,
            'wimi_risk': 150,
        },
    )

    assert listing.status_code == 200
    assert listing.json()['total'] == 1


def test_list_cases_all_results_ignores_page_size(client):
    for index in range(3):
        create = client.post(
            '/api/v1/cases',
            json={
                'vk_number': f'VK-ALL-20260423-{index + 1:03d}',
                'device_name': f'flow-device-{index + 1}',
                'tricia_s': 1,
                'tricia_p': 1,
                'tricia_d': 5,
                'user_s': 1,
                'user_d': 5,
                'validation_status': 'saved',
            },
        )
        assert create.status_code == 201

    listing = client.get(
        '/api/v1/cases',
        params={
            'vk_number_contains': 'VK-ALL-20260423-',
            'page_size': 1,
            'all': 'true',
        },
    )

    assert listing.status_code == 200
    body = listing.json()
    assert body['total'] == 3
    assert body['page'] == 1
    assert body['page_size'] == 3
    assert len(body['items']) == 3


def test_list_cases_counts_latest_snapshot_once(client, db_session):
    create = client.post(
        '/api/v1/cases',
        json={
            'vk_number': 'VK-LATEST-20260423-001',
            'device_name': 'latest-snapshot-device',
            'tricia_s': 1,
            'tricia_p': 5,
            'tricia_d': 5,
            'user_s': 8,
            'user_d': 10,
            'validation_status': 'saved',
        },
    )
    assert create.status_code == 201

    case = db_session.scalar(select(Case).where(Case.vk_number == 'VK-LATEST-20260423-001'))
    assert case is not None

    db_session.add(
        ClassificationSnapshot(
            case_id=case.id,
            tricia_s=1,
            tricia_p=5,
            tricia_d=1,
            user_s=1,
            user_d=1,
            deviation_s=0,
            deviation_d=0,
            problem_flag=False,
        )
    )
    db_session.commit()

    listing = client.get(
        '/api/v1/cases',
        params={
            'vk_number': 'VK-LATEST-20260423-001',
        },
    )

    assert listing.status_code == 200
    body = listing.json()
    assert body['total'] == 1
    assert len(body['items']) == 1
    assert body['items'][0]['tricia_d'] == 1
    assert body['items'][0]['user_s'] == 1

    problematic = client.get(
        '/api/v1/cases',
        params={
            'vk_number': 'VK-LATEST-20260423-001',
            'problematic_only': 'true',
        },
    )

    assert problematic.status_code == 200
    problematic_body = problematic.json()
    assert problematic_body['total'] == 0
    assert problematic_body['items'] == []


def test_list_cases_supports_server_side_sorting_with_pagination(client):
    for vk_number in ['VK-SORT-003', 'VK-SORT-001', 'VK-SORT-002']:
        create = client.post(
            '/api/v1/cases',
            json={
                'vk_number': vk_number,
                'device_name': f'device-{vk_number}',
                'tricia_s': 1,
                'tricia_p': 5,
                'tricia_d': 5,
                'user_s': 1,
                'user_d': 5,
                'validation_status': 'saved',
            },
        )
        assert create.status_code == 201

    first_page = client.get(
        '/api/v1/cases',
        params={
            'vk_number_contains': 'VK-SORT-',
            'sort_by': 'vk_number',
            'sort_dir': 'asc',
            'page': 1,
            'page_size': 1,
        },
    )
    assert first_page.status_code == 200
    first_payload = first_page.json()
    assert first_payload['items'][0]['vk_number'] == 'VK-SORT-001'

    second_page = client.get(
        '/api/v1/cases',
        params={
            'vk_number_contains': 'VK-SORT-',
            'sort_by': 'vk_number',
            'sort_dir': 'asc',
            'page': 2,
            'page_size': 1,
        },
    )
    assert second_page.status_code == 200
    second_payload = second_page.json()
    assert second_payload['items'][0]['vk_number'] == 'VK-SORT-002'

    descending = client.get(
        '/api/v1/cases',
        params={
            'vk_number_contains': 'VK-SORT-',
            'sort_by': 'vk_number',
            'sort_dir': 'desc',
            'page': 1,
            'page_size': 1,
        },
    )
    assert descending.status_code == 200
    descending_payload = descending.json()
    assert descending_payload['items'][0]['vk_number'] == 'VK-SORT-003'
