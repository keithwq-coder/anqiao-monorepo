"""Add shareholder role and custodian_user_id column (SPEC-0002 v0.5.0).

Product owner direction 2026-08-26 (DEC-0177/0179): the shareholder (股东)
role is added for 赵/武 as a business-type role granting global visibility,
assignment, pool release/archive without account management. The custodian
(管理人) column on institutions allows dual ownership-tracking.

``down_revision`` is ``0014_remove_general_manager_role``.
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID


revision: str = "0015_add_shareholder_role_and_custodian"
down_revision: str | None = "0014_remove_general_manager_role"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_ROLE_VALUE_CONSTRAINT = "ck_role_grants_role_value"
_ROLES_V014 = "'business_user','administrator','manager'"
_ROLES_V015 = "'business_user','administrator','manager','shareholder'"


def upgrade() -> None:
    # 1. Extend role_grants CHECK constraint to include shareholder.
    op.drop_constraint(_ROLE_VALUE_CONSTRAINT, "role_grants", type_="check")
    op.create_check_constraint(
        _ROLE_VALUE_CONSTRAINT,
        "role_grants",
        f"role IN ({_ROLES_V015})",
    )

    # 2. Add custodian_user_id column to institutions (nullable FK).
    op.add_column(
        "institutions",
        sa.Column(
            "custodian_user_id",
            PG_UUID(as_uuid=True),
            sa.ForeignKey("user_identities.id", ondelete="RESTRICT"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_institutions_custodian",
        "institutions",
        ["custodian_user_id"],
    )


def downgrade() -> None:
    # 1. Remove custodian column + index.
    op.drop_index("ix_institutions_custodian", table_name="institutions")
    op.drop_column("institutions", "custodian_user_id")

    # 2. Narrow role constraint back to v0.4.1 set.
    op.drop_constraint(_ROLE_VALUE_CONSTRAINT, "role_grants", type_="check")
    op.create_check_constraint(
        _ROLE_VALUE_CONSTRAINT,
        "role_grants",
        f"role IN ({_ROLES_V014})",
    )