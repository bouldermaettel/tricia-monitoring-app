import logging
import os
import time
import json

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.engine import make_url
from sqlalchemy import inspect, text

from src.api import api_router
from src.api.errors import register_exception_handlers
from src.api.middleware.request_context import RequestContextMiddleware
from src.core.config import get_settings
from src.core.logging import configure_logging
from src.db.base import Base
import src.models  # noqa: F401
from src.db.session import SessionLocal, engine
from src.db.seeds.case_categories import seed_case_categories
from src.services.user_service import UserService


logger = logging.getLogger(__name__)


def _uses_sqlite(database_url: str) -> bool:
    return make_url(database_url).drivername == "sqlite"


def _ensure_schema() -> None:
    """Ensure baseline tables exist when Alembic runtime isn't available."""
    Base.metadata.create_all(bind=engine)


def _ensure_risk_schema() -> None:
    """Keep the risk columns available when a legacy backfill predates Alembic."""
    settings = get_settings()
    if not make_url(settings.database_url).drivername.startswith("postgresql"):
        return

    with engine.begin() as connection:
        inspector = inspect(connection)
        if "classification_snapshots" not in inspector.get_table_names():
            return
        columns = {column["name"] for column in inspector.get_columns("classification_snapshots")}
        if "user_p" not in columns and "wimi_p" in columns:
            connection.execute(text("ALTER TABLE classification_snapshots RENAME COLUMN wimi_p TO user_p"))
            columns.remove("wimi_p")
            columns.add("user_p")
        if "user_p" not in columns:
            connection.execute(text("ALTER TABLE classification_snapshots ADD COLUMN user_p INTEGER"))
        if "tri_risk" not in columns:
            connection.execute(text("ALTER TABLE classification_snapshots ADD COLUMN tri_risk INTEGER"))
        if "wimi_risk" not in columns:
            connection.execute(text("ALTER TABLE classification_snapshots ADD COLUMN wimi_risk INTEGER"))
        connection.execute(
            text(
                "UPDATE classification_snapshots SET user_p = tricia_p "
                "WHERE user_p IS NULL AND tricia_p IS NOT NULL"
            )
        )
        connection.execute(
            text(
                "UPDATE classification_snapshots SET tri_risk = tricia_s * tricia_p * tricia_d "
                "WHERE tricia_s IS NOT NULL AND tricia_p IS NOT NULL AND tricia_d IS NOT NULL"
            )
        )
        connection.execute(
            text(
                "UPDATE classification_snapshots SET wimi_risk = user_s * user_p * user_d "
                "WHERE user_s IS NOT NULL AND user_p IS NOT NULL AND user_d IS NOT NULL"
            )
        )


def _initialize_database() -> None:
    """Initialize DB objects with retries to tolerate transient Postgres cold starts."""
    settings = get_settings()
    max_attempts = 1 if _uses_sqlite(settings.database_url) else int(os.getenv("DB_INIT_MAX_ATTEMPTS", "30"))
    retry_delay_seconds = int(os.getenv("DB_INIT_RETRY_DELAY_SECONDS", "2"))

    for attempt in range(1, max_attempts + 1):
        try:
            _ensure_schema()
            _ensure_risk_schema()
            _ensure_threshold_config_schema()
            _ensure_user_policy_schema()
            _ensure_postgres_sequences()
            _ensure_bootstrap_admin()
            _ensure_reference_data()
            return
        except SQLAlchemyError as exc:
            if attempt == max_attempts:
                logger.exception(
                    "Database initialization failed after %s attempts; app will start without verified DB readiness",
                    max_attempts,
                )
                return

            logger.warning(
                "Database initialization attempt %s/%s failed (%s). Retrying in %ss",
                attempt,
                max_attempts,
                exc.__class__.__name__,
                retry_delay_seconds,
            )
            time.sleep(retry_delay_seconds)


