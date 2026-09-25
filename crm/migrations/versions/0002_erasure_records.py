"""Create erasure_records table for SPEC-0011 lifecycle erasure.

TASK-0017: permanent erasure records with backup propagation tracking.
The propagate_by deadline is erased_at + 30 days (DEC-0104 Decision 2).
This migration is local synthetic only — no production database is touched.
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0002_erasure_records"
down_revision: str | None = "0001_initial_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "erasure_records",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("target_type", sa.String(80), nullable=False),
        sa.Column("target_id", sa.Uuid(), nullable=False),
        sa.Column("erased_by_user_id", sa.Uuid(), nullable=False),
        sa.Column("erasure_reason", sa.Text(), nullable=False),
        sa.Column("erasure_scope", sa.Text(), nullable=False),
        sa.Column("erased_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("propagate_by", sa.DateTime(timezone=True), nullable=False),
        sa.Column("propagation_status", sa.String(24), nullable=False),
        sa.Column("propagation_verified_at", sa.DateTime(timezone=True)),
        sa.Column("is_request_fulfillment", sa.Boolean(), nullable=False),
        sa.Column("request_reference", sa.Text()),
        sa.CheckConstraint("char_length(btrim(erasure_reason)) > 0", name="ck_erasure_records_erasure_reason_not_blank"),
        sa.CheckConstraint("propagate_by > erased_at", name="ck_erasure_records_propagate_after_erasure"),
        sa.CheckConstraint("propagation_status IN ('pending','verified','incomplete')", name="ck_erasure_records_propagation_status_value"),
        sa.CheckConstraint(
            "(propagation_verified_at IS NULL AND propagation_status = 'pending') "
            "OR (propagation_verified_at IS NOT NULL AND propagation_status <> 'pending')",
            name="ck_erasure_records_propagation_verified_complete",
        ),
        sa.CheckConstraint("target_type IN ('institution','contact')", name="ck_erasure_records_erasure_target_type"),
        sa.ForeignKeyConstraint(["erased_by_user_id"], ["user_identities.id"], name="fk_erasure_records_erased_by_user_id_user_identities", ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name="pk_erasure_records"),
    )
    op.create_index("ix_erasure_records_target", "erasure_records", ["target_type", "target_id"])
    op.create_index("ix_erasure_records_propagate_by", "erasure_records", ["propagate_by"])


def downgrade() -> None:
    op.drop_index("ix_erasure_records_propagate_by", table_name="erasure_records")
    op.drop_index("ix_erasure_records_target", table_name="erasure_records")
    op.drop_table("erasure_records")
