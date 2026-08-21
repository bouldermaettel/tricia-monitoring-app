"""add independent WIMI-P and calculated risk values

Revision ID: 008_wimi_p_and_risk_values
Revises: 007_user_role_and_password_reset_policy
"""

from alembic import op
import sqlalchemy as sa


revision = "008_wimi_p_and_risk_values"
down_revision = "007_user_role_and_password_reset_policy"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("classification_snapshots")}

    # The DEV backfill used wimi_p before the application adopted user_p as its
    # internal name. Preserve that data when upgrading DEV.
    if "user_p" not in columns:
        if "wimi_p" in columns:
            op.alter_column("classification_snapshots", "wimi_p", new_column_name="user_p")
        else:
            op.add_column("classification_snapshots", sa.Column("user_p", sa.Integer(), nullable=True))

    if "tri_risk" not in columns:
        op.add_column("classification_snapshots", sa.Column("tri_risk", sa.Integer(), nullable=True))
    if "wimi_risk" not in columns:
        op.add_column("classification_snapshots", sa.Column("wimi_risk", sa.Integer(), nullable=True))

    op.execute(
        sa.text(
            "UPDATE classification_snapshots "
            "SET user_p = tricia_p "
            "WHERE user_p IS NULL AND tricia_p IS NOT NULL"
        )
    )
    op.execute(
        sa.text(
            "UPDATE classification_snapshots "
            "SET tri_risk = tricia_s * tricia_p * tricia_d "
            "WHERE tricia_s IS NOT NULL AND tricia_p IS NOT NULL AND tricia_d IS NOT NULL"
        )
    )
    op.execute(
        sa.text(
            "UPDATE classification_snapshots "
            "SET wimi_risk = user_s * user_p * user_d "
            "WHERE user_s IS NOT NULL AND user_p IS NOT NULL AND user_d IS NOT NULL"
        )
    )


def downgrade() -> None:
    op.drop_column("classification_snapshots", "wimi_risk")
    op.drop_column("classification_snapshots", "tri_risk")
    op.drop_column("classification_snapshots", "user_p")
