"""Add optional amount column to institutions (SPEC-0001 extension).

Product owner direction 2026-08-26 (OD-008): sales performance reports need
amount totals. The amount column is optional (NULL = no amount recorded) and
stored as NUMERIC(15,2) for currency values in 元 (RMB).

``down_revision`` is ``0015_add_shareholder_role_and_custodian``.
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0016_add_institution_amount"
down_revision: str | None = "0015_add_shareholder_role_and_custodian"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "institutions",
        sa.Column("amount", sa.Numeric(15, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("institutions", "amount")