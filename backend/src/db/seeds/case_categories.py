from sqlalchemy.orm import Session

from src.models.case import CaseCategory

DEFAULT_CATEGORIES = [
    {"code": "no_issue", "label": "No Issue", "description": "No follow-up needed"},
    {"code": "monitor", "label": "Monitor", "description": "Monitor over time"},
    {"code": "problem", "label": "Problem", "description": "Requires intervention"},
]


def seed_case_categories(db: Session) -> None:
    for item in DEFAULT_CATEGORIES:
        exists = db.get(CaseCategory, item["code"])
        if not exists:
            db.add(CaseCategory(**item, is_active=True))
    db.commit()