def _ensure_postgres_sequences() -> None:
    """Realign PostgreSQL identity/serial sequences with table data.

    Some imported datasets can leave sequences behind max(id), causing
    intermittent duplicate key violations on inserts.
    """
    settings = get_settings()
    if not make_url(settings.database_url).drivername.startswith("postgresql"):
        return

    sequence_targets = [
        ("case_reviews", "id"),
        ("case_comments", "id"),
        ("case_audit_events", "id"),
    ]

    try:
        with engine.begin() as connection:
            inspector = inspect(connection)
            tables = set(inspector.get_table_names())

            for table_name, column_name in sequence_targets:
                if table_name not in tables:
                    continue

                connection.execute(
                    text(
                        "SELECT setval(" 
                        "pg_get_serial_sequence(:table_name, :column_name), "
                        "COALESCE((SELECT MAX(id) FROM " + table_name + "), 0) + 1, "
                        "false)"
                    ),
                    {"table_name": table_name, "column_name": column_name},
                )
    except SQLAlchemyError:
        # Sequence healing is best-effort; keep app startup resilient.
        return


def _ensure_threshold_config_schema() -> None:
    """Apply compatibility migration for risk category boundaries in threshold settings."""
    settings = get_settings()
    dialect = make_url(settings.database_url).drivername

    default_categories = json.dumps(
        [
            {"label": "Class 1", "min_value": 0, "max_value": 10},
            {"label": "Class 2", "min_value": 11, "max_value": 250},
            {"label": "Class 3", "min_value": 251, "max_value": 500},
            {"label": "Class 4", "min_value": 501, "max_value": 1000},
        ]
    )
    default_problematic_case_thresholds = json.dumps({"3M": 10, "6M": 20, "12M": 40})

    try:
        with engine.begin() as connection:
            inspector = inspect(connection)
            if "threshold_configs" not in inspector.get_table_names():
                return

            columns = {column["name"] for column in inspector.get_columns("threshold_configs")}
            needs_risk_categories = "risk_categories" not in columns
            needs_problematic_case_thresholds = "problematic_case_thresholds" not in columns

            if not needs_risk_categories and not needs_problematic_case_thresholds:
                return

            if dialect.startswith("postgresql"):
                if needs_risk_categories:
                    connection.execute(
                        text(
                            "ALTER TABLE threshold_configs "
                            "ADD COLUMN IF NOT EXISTS risk_categories JSON NOT NULL "
                            f"DEFAULT '{default_categories}'::json"
                        )
                    )
                if needs_problematic_case_thresholds:
                    connection.execute(
                        text(
                            "ALTER TABLE threshold_configs "
                            "ADD COLUMN IF NOT EXISTS problematic_case_thresholds JSON NOT NULL "
                            f"DEFAULT '{default_problematic_case_thresholds}'::json"
                        )
                    )
            else:
                if needs_risk_categories:
                    connection.execute(
                        text(
                            "ALTER TABLE threshold_configs "
                            "ADD COLUMN risk_categories TEXT NOT NULL "
                            f"DEFAULT '{default_categories}'"
                        )
                    )
                if needs_problematic_case_thresholds:
                    connection.execute(
                        text(
                            "ALTER TABLE threshold_configs "
                            "ADD COLUMN problematic_case_thresholds TEXT NOT NULL "
                            f"DEFAULT '{default_problematic_case_thresholds}'"
                        )
                    )
    except SQLAlchemyError:
        # If the database is temporarily unavailable during cold start, continue boot.
        return


def _ensure_user_policy_schema() -> None:
    """Apply minimal compatibility migration for user role policy changes."""
    settings = get_settings()
    dialect = make_url(settings.database_url).drivername

    try:
        with engine.begin() as connection:
            inspector = inspect(connection)
            if "users" not in inspector.get_table_names():
                return

            user_columns = {column["name"] for column in inspector.get_columns("users")}

            if "must_change_password" not in user_columns:
                if dialect.startswith("postgresql"):
                    connection.execute(
                        text(
                            "ALTER TABLE users "
                            "ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE"
                        )
                    )
                else:
                    connection.execute(
                        text("ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT 0")
                    )

            connection.execute(
                text(
                    "UPDATE users SET role = 'user' "
                    "WHERE role IS NULL OR LOWER(role) NOT IN ('admin', 'user')"
                )
            )
    except SQLAlchemyError:
        # If the database is temporarily unavailable during cold start, continue boot.
        return


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


def _ensure_reference_data() -> None:
    db = SessionLocal()
    try:
        seed_case_categories(db)
    except SQLAlchemyError:
        pass
    finally:
        db.close()


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging()
    _initialize_database()

    app = FastAPI(title="Monitoring Tool API", version="1.0.0")
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
