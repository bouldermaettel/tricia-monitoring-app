from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.engine import make_url

from src.api import api_router
from src.api.errors import register_exception_handlers
from src.api.middleware.request_context import RequestContextMiddleware
from src.core.config import get_settings
from src.core.logging import configure_logging
from src.db.base import Base
import src.models  # noqa: F401
from src.db.session import SessionLocal, engine
from src.services.user_service import UserService


def _uses_sqlite(database_url: str) -> bool:
    return make_url(database_url).drivername == "sqlite"


def _ensure_schema() -> None:
    """Keep local SQLite convenient; production schema changes should use Alembic."""
    settings = get_settings()
    if _uses_sqlite(settings.database_url):
        Base.metadata.create_all(bind=engine)


def _ensure_bootstrap_admin() -> None:
    settings = get_settings()
    db = SessionLocal()
    try:
        UserService(db).ensure_bootstrap_admin(
            username=settings.bootstrap_admin_username,
            password=settings.bootstrap_admin_password,
            display_name=settings.bootstrap_admin_display_name,
        )
    except SQLAlchemyError:
        # Migrations may not be applied yet during early startup.
        pass
    finally:
        db.close()


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging()
    _ensure_schema()
    _ensure_bootstrap_admin()

    app = FastAPI(title="Monitoring Tool API", version="0.1.0")
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router)
    register_exception_handlers(app)
    return app


app = create_app()
