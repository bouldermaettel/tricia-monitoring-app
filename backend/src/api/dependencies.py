from fastapi import Depends, Header
from sqlalchemy.orm import Session

from src.db.session import get_db_session


def get_db(db: Session = Depends(get_db_session)) -> Session:
    return db


def get_actor_id(x_actor_id: str | None = Header(default=None)) -> str:
    return x_actor_id or "system"
