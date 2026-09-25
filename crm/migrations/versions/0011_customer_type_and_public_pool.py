"""Add customer type + public pool to institutions.

TASK-0037 (SPEC-0001 v0.8.0): every institution becomes a customer with a
required three-value customer_type (direct_purchase/individual/channel); a
public pool is modeled as owner_user_id NULL + an explicit in_pool marker.

Existing rows are backfilled as direct_purchase (the historical
机构/企业 records). ``institution_owner_history.new_owner_user_id`` is
made nullable so a release-to-pool records 原负责人 -> None.

``down_revision`` is ``0010_owner_history_reason_optional``.
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0011_customer_type_and_public_pool"
down_revision: str | None = "0010_owner_history_reason_optional"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_CUSTOMER_TYPE_CHECK = "ck_institutions_customer_type_value"
_POOL_STATE_CHECK = "ck_institutions_pool_state_consistent"


def upgrade() -> None:
    op.add_column(
        "institutions",
        sa.Column("customer_type", sa.String(32), nullable=False, server_default="direct_purchase"),
    )
    op.add_column(
        "institutions",
        sa.Column("in_pool", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.alter_column("institutions", "owner_user_id", existing_type=sa.Uuid(), nullable=True)
    op.alter_column(
        "institution_owner_history",
        "new_owner_user_id",
        existing_type=sa.Uuid(),
        nullable=True,
    )
    op.create_check_constraint(
        _CUSTOMER_TYPE_CHECK,
        "institutions",
        "customer_type IN ('direct_purchase','individual','channel')",
    )
    op.create_check_constraint(
        _POOL_STATE_CHECK,
        "institutions",
        "(in_pool AND owner_user_id IS NULL) OR (NOT in_pool AND owner_user_id IS NOT NULL)",
    )


def downgrade() -> None:
    op.drop_constraint(_POOL_STATE_CHECK, "institutions", type_="check")
    op.drop_constraint(_CUSTOMER_TYPE_CHECK, "institutions", type_="check")
    op.alter_column(
        "institution_owner_history",
        "new_owner_user_id",
        existing_type=sa.Uuid(),
        nullable=False,
    )
    op.alter_column("institutions", "owner_user_id", existing_type=sa.Uuid(), nullable=False)
    op.drop_column("institutions", "in_pool")
    op.drop_column("institutions", "customer_type")
