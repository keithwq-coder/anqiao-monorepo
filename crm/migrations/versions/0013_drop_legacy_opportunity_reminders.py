"""Remove superseded SPEC-0003 v0.3.0 reminder storage (TASK-0039)."""

from collections.abc import Sequence

from alembic import op


revision: str = "0013_drop_legacy_opportunity_reminders"
down_revision: str | None = "0012_opportunity_candidates"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index("ix_opportunity_reminders_recipient", table_name="opportunity_reminders")
    op.drop_table("opportunity_reminders")


def downgrade() -> None:
    raise RuntimeError("Legacy opportunity_reminders storage is intentionally not restored")
