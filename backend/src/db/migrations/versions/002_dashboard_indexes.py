"""dashboard indexes

Revision ID: 002_dashboard_indexes
Revises: 001_initial_schema
Create Date: 2026-04-23
"""

from alembic import op

revision = "002_dashboard_indexes"
down_revision = "001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_cases_analysis_date", "cases", ["analysis_date"], unique=False)
    op.create_index("ix_cases_validation_status", "cases", ["validation_status"], unique=False)
    op.create_index("ix_classification_case_id", "classification_snapshots", ["case_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_classification_case_id", table_name="classification_snapshots")
    op.drop_index("ix_cases_validation_status", table_name="cases")
    op.drop_index("ix_cases_analysis_date", table_name="cases")
