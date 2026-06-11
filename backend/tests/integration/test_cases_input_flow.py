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
