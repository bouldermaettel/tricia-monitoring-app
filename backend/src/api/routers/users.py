from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.api.dependencies import get_db, require_admin
from src.api.schemas.users import UserCreateRequest, UserListResponse, UserRecord, UserUpdateRequest
from src.models.user import User
from src.services.user_service import UserService

router = APIRouter()


@router.get("", response_model=UserListResponse)
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> UserListResponse:
    users = UserService(db).list_users()
    return UserListResponse(
        items=[
            UserRecord(
                id=user.id,
                external_key=user.external_key,
                acronym=user.shortcut or "",
                display_name=user.display_name,
                role=user.role,
                is_active=user.is_active,
            )
            for user in users
        ]
    )


@router.post("", response_model=UserRecord, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> UserRecord:
    try:
        user = UserService(db).create_user(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return UserRecord(
        id=user.id,
        external_key=user.external_key,
        acronym=user.shortcut or "",
        display_name=user.display_name,
        role=user.role,
        is_active=user.is_active,
    )


@router.patch('/{user_id}', response_model=UserRecord)
def update_user(
    user_id: str,
    payload: UserUpdateRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(require_admin),
) -> UserRecord:
    if actor.id == user_id:
        requested_role = payload.role.lower().strip() if payload.role is not None else None
        if requested_role is not None and requested_role != 'admin':
            raise HTTPException(status_code=400, detail='Cannot change your own role from admin')
        if payload.is_active is False:
            raise HTTPException(status_code=400, detail='Cannot deactivate your own account')

    service = UserService(db)
    try:
        user = service.update_user(user_id, payload)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return UserRecord(
        id=user.id,
        external_key=user.external_key,
        acronym=user.shortcut or "",
        display_name=user.display_name,
        role=user.role,
        is_active=user.is_active,
    )


@router.delete('/{user_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_admin),
) -> None:
    if actor.id == user_id:
        raise HTTPException(status_code=400, detail='Cannot delete currently authenticated admin user')

    try:
        deleted = UserService(db).delete_user(user_id)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    if not deleted:
        raise HTTPException(status_code=404, detail='User not found')
