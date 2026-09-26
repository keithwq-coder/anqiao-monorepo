"""Domain values and invariants for the authorized manual CRM slice."""

from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from enum import StrEnum
from uuid import UUID, uuid4


class DomainValidationError(ValueError):
    """Raised when approved minimum data or consistency rules are violated."""


class UserStatus(StrEnum):
    PENDING = "pending"
    ENABLED = "enabled"
    DISABLED = "disabled"


class Role(StrEnum):
    BUSINESS_USER = "business_user"
    ADMINISTRATOR = "administrator"
    MANAGER = "manager"
    SHAREHOLDER = "shareholder"


class CustomerType(StrEnum):
    """SPEC-0001 v0.8.0 R-037: three pure-label customer types.

    The type does not change any behavior; it is used only for
    classification, filtering, and statistics. ``个人`` (individual) is
    reserved in the first version (R-038: no personal flow/PII); ``渠道``
    (channel) is a pure label with no hierarchy/commission (R-039).
    """

    DIRECT_PURCHASE = "direct_purchase"
    INDIVIDUAL = "individual"
    CHANNEL = "channel"


class ContactabilityStatus(StrEnum):
    AVAILABLE = "available"
    NOT_YET_OBTAINED = "not_yet_obtained"
    NOT_PROVIDED_OR_NOT_STORABLE = "not_provided_or_not_storable"


# R-029 (DEC-0080): write-time communication-method category vocabulary.
# The category is stored as a 【category】 prefix on the free-text
# ``interaction_method`` column (no schema column exists for it and no new
# migration is authorized this task); the free text remains the owner's
# work-necessary detail and is what gets displayed.
METHOD_CATEGORIES = frozenset({"电话", "微信", "面谈", "邮件", "其他"})


def compose_stored_interaction_method(
    category: str | None,
    free_text: str,
) -> str:
    """Compose the stored ``interaction_method`` value from an optional
    category and the free-text detail.

    ``category`` must be a member of METHOD_CATEGORIES (or None). The
    【category】 prefix is the persistence encoding; display code splits it
    back via ``split_stored_interaction_method``.
    """
    if category is None:
        return free_text
    if category not in METHOD_CATEGORIES:
        raise DomainValidationError(
            f"communication method category must be one of {sorted(METHOD_CATEGORIES)}"
        )
    return f"【{category}】{free_text or ''}"


def split_stored_interaction_method(value: str) -> tuple[str | None, str]:
    """Split a stored ``interaction_method`` into (category, free_text).

    Values without a valid 【category】 prefix yield (None, value) — legacy
    and category-less data stay unchanged.
    """
    if value:
        for category in METHOD_CATEGORIES:
            prefix = f"【{category}】"
            if value.startswith(prefix):
                return category, value[len(prefix):]
    return None, value


class AiReviewStatus(StrEnum):
    NOT_REQUESTED = "not_requested"
    UNAVAILABLE = "unavailable"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class ContentAttribution(StrEnum):
    SALESPERSON_INPUT = "salesperson_input"
    SALESPERSON_CONFIRMED_AI = "salesperson_confirmed_ai"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _required(value: str, label: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise DomainValidationError(f"{label} is required")
    return normalized


def _optional(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _aware(value: datetime, label: str) -> datetime:
    # MySQL DATETIME 读取为 naive；本仓约定库内一律存 UTC 墙钟（PG timestamptz 时代
    # 由驱动原生返回 aware），故对 naive 值按 UTC 收编而非拒绝（业主原则：不匹配改代码）。
    if value.tzinfo is None or value.utcoffset() is None:
        return value.replace(tzinfo=timezone.utc)
    return value


@dataclass(frozen=True, slots=True)
class UserIdentity:
    username: str
    display_name: str
    password_hash: str
    status: UserStatus = UserStatus.PENDING
    id: UUID = field(default_factory=uuid4)
    session_epoch: int = 0
    phone: str | None = None
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)

    def __post_init__(self) -> None:
        object.__setattr__(self, "username", _required(self.username, "username").casefold())
        object.__setattr__(self, "display_name", _required(self.display_name, "display name"))
        object.__setattr__(self, "phone", _optional(self.phone))
        if not self.password_hash.startswith("$argon2id$"):
            raise DomainValidationError("passwords must be represented by an Argon2id hash")
        if self.session_epoch < 0:
            raise DomainValidationError("session epoch cannot be negative")
        _aware(self.created_at, "created_at")
        _aware(self.updated_at, "updated_at")


@dataclass(frozen=True, slots=True)
class RoleGrant:
    user_id: UUID
    role: Role
    granted_by_user_id: UUID
    reason: str
    scope_reference: str | None = None
    id: UUID = field(default_factory=uuid4)
    granted_at: datetime = field(default_factory=utc_now)

    def __post_init__(self) -> None:
        object.__setattr__(self, "reason", _required(self.reason, "grant reason"))
        object.__setattr__(self, "scope_reference", _optional(self.scope_reference))
        if self.role is Role.MANAGER and self.scope_reference is None:
            raise DomainValidationError("manager role requires an explicit scope")
        _aware(self.granted_at, "granted_at")


@dataclass(frozen=True, slots=True)
class Institution:
    name: str
    source_description: str
    customer_type: CustomerType
    created_by_user_id: UUID
    idempotency_key: str
    owner_user_id: UUID | None = None
    custodian_user_id: UUID | None = None
    amount: float | None = None
    in_pool: bool = False
    category: str | None = None
    region: str | None = None
    source_kind: str | None = None
    source_evidence_reference: str | None = None
    id: UUID = field(default_factory=uuid4)
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)

    def __post_init__(self) -> None:
        object.__setattr__(self, "name", _required(self.name, "institution name"))
        object.__setattr__(
            self,
            "source_description",
            _required(self.source_description, "source description"),
        )
        object.__setattr__(self, "idempotency_key", _required(self.idempotency_key, "idempotency key"))
        # R-040 (SPEC-0001 v0.8.0): a record is in the public pool iff it has
        # no owner; the explicit in_pool marker must agree with owner state.
        if self.in_pool != (self.owner_user_id is None):
            raise DomainValidationError("in_pool state must match owner presence")
        for attribute in ("category", "region", "source_kind", "source_evidence_reference"):
            object.__setattr__(self, attribute, _optional(getattr(self, attribute)))
        _aware(self.created_at, "created_at")
        _aware(self.updated_at, "updated_at")


