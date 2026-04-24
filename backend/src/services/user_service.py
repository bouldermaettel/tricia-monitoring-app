from uuid import uuid4

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.api.schemas.users import UserCreateRequest, UserUpdateRequest
from src.core.security import hash_password, verify_password
from src.models.user import User

ALLOWED_ROLES = {"operator", "analyst", "controller", "admin"}


def _build_default_shortcut(external_key: str) -> str:
    candidate = external_key.strip()
    if "@" in candidate:
        candidate = candidate.split("@", 1)[0]
    normalized = "".join(ch for ch in candidate if ch.isalnum() or ch in {"_", "-"})
    return (normalized or "user")[:32]


class UserService:
    def __init__(self, db: Session):
        self.db = db

    def list_users(self) -> list[User]:
        return list(self.db.scalars(select(User).order_by(User.display_name.asc())))

    def authenticate(self, username: str, password: str) -> User | None:
        user = self.db.scalar(
            select(User).where(
                User.external_key == username.strip(),
                User.is_active.is_(True),
            )
        )
        if user is None or not user.password_hash:
            return None
        if not verify_password(password, user.password_hash):
            return None
        return user

    def get_by_actor_key(self, actor_key: str) -> User | None:
        return self.db.scalar(select(User).where(or_(User.id == actor_key, User.external_key == actor_key)))

    def create_user(self, payload: UserCreateRequest) -> User:
        role = payload.role.lower().strip()
        if role not in ALLOWED_ROLES:
            raise ValueError(f"Invalid role '{payload.role}'. Allowed roles: {', '.join(sorted(ALLOWED_ROLES))}")

        user = User(
            id=str(uuid4()),
            external_key=payload.external_key.strip(),
            shortcut=payload.acronym.strip()[:32],
            password_hash=hash_password(payload.password),
            display_name=payload.display_name.strip(),
            role=role,
            is_active=payload.is_active,
        )
        self.db.add(user)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise ValueError("external_key already exists") from exc
        self.db.refresh(user)
        return user

    def update_user(self, user_id: str, payload: UserUpdateRequest) -> User:
        user = self.db.scalar(select(User).where(User.id == user_id))
        if user is None:
            raise LookupError("User not found")

        if payload.display_name is not None:
            user.display_name = payload.display_name.strip()

        if payload.acronym is not None:
            user.shortcut = payload.acronym.strip()[:32]

        if payload.password is not None:
            user.password_hash = hash_password(payload.password)

        if payload.role is not None:
            role = payload.role.lower().strip()
            if role not in ALLOWED_ROLES:
                raise ValueError(f"Invalid role '{payload.role}'. Allowed roles: {', '.join(sorted(ALLOWED_ROLES))}")
            user.role = role

        if payload.is_active is not None:
            user.is_active = payload.is_active

        self.db.commit()
        self.db.refresh(user)
        return user

    def delete_user(self, user_id: str) -> bool:
        user = self.db.scalar(select(User).where(User.id == user_id))
        if user is None:
            return False
        self.db.delete(user)
        self.db.commit()
        return True

    def ensure_bootstrap_admin(self, username: str, password: str, display_name: str) -> None:
        if not username or not password:
            return

        existing = self.db.scalar(select(User).where(User.external_key == username.strip()))
        if existing is None:
            self.db.add(
                User(
                    id=str(uuid4()),
                    external_key=username.strip(),
                    shortcut=_build_default_shortcut(username),
                    password_hash=hash_password(password),
                    display_name=display_name.strip() or "System Admin",
                    role="admin",
                    is_active=True,
                )
            )
            self.db.commit()
            return

        changed = False
        if existing.role != "admin":
            existing.role = "admin"
            changed = True
        if not existing.is_active:
            existing.is_active = True
            changed = True
        if not verify_password(password, existing.password_hash or ""):
            existing.password_hash = hash_password(password)
            changed = True
        if display_name and existing.display_name != display_name:
            existing.display_name = display_name
            changed = True
        if not existing.shortcut:
            existing.shortcut = _build_default_shortcut(existing.external_key)
            changed = True

        if changed:
            self.db.commit()
