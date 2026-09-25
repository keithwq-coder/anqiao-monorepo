"""Add agent role to role_grants and phone column to user_identities.

TASK-0034 (SPEC-0002 v0.3.0 / SPEC-0014 v0.2.0, DEC-0145): the 代理
(``agent``) role shares the business_user permission scope; the
``user_identities.phone`` field is optional, non-unique, and not used for
login.

``down_revision`` is ``0005_opportunity_reminders_ai_reasoning`` (not
``0006_operation_records``) because ``0006`` is excluded from production
(DEC-0133/0139/0141); production advances 0005 -> 0007 directly. The two
heads (0006 and 0007) are siblings branching from 0005.
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0007_agent_role_and_user_phone"
down_revision: str | None = "0005_opportunity_reminders_ai_reasoning"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_ROLE_VALUE_CONSTRAINT = "ck_role_grants_role_value"
_ROLES_WITH_AGENT = (
    "'business_user','administrator','general_manager','manager','agent'"
)
_ROLES_WITHOUT_AGENT = "'business_user','administrator','general_manager','manager'"


def upgrade() -> None:
    op.add_column(
        "user_identities",
        sa.Column("phone", sa.String(80), nullable=True),
    )
    op.drop_constraint(_ROLE_VALUE_CONSTRAINT, "role_grants", type_="check")
    op.create_check_constraint(
        _ROLE_VALUE_CONSTRAINT,
        "role_grants",
        f"role IN ({_ROLES_WITH_AGENT})",
    )


def downgrade() -> None:
    op.drop_constraint(_ROLE_VALUE_CONSTRAINT, "role_grants", type_="check")
    op.create_check_constraint(
        _ROLE_VALUE_CONSTRAINT,
        "role_grants",
        f"role IN ({_ROLES_WITHOUT_AGENT})",
    )
    op.drop_column("user_identities", "phone")
