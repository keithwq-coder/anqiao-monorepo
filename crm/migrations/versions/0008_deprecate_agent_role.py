"""Remove the deprecated agent role from role_grants.

TASK-0036 (SPEC-0002 v0.4.0, DEC-0149/DEC-0153): the 代理 (``agent``)
login role is deprecated; ``agent`` is no longer a legal login role. The
``user_identities.phone`` column added by 0007 is retained (R-025).

``down_revision`` is ``0007_agent_role_and_user_phone`` (production head).
The ``0006`` head is an excluded sibling; this migration keeps the
0005 -> 0007 -> 0008 chain.
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0008_deprecate_agent_role"
down_revision: str | None = "0007_agent_role_and_user_phone"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_ROLE_VALUE_CONSTRAINT = "ck_role_grants_role_value"
_ROLES_WITHOUT_AGENT = "'business_user','administrator','general_manager','manager'"
_ROLES_WITH_AGENT = "'business_user','administrator','general_manager','manager','agent'"


def upgrade() -> None:
    op.drop_constraint(_ROLE_VALUE_CONSTRAINT, "role_grants", type_="check")
    # Remove any remaining deprecated 'agent' grants before tightening the
    # constraint. DEC-0149/DEC-0153 deprecate the agent login role, so no
    # 'agent' row is legal; leaving one would make the new constraint fail
    # validation (CheckViolation). Matches this migration's stated intent.
    op.execute(
        sa.text("DELETE FROM role_grants WHERE role = :role").bindparams(role="agent"),
    )
    op.create_check_constraint(
        _ROLE_VALUE_CONSTRAINT,
        "role_grants",
        f"role IN ({_ROLES_WITHOUT_AGENT})",
    )


def downgrade() -> None:
    op.drop_constraint(_ROLE_VALUE_CONSTRAINT, "role_grants", type_="check")
    op.create_check_constraint(
        _ROLE_VALUE_CONSTRAINT,
        "role_grants",
        f"role IN ({_ROLES_WITH_AGENT})",
    )
