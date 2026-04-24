"""add case audit trail table

Revision ID: 005_case_audit_trail
Revises: 004_user_shortcut_and_case_wimi_shortcut
Create Date: 2026-04-24
"""

from alembic import op
import sqlalchemy as sa

revision = "005_case_audit_trail"
down_revision = "004_user_shortcut_and_case_wimi_shortcut"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "case_audit_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("case_id", sa.String(length=36), nullable=False),
        sa.Column("action", sa.String(length=32), nullable=False),
        sa.Column("actor_id", sa.String(length=64), nullable=True),
        sa.Column("changes", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_case_audit_events_case_id", "case_audit_events", ["case_id"])
    op.create_index("ix_case_audit_events_created_at", "case_audit_events", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_case_audit_events_created_at", table_name="case_audit_events")
    op.drop_index("ix_case_audit_events_case_id", table_name="case_audit_events")
    op.drop_table("case_audit_events")
