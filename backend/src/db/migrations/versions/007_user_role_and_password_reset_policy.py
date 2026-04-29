"""reduce roles to admin/user and add forced password change flag

Revision ID: 007_user_role_and_password_reset_policy
Revises: 006_require_user_shortcut
Create Date: 2026-04-27
"""

from alembic import op
import sqlalchemy as sa

revision = "007_user_role_and_password_reset_policy"
down_revision = "006_require_user_shortcut"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    # Column may already exist if _ensure_user_policy_schema() ran on a previous startup
    # before this migration was applied.  Use dialect-appropriate idempotent ADD COLUMN.
    if dialect == "postgresql":
        bind.execute(
            sa.text(
                "ALTER TABLE users "
                "ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE"
            )
        )
    else:
        from sqlalchemy import inspect as sa_inspect
        user_columns = {col["name"] for col in sa_inspect(bind).get_columns("users")}
        if "must_change_password" not in user_columns:
            op.add_column(
                "users",
                sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default=sa.text("0")),
            )

    # Collapse legacy roles into the new user role.
    op.execute("UPDATE users SET role = 'user' WHERE role <> 'admin'")


def downgrade() -> None:
    op.drop_column("users", "must_change_password")
