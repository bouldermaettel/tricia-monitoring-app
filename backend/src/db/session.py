from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

from src.core.config import get_settings

settings = get_settings()


def _validate_database_url(raw_url: str) -> None:
    url = make_url(raw_url)
    if url.drivername == "sqlite" and not settings.allow_sqlite:
        raise RuntimeError(
            "SQLite is disabled for this application runtime. "
            "Start local Postgres with ./dev-postgres.sh up and run the backend with ./dev-postgres.sh backend."
        )


def _prepare_database_url(raw_url: str) -> str:
    """Normalize SQLite file paths and ensure parent directory exists."""
    url = make_url(raw_url)
    if url.drivername != "sqlite" or not url.database:
        return raw_url

    db_path = Path(url.database)
    if not db_path.is_absolute():
        project_root = Path(__file__).resolve().parents[3]
        db_path = (project_root / db_path).resolve()

    db_path.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{db_path}"


_validate_database_url(settings.database_url)
database_url = _prepare_database_url(settings.database_url)
connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
engine = create_engine(database_url, future=True, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, class_=Session)


def get_db_session() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
