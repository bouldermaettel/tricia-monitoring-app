#!/usr/bin/env python3
"""Backfill WIMI-P and TRI/WIMI risk products in PostgreSQL.

The target database is selected with DATABASE_URL.  The default is the local
development database used by ``dev-postgres.sh``; production runs should pass
the production DATABASE_URL explicitly in the environment.
"""

from __future__ import annotations

import argparse
import os
from dataclasses import dataclass

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import URL, make_url


DEFAULT_DATABASE_URL = "postgresql+psycopg://monitoring:monitoring@127.0.0.1:5432/monitoring"
TABLE_NAME = "classification_snapshots"
REQUIRED_SOURCE_COLUMNS = (
    "tricia_s",
    "tricia_p",
    "tricia_d",
    "user_s",
    "user_d",
)
BACKFILL_COLUMNS = {
    "wimi_p": "INTEGER",
    "tri_risk": "INTEGER",
    "wimi_risk": "INTEGER",
}


@dataclass(frozen=True)
class BackfillSummary:
    total_rows: int
    wimi_p_rows: int
    tri_risk_rows: int
    wimi_risk_rows: int
    incomplete_wimi_p_rows: int
    incomplete_tri_risk_rows: int
    incomplete_wimi_risk_rows: int


def _database_url(raw_url: str | None) -> str:
    return raw_url or os.environ.get("DATABASE_URL") or DEFAULT_DATABASE_URL


def _safe_database_target(database_url: str) -> str:
    parsed: URL = make_url(database_url)
    if parsed.password is not None:
        parsed = parsed.set(password="***")
    return str(parsed)


def _validate_postgresql(database_url: str) -> None:
    dialect = make_url(database_url).get_backend_name()
    if dialect != "postgresql":
        raise RuntimeError(
            f"Unsupported database dialect '{dialect}'. "
            "This backfill is intentionally limited to PostgreSQL."
        )


def _validate_source_schema(connection) -> None:
    columns = {column["name"] for column in inspect(connection).get_columns(TABLE_NAME)}
    missing = [column for column in REQUIRED_SOURCE_COLUMNS if column not in columns]
    if missing:
        raise RuntimeError(
            f"Table '{TABLE_NAME}' is missing required source columns: {', '.join(missing)}"
        )


def _ensure_columns(connection) -> None:
    columns = {column["name"] for column in inspect(connection).get_columns(TABLE_NAME)}
    for column_name, column_type in BACKFILL_COLUMNS.items():
        if column_name not in columns:
            connection.execute(
                text(f'ALTER TABLE "{TABLE_NAME}" ADD COLUMN "{column_name}" {column_type}')
            )


def _count(connection, condition: str) -> int:
    return int(
        connection.execute(
            text(f'SELECT COUNT(*) FROM "{TABLE_NAME}" WHERE {condition}')
        ).scalar_one()
    )


def _backfill(connection) -> BackfillSummary:
    connection.execute(
        text(
            f'UPDATE "{TABLE_NAME}" '
            'SET "wimi_p" = "tricia_p", "tri_risk" = NULL, "wimi_risk" = NULL'
        )
    )
    connection.execute(
        text(
            f'UPDATE "{TABLE_NAME}" '
            'SET "tri_risk" = "tricia_s" * "tricia_p" * "tricia_d" '
            'WHERE "tricia_s" IS NOT NULL '
            'AND "tricia_p" IS NOT NULL '
            'AND "tricia_d" IS NOT NULL'
        )
    )
    connection.execute(
        text(
            f'UPDATE "{TABLE_NAME}" '
            'SET "wimi_risk" = "user_s" * "wimi_p" * "user_d" '
            'WHERE "user_s" IS NOT NULL '
            'AND "wimi_p" IS NOT NULL '
            'AND "user_d" IS NOT NULL'
        )
    )

    total_rows = _count(connection, "TRUE")
    incomplete_wimi_p_rows = _count(connection, '"tricia_p" IS NULL')
    incomplete_tri_risk_rows = _count(
        connection,
        '"tricia_s" IS NULL OR "tricia_p" IS NULL OR "tricia_d" IS NULL',
    )
    incomplete_wimi_risk_rows = _count(
        connection,
        '"user_s" IS NULL OR "wimi_p" IS NULL OR "user_d" IS NULL',
    )

    mismatch_wimi_p = _count(
        connection,
        '"tricia_p" IS NOT NULL AND ("wimi_p" IS NULL OR "wimi_p" <> "tricia_p")',
    )
    mismatch_tri_risk = _count(
        connection,
        '"tricia_s" IS NOT NULL AND "tricia_p" IS NOT NULL '
        'AND "tricia_d" IS NOT NULL '
        'AND ("tri_risk" IS NULL OR "tri_risk" <> "tricia_s" * "tricia_p" * "tricia_d")',
    )
    mismatch_wimi_risk = _count(
        connection,
        '"user_s" IS NOT NULL AND "wimi_p" IS NOT NULL AND "user_d" IS NOT NULL '
        'AND ("wimi_risk" IS NULL OR "wimi_risk" <> "user_s" * "wimi_p" * "user_d")',
    )
    if mismatch_wimi_p or mismatch_tri_risk or mismatch_wimi_risk:
        raise RuntimeError(
            "Backfill validation failed: "
            f"wimi_p={mismatch_wimi_p}, tri_risk={mismatch_tri_risk}, "
            f"wimi_risk={mismatch_wimi_risk} mismatches"
        )

    return BackfillSummary(
        total_rows=total_rows,
        wimi_p_rows=total_rows - incomplete_wimi_p_rows,
        tri_risk_rows=total_rows - incomplete_tri_risk_rows,
        wimi_risk_rows=total_rows - incomplete_wimi_risk_rows,
        incomplete_wimi_p_rows=incomplete_wimi_p_rows,
        incomplete_tri_risk_rows=incomplete_tri_risk_rows,
        incomplete_wimi_risk_rows=incomplete_wimi_risk_rows,
    )


def run(database_url: str) -> BackfillSummary:
    """Run the schema extension and backfill in one transaction."""
    _validate_postgresql(database_url)
    engine = create_engine(database_url, future=True)
    try:
        with engine.begin() as connection:
            if TABLE_NAME not in inspect(connection).get_table_names():
                raise RuntimeError(f"Required table '{TABLE_NAME}' does not exist")
            _validate_source_schema(connection)
            _ensure_columns(connection)
            return _backfill(connection)
    finally:
        engine.dispose()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--database-url",
        default=None,
        help="Database URL; defaults to DATABASE_URL or the local DEV PostgreSQL URL.",
    )
    args = parser.parse_args()
    database_url = _database_url(args.database_url)
    print(f"Database: {_safe_database_target(database_url)}")
    summary = run(database_url)
    print(f"Rows scanned: {summary.total_rows}")
    print(f"WIMI-P populated: {summary.wimi_p_rows}")
    print(f"TRI-RISK populated: {summary.tri_risk_rows}")
    print(f"WIMI-RISK populated: {summary.wimi_risk_rows}")
    print(
        "Incomplete rows (reported, left NULL): "
        f"WIMI-P={summary.incomplete_wimi_p_rows}, "
        f"TRI-RISK={summary.incomplete_tri_risk_rows}, "
        f"WIMI-RISK={summary.incomplete_wimi_risk_rows}"
    )
    print("Validation: passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
