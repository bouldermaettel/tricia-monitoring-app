from fastapi import Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from src.core.token import decode_access_token
from src.db.session import get_db_session
from src.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


def get_db(db: Session = Depends(get_db_session)) -> Session:
    return db


def get_actor_id(
    x_actor_id: str | None = Header(default=None),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str:
    if x_actor_id:
        return x_actor_id

    if credentials is not None:
        try:
            payload = decode_access_token(credentials.credentials)
        except InvalidTokenError:
            payload = {}
        subject = str(payload.get("sub", "")).strip()
        if subject:
            return subject

    return "system"


def get_actor_role(x_actor_role: str | None = Header(default=None)) -> str:
    return (x_actor_role or "operator").lower()


def get_current_actor(db: Session = Depends(get_db), x_actor_id: str | None = Header(default=None)) -> User:
    if x_actor_id:
        actor = db.scalar(select(User).where(or_(User.id == x_actor_id, User.external_key == x_actor_id)))
        if actor is not None and actor.is_active:
            return actor

    raise HTTPException(status_code=401, detail="Missing actor identity")


def get_current_actor_from_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing authentication token")

    token = credentials.credentials
    try:
        payload = decode_access_token(token)
    except InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Invalid authentication token") from exc

    subject = str(payload.get("sub", "")).strip()
    if not subject:
        raise HTTPException(status_code=401, detail="Invalid authentication token")

    actor = db.scalar(select(User).where(User.id == subject))
    if actor is None or not actor.is_active:
        raise HTTPException(status_code=401, detail="Invalid or inactive actor")
    return actor


def require_admin(actor: User = Depends(get_current_actor_from_token)) -> User:
    if actor.role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return actor
