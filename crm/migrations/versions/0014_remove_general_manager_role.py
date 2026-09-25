"""Remove the deprecated general_manager role from role_grants.

Product owner direction 2026-08-24 (DEC-0172): the 总经理 (``general_manager``)
login role is removed from the system; only administrator / manager /
business_user remain. All existing general_manager grants were revoked during
the account cleanup (DEC-0171) and the board-director accounts were re-granted
as scoped manager, so no active general_manager rows should exist. This
migration only narrows the CHECK constraint.

``down_revision`` is ``0013_drop_legacy_opportunity_reminders`` (current head).
"""

from collections.abc import Sequence

from alembic import op


revision: str = "0014_remove_general_manager_role"
down_revision: str | None = "0013_drop_legacy_opportunity_reminders"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_ROLE_VALUE_CONSTRAINT = "ck_role_grants_role_value"
_ROLES_NEW = "'business_user','administrator','manager'"
_ROLES_WITH_GM = "'business_user','administrator','general_manager','manager'"


def upgrade() -> None:
    # The general_manager role no longer exists; drop any residual rows
    # (active or revoked history) before narrowing the CHECK constraint —
    # same convention as 0008 removing the legacy agent rows.
    op.execute("DELETE FROM role_grants WHERE role = 'general_manager'")
    op.drop_constraint(_ROLE_VALUE_CONSTRAINT, "role_grants", type_="check")
    op.create_check_constraint(
        _ROLE_VALUE_CONSTRAINT,
        "role_grants",
        f"role IN ({_ROLES_NEW})",
    )


def downgrade() -> None:
    op.drop_constraint(_ROLE_VALUE_CONSTRAINT, "role_grants", type_="check")
    op.create_check_constraint(
        _ROLE_VALUE_CONSTRAINT,
        "role_grants",
        f"role IN ({_ROLES_WITH_GM})",
    )
