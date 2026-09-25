"""代理商档案域：5 张业务聚合表 + 删除 agent_tier.max_region_grade（SPEC-0002）

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-13
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _enum(name: str, values: tuple[str, ...], length: int = 16) -> sa.Enum:
    return sa.Enum(
        *values,
        name=name,
        native_enum=False,
        create_constraint=True,
        length=length,
    )


def _audit_columns() -> list[sa.Column]:
    return [
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
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
        "party",
        *_audit_columns(),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("credit_code", sa.String(64), nullable=True),
        sa.Column("qualification", sa.String(256), nullable=True),
        sa.Column("wechat_openid", sa.String(64), nullable=True),
        sa.Column("phone", sa.String(32), nullable=True),
    )

    op.create_table(
        "agent_profile",
        *_audit_columns(),
        sa.Column(
            "party_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("party.id"),
            nullable=False,
        ),
        sa.Column("tier_code", sa.String(32), nullable=False),
        sa.Column("city_code", sa.String(32), nullable=False),
        sa.Column(
            "district_code",
            sa.String(32),
            nullable=False,
            server_default="",
        ),
        sa.Column("annual_commitment", sa.Numeric(14, 2), nullable=False),
        sa.Column("quarter_plan", sa.Numeric(14, 2), nullable=False),
        sa.Column(
            "status",
            _enum(
                "lifecycle_status",
                (
                    "intention",
                    "reviewing",
                    "pending_sign",
                    "trial",
                    "converted",
                    "dissolved",
                    "rejected",
                ),
            ),
            nullable=False,
            server_default="intention",
        ),
    )

    op.create_table(
        "agreement",
        *_audit_columns(),
        sa.Column(
            "agent_profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("agent_profile.id"),
            nullable=False,
        ),
        sa.Column("tier_code", sa.String(32), nullable=False),
        sa.Column("city_code", sa.String(32), nullable=False),
        sa.Column(
            "district_code",
            sa.String(32),
            nullable=False,
            server_default="",
        ),
        sa.Column("annual_commitment", sa.Numeric(14, 2), nullable=False),
        sa.Column("deposit_std", sa.Numeric(12, 2), nullable=False),
        sa.Column("first_purchase", sa.Numeric(12, 2), nullable=False),
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=False),
        sa.Column("valid_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "sign_status",
            _enum("agreement_sign_status", ("signed", "terminated")),
            nullable=False,
            server_default="signed",
        ),
    )

    op.create_table(
        "region_occupancy",
        *_audit_columns(),
        sa.Column("city_code", sa.String(32), nullable=False),
        sa.Column(
            "district_code",
            sa.String(32),
            nullable=False,
            server_default="",
        ),
        sa.Column(
            "agent_profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("agent_profile.id"),
            nullable=False,
        ),
        sa.Column(
            "occupied_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "uq_region_occupancy_city_district",
        "region_occupancy",
        ["city_code", "district_code"],
        unique=True,
    )

    op.create_table(
        "deposit",
        *_audit_columns(),
        sa.Column(
            "agent_profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("agent_profile.id"),
            nullable=False,
        ),
        sa.Column(
            "deposit_type",
            _enum("deposit_type", ("deposit", "first_purchase")),
            nullable=False,
        ),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column(
            "paid_amount",
            sa.Numeric(12, 2),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "status",
            _enum("deposit_status", ("paid", "waived", "deferred", "refunded")),
            nullable=False,
            server_default="paid",
        ),
    )

    # R-009 / DEC-0022：S/A/B/C 区域分级不采用，作废字段删除
    op.drop_column("agent_tier", "max_region_grade")


def downgrade() -> None:
    # 先恢复 max_region_grade（0001 的历史字段）
    op.add_column(
        "agent_tier",
        sa.Column("max_region_grade", sa.String(8), nullable=False, server_default="C"),
    )
    op.alter_column("agent_tier", "max_region_grade", server_default=None)

    for table in ("deposit", "region_occupancy", "agreement", "agent_profile", "party"):
        op.drop_table(table)
