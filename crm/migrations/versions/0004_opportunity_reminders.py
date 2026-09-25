"""Create opportunity_reminders table for SPEC-0003 opportunity discovery.

TASK-0020: discovery reminders (masked, cross-owner, local-deterministic).
Each row is one reminder delivered to one recipient (a record owner or the
administrator for unowned records). The reminder carries a masked supporting
reason, key uncertainties, discovery time, source-traceable involved-record
references, and a read/unread message status. No claim/promote/convert
action exists (R-004); the reminder is a distinct layer from SPEC-0001
records (R-003).

This migration is local synthetic only — no production database is touched.
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0004_opportunity_reminders"
down_revision: str | None = "0003_import_batches"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "opportunity_reminders",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("recipient_user_id", sa.Uuid(), nullable=False),
        sa.Column("discovery_rule", sa.String(120), nullable=False),
        sa.Column("supporting_reason", sa.Text(), nullable=False),
        sa.Column("key_uncertainties", sa.Text(), nullable=False),
        sa.Column("status_label", sa.String(40), nullable=False),
        sa.Column("involved_records", sa.JSON(), nullable=False),
        sa.Column("routed_reason", sa.String(40), nullable=True),
        sa.Column("discovered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("read", sa.Boolean(), nullable=False),
        sa.CheckConstraint(
            "char_length(btrim(supporting_reason)) > 0",
            name="ck_opportunity_reminders_reason_not_blank",
        ),
        sa.CheckConstraint(
            "char_length(btrim(key_uncertainties)) > 0",
            name="ck_opportunity_reminders_uncertainties_not_blank",
        ),
        sa.CheckConstraint(
            "status_label = '未确认'",
            name="ck_opportunity_reminders_status_unconfirmed",
        ),
        sa.CheckConstraint(
            "routed_reason IS NULL OR routed_reason IN ('unowned')",
            name="ck_opportunity_reminders_routed_reason_value",
        ),
        sa.ForeignKeyConstraint(
            ["recipient_user_id"],
            ["user_identities.id"],
            name="fk_opportunity_reminders_recipient_user_id_user_identities",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_opportunity_reminders"),
    )
    op.create_index(
        "ix_opportunity_reminders_recipient",
        "opportunity_reminders",
        ["recipient_user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_opportunity_reminders_recipient", table_name="opportunity_reminders")
    op.drop_table("opportunity_reminders")