@dataclass(frozen=True, slots=True)
class Contact:
    institution_id: UUID
    created_by_user_id: UUID
    contactability_status: ContactabilityStatus
    idempotency_key: str
    name: str | None = None
    role_label: str | None = None
    job_title: str | None = None
    phone: str | None = None
    email: str | None = None
    wechat: str | None = None
    other_channel: str | None = None
    channel_notes: str | None = None
    id: UUID = field(default_factory=uuid4)
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)

    def __post_init__(self) -> None:
        for attribute in (
            "name",
            "role_label",
            "job_title",
            "phone",
            "email",
            "wechat",
            "other_channel",
            "channel_notes",
        ):
            object.__setattr__(self, attribute, _optional(getattr(self, attribute)))
        object.__setattr__(self, "idempotency_key", _required(self.idempotency_key, "idempotency key"))
        if self.name is None and self.role_label is None:
            raise DomainValidationError("a contact needs a name or identifiable role")
        channels = (self.phone, self.email, self.wechat, self.other_channel)
        if self.contactability_status is ContactabilityStatus.AVAILABLE and not any(channels):
            raise DomainValidationError("available contact status requires a storable channel")
        if self.contactability_status is not ContactabilityStatus.AVAILABLE and any(channels):
            raise DomainValidationError("channel values require available contact status")
        _aware(self.created_at, "created_at")
        _aware(self.updated_at, "updated_at")


@dataclass(frozen=True, slots=True)
class FollowUpActivity:
    institution_id: UUID
    recorded_by_user_id: UUID
    occurred_at: datetime
    interaction_method: str
    factual_body: str
    idempotency_key: str
    participants: str | None = None
    customer_needs: str | None = None
    decision_participants: str | None = None
    objections_constraints: str | None = None
    commitments: str | None = None
    next_action: str | None = None
    next_action_owner_user_id: UUID | None = None
    next_action_target_date: date | None = None
    facts_to_verify: str | None = None
    evidence_reference: str | None = None
    shared_summary: str | None = None
    content_attribution: ContentAttribution = ContentAttribution.SALESPERSON_INPUT
    ai_review_status: AiReviewStatus = AiReviewStatus.UNAVAILABLE
    id: UUID = field(default_factory=uuid4)
    recorded_at: datetime = field(default_factory=utc_now)

    def __post_init__(self) -> None:
        object.__setattr__(self, "interaction_method", _required(self.interaction_method, "interaction method"))
        object.__setattr__(self, "factual_body", _required(self.factual_body, "factual body"))
        object.__setattr__(self, "idempotency_key", _required(self.idempotency_key, "idempotency key"))
        for attribute in (
            "participants",
            "customer_needs",
            "decision_participants",
            "objections_constraints",
            "commitments",
            "next_action",
            "facts_to_verify",
            "evidence_reference",
            "shared_summary",
        ):
            object.__setattr__(self, attribute, _optional(getattr(self, attribute)))
        if self.next_action is None:
            if self.next_action_owner_user_id is not None or self.next_action_target_date is not None:
                raise DomainValidationError("next-action owner or date requires next-action content")
        elif self.next_action_owner_user_id is None:
            raise DomainValidationError("next-action content requires an owner")
        _aware(self.occurred_at, "occurred_at")
        _aware(self.recorded_at, "recorded_at")
