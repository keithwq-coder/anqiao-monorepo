"""规则配置域 ORM 模型：8 张版本化配置表。

依据：SPEC-0001 R-001/R-002、Phase1 规格第 2 节（表结构与业务键）、DEC-0007（规则即数据）。
"""

import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class RuleStatus(StrEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    SUPERSEDED = "superseded"


class Base(DeclarativeBase):
    pass


def _rule_status_enum() -> Enum:
    return Enum(
        RuleStatus,
        values_callable=lambda cls: [member.value for member in cls],
        name="rule_status",
        native_enum=False,
        create_constraint=True,
        length=16,
    )


class RuleConfigMixin:
    """版本化通用字段（SPEC-0001 R-002，所有配置表共有）。"""

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    effective_from: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    effective_to: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[RuleStatus] = mapped_column(
        _rule_status_enum(), nullable=False, default=RuleStatus.DRAFT
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )


class AgentTier(RuleConfigMixin, Base):
    """代理商档位（两档：区县/地级市）。业务键：tier_code。"""

    __tablename__ = "agent_tier"
    tier_code: Mapped[str] = mapped_column(String(32), nullable=False)
    tier_name: Mapped[str] = mapped_column(String(64), nullable=False)
    annual_commitment: Mapped[Any] = mapped_column(Numeric(14, 2), nullable=False)
    deposit_std: Mapped[Any] = mapped_column(Numeric(12, 2), nullable=False)
    first_purchase: Mapped[Any] = mapped_column(Numeric(12, 2), nullable=False)
    rebate_cap_rate: Mapped[Any] = mapped_column(Numeric(6, 4), nullable=False)
    trial_days: Mapped[int] = mapped_column(Integer, nullable=False)

    __table_args__ = (
        Index("uq_agent_tier_key_eff", "tier_code", "effective_from", unique=True),
        Index(
            "uq_agent_tier_key_active",
            "tier_code",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
    )


class PriceLadder(RuleConfigMixin, Base):
    """价盘阶梯（3 档 + 面议开放档，代理/经销共享）。业务键：(product_code, ladder_tier)。"""

    __tablename__ = "price_ladder"
    product_code: Mapped[str] = mapped_column(String(32), nullable=False)
    ladder_tier: Mapped[int] = mapped_column(Integer, nullable=False)
    monthly_qty_min: Mapped[int] = mapped_column(Integer, nullable=False)
    monthly_qty_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    unit_price: Mapped[Any] = mapped_column(Numeric(12, 2), nullable=True)
    is_negotiable: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    __table_args__ = (
        Index(
            "uq_price_ladder_key_eff",
            "product_code",
            "ladder_tier",
            "effective_from",
            unique=True,
        ),
        Index(
            "uq_price_ladder_key_active",
            "product_code",
            "ladder_tier",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
    )


class PriceLine(RuleConfigMixin, Base):
    """价格线（标价/建议零售/控价/B端/备案）。业务键：(product_code, line_type)。"""

    __tablename__ = "price_line"
    product_code: Mapped[str] = mapped_column(String(32), nullable=False)
    line_type: Mapped[str] = mapped_column(String(16), nullable=False)
    amount: Mapped[Any] = mapped_column(Numeric(12, 2), nullable=False)

    __table_args__ = (
        Index(
            "uq_price_line_key_eff",
            "product_code",
            "line_type",
            "effective_from",
            unique=True,
        ),
        Index(
            "uq_price_line_key_active",
            "product_code",
            "line_type",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
    )


class RebateRule(RuleConfigMixin, Base):
    """返利规则（按角色 4 类/2 类）。业务键：(role, rebate_type)。"""

    __tablename__ = "rebate_rule"
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    rebate_type: Mapped[str] = mapped_column(String(24), nullable=False)
    rate: Mapped[Any] = mapped_column(Numeric(6, 4), nullable=False)
    trigger_condition: Mapped[str | None] = mapped_column(
        String(512), nullable=True
    )
    settle_period: Mapped[str] = mapped_column(String(16), nullable=False)
    settle_method: Mapped[str] = mapped_column(String(32), nullable=False)

    __table_args__ = (
        Index(
            "uq_rebate_rule_key_eff",
            "role",
            "rebate_type",
            "effective_from",
            unique=True,
        ),
        Index(
            "uq_rebate_rule_key_active",
            "role",
            "rebate_type",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
    )


class DepositRule(RuleConfigMixin, Base):
    """保证金/首批货款标准。业务键：(role, deposit_type)。"""

    __tablename__ = "deposit_rule"
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    deposit_type: Mapped[str] = mapped_column(String(24), nullable=False)
    amount: Mapped[Any] = mapped_column(Numeric(12, 2), nullable=False)
    refundable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    reducible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deferrable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    __table_args__ = (
        Index(
            "uq_deposit_rule_key_eff",
            "role",
            "deposit_type",
            "effective_from",
            unique=True,
        ),
        Index(
            "uq_deposit_rule_key_active",
            "role",
            "deposit_type",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
    )


class ProtectionPolicy(RuleConfigMixin, Base):
    """报备保护期。业务键：customer_type。"""

    __tablename__ = "protection_policy"
    customer_type: Mapped[str] = mapped_column(String(24), nullable=False)
    protection_days: Mapped[int] = mapped_column(Integer, nullable=False)
    extendable_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    renewal_condition: Mapped[str | None] = mapped_column(String(512), nullable=True)

    __table_args__ = (
        Index(
            "uq_protection_policy_key_eff",
            "customer_type",
            "effective_from",
            unique=True,
        ),
        Index(
            "uq_protection_policy_key_active",
            "customer_type",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
    )


class RegionGrade(RuleConfigMixin, Base):
    """区域分级 S/A/B/C。业务键：grade。"""

    __tablename__ = "region_grade"
    grade: Mapped[str] = mapped_column(String(8), nullable=False)
    definition: Mapped[str | None] = mapped_column(String(512), nullable=True)

    __table_args__ = (
        Index("uq_region_grade_key_eff", "grade", "effective_from", unique=True),
        Index(
            "uq_region_grade_key_active",
            "grade",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
    )


class BannedTerm(RuleConfigMixin, Base):
    """合规禁用词。业务键：term。"""

    __tablename__ = "banned_term"
    term: Mapped[str] = mapped_column(String(64), nullable=False)
    scope: Mapped[str | None] = mapped_column(String(24), nullable=True)

    __table_args__ = (
        Index("uq_banned_term_key_eff", "term", "effective_from", unique=True),
        Index(
            "uq_banned_term_key_active",
            "term",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
    )


# ---- 代理商档案域（SPEC-0002，业务聚合，非版本化配置）----


class LifecycleStatus(StrEnum):
    """代理商生命周期状态（SPEC-0002 R-006）。"""

    INTENTION = "intention"
    REVIEWING = "reviewing"
    PENDING_SIGN = "pending_sign"
    TRIAL = "trial"
    CONVERTED = "converted"
    DISSOLVED = "dissolved"
    REJECTED = "rejected"


class AgreementSignStatus(StrEnum):
    SIGNED = "signed"
    TERMINATED = "terminated"


class DepositStatus(StrEnum):
    PAID = "paid"
    WAIVED = "waived"
    DEFERRED = "deferred"
    REFUNDED = "refunded"


class DepositType(StrEnum):
    DEPOSIT = "deposit"  # 保证金
    FIRST_PURCHASE = "first_purchase"  # 首批货款（加盟费性质）


def _status_enum(enum_cls: type[StrEnum], name: str) -> Enum:
    return Enum(
        enum_cls,
        values_callable=lambda cls: [member.value for member in cls],
        name=name,
        native_enum=False,
        create_constraint=True,
        length=16,
    )


class Party(Base):
    """合作方（SPEC-0002 R-001）。"""

    __tablename__ = "party"
    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    credit_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    qualification: Mapped[str | None] = mapped_column(String(256), nullable=True)
    wechat_openid: Mapped[str | None] = mapped_column(String(64), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )


class AgentProfile(Base):
    """代理商档案（SPEC-0002 R-002）。"""

    __tablename__ = "agent_profile"
    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    party_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("party.id"),
        nullable=False,
    )
    tier_code: Mapped[str] = mapped_column(String(32), nullable=False)
    city_code: Mapped[str] = mapped_column(String(32), nullable=False)
    district_code: Mapped[str] = mapped_column(
        String(32), nullable=False, default="", server_default=""
    )
    annual_commitment: Mapped[Any] = mapped_column(Numeric(14, 2), nullable=False)
    quarter_plan: Mapped[Any] = mapped_column(Numeric(14, 2), nullable=False)
    status: Mapped[LifecycleStatus] = mapped_column(
        _status_enum(LifecycleStatus, "lifecycle_status"),
        nullable=False,
        default=LifecycleStatus.INTENTION,
        server_default=LifecycleStatus.INTENTION.value,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )


class Agreement(Base):
    """代理协议（SPEC-0002 R-003）。"""

    __tablename__ = "agreement"
    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    agent_profile_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("agent_profile.id"),
        nullable=False,
    )
    tier_code: Mapped[str] = mapped_column(String(32), nullable=False)
    city_code: Mapped[str] = mapped_column(String(32), nullable=False)
    district_code: Mapped[str] = mapped_column(
        String(32), nullable=False, default="", server_default=""
    )
    annual_commitment: Mapped[Any] = mapped_column(Numeric(14, 2), nullable=False)
    deposit_std: Mapped[Any] = mapped_column(Numeric(12, 2), nullable=False)
    first_purchase: Mapped[Any] = mapped_column(Numeric(12, 2), nullable=False)
    valid_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    valid_to: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    sign_status: Mapped[AgreementSignStatus] = mapped_column(
        _status_enum(AgreementSignStatus, "agreement_sign_status"),
        nullable=False,
        default=AgreementSignStatus.SIGNED,
        server_default=AgreementSignStatus.SIGNED.value,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )


class RegionOccupancy(Base):
    """区域占用（SPEC-0002 R-004，补 AC-004 DB 约束）。

    `district_code=""` = 地级市市级（与 region_guard 约定一致）。
    UNIQUE(city_code, district_code) 防重复占用；地级市↔区县互斥语义由应用层 region_guard 保证。
    """

    __tablename__ = "region_occupancy"
    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    city_code: Mapped[str] = mapped_column(String(32), nullable=False)
    district_code: Mapped[str] = mapped_column(
        String(32), nullable=False, default="", server_default=""
    )
    agent_profile_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("agent_profile.id"),
        nullable=False,
    )
    occupied_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    __table_args__ = (
        Index(
            "uq_region_occupancy_city_district",
            "city_code",
            "district_code",
            unique=True,
        ),
    )


class Deposit(Base):
    """保证金/首批货款（SPEC-0002 R-005）。"""

    __tablename__ = "deposit"
    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    agent_profile_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("agent_profile.id"),
        nullable=False,
    )
    deposit_type: Mapped[DepositType] = mapped_column(
        _status_enum(DepositType, "deposit_type"),
        nullable=False,
    )
    amount: Mapped[Any] = mapped_column(Numeric(12, 2), nullable=False)
    paid_amount: Mapped[Any] = mapped_column(
        Numeric(12, 2), nullable=False, default=0, server_default="0"
    )
    status: Mapped[DepositStatus] = mapped_column(
        _status_enum(DepositStatus, "deposit_status"),
        nullable=False,
        default=DepositStatus.PAID,
        server_default=DepositStatus.PAID.value,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
