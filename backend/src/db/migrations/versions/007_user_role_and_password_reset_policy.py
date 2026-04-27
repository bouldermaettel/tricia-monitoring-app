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
    op.add_column(
        "users",
        sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )

    # Collapse legacy roles into the new user role.
    op.execute("UPDATE users SET role = 'user' WHERE role <> 'admin'")


def downgrade() -> None:
    op.drop_column("users", "must_change_password")
