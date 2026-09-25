"""Make institution_owner_history.reason optional.

TASK-0036 (SPEC-0002 v0.4.0 R-026): the administrator may 点名分配
(assign ownership) without a reason (auto-traced in audit_events);
general managers must still provide a reason, enforced at the route layer.

``down_revision`` is ``0009_archive_reason_optional``.
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0010_owner_history_reason_optional"
down_revision: str | None = "0009_archive_reason_optional"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_REASON_CONSTRAINT = "ck_institution_owner_history_reason_not_blank"


def upgrade() -> None:
    op.alter_column(
        "institution_owner_history",
        "reason",
        existing_type=sa.Text(),
        nullable=True,
    )
    op.drop_constraint(_REASON_CONSTRAINT, "institution_owner_history", type_="check")


def downgrade() -> None:
    op.create_check_constraint(
        _REASON_CONSTRAINT,
        "institution_owner_history",
        "char_length(btrim(reason)) > 0",
    )
    op.alter_column(
        "institution_owner_history",
        "reason",
        existing_type=sa.Text(),
        nullable=False,
    )
