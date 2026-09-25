"""规则配置域：8 张版本化配置表（SPEC-0001 R-001/R-002）

Revision ID: 0001
Revises:
Create Date: 2026-08-13
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _versioned_columns() -> list[sa.Column]:
    """版本化通用字段（所有配置表共有）。"""
    return [
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("effective_from", sa.DateTime(timezone=True), nullable=False),
        sa.Column("effective_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "status",
            sa.Enum(
                "draft",
                "active",
                "superseded",
                name="rule_status",
                native_enum=False,
                create_constraint=True,
                length=16,
            ),
            nullable=False,
            server_default="draft",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    ]


def upgrade() -> None:
    op.create_table(
        "agent_tier",
        *_versioned_columns(),
        sa.Column("tier_code", sa.String(32), nullable=False),
        sa.Column("tier_name", sa.String(64), nullable=False),
        sa.Column("annual_commitment", sa.Numeric(14, 2), nullable=False),
        sa.Column("deposit_std", sa.Numeric(12, 2), nullable=False),
        sa.Column("first_purchase", sa.Numeric(12, 2), nullable=False),
        sa.Column("rebate_cap_rate", sa.Numeric(6, 4), nullable=False),
        sa.Column("max_region_grade", sa.String(8), nullable=False),
        sa.Column("trial_days", sa.Integer(), nullable=False),
    )
    op.create_index(
        "uq_agent_tier_key_eff",
        "agent_tier",
        ["tier_code", "effective_from"],
        unique=True,
    )
    op.create_index(
        "uq_agent_tier_key_active",
        "agent_tier",
        ["tier_code"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
    )

    op.create_table(
        "price_ladder",
        *_versioned_columns(),
        sa.Column("product_code", sa.String(32), nullable=False),
        sa.Column("ladder_tier", sa.Integer(), nullable=False),
        sa.Column("monthly_qty_min", sa.Integer(), nullable=False),
        sa.Column("monthly_qty_max", sa.Integer(), nullable=True),
        sa.Column("unit_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("is_negotiable", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_index(
        "uq_price_ladder_key_eff",
        "price_ladder",
        ["product_code", "ladder_tier", "effective_from"],
        unique=True,
    )
    op.create_index(
        "uq_price_ladder_key_active",
        "price_ladder",
        ["product_code", "ladder_tier"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
    )

    op.create_table(
        "price_line",
        *_versioned_columns(),
        sa.Column("product_code", sa.String(32), nullable=False),
        sa.Column("line_type", sa.String(16), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
    )
    op.create_index(
        "uq_price_line_key_eff",
        "price_line",
        ["product_code", "line_type", "effective_from"],
        unique=True,
    )
    op.create_index(
        "uq_price_line_key_active",
        "price_line",
        ["product_code", "line_type"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
    )

    op.create_table(
        "rebate_rule",
        *_versioned_columns(),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("rebate_type", sa.String(24), nullable=False),
        sa.Column("rate", sa.Numeric(6, 4), nullable=False),
        sa.Column("trigger_condition", sa.String(512), nullable=True),
        sa.Column("settle_period", sa.String(16), nullable=False),
        sa.Column("settle_method", sa.String(32), nullable=False),
    )
    op.create_index(
        "uq_rebate_rule_key_eff",
        "rebate_rule",
        ["role", "rebate_type", "effective_from"],
        unique=True,
    )
    op.create_index(
        "uq_rebate_rule_key_active",
        "rebate_rule",
        ["role", "rebate_type"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
    )

    op.create_table(
        "deposit_rule",
        *_versioned_columns(),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("deposit_type", sa.String(24), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("refundable", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("reducible", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deferrable", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_index(
        "uq_deposit_rule_key_eff",
        "deposit_rule",
        ["role", "deposit_type", "effective_from"],
        unique=True,
    )
    op.create_index(
        "uq_deposit_rule_key_active",
        "deposit_rule",
        ["role", "deposit_type"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
    )

    op.create_table(
        "protection_policy",
        *_versioned_columns(),
        sa.Column("customer_type", sa.String(24), nullable=False),
        sa.Column("protection_days", sa.Integer(), nullable=False),
        sa.Column("extendable_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("renewal_condition", sa.String(512), nullable=True),
    )
    op.create_index(
        "uq_protection_policy_key_eff",
        "protection_policy",
        ["customer_type", "effective_from"],
        unique=True,
    )
    op.create_index(
        "uq_protection_policy_key_active",
        "protection_policy",
        ["customer_type"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
    )

    op.create_table(
        "region_grade",
        *_versioned_columns(),
        sa.Column("grade", sa.String(8), nullable=False),
        sa.Column("definition", sa.String(512), nullable=True),
    )
    op.create_index(
        "uq_region_grade_key_eff",
        "region_grade",
        ["grade", "effective_from"],
        unique=True,
    )
    op.create_index(
        "uq_region_grade_key_active",
        "region_grade",
        ["grade"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
    )

    op.create_table(
        "banned_term",
        *_versioned_columns(),
        sa.Column("term", sa.String(64), nullable=False),
        sa.Column("scope", sa.String(24), nullable=True),
    )
    op.create_index(
        "uq_banned_term_key_eff",
        "banned_term",
        ["term", "effective_from"],
        unique=True,
    )
    op.create_index(
        "uq_banned_term_key_active",
        "banned_term",
        ["term"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
    )


def downgrade() -> None:
    for table in (
        "banned_term",
        "region_grade",
        "protection_policy",
        "deposit_rule",
        "rebate_rule",
        "price_line",
        "price_ladder",
        "agent_tier",
    ):
        op.drop_table(table)
