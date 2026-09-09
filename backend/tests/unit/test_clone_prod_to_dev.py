from pathlib import Path
import importlib.util

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
