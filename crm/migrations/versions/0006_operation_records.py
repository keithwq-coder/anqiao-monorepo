"""Create operation_records table for SPEC-0012 operations audit.

TASK-0018: durable records for backup, restore rehearsal, deletion
propagation, deployment change, and rollback actions. Each record carries
the actor, action, target, outcome, and a non-secret summary. Secrets are
never stored (SPEC-0012 §10). The outcome is fail-closed: an unverified
backup, restore, or deletion propagation is recorded as ``failed`` or
``unverified``, never ``success`` (SPEC-0012 §8, AC-005).

This migration is local synthetic only — no production database is touched.
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0006_operation_records"
down_revision: str | None = "0005_opportunity_reminders_ai_reasoning"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "operation_records",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("operation_type", sa.String(40), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=True),
        sa.Column("action", sa.String(120), nullable=False),
        sa.Column("target_description", sa.Text(), nullable=False),
        sa.Column("outcome", sa.String(16), nullable=False),
        sa.Column("detail_summary", sa.Text(), nullable=True),
        sa.Column("failure_summary", sa.Text(), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "operation_type IN ('backup','restore','deployment_change','rollback',"
            "'deletion_propagation')",
            name="ck_operation_records_operation_type_value",
        ),
        sa.CheckConstraint(
            "outcome IN ('success','failed','unverified')",
            name="ck_operation_records_outcome_value",
        ),
        sa.CheckConstraint(
            "char_length(btrim(action)) > 0",
            name="ck_operation_records_action_not_blank",
        ),
        sa.CheckConstraint(
            "char_length(btrim(target_description)) > 0",
            name="ck_operation_records_target_description_not_blank",
        ),
        sa.CheckConstraint(
            "(completed_at IS NULL AND outcome = 'unverified') "
            "OR (completed_at IS NOT NULL AND outcome <> 'unverified')",
            name="ck_operation_records_completed_at_consistency",
        ),
        sa.CheckConstraint(
            "(outcome = 'success' AND failure_summary IS NULL) "
            "OR (outcome <> 'success')",
            name="ck_operation_records_success_has_no_failure_summary",
        ),
        sa.ForeignKeyConstraint(
            ["actor_user_id"],
            ["user_identities.id"],
            name="fk_operation_records_actor_user_id_user_identities",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_operation_records"),
    )
    op.create_index(
        "ix_operation_records_type_time",
        "operation_records",
        ["operation_type", sa.text("occurred_at DESC")],
    )
    op.create_index(
        "ix_operation_records_actor_time",
        "operation_records",
        ["actor_user_id", sa.text("occurred_at DESC")],
    )


def downgrade() -> None:
    op.drop_index("ix_operation_records_actor_time", table_name="operation_records")
    op.drop_index("ix_operation_records_type_time", table_name="operation_records")
    op.drop_table("operation_records")
