#!/usr/bin/env python3
"""Clone one PostgreSQL monitoring database into another.

The command is deliberately dry-run by default. Applying the clone requires
``--apply`` and creates a ``pg_dump`` backup of the target first.

Examples::

    SOURCE_DATABASE_URL='...' TARGET_DATABASE_URL='...' \
    python scripts/clone_prod_to_dev.py

    SOURCE_DATABASE_URL='...' TARGET_DATABASE_URL='...' \
    python scripts/clone_prod_to_dev.py --apply
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from psycopg.types.json import Json, Jsonb
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Connection, Engine, make_url


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))


EXCLUDED_TABLES = {"alembic_version"}
DERIVED_COMPATIBILITY_COLUMNS = {
    "classification_snapshots": {
        "user_p": '"tricia_p"',
        "tri_risk": '"tricia_s" * "tricia_p" * "tricia_d"',
        "wimi_risk": '"user_s" * "user_p" * "user_d"',
    }
}


def quote_identifier(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def database_url(value: str | None, env_name: str) -> str:
    resolved = value or os.environ.get(env_name)
    if not resolved:
        raise SystemExit(f"Missing {env_name} or the corresponding command-line option")
    return resolved


def public_tables(connection: Connection) -> set[str]:
    rows = connection.execute(
        text(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
        )
    )
    return {row[0] for row in rows if row[0] not in EXCLUDED_TABLES}


def table_columns(connection: Connection, table: str) -> list[str]:
    rows = connection.execute(
        text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = :table "
            "ORDER BY ordinal_position"
        ),
        {"table": table},
    )
    return [row[0] for row in rows]


def table_dependencies(connection: Connection, tables: set[str]) -> dict[str, set[str]]:
    rows = connection.execute(
        text(
            "SELECT tc.table_name, ccu.table_name "
            "FROM information_schema.table_constraints AS tc "
            "JOIN information_schema.constraint_column_usage AS ccu "
            "  ON tc.constraint_name = ccu.constraint_name "
            " AND tc.constraint_schema = ccu.constraint_schema "
            "WHERE tc.constraint_type = 'FOREIGN KEY' "
            "  AND tc.table_schema = 'public'"
        )
    )
    dependencies: dict[str, set[str]] = defaultdict(set)
    for child, parent in rows:
        if child in tables and parent in tables and child != parent:
            dependencies[child].add(parent)
    return dependencies


def insertion_order(tables: set[str], dependencies: dict[str, set[str]]) -> list[str]:
    """Return a parent-before-child order, failing on FK cycles."""
    remaining = {table: set(dependencies.get(table, set())) for table in tables}
    result: list[str] = []
    ready = deque(sorted(table for table, parents in remaining.items() if not parents))
    while ready:
        table = ready.popleft()
        result.append(table)
        for child in sorted(remaining):
            if table in remaining[child]:
                remaining[child].remove(table)
                if not remaining[child]:
                    ready.append(child)
    if len(result) != len(tables):
        cycle = sorted(table for table, parents in remaining.items() if parents)
        raise RuntimeError(f"Foreign-key cycle prevents safe copy order: {', '.join(cycle)}")
    return result


def schema_revision(connection: Connection) -> str | None:
    if not connection.execute(
        text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name='alembic_version')"
        )
    ).scalar():
        return None
    return connection.execute(text("SELECT version_num FROM alembic_version")).scalar()


def row_count(connection: Connection, table: str) -> int:
    return int(connection.execute(text(f"SELECT count(*) FROM {quote_identifier(table)}")).scalar() or 0)


def snapshot_counts(connection: Connection, tables: set[str]) -> dict[str, int]:
    return {table: row_count(connection, table) for table in sorted(tables)}


def assert_compatible_columns(source: Connection, target: Connection, tables: set[str]) -> None:
    for table in sorted(tables):
        source_columns = table_columns(source, table)
        target_columns = table_columns(target, table)
        missing = [column for column in source_columns if column not in target_columns]
        if missing:
            raise RuntimeError(
                f"Target is missing source columns for {table}: {missing}"
            )
        extra = [column for column in target_columns if column not in source_columns]
        supported_extra = set(DERIVED_COMPATIBILITY_COLUMNS.get(table, {}))
        if unsupported := [column for column in extra if column not in supported_extra]:
            raise RuntimeError(
                f"Target has unsupported extra columns for {table}: {unsupported}"
            )


def foreign_key_violations(connection: Connection) -> list[str]:
    rows = connection.execute(
        text(
            "SELECT child.relname, parent.relname, "
            "array_agg(child_attr.attname ORDER BY keys.ordinality), "
            "array_agg(parent_attr.attname ORDER BY keys.ordinality) "
            "FROM pg_constraint AS constraint_row "
            "JOIN pg_class AS child ON child.oid = constraint_row.conrelid "
            "JOIN pg_class AS parent ON parent.oid = constraint_row.confrelid "
            "JOIN LATERAL unnest(constraint_row.conkey, constraint_row.confkey) "
            "WITH ORDINALITY AS keys(child_key, parent_key, ordinality) ON TRUE "
            "JOIN pg_attribute AS child_attr ON child_attr.attrelid = child.oid "
            " AND child_attr.attnum = keys.child_key "
            "JOIN pg_attribute AS parent_attr ON parent_attr.attrelid = parent.oid "
            " AND parent_attr.attnum = keys.parent_key "
            "WHERE constraint_row.contype = 'f' "
            "AND child.relnamespace = 'public'::regnamespace "
            "GROUP BY child.relname, parent.relname, constraint_row.oid"
        )
    )
    violations: list[str] = []
    for child, parent, child_columns, parent_columns in rows:
        join = " AND ".join(
            f"child.{quote_identifier(child_column)} = parent.{quote_identifier(parent_column)}"
            for child_column, parent_column in zip(child_columns, parent_columns)
        )
        non_null = " AND ".join(
            f"child.{quote_identifier(column)} IS NOT NULL" for column in child_columns
        )
        query = text(
            f"SELECT 1 FROM {quote_identifier(child)} AS child "
            f"WHERE ({non_null}) AND NOT EXISTS (SELECT 1 FROM {quote_identifier(parent)} AS parent WHERE {join}) LIMIT 1"
        )
        if connection.execute(query).first() is not None:
            violations.append(f"{child} -> {parent}")
    return violations


def backup_target(url: str, backup_dir: Path) -> Path:
    backup_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output = backup_dir / f"dev-before-prod-clone-{timestamp}.dump"
    parsed = make_url(url)
    password = parsed.password
    dump_url = parsed.set(drivername="postgresql", password=None).render_as_string(hide_password=False)
    environment = os.environ.copy()
    if password is not None:
        environment["PGPASSWORD"] = password
    subprocess.run(
        ["pg_dump", "--format=custom", "--no-owner", "--file", str(output), dump_url],
        check=True,
        env=environment,
    )
    return output


def reset_sequences(connection: Connection, tables: set[str]) -> None:
    rows = connection.execute(
        text(
            "SELECT table_name, column_name FROM information_schema.columns "
            "WHERE table_schema='public' AND column_default LIKE 'nextval(%'"
        )
    )
    for table, column in rows:
        if table not in tables:
            continue
        sequence = connection.execute(
            text("SELECT pg_get_serial_sequence(:table, :column)"),
            {"table": f"public.{table}", "column": column},
        ).scalar()
        if sequence:
            connection.execute(
                text(
                    "SELECT setval(CAST(:sequence AS regclass), "
                    "COALESCE((SELECT MAX(" + quote_identifier(column) + ") FROM "
                    + quote_identifier(table) + "), 1), "
                    "(SELECT COUNT(*) > 0 FROM " + quote_identifier(table) + "))"
                ),
                {"sequence": sequence},
            )


def json_column_types(connection: Connection, table: str) -> dict[str, str]:
    rows = connection.execute(
        text(
            "SELECT column_name, data_type FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name=:table "
            "AND data_type IN ('json', 'jsonb')"
        ),
        {"table": table},
    )
    return {row[0]: row[1] for row in rows}


def adapt_json_rows(
    rows: list[tuple[Any, ...]],
    columns: list[str],
    json_types: dict[str, str],
) -> list[tuple[Any, ...]]:
    adapted: list[tuple[Any, ...]] = []
    for row in rows:
        values = []
        for column, value in zip(columns, row):
            if value is not None and column in json_types:
                values.append(Jsonb(value) if json_types[column] == "jsonb" else Json(value))
            else:
                values.append(value)
        adapted.append(tuple(values))
    return adapted


def copy_tables(source: Connection, target: Connection, tables: set[str], order: list[str]) -> None:
    target.execute(
        text(
            "TRUNCATE TABLE "
            + ", ".join(quote_identifier(table) for table in sorted(tables))
            + " RESTART IDENTITY CASCADE"
        )
    )
    for table in order:
        columns = table_columns(source, table)
        if not columns:
            continue
        select_sql = f"SELECT {', '.join(quote_identifier(c) for c in columns)} FROM {quote_identifier(table)}"
        rows = [tuple(row) for row in source.exec_driver_sql(select_sql).fetchall()]
        if not rows:
            continue
        rows = adapt_json_rows(rows, columns, json_column_types(target, table))
        insert_sql = (
            f"INSERT INTO {quote_identifier(table)} "
            f"({', '.join(quote_identifier(c) for c in columns)}) "
            f"VALUES ({', '.join('%s' for _ in columns)})"
        )
        target.exec_driver_sql(insert_sql, rows)


def backfill_derived_compatibility_columns(
    connection: Connection,
    source_columns_by_table: dict[str, list[str]],
) -> None:
    """Populate columns introduced after the source schema, when present."""
    for table, columns in DERIVED_COMPATIBILITY_COLUMNS.items():
        if table not in source_columns_by_table:
            continue
        available = set(table_columns(connection, table))
        for column, expression in columns.items():
            if column in source_columns_by_table[table] or column not in available:
                continue
            connection.execute(
                text(
                    f"UPDATE {quote_identifier(table)} SET {quote_identifier(column)} = {expression} "
                    f"WHERE {quote_identifier(column)} IS NULL"
                )
            )


def validate_derived_compatibility_columns(
    connection: Connection,
    source_columns_by_table: dict[str, list[str]],
) -> list[str]:
    errors: list[str] = []
    for table, columns in DERIVED_COMPATIBILITY_COLUMNS.items():
        if table not in source_columns_by_table:
            continue
        available = set(table_columns(connection, table))
        for column in columns:
            if column in source_columns_by_table[table] or column not in available:
                continue
            nulls = connection.execute(
                text(
                    f"SELECT count(*) FROM {quote_identifier(table)} "
                    f"WHERE {quote_identifier(column)} IS NULL"
                )
            ).scalar()
            if nulls:
                errors.append(f"{table}.{column}: {nulls} NULL values")
    return errors


def canonical(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: canonical(value[key]) for key in sorted(value)}
    if isinstance(value, (list, tuple)):
        return [canonical(item) for item in value]
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def table_digest(
    connection: Connection,
    table: str,
    ignored: set[str] | None = None,
    columns_override: list[str] | None = None,
    where: str | None = None,
    parameters: dict[str, Any] | None = None,
) -> str:
    ignored = ignored or set()
    columns = columns_override or [column for column in table_columns(connection, table) if column not in ignored]
    query = (
        f"SELECT {', '.join(quote_identifier(c) for c in columns)} "
        f"FROM {quote_identifier(table)}"
        + (f" WHERE {where}" if where else "")
    )
    rows = connection.execute(text(query), parameters or {}).fetchall()
    normalized = sorted(
        json.dumps({column: canonical(value) for column, value in zip(columns, row)}, sort_keys=True, default=str)
        for row in rows
    )
    return hashlib.sha256("\n".join(normalized).encode()).hexdigest()


def verify_parity(
    source: Connection,
    target: Connection,
    tables: set[str],
) -> list[str]:
    mismatches: list[str] = []
    for table in sorted(tables):
        source_count = row_count(source, table)
        target_count = row_count(target, table)
        if source_count != target_count:
            mismatches.append(f"{table}: row count source={source_count} target={target_count}")
        common_columns = [column for column in table_columns(source, table) if column in table_columns(target, table)]
        if table_digest(source, table, columns_override=common_columns) != table_digest(
            target, table, columns_override=common_columns
        ):
            mismatches.append(f"{table}: row contents differ")
    return mismatches


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source-url", help="Production PostgreSQL URL; defaults to SOURCE_DATABASE_URL")
    parser.add_argument("--target-url", help="Development PostgreSQL URL; defaults to TARGET_DATABASE_URL")
    parser.add_argument("--backup-dir", type=Path, default=ROOT / "migration-backups")
    parser.add_argument("--apply", action="store_true", help="Perform the destructive dev replacement")
    parser.add_argument("--verify-only", action="store_true", help="Only compare source and target data")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.apply and args.verify_only:
        raise SystemExit("--apply and --verify-only cannot be combined")
    source_url = database_url(args.source_url, "SOURCE_DATABASE_URL")
    target_url = database_url(args.target_url, "TARGET_DATABASE_URL")
    source_identity = make_url(source_url).set(password=None).render_as_string()
    target_identity = make_url(target_url).set(password=None).render_as_string()
    if source_identity == target_identity:
        raise SystemExit("Source and target database URLs identify the same database; refusing to continue")
    source_engine: Engine = create_engine(source_url, future=True)
    target_engine: Engine = create_engine(target_url, future=True)

    with source_engine.connect() as source, target_engine.connect() as target:
        source.execute(text("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY"))
        source_revision = schema_revision(source)
        target_revision = schema_revision(target)
        if source_revision != target_revision:
            print(
                f"Schema revisions differ; applying additive compatibility mode: "
                f"source={source_revision!r}, target={target_revision!r}"
            )
        source_tables = public_tables(source)
        target_tables = public_tables(target)
        if source_tables != target_tables:
            raise RuntimeError(
                f"Schema tables differ: only source={sorted(source_tables - target_tables)}, "
                f"only target={sorted(target_tables - source_tables)}"
            )
        assert_compatible_columns(source, target, source_tables)
        dependencies = table_dependencies(source, source_tables)
        order = insertion_order(source_tables, dependencies)
        print(f"Schema revision: {source_revision or 'unknown'}")
        print(f"Tables: {len(source_tables)}; copy order: {', '.join(order)}")
        print(f"Source counts: {snapshot_counts(source, source_tables)}")
        print(f"Target counts: {snapshot_counts(target, target_tables)}")

        if args.verify_only:
            mismatches = verify_parity(source, target, source_tables)
            if mismatches:
                print("Parity check failed:")
                print("\n".join(f"- {item}" for item in mismatches))
                return 1
            print("Parity check passed.")
            return 0

        if not args.apply:
            print("Dry run only. Re-run with --apply to back up and replace the dev database.")
            return 0

        backup = backup_target(target_url, args.backup_dir)
        print(f"Development backup: {backup}")
        copy_tables(source, target, source_tables, order)
        source_columns_by_table = {
            table: table_columns(source, table) for table in source_tables
        }
        backfill_derived_compatibility_columns(target, source_columns_by_table)
        reset_sequences(target, source_tables)
        mismatches = verify_parity(source, target, source_tables)
        if mismatches:
            target.rollback()
            raise RuntimeError("Parity check failed after copy:\n" + "\n".join(mismatches))
        compatibility_errors = validate_derived_compatibility_columns(target, source_columns_by_table)
        if compatibility_errors:
            target.rollback()
            raise RuntimeError("Derived-column validation failed:\n" + "\n".join(compatibility_errors))
        violations = foreign_key_violations(target)
        if violations:
            target.rollback()
            raise RuntimeError("Foreign-key validation failed:\n" + "\n".join(violations))
        target.commit()
        print("Full data clone completed, including users and password hashes.")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
