"""Create import_batches and import_row_results tables for SPEC-0013 bulk import.

TASK-0011: durable batch identity + per-row result persistence. A batch
records importer, time, source file reference (content SHA-256 fingerprint
for idempotent rerun), counts, and status. Each row result records the
line number, outcome (imported / flagged_duplicate / failed), the created
institution id (when imported), a duplicate candidate reference (when
flagged), and a human-readable reason (when failed).

This migration is local synthetic only — no production database is touched.
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0003_import_batches"
down_revision: str | None = "0002_erasure_records"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "import_batches",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("imported_by_user_id", sa.Uuid(), nullable=False),
        sa.Column("source_file_name", sa.String(240), nullable=False),
        sa.Column("source_file_sha256", sa.String(64), nullable=False),
        sa.Column("row_count", sa.Integer(), nullable=False),
        sa.Column("imported_count", sa.Integer(), nullable=False),
        sa.Column("duplicate_count", sa.Integer(), nullable=False),
        sa.Column("failed_count", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("imported_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("undone_at", sa.DateTime(timezone=True)),
        sa.Column("undone_by_user_id", sa.Uuid()),
        sa.Column("undo_reason", sa.Text()),
        sa.CheckConstraint(
            "char_length(btrim(source_file_name)) > 0",
            name="ck_import_batches_source_file_name_not_blank",
        ),
        sa.CheckConstraint(
            "char_length(source_file_sha256) = 64",
            name="ck_import_batches_source_file_sha256_len64",
        ),
        sa.CheckConstraint("row_count >= 0", name="ck_import_batches_row_count_nonnegative"),
        sa.CheckConstraint("imported_count >= 0", name="ck_import_batches_imported_count_nonnegative"),
        sa.CheckConstraint("duplicate_count >= 0", name="ck_import_batches_duplicate_count_nonnegative"),
        sa.CheckConstraint("failed_count >= 0", name="ck_import_batches_failed_count_nonnegative"),
        sa.CheckConstraint(
            "imported_count + duplicate_count + failed_count = row_count",
            name="ck_import_batches_counts_sum_to_row_count",
        ),
        sa.CheckConstraint(
            "status IN ('active','undone')",
            name="ck_import_batches_status_value",
        ),
        sa.CheckConstraint(
            "(undone_at IS NULL AND undone_by_user_id IS NULL AND undo_reason IS NULL) "
            "OR (undone_at IS NOT NULL AND undone_by_user_id IS NOT NULL "
            "AND undo_reason IS NOT NULL)",
            name="ck_import_batches_undo_complete",
        ),
        sa.ForeignKeyConstraint(
            ["imported_by_user_id"],
            ["user_identities.id"],
            name="fk_import_batches_imported_by_user_id_user_identities",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["undone_by_user_id"],
            ["user_identities.id"],
            name="fk_import_batches_undone_by_user_id_user_identities",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_import_batches"),
    )
    op.create_index(
        "uq_import_batches_fingerprint",
        "import_batches",
        ["imported_by_user_id", "source_file_sha256"],
        unique=True,
    )
    op.create_index("ix_import_batches_status", "import_batches", ["status"])

    op.create_table(
        "import_row_results",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("batch_id", sa.Uuid(), nullable=False),
        sa.Column("line_number", sa.Integer(), nullable=False),
        sa.Column("outcome", sa.String(24), nullable=False),
        sa.Column("institution_id", sa.Uuid()),
        sa.Column("duplicate_of_institution_id", sa.Uuid()),
        sa.Column("reason", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("line_number >= 1", name="ck_import_row_results_line_number_positive"),
        sa.CheckConstraint(
            "outcome IN ('imported','flagged_duplicate','failed')",
            name="ck_import_row_results_outcome_value",
        ),
        sa.CheckConstraint(
            "(outcome = 'imported' AND institution_id IS NOT NULL "
            "AND duplicate_of_institution_id IS NULL) "
            "OR (outcome = 'flagged_duplicate' AND duplicate_of_institution_id IS NOT NULL) "
            "OR (outcome = 'failed')",
            name="ck_import_row_results_outcome_consistency",
        ),
        sa.ForeignKeyConstraint(
            ["batch_id"],
            ["import_batches.id"],
            name="fk_import_row_results_batch_id_import_batches",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["institution_id"],
            ["institutions.id"],
            name="fk_import_row_results_institution_id_institutions",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["duplicate_of_institution_id"],
            ["institutions.id"],
            name="fk_import_row_results_duplicate_of_institution_id_institutions",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_import_row_results"),
    )
    op.create_index(
        "ix_import_row_results_batch_line",
        "import_row_results",
        ["batch_id", "line_number"],
    )


def downgrade() -> None:
    op.drop_index("ix_import_row_results_batch_line", table_name="import_row_results")
    op.drop_table("import_row_results")
    op.drop_index("ix_import_batches_status", table_name="import_batches")
    op.drop_index("uq_import_batches_fingerprint", table_name="import_batches")
    op.drop_table("import_batches")
