"""add user shortcut and case wimi shortcut

Revision ID: 004_user_shortcut_and_case_wimi_shortcut
Revises: 003_user_password_hash
Create Date: 2026-04-23
"""

from alembic import op
import sqlalchemy as sa

revision = "004_user_shortcut_and_case_wimi_shortcut"
down_revision = "003_user_password_hash"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("shortcut", sa.String(length=32), nullable=True))
    op.add_column("cases", sa.Column("wimi_shortcut", sa.String(length=32), nullable=True))


def downgrade() -> None:
    op.drop_column("cases", "wimi_shortcut")
    op.drop_column("users", "shortcut")
