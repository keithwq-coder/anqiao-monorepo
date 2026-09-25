"""Make institutions.archive_reason optional once archived.

TASK-0036 (SPEC-0002 v0.4.0 R-008 / SPEC-0001 v0.8.0 R-036): the
administrator may archive a record without providing an archive reason;
the archive is still auto-traced (who/when/what) in audit_events.

``down_revision`` is ``0008_deprecate_agent_role``.
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0009_archive_reason_optional"
down_revision: str | None = "0008_deprecate_agent_role"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_ARCHIVE_CONSTRAINT = "ck_institutions_archive_complete"


def upgrade() -> None:
    op.drop_constraint(_ARCHIVE_CONSTRAINT, "institutions", type_="check")
    op.create_check_constraint(
        _ARCHIVE_CONSTRAINT,
        "institutions",
        "(archived_at IS NULL AND archive_reason IS NULL) OR (archived_at IS NOT NULL)",
    )


def downgrade() -> None:
    op.drop_constraint(_ARCHIVE_CONSTRAINT, "institutions", type_="check")
    op.create_check_constraint(
        _ARCHIVE_CONSTRAINT,
        "institutions",
        "(archived_at IS NULL AND archive_reason IS NULL) "
        "OR (archived_at IS NOT NULL AND archive_reason IS NOT NULL)",
    )
