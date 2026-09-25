"""Add opportunity_candidates table.

SPEC-0003 v0.4.0 (TASK-0038): opportunity candidates with human
adjudication (待处理/采纳/忽略), two sources (existing_customer/crawler),
and a 30-day retention for crawler-sourced candidates (OD-001/DEC-0152).

``down_revision`` is ``0011_customer_type_and_public_pool``.
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0012_opportunity_candidates"
down_revision: str | None = "0011_customer_type_and_public_pool"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "opportunity_candidates",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("recipient_user_id", sa.Uuid(), nullable=False),
        sa.Column("source", sa.String(32), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="待处理"),
        sa.Column("candidate_text", sa.Text(), nullable=False),
        sa.Column("supporting_reason", sa.Text(), nullable=False),
        sa.Column("key_uncertainties", sa.Text(), nullable=False),
        sa.Column("involved_records", sa.JSON()),
        sa.Column("external_subject", sa.JSON()),
        sa.Column("discovered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.Column("read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("ai_used", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("model_identifier", sa.String(120)),
        sa.Column("adjudicated_at", sa.DateTime(timezone=True)),
        sa.Column("adjudicated_by_user_id", sa.Uuid()),
        sa.ForeignKeyConstraint(
            ["recipient_user_id"],
            ["user_identities.id"],
            name="fk_candidates_recipient",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["adjudicated_by_user_id"],
            ["user_identities.id"],
            name="fk_candidates_adjudicated_by",
            ondelete="RESTRICT",
        ),
        sa.CheckConstraint(
            "source IN ('existing_customer','crawler')",
            name="ck_opportunity_candidates_candidate_source_value",
        ),
        sa.CheckConstraint(
            "status IN ('待处理','采纳','忽略')",
            name="ck_opportunity_candidates_candidate_status_value",
        ),
        sa.CheckConstraint(
            "char_length(btrim(supporting_reason)) > 0",
            name="ck_opportunity_candidates_candidate_reason_not_blank",
        ),
    )
    op.create_index(
        "ix_opportunity_candidates_recipient",
        "opportunity_candidates",
        ["recipient_user_id"],
    )
    op.create_index(
        "ix_opportunity_candidates_expiry",
        "opportunity_candidates",
        ["expires_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_opportunity_candidates_expiry", table_name="opportunity_candidates")
    op.drop_index("ix_opportunity_candidates_recipient", table_name="opportunity_candidates")
    op.drop_table("opportunity_candidates")
