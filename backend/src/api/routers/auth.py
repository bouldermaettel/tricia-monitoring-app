from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from jwt import InvalidTokenError

from src.api.dependencies import get_current_actor_from_token, get_db
from src.api.schemas.auth import AuthPasswordChangeRequest, AuthRefreshRequest, AuthSessionRequest, AuthSessionResponse
from src.core.token import create_access_token, create_refresh_token, decode_refresh_token
from src.models.user import User
from src.services.user_service import UserService

router = APIRouter()


@router.post('/session', response_model=AuthSessionResponse)
def create_session(payload: AuthSessionRequest, db: Session = Depends(get_db)) -> AuthSessionResponse:
    user = UserService(db).authenticate(payload.username, payload.password)

    if user is None:
        raise HTTPException(status_code=401, detail='Invalid credentials')

    access_token, expires_in = create_access_token(user.id, user.role)
    refresh_token, refresh_expires_in = create_refresh_token(user.id, user.role)

    return AuthSessionResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
        refresh_expires_in=refresh_expires_in,
        actor_id=user.id,
        external_key=user.external_key,
        acronym=user.shortcut or "",
        display_name=user.display_name,
        role=user.role,
        must_change_password=user.must_change_password,
        is_active=user.is_active,
    )


@router.post('/refresh', response_model=AuthSessionResponse)
def refresh_session(payload: AuthRefreshRequest, db: Session = Depends(get_db)) -> AuthSessionResponse:
    try:
        token_payload = decode_refresh_token(payload.refresh_token)
    except InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail='Invalid refresh token') from exc

    subject = str(token_payload.get('sub', '')).strip()
    if not subject:
        raise HTTPException(status_code=401, detail='Invalid refresh token')

    user = UserService(db).get_by_actor_key(subject)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail='Invalid refresh token')

    access_token, expires_in = create_access_token(user.id, user.role)
    refresh_token, refresh_expires_in = create_refresh_token(user.id, user.role)

    return AuthSessionResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
        refresh_expires_in=refresh_expires_in,
        actor_id=user.id,
        external_key=user.external_key,
        acronym=user.shortcut or "",
        display_name=user.display_name,
        role=user.role,
        must_change_password=user.must_change_password,
        is_active=user.is_active,
    )


@router.post('/change-password', response_model=AuthSessionResponse)
def change_password(
    payload: AuthPasswordChangeRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_actor_from_token),
) -> AuthSessionResponse:
    service = UserService(db)
    try:
        user = service.change_password(actor, payload.current_password, payload.new_password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    access_token, expires_in = create_access_token(user.id, user.role)
    refresh_token, refresh_expires_in = create_refresh_token(user.id, user.role)
    return AuthSessionResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
        refresh_expires_in=refresh_expires_in,
        actor_id=user.id,
        external_key=user.external_key,
        acronym=user.shortcut or "",
        display_name=user.display_name,
        role=user.role,
        must_change_password=user.must_change_password,
        is_active=user.is_active,
    )
