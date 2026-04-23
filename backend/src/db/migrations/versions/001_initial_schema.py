"""initial schema

Revision ID: 001_initial_schema
Revises:
Create Date: 2026-04-23
"""

from alembic import op
import sqlalchemy as sa

revision = "001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("external_key", sa.String(length=128), nullable=False, unique=True),
        sa.Column("display_name", sa.String(length=128), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
    )
    op.create_table(
        "cases",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("vk_number", sa.String(length=64), nullable=False, unique=True),
        sa.Column("device_name", sa.String(length=128), nullable=False),
        sa.Column("analysis_date", sa.Date(), nullable=False),
        sa.Column("input_timestamp", sa.DateTime(), nullable=False),
        sa.Column("source_type", sa.String(length=32), nullable=False),
        sa.Column("created_by_user_id", sa.String(length=64), nullable=True),
        sa.Column("validation_status", sa.String(length=32), nullable=False),
    )
    op.create_table(
        "classification_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("case_id", sa.String(length=36), nullable=False),
        sa.Column("tricia_s", sa.Integer(), nullable=False),
        sa.Column("tricia_p", sa.Integer(), nullable=False),
        sa.Column("tricia_d", sa.Integer(), nullable=False),
        sa.Column("user_s", sa.Integer(), nullable=False),
        sa.Column("user_d", sa.Integer(), nullable=False),
        sa.Column("deviation_s", sa.Integer(), nullable=False),
        sa.Column("deviation_d", sa.Integer(), nullable=False),
        sa.Column("problem_flag", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )


def downgrade() -> None:
    op.drop_table("classification_snapshots")
    op.drop_table("cases")
    op.drop_table("users")
