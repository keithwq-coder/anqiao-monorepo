"""SQLAlchemy mappings for identity, CRM facts, history, audit, and sessions."""

from datetime import date, datetime
from typing import Any
from uuid import UUID, uuid4

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from crm.domain.models import utc_now
from crm.persistence.base import Base


UUID_TYPE = sa.Uuid(as_uuid=True, native_uuid=True)
TZ_DATETIME = sa.DateTime(timezone=True)


class UserIdentityModel(Base):
    __tablename__ = "user_identities"
    __table_args__ = (
        sa.CheckConstraint("status IN ('pending','enabled','disabled')", name="user_status"),
        sa.CheckConstraint("session_epoch >= 0", name="session_epoch_nonnegative"),
        sa.CheckConstraint("password_hash LIKE '$argon2id$%'", name="argon2id_hash"),
        sa.Index("uq_user_identities_username_ci", sa.func.lower(sa.column("username")), unique=True),
    )

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    username: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    display_name: Mapped[str] = mapped_column(sa.String(160), nullable=False)
    password_hash: Mapped[str] = mapped_column(sa.Text, nullable=False)
    status: Mapped[str] = mapped_column(sa.String(16), nullable=False, default="pending")
    session_epoch: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=0)
    phone: Mapped[str | None] = mapped_column(sa.String(80))
    created_at: Mapped[datetime] = mapped_column(TZ_DATETIME, nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(TZ_DATETIME, nullable=False, default=utc_now, onupdate=utc_now)


class RoleGrantModel(Base):
    __tablename__ = "role_grants"
    __table_args__ = (
        sa.CheckConstraint(
            "role IN ('business_user','administrator','manager','shareholder')",
            name="role_value",
        ),
        sa.CheckConstraint(
            "role <> 'manager' OR scope_reference IS NOT NULL",
            name="manager_scope_required",
        ),
        sa.CheckConstraint(
            "(revoked_at IS NULL AND revoked_by_user_id IS NULL AND revocation_reason IS NULL) "
            "OR (revoked_at IS NOT NULL AND revoked_by_user_id IS NOT NULL "
            "AND revocation_reason IS NOT NULL)",
            name="revocation_complete",
        ),
    )

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(sa.ForeignKey("user_identities.id", ondelete="RESTRICT"), nullable=False)
    role: Mapped[str] = mapped_column(sa.String(32), nullable=False)
    scope_reference: Mapped[str | None] = mapped_column(sa.String(160))
    granted_by_user_id: Mapped[UUID] = mapped_column(sa.ForeignKey("user_identities.id", ondelete="RESTRICT"), nullable=False)
    granted_at: Mapped[datetime] = mapped_column(TZ_DATETIME, nullable=False, default=utc_now)
    reason: Mapped[str] = mapped_column(sa.Text, nullable=False)
    revoked_by_user_id: Mapped[UUID | None] = mapped_column(sa.ForeignKey("user_identities.id", ondelete="RESTRICT"))
    revoked_at: Mapped[datetime | None] = mapped_column(TZ_DATETIME)
    revocation_reason: Mapped[str | None] = mapped_column(sa.Text)


class InstitutionModel(Base):
    __tablename__ = "institutions"
    __table_args__ = (
        sa.CheckConstraint("char_length(btrim(name)) > 0", name="name_not_blank"),
        sa.CheckConstraint("char_length(btrim(source_description)) > 0", name="source_not_blank"),
        sa.CheckConstraint(
            "customer_type IN ('direct_purchase','individual','channel')",
            name="customer_type_value",
        ),
        sa.CheckConstraint(
            "(in_pool AND owner_user_id IS NULL) OR (NOT in_pool AND owner_user_id IS NOT NULL)",
            name="pool_state_consistent",
        ),
        sa.CheckConstraint(
            "(archived_at IS NULL AND archive_reason IS NULL) "
            "OR (archived_at IS NOT NULL)",
            name="archive_complete",
        ),
        sa.UniqueConstraint("created_by_user_id", "idempotency_key", name="uq_institutions_creator_submission"),
        sa.Index("ix_institutions_owner", "owner_user_id"),
        sa.Index("ix_institutions_custodian", "custodian_user_id"),
    )

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(sa.String(240), nullable=False)
    source_description: Mapped[str] = mapped_column(sa.Text, nullable=False)
    customer_type: Mapped[str] = mapped_column(sa.String(32), nullable=False, default="direct_purchase")
    source_kind: Mapped[str | None] = mapped_column(sa.String(64))
    category: Mapped[str | None] = mapped_column(sa.String(120))
    region: Mapped[str | None] = mapped_column(sa.String(160))
    source_evidence_reference: Mapped[str | None] = mapped_column(sa.Text)
    owner_user_id: Mapped[UUID | None] = mapped_column(sa.ForeignKey("user_identities.id", ondelete="RESTRICT"))
    custodian_user_id: Mapped[UUID | None] = mapped_column(sa.ForeignKey("user_identities.id", ondelete="RESTRICT"), nullable=True)
    amount: Mapped[float | None] = mapped_column(sa.Numeric(15, 2), nullable=True)
    in_pool: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, default=False)
    created_by_user_id: Mapped[UUID] = mapped_column(sa.ForeignKey("user_identities.id", ondelete="RESTRICT"), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(sa.String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TZ_DATETIME, nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(TZ_DATETIME, nullable=False, default=utc_now, onupdate=utc_now)
    archived_at: Mapped[datetime | None] = mapped_column(TZ_DATETIME)
    archive_reason: Mapped[str | None] = mapped_column(sa.Text)


class InstitutionOwnerHistoryModel(Base):
    __tablename__ = "institution_owner_history"
    __table_args__ = (
        sa.Index("ix_institution_owner_history_record_time", "institution_id", sa.text("effective_at DESC")),
    )

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    institution_id: Mapped[UUID] = mapped_column(
        sa.ForeignKey(
            "institutions.id",
            name="fk_owner_history_institution",
            ondelete="RESTRICT",
        ),
        nullable=False,
    )
    previous_owner_user_id: Mapped[UUID | None] = mapped_column(
        sa.ForeignKey(
            "user_identities.id",
            name="fk_owner_history_previous_owner",
            ondelete="RESTRICT",
        )
    )
    new_owner_user_id: Mapped[UUID | None] = mapped_column(
        sa.ForeignKey(
            "user_identities.id",
            name="fk_owner_history_new_owner",
            ondelete="RESTRICT",
        )
    )
    transferred_by_user_id: Mapped[UUID] = mapped_column(
        sa.ForeignKey(
            "user_identities.id",
            name="fk_owner_history_transferred_by",
            ondelete="RESTRICT",
        ),
        nullable=False,
    )
    effective_at: Mapped[datetime] = mapped_column(TZ_DATETIME, nullable=False, default=utc_now)
    reason: Mapped[str | None] = mapped_column(sa.Text)


class ContactModel(Base):
    __tablename__ = "contacts"
    __table_args__ = (
        sa.CheckConstraint("name IS NOT NULL OR role_label IS NOT NULL", name="identity_present"),
        sa.CheckConstraint(
            "contactability_status IN "
            "('available','not_yet_obtained','not_provided_or_not_storable')",
            name="contactability_status",
        ),
        sa.CheckConstraint(
            "(contactability_status = 'available' AND "
            "(phone IS NOT NULL OR email IS NOT NULL OR wechat IS NOT NULL OR other_channel IS NOT NULL)) "
            "OR (contactability_status <> 'available' AND phone IS NULL AND email IS NULL "
            "AND wechat IS NULL AND other_channel IS NULL)",
            name="channel_status_matches_values",
        ),
        sa.CheckConstraint(
            "(archived_at IS NULL AND archive_reason IS NULL) "
            "OR (archived_at IS NOT NULL AND archive_reason IS NOT NULL)",
            name="archive_complete",
        ),
        sa.UniqueConstraint("created_by_user_id", "idempotency_key", name="uq_contacts_creator_submission"),
        sa.Index("ix_contacts_institution", "institution_id"),
    )

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    institution_id: Mapped[UUID] = mapped_column(sa.ForeignKey("institutions.id", ondelete="RESTRICT"), nullable=False)
    name: Mapped[str | None] = mapped_column(sa.String(160))
    role_label: Mapped[str | None] = mapped_column(sa.String(160))
    job_title: Mapped[str | None] = mapped_column(sa.String(160))
    contactability_status: Mapped[str] = mapped_column(sa.String(40), nullable=False)
    phone: Mapped[str | None] = mapped_column(sa.String(80))
    email: Mapped[str | None] = mapped_column(sa.String(254))
    wechat: Mapped[str | None] = mapped_column(sa.String(160))
    other_channel: Mapped[str | None] = mapped_column(sa.String(240))
    channel_notes: Mapped[str | None] = mapped_column(sa.Text)
    created_by_user_id: Mapped[UUID] = mapped_column(sa.ForeignKey("user_identities.id", ondelete="RESTRICT"), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(sa.String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TZ_DATETIME, nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(TZ_DATETIME, nullable=False, default=utc_now, onupdate=utc_now)
    archived_at: Mapped[datetime | None] = mapped_column(TZ_DATETIME)
    archive_reason: Mapped[str | None] = mapped_column(sa.Text)


class FollowUpActivityModel(Base):
    __tablename__ = "follow_up_activities"
    __table_args__ = (
        sa.CheckConstraint("char_length(btrim(interaction_method)) > 0", name="method_not_blank"),
        sa.CheckConstraint("current_version >= 1", name="current_version_positive"),
        sa.CheckConstraint(
            "ai_review_status IN ('not_requested','unavailable','completed','failed','skipped')",
            name="ai_review_status",
        ),
        sa.CheckConstraint(
            "(withdrawn_at IS NULL AND withdrawn_by_user_id IS NULL AND withdrawal_reason IS NULL) "
            "OR (withdrawn_at IS NOT NULL AND withdrawn_by_user_id IS NOT NULL "
            "AND withdrawal_reason IS NOT NULL)",
            name="withdrawal_complete",
        ),
        sa.UniqueConstraint("recorded_by_user_id", "idempotency_key", name="uq_follow_up_activities_recorder_submission"),
        sa.Index(
            "ix_follow_up_activities_history",
            "institution_id",
            sa.text("occurred_at DESC"),
            sa.text("recorded_at DESC"),
            sa.text("id DESC"),
        ),
    )

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    institution_id: Mapped[UUID] = mapped_column(sa.ForeignKey("institutions.id", ondelete="RESTRICT"), nullable=False)
    recorded_by_user_id: Mapped[UUID] = mapped_column(sa.ForeignKey("user_identities.id", ondelete="RESTRICT"), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(TZ_DATETIME, nullable=False)
    interaction_method: Mapped[str] = mapped_column(sa.String(80), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(TZ_DATETIME, nullable=False, default=utc_now)
    current_version: Mapped[int] = mapped_column(sa.Integer, nullable=False, default=1)
    ai_review_status: Mapped[str] = mapped_column(sa.String(24), nullable=False, default="unavailable")
    ai_reviewed_at: Mapped[datetime | None] = mapped_column(TZ_DATETIME)
    idempotency_key: Mapped[str] = mapped_column(sa.String(128), nullable=False)
    withdrawn_at: Mapped[datetime | None] = mapped_column(TZ_DATETIME)
    withdrawn_by_user_id: Mapped[UUID | None] = mapped_column(sa.ForeignKey("user_identities.id", ondelete="RESTRICT"))
    withdrawal_reason: Mapped[str | None] = mapped_column(sa.Text)


class FollowUpActivityRevisionModel(Base):
    __tablename__ = "follow_up_activity_revisions"
    __table_args__ = (
        sa.CheckConstraint("version_number >= 1", name="version_positive"),
        sa.CheckConstraint("char_length(btrim(factual_body)) > 0", name="body_not_blank"),
        sa.CheckConstraint(
            "content_attribution IN ('salesperson_input','salesperson_confirmed_ai')",
            name="content_attribution",
        ),
        sa.CheckConstraint(
            "(next_action IS NULL AND next_action_owner_user_id IS NULL "
            "AND next_action_target_date IS NULL) OR "
            "(next_action IS NOT NULL AND char_length(btrim(next_action)) > 0 "
            "AND next_action_owner_user_id IS NOT NULL)",
            name="next_action_complete",
        ),
        sa.UniqueConstraint("activity_id", "version_number", name="uq_follow_up_activity_revision_version"),
        sa.Index("ix_follow_up_activity_revisions_activity", "activity_id", "version_number"),
    )

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    activity_id: Mapped[UUID] = mapped_column(
        sa.ForeignKey(
            "follow_up_activities.id",
            name="fk_activity_revisions_activity",
            ondelete="RESTRICT",
        ),
        nullable=False,
    )
    version_number: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    factual_body: Mapped[str] = mapped_column(sa.Text, nullable=False)
    participants: Mapped[str | None] = mapped_column(sa.Text)
    customer_needs: Mapped[str | None] = mapped_column(sa.Text)
    decision_participants: Mapped[str | None] = mapped_column(sa.Text)
    objections_constraints: Mapped[str | None] = mapped_column(sa.Text)
    commitments: Mapped[str | None] = mapped_column(sa.Text)
    next_action: Mapped[str | None] = mapped_column(sa.Text)
    next_action_owner_user_id: Mapped[UUID | None] = mapped_column(
        sa.ForeignKey(
            "user_identities.id",
            name="fk_activity_revisions_next_owner",
            ondelete="RESTRICT",
        )
    )
    next_action_target_date: Mapped[date | None] = mapped_column(sa.Date)
    facts_to_verify: Mapped[str | None] = mapped_column(sa.Text)
    evidence_reference: Mapped[str | None] = mapped_column(sa.Text)
    shared_summary: Mapped[str | None] = mapped_column(sa.Text)
    content_attribution: Mapped[str] = mapped_column(sa.String(40), nullable=False, default="salesperson_input")
    created_by_user_id: Mapped[UUID] = mapped_column(
        sa.ForeignKey(
            "user_identities.id",
            name="fk_activity_revisions_created_by",
            ondelete="RESTRICT",
        ),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(TZ_DATETIME, nullable=False, default=utc_now)
    change_reason: Mapped[str | None] = mapped_column(sa.Text)


class AuditEventModel(Base):
    __tablename__ = "audit_events"
    __table_args__ = (
        sa.CheckConstraint("outcome IN ('success','denied','failure')", name="outcome_value"),
        sa.CheckConstraint("char_length(btrim(action)) > 0", name="action_not_blank"),
        sa.Index("ix_audit_events_target_time", "target_type", "target_id", sa.text("occurred_at DESC")),
        sa.Index("ix_audit_events_actor_time", "actor_user_id", sa.text("occurred_at DESC")),
    )

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    actor_user_id: Mapped[UUID | None] = mapped_column(sa.ForeignKey("user_identities.id", ondelete="RESTRICT"))
    action: Mapped[str] = mapped_column(sa.String(120), nullable=False)
    target_type: Mapped[str] = mapped_column(sa.String(80), nullable=False)
    target_id: Mapped[UUID | None] = mapped_column(UUID_TYPE)
    outcome: Mapped[str] = mapped_column(sa.String(16), nullable=False)
    reason: Mapped[str | None] = mapped_column(sa.Text)
    before_state: Mapped[dict[str, Any] | None] = mapped_column(sa.JSON)
    after_state: Mapped[dict[str, Any] | None] = mapped_column(sa.JSON)
    failure_summary: Mapped[str | None] = mapped_column(sa.Text)
    occurred_at: Mapped[datetime] = mapped_column(TZ_DATETIME, nullable=False, default=utc_now)


class ServerSessionModel(Base):
    __tablename__ = "server_sessions"
    __table_args__ = (
        sa.CheckConstraint("user_session_epoch >= 0", name="session_epoch_nonnegative"),
        sa.CheckConstraint("expires_at > created_at", name="expiry_after_creation"),
        sa.CheckConstraint(
            "(invalidated_at IS NULL AND invalidation_reason IS NULL) "
            "OR (invalidated_at IS NOT NULL AND invalidation_reason IS NOT NULL)",
            name="invalidation_complete",
        ),
        sa.Index("ix_server_sessions_user_expiry", "user_id", "expires_at"),
    )

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    session_token_hash: Mapped[str] = mapped_column(sa.String(64), nullable=False, unique=True)
    csrf_token_hash: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    user_id: Mapped[UUID] = mapped_column(sa.ForeignKey("user_identities.id", ondelete="RESTRICT"), nullable=False)
    user_session_epoch: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TZ_DATETIME, nullable=False, default=utc_now)
    expires_at: Mapped[datetime] = mapped_column(TZ_DATETIME, nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(TZ_DATETIME, nullable=False, default=utc_now)
    invalidated_at: Mapped[datetime | None] = mapped_column(TZ_DATETIME)
    invalidation_reason: Mapped[str | None] = mapped_column(sa.Text)


class ErasureRecordModel(Base):
    """TASK-0017 (SPEC-0011): permanent erasure record.

    Records who erased what, when, why, and the backup propagation status.
    Never stores deleted personal values (R-004). The ``propagate_by``
    deadline is erased_at + 30 days (DEC-0104 Decision 2).
    """

    __tablename__ = "erasure_records"
    __table_args__ = (
        sa.CheckConstraint("char_length(btrim(erasure_reason)) > 0", name="erasure_reason_not_blank"),
        sa.CheckConstraint("propagate_by > erased_at", name="propagate_after_erasure"),
        sa.CheckConstraint(
            "propagation_status IN ('pending','verified','incomplete')",
            name="propagation_status_value",
        ),
        sa.CheckConstraint(
            "(propagation_verified_at IS NULL AND propagation_status = 'pending') "
            "OR (propagation_verified_at IS NOT NULL AND propagation_status <> 'pending')",
            name="propagation_verified_complete",
        ),
        sa.CheckConstraint(
            "target_type IN ('institution','contact')",
            name="erasure_target_type",
        ),
        sa.Index("ix_erasure_records_target", "target_type", "target_id"),
        sa.Index("ix_erasure_records_propagate_by", "propagate_by"),
    )

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    target_type: Mapped[str] = mapped_column(sa.String(80), nullable=False)
    target_id: Mapped[UUID] = mapped_column(UUID_TYPE, nullable=False)
    erased_by_user_id: Mapped[UUID] = mapped_column(
        sa.ForeignKey("user_identities.id", ondelete="RESTRICT"), nullable=False
    )
    erasure_reason: Mapped[str] = mapped_column(sa.Text, nullable=False)
    erasure_scope: Mapped[str] = mapped_column(sa.Text, nullable=False)
    erased_at: Mapped[datetime] = mapped_column(TZ_DATETIME, nullable=False, default=utc_now)
    propagate_by: Mapped[datetime] = mapped_column(TZ_DATETIME, nullable=False)
    propagation_status: Mapped[str] = mapped_column(sa.String(24), nullable=False, default="pending")
    propagation_verified_at: Mapped[datetime | None] = mapped_column(TZ_DATETIME)
    is_request_fulfillment: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, default=False)
    request_reference: Mapped[str | None] = mapped_column(sa.Text)


class ImportBatchModel(Base):
    """TASK-0011 (SPEC-0013): one durable import batch.

    Records the importer, source file reference (name + content SHA-256
    fingerprint used for idempotent rerun), per-outcome counts, and batch
    status. ``status`` is ``active`` until an administrator undoes the
    batch, after which the complete undo triple is written. The
    (imported_by_user_id, source_file_sha256) unique index enforces
    idempotent rerun (AC-004): a second run with the same fingerprint
    returns the existing batch without re-importing rows.
    """

    __tablename__ = "import_batches"
    __table_args__ = (
        sa.CheckConstraint(
            "char_length(btrim(source_file_name)) > 0",
            name="source_file_name_not_blank",
        ),
        sa.CheckConstraint(
            "char_length(source_file_sha256) = 64",
            name="source_file_sha256_len64",
        ),
        sa.CheckConstraint("row_count >= 0", name="row_count_nonnegative"),
        sa.CheckConstraint("imported_count >= 0", name="imported_count_nonnegative"),
        sa.CheckConstraint("duplicate_count >= 0", name="duplicate_count_nonnegative"),
        sa.CheckConstraint("failed_count >= 0", name="failed_count_nonnegative"),
        sa.CheckConstraint(
            "imported_count + duplicate_count + failed_count = row_count",
            name="counts_sum_to_row_count",
        ),
        sa.CheckConstraint("status IN ('active','undone')", name="status_value"),
        sa.CheckConstraint(
            "(undone_at IS NULL AND undone_by_user_id IS NULL AND undo_reason IS NULL) "
            "OR (undone_at IS NOT NULL AND undone_by_user_id IS NOT NULL "
            "AND undo_reason IS NOT NULL)",
            name="undo_complete",
        ),
        sa.UniqueConstraint(
            "imported_by_user_id", "source_file_sha256", name="uq_import_batches_fingerprint"
        ),
        sa.Index("ix_import_batches_status", "status"),
    )

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    imported_by_user_id: Mapped[UUID] = mapped_column(
        sa.ForeignKey("user_identities.id", ondelete="RESTRICT"), nullable=False
    )
    source_file_name: Mapped[str] = mapped_column(sa.String(240), nullable=False)
    source_file_sha256: Mapped[str] = mapped_column(sa.String(64), nullable=False)
    row_count: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    imported_count: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    duplicate_count: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    failed_count: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    status: Mapped[str] = mapped_column(sa.String(24), nullable=False, default="active")
    imported_at: Mapped[datetime] = mapped_column(TZ_DATETIME, nullable=False, default=utc_now)
    undone_at: Mapped[datetime | None] = mapped_column(TZ_DATETIME)
    undone_by_user_id: Mapped[UUID | None] = mapped_column(
        sa.ForeignKey("user_identities.id", ondelete="RESTRICT")
    )
    undo_reason: Mapped[str | None] = mapped_column(sa.Text)


class ImportRowResultModel(Base):
    """TASK-0011 (SPEC-0013): per-row import outcome.

    Each data row of a batch is recorded with its 1-based line number and
    one of three outcomes: ``imported`` (institution created, FK recorded),
    ``flagged_duplicate`` (suspected duplicate of an existing institution,
    FK to the candidate recorded; the record is still imported per trusted
    load — never auto-merged), or ``failed`` (missing required fields or
    other validation error, with a human-readable reason). Failed rows do
    not block valid rows (AC-002, per-row isolation).
    """

    __tablename__ = "import_row_results"
    __table_args__ = (
        sa.CheckConstraint("line_number >= 1", name="line_number_positive"),
        sa.CheckConstraint(
            "outcome IN ('imported','flagged_duplicate','failed')",
            name="outcome_value",
        ),
        sa.CheckConstraint(
            "(outcome = 'imported' AND institution_id IS NOT NULL "
            "AND duplicate_of_institution_id IS NULL) "
            "OR (outcome = 'flagged_duplicate' AND duplicate_of_institution_id IS NOT NULL) "
            "OR (outcome = 'failed')",
            name="outcome_consistency",
        ),
        sa.Index("ix_import_row_results_batch_line", "batch_id", "line_number"),
    )

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    batch_id: Mapped[UUID] = mapped_column(
        sa.ForeignKey("import_batches.id", ondelete="RESTRICT"), nullable=False
    )
    line_number: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    outcome: Mapped[str] = mapped_column(sa.String(24), nullable=False)
    institution_id: Mapped[UUID | None] = mapped_column(
        sa.ForeignKey("institutions.id", ondelete="RESTRICT")
    )
    duplicate_of_institution_id: Mapped[UUID | None] = mapped_column(
        sa.ForeignKey("institutions.id", ondelete="RESTRICT")
    )
    reason: Mapped[str | None] = mapped_column(sa.Text)
    created_at: Mapped[datetime] = mapped_column(TZ_DATETIME, nullable=False, default=utc_now)


class OperationRecordModel(Base):
    """TASK-0018 (SPEC-0012): durable operations audit record.

    Records one backup, restore rehearsal, deletion propagation,
    deployment change, or rollback action. Each record carries the actor,
    action verb, target description, outcome, and a non-secret summary.
    Secrets are never stored: the ``detail_summary`` field holds only
    non-sensitive classification text (R-009/AC-009). The ``outcome`` field
    is fail-closed — a backup, restore, or deletion propagation that could
    not be verified is recorded as ``failed`` or ``unverified``, never
    ``success`` (SPEC-0012 §8, AC-005).
    """

    __tablename__ = "operation_records"
    __table_args__ = (
        sa.CheckConstraint(
            "operation_type IN ('backup','restore','deployment_change','rollback',"
            "'deletion_propagation')",
            name="operation_type_value",
        ),
        sa.CheckConstraint(
            "outcome IN ('success','failed','unverified')",
            name="outcome_value",
        ),
        sa.CheckConstraint("char_length(btrim(action)) > 0", name="action_not_blank"),
        sa.CheckConstraint(
            "char_length(btrim(target_description)) > 0",
            name="target_description_not_blank",
        ),
        sa.CheckConstraint(
            "(completed_at IS NULL AND outcome = 'unverified') "
            "OR (completed_at IS NOT NULL AND outcome <> 'unverified')",
            name="completed_at_consistency",
        ),
        sa.CheckConstraint(
            "(outcome = 'success' AND failure_summary IS NULL) "
            "OR (outcome <> 'success')",
            name="success_has_no_failure_summary",
        ),
        sa.Index("ix_operation_records_type_time", "operation_type", sa.text("occurred_at DESC")),
        sa.Index("ix_operation_records_actor_time", "actor_user_id", sa.text("occurred_at DESC")),
    )

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    operation_type: Mapped[str] = mapped_column(sa.String(40), nullable=False)
    actor_user_id: Mapped[UUID | None] = mapped_column(
        sa.ForeignKey("user_identities.id", ondelete="RESTRICT")
    )
    action: Mapped[str] = mapped_column(sa.String(120), nullable=False)
    target_description: Mapped[str] = mapped_column(sa.Text, nullable=False)
    outcome: Mapped[str] = mapped_column(sa.String(16), nullable=False)
    detail_summary: Mapped[str | None] = mapped_column(sa.Text)
    failure_summary: Mapped[str | None] = mapped_column(sa.Text)
    occurred_at: Mapped[datetime] = mapped_column(TZ_DATETIME, nullable=False, default=utc_now)
    completed_at: Mapped[datetime | None] = mapped_column(TZ_DATETIME)


class OpportunityCandidateModel(Base):
    """SPEC-0003 v0.4.0: one AI-derived business opportunity candidate.

    A candidate is surfaced by an AI (synthetic stub unless OD-006a grants a
    real provider), with a supporting reason; a HUMAN adjudicates it
    (待处理/采纳/忽略) — the AI has no final judgment and never auto-files or
    creates a customer (R-003/R-017). Sources: ``existing_customer`` (involves
    CRM records) or ``crawler`` (external public info, retained 30 days,
    OD-001/DEC-0152). Landings (R-007/R-008): adopting an existing-customer
    hit notifies the record owner; adopting a crawler new subject releases it
    to the public pool. Display never leaks another owner's protected fields
    (R-009/R-010/R-013 hard boundary).
    """

    __tablename__ = "opportunity_candidates"
    __table_args__ = (
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
            name="candidate_source_value",
        ),
        sa.CheckConstraint(
            "status IN ('待处理','采纳','忽略')",
            name="candidate_status_value",
        ),
        sa.CheckConstraint(
            "char_length(btrim(supporting_reason)) > 0",
            name="candidate_reason_not_blank",
        ),
        sa.Index("ix_opportunity_candidates_recipient", "recipient_user_id"),
        sa.Index("ix_opportunity_candidates_expiry", "expires_at"),
    )

    id: Mapped[UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid4)
    recipient_user_id: Mapped[UUID] = mapped_column(UUID_TYPE, nullable=False)
    source: Mapped[str] = mapped_column(sa.String(32), nullable=False)
    status: Mapped[str] = mapped_column(sa.String(16), nullable=False, default="待处理")
    candidate_text: Mapped[str] = mapped_column(sa.Text, nullable=False)
    supporting_reason: Mapped[str] = mapped_column(sa.Text, nullable=False)
    key_uncertainties: Mapped[str] = mapped_column(sa.Text, nullable=False)
    involved_records: Mapped[list | None] = mapped_column(sa.JSON)
    external_subject: Mapped[dict[str, Any] | None] = mapped_column(sa.JSON)
    discovered_at: Mapped[datetime] = mapped_column(TZ_DATETIME, nullable=False, default=utc_now)
    expires_at: Mapped[datetime | None] = mapped_column(TZ_DATETIME)
    read: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, default=False)
    ai_used: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, default=False)
    model_identifier: Mapped[str | None] = mapped_column(sa.String(120))
    adjudicated_at: Mapped[datetime | None] = mapped_column(TZ_DATETIME)
    adjudicated_by_user_id: Mapped[UUID | None] = mapped_column(UUID_TYPE)
