from datetime import datetime, timedelta, timezone

import jwt

from src.core.config import get_settings

_ACCESS_TOKEN_TTL_MINUTES = 15
_REFRESH_TOKEN_TTL_DAYS = 7


def create_access_token(user_id: str, role: str) -> tuple[str, int]:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=_ACCESS_TOKEN_TTL_MINUTES)
    payload = {
        "typ": "access",
        "sub": user_id,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp()),
    }
    token = jwt.encode(payload, settings.secret_key, algorithm="HS256")
    return token, _ACCESS_TOKEN_TTL_MINUTES * 60


def create_refresh_token(user_id: str, role: str) -> tuple[str, int]:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=_REFRESH_TOKEN_TTL_DAYS)
    payload = {
        "typ": "refresh",
        "sub": user_id,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp()),
    }
    token = jwt.encode(payload, settings.secret_key, algorithm="HS256")
    return token, _REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60


def decode_access_token(token: str) -> dict:
    settings = get_settings()
    payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    if payload.get("typ") != "access":
        raise jwt.InvalidTokenError("Invalid token type")
    return payload


def decode_refresh_token(token: str) -> dict:
    settings = get_settings()
    payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    if payload.get("typ") != "refresh":
        raise jwt.InvalidTokenError("Invalid token type")
    return payload
