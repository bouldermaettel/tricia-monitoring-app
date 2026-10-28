from pathlib import Path
import importlib.util
import sys
import types

import pytest


SCRIPT = Path(__file__).resolve().parents[3] / "scripts" / "clone_prod_to_dev.py"
SPEC = importlib.util.spec_from_file_location("clone_prod_to_dev", SCRIPT)
assert SPEC and SPEC.loader
clone = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(clone)


def test_insertion_order_places_parents_before_children():
    tables = {"cases", "users", "case_reviews"}
    dependencies = {"cases": {"users"}, "case_reviews": {"cases"}}

    assert clone.insertion_order(tables, dependencies) == ["users", "cases", "case_reviews"]


def test_insertion_order_rejects_foreign_key_cycles():
    with pytest.raises(RuntimeError, match="Foreign-key cycle"):
        clone.insertion_order({"a", "b"}, {"a": {"b"}, "b": {"a"}})


def test_quote_identifier_escapes_quotes():
    assert clone.quote_identifier('a"b') == '"a""b"'


def test_users_are_included_in_the_data_copy():
    assert "users" not in clone.EXCLUDED_TABLES
    assert "alembic_version" in clone.EXCLUDED_TABLES


def test_known_new_classification_columns_have_compatibility_backfills():
    assert clone.DERIVED_COMPATIBILITY_COLUMNS["classification_snapshots"] == {
        "user_p": '"tricia_p"',
        "tri_risk": '"tricia_s" * "tricia_p" * "tricia_d"',
        "wimi_risk": '"user_s" * "user_p" * "user_d"',
    }


def test_adapt_json_rows_wraps_jsonb_values():
    rows = clone.adapt_json_rows(
        [(1, {"3M": 3}, [1, 2])],
        ["id", "thresholds", "values"],
        {"thresholds": "jsonb", "values": "json"},
    )

    assert rows[0][0] == 1
    assert rows[0][1].obj == {"3M": 3}
    assert rows[0][2].obj == [1, 2]


def test_backup_target_writes_private_local_dump(monkeypatch, tmp_path):
    calls = {}

    def fake_pg_dump(command, check, env):
        calls["command"] = command
        calls["check"] = check
        calls["env"] = env
        Path(command[command.index("--file") + 1]).write_bytes(b"custom-format-dump")

    monkeypatch.setattr(clone.subprocess, "run", fake_pg_dump)
    backup = clone.backup_target(
        "postgresql://monitoring:secret@example.test/monitoring", tmp_path, "prod"
    )

    assert backup.parent == tmp_path
    assert backup.name.endswith("-prod-database-backup.dump")
    assert backup.read_bytes() == b"custom-format-dump"
    assert backup.stat().st_mode & 0o777 == 0o600
    assert calls["check"] is True
    assert calls["env"]["PGPASSWORD"] == "secret"


def test_upload_backup_checks_blob_size_and_digest(monkeypatch, tmp_path):
    remote = {}

    class FakeBlobClient:
        def upload_blob(self, stream, overwrite, metadata):
            remote["bytes"] = stream.read()
            remote["overwrite"] = overwrite
            remote["metadata"] = metadata

        def get_blob_properties(self):
            return types.SimpleNamespace(
                size=len(remote["bytes"]), metadata=remote["metadata"]
            )

    class FakeContainerClient:
        @classmethod
        def from_container_url(cls, container_url):
            remote["container_url"] = container_url
            return cls()

        def get_blob_client(self, blob_name):
            remote["blob_name"] = blob_name
            return FakeBlobClient()

    azure = types.ModuleType("azure")
    storage = types.ModuleType("azure.storage")
    blob = types.ModuleType("azure.storage.blob")
    blob.ContainerClient = FakeContainerClient
    azure.storage = storage
    storage.blob = blob
    monkeypatch.setitem(sys.modules, "azure", azure)
    monkeypatch.setitem(sys.modules, "azure.storage", storage)
    monkeypatch.setitem(sys.modules, "azure.storage.blob", blob)

    backup = tmp_path / "prod.dump"
    backup.write_bytes(b"private dump")
    blob_name, digest = clone.upload_backup(
        backup, "https://account/container?short-lived-sas"
    )

    assert remote["bytes"] == b"private dump"
    assert remote["overwrite"] is False
    assert blob_name == "prod.dump"
    assert digest == remote["metadata"]["sha256"]
    assert remote["metadata"]["size"] == str(len(b"private dump"))


def test_main_rejects_identical_database_urls(monkeypatch):
    database_url = "postgresql://monitoring:secret@example.test/monitoring"
    monkeypatch.setenv("SOURCE_DATABASE_URL", database_url)
    monkeypatch.setenv("TARGET_DATABASE_URL", database_url)
    monkeypatch.setattr(sys, "argv", [str(SCRIPT)])

    with pytest.raises(SystemExit, match="same database"):
        clone.main()


def test_assert_compatible_columns_rejects_unknown_target_columns():
    class FakeConnection:
        def __init__(self, columns):
            self.columns = columns

        def execute(self, statement, parameters):
            return [(column,) for column in self.columns[parameters["table"]]]

    source = FakeConnection({"cases": ["id", "name"]})
    target = FakeConnection({"cases": ["id", "name", "unexpected"]})

    with pytest.raises(RuntimeError, match="unsupported extra columns"):
        clone.assert_compatible_columns(source, target, {"cases"})
