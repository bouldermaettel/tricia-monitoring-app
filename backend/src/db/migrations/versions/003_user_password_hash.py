"""add password hash to users

Revision ID: 003_user_password_hash
Revises: 002_dashboard_indexes
Create Date: 2026-04-23
"""

from alembic import op
import sqlalchemy as sa

revision = "003_user_password_hash"
down_revision = "002_dashboard_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("password_hash", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "password_hash")
