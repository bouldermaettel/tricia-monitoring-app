"""require user shortcut for all users

Revision ID: 006_require_user_shortcut
Revises: 005_case_audit_trail
Create Date: 2026-04-24
"""

from alembic import op
import sqlalchemy as sa

revision = "006_require_user_shortcut"
down_revision = "005_case_audit_trail"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    if dialect == "postgresql":
        op.execute(
            """
            UPDATE users
            SET shortcut = LEFT(
                CASE
                    WHEN STRPOS(external_key, '@') > 0 THEN SUBSTRING(external_key FROM 1 FOR STRPOS(external_key, '@') - 1)
                    ELSE COALESCE(external_key, id)
                END,
                32
            )
            WHERE shortcut IS NULL OR TRIM(shortcut) = ''
            """
        )
    else:
        op.execute(
            """
            UPDATE users
            SET shortcut = SUBSTR(
                CASE
                    WHEN INSTR(external_key, '@') > 0 THEN SUBSTR(external_key, 1, INSTR(external_key, '@') - 1)
                    ELSE COALESCE(external_key, id)
                END,
                1,
                32
            )
            WHERE shortcut IS NULL OR TRIM(shortcut) = ''
            """
        )
    # Only alter to NOT NULL if the column is currently nullable.
    from sqlalchemy import inspect as sa_inspect
    user_columns = {col["name"]: col for col in sa_inspect(bind).get_columns("users")}
    if "shortcut" in user_columns and user_columns["shortcut"].get("nullable", True):
        op.alter_column("users", "shortcut", existing_type=sa.String(length=32), nullable=False)


def downgrade() -> None:
    op.alter_column("users", "shortcut", existing_type=sa.String(length=32), nullable=True)
