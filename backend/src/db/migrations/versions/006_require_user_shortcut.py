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
    op.execute(
        """
        UPDATE users
        SET shortcut = SUBSTR(
            CASE
                WHEN INSTR(external_key, '@') > 0 THEN SUBSTR(external_key, 1, INSTR(external_key, '@') - 1)
                ELSE external_key
            END,
            1,
            32
        )
        WHERE shortcut IS NULL OR TRIM(shortcut) = ''
        """
    )
    op.alter_column("users", "shortcut", existing_type=sa.String(length=32), nullable=False)


def downgrade() -> None:
    op.alter_column("users", "shortcut", existing_type=sa.String(length=32), nullable=True)
