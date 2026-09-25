"""Create the authorized identity and manual CRM fact schema."""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0001_initial_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_identities",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("username", sa.String(64), nullable=False),
        sa.Column("display_name", sa.String(160), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("session_epoch", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("status IN ('pending','enabled','disabled')", name="ck_user_identities_user_status"),
        sa.CheckConstraint("session_epoch >= 0", name="ck_user_identities_session_epoch_nonnegative"),
        sa.CheckConstraint("password_hash LIKE '$argon2id$%'", name="ck_user_identities_argon2id_hash"),
        sa.PrimaryKeyConstraint("id", name="pk_user_identities"),
    )
    op.create_index("uq_user_identities_username_ci", "user_identities", [sa.text("lower(username)")], unique=True)

    op.create_table(
        "role_grants",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("role", sa.String(32), nullable=False),
        sa.Column("scope_reference", sa.String(160)),
        sa.Column("granted_by_user_id", sa.Uuid(), nullable=False),
        sa.Column("granted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("revoked_by_user_id", sa.Uuid()),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.Column("revocation_reason", sa.Text()),
        sa.CheckConstraint("role IN ('business_user','administrator','general_manager','manager')", name="ck_role_grants_role_value"),
        sa.CheckConstraint("role <> 'manager' OR scope_reference IS NOT NULL", name="ck_role_grants_manager_scope_required"),
        sa.CheckConstraint("(revoked_at IS NULL AND revoked_by_user_id IS NULL AND revocation_reason IS NULL) OR (revoked_at IS NOT NULL AND revoked_by_user_id IS NOT NULL AND revocation_reason IS NOT NULL)", name="ck_role_grants_revocation_complete"),
        sa.ForeignKeyConstraint(["granted_by_user_id"], ["user_identities.id"], name="fk_role_grants_granted_by_user_id_user_identities", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["revoked_by_user_id"], ["user_identities.id"], name="fk_role_grants_revoked_by_user_id_user_identities", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["user_id"], ["user_identities.id"], name="fk_role_grants_user_id_user_identities", ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name="pk_role_grants"),
    )

    op.create_table(
        "institutions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(240), nullable=False),
        sa.Column("source_description", sa.Text(), nullable=False),
        sa.Column("source_kind", sa.String(64)),
        sa.Column("category", sa.String(120)),
        sa.Column("region", sa.String(160)),
        sa.Column("source_evidence_reference", sa.Text()),
        sa.Column("owner_user_id", sa.Uuid(), nullable=False),
        sa.Column("created_by_user_id", sa.Uuid(), nullable=False),
        sa.Column("idempotency_key", sa.String(128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True)),
        sa.Column("archive_reason", sa.Text()),
        sa.CheckConstraint("char_length(btrim(name)) > 0", name="ck_institutions_name_not_blank"),
        sa.CheckConstraint("char_length(btrim(source_description)) > 0", name="ck_institutions_source_not_blank"),
        sa.CheckConstraint("(archived_at IS NULL AND archive_reason IS NULL) OR (archived_at IS NOT NULL AND archive_reason IS NOT NULL)", name="ck_institutions_archive_complete"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["user_identities.id"], name="fk_institutions_created_by_user_id_user_identities", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["owner_user_id"], ["user_identities.id"], name="fk_institutions_owner_user_id_user_identities", ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name="pk_institutions"),
        sa.UniqueConstraint("created_by_user_id", "idempotency_key", name="uq_institutions_creator_submission"),
    )
    op.create_index("ix_institutions_owner", "institutions", ["owner_user_id"])

    op.create_table(
        "institution_owner_history",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("institution_id", sa.Uuid(), nullable=False),
        sa.Column("previous_owner_user_id", sa.Uuid()),
        sa.Column("new_owner_user_id", sa.Uuid(), nullable=False),
        sa.Column("transferred_by_user_id", sa.Uuid(), nullable=False),
        sa.Column("effective_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.CheckConstraint("char_length(btrim(reason)) > 0", name="ck_institution_owner_history_reason_not_blank"),
        sa.ForeignKeyConstraint(["institution_id"], ["institutions.id"], name="fk_owner_history_institution", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["new_owner_user_id"], ["user_identities.id"], name="fk_owner_history_new_owner", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["previous_owner_user_id"], ["user_identities.id"], name="fk_owner_history_previous_owner", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["transferred_by_user_id"], ["user_identities.id"], name="fk_owner_history_transferred_by", ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name="pk_institution_owner_history"),
    )
    op.create_index("ix_institution_owner_history_record_time", "institution_owner_history", ["institution_id", sa.text("effective_at DESC")])

    op.create_table(
        "contacts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("institution_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(160)),
        sa.Column("role_label", sa.String(160)),
        sa.Column("job_title", sa.String(160)),
        sa.Column("contactability_status", sa.String(40), nullable=False),
        sa.Column("phone", sa.String(80)),
        sa.Column("email", sa.String(254)),
        sa.Column("wechat", sa.String(160)),
        sa.Column("other_channel", sa.String(240)),
        sa.Column("channel_notes", sa.Text()),
        sa.Column("created_by_user_id", sa.Uuid(), nullable=False),
        sa.Column("idempotency_key", sa.String(128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True)),
        sa.Column("archive_reason", sa.Text()),
        sa.CheckConstraint("name IS NOT NULL OR role_label IS NOT NULL", name="ck_contacts_identity_present"),
        sa.CheckConstraint("contactability_status IN ('available','not_yet_obtained','not_provided_or_not_storable')", name="ck_contacts_contactability_status"),
        sa.CheckConstraint("(contactability_status = 'available' AND (phone IS NOT NULL OR email IS NOT NULL OR wechat IS NOT NULL OR other_channel IS NOT NULL)) OR (contactability_status <> 'available' AND phone IS NULL AND email IS NULL AND wechat IS NULL AND other_channel IS NULL)", name="ck_contacts_channel_status_matches_values"),
        sa.CheckConstraint("(archived_at IS NULL AND archive_reason IS NULL) OR (archived_at IS NOT NULL AND archive_reason IS NOT NULL)", name="ck_contacts_archive_complete"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["user_identities.id"], name="fk_contacts_created_by_user_id_user_identities", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["institution_id"], ["institutions.id"], name="fk_contacts_institution_id_institutions", ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name="pk_contacts"),
        sa.UniqueConstraint("created_by_user_id", "idempotency_key", name="uq_contacts_creator_submission"),
    )
    op.create_index("ix_contacts_institution", "contacts", ["institution_id"])

    op.create_table(
        "follow_up_activities",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("institution_id", sa.Uuid(), nullable=False),
        sa.Column("recorded_by_user_id", sa.Uuid(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("interaction_method", sa.String(80), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("current_version", sa.Integer(), nullable=False),
        sa.Column("ai_review_status", sa.String(24), nullable=False),
        sa.Column("ai_reviewed_at", sa.DateTime(timezone=True)),
        sa.Column("idempotency_key", sa.String(128), nullable=False),
        sa.Column("withdrawn_at", sa.DateTime(timezone=True)),
        sa.Column("withdrawn_by_user_id", sa.Uuid()),
        sa.Column("withdrawal_reason", sa.Text()),
        sa.CheckConstraint("char_length(btrim(interaction_method)) > 0", name="ck_follow_up_activities_method_not_blank"),
        sa.CheckConstraint("current_version >= 1", name="ck_follow_up_activities_current_version_positive"),
        sa.CheckConstraint("ai_review_status IN ('not_requested','unavailable','completed','failed','skipped')", name="ck_follow_up_activities_ai_review_status"),
        sa.CheckConstraint("(withdrawn_at IS NULL AND withdrawn_by_user_id IS NULL AND withdrawal_reason IS NULL) OR (withdrawn_at IS NOT NULL AND withdrawn_by_user_id IS NOT NULL AND withdrawal_reason IS NOT NULL)", name="ck_follow_up_activities_withdrawal_complete"),
        sa.ForeignKeyConstraint(["institution_id"], ["institutions.id"], name="fk_follow_up_activities_institution_id_institutions", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["recorded_by_user_id"], ["user_identities.id"], name="fk_follow_up_activities_recorded_by_user_id_user_identities", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["withdrawn_by_user_id"], ["user_identities.id"], name="fk_follow_up_activities_withdrawn_by_user_id_user_identities", ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name="pk_follow_up_activities"),
        sa.UniqueConstraint("recorded_by_user_id", "idempotency_key", name="uq_follow_up_activities_recorder_submission"),
    )
    op.execute("CREATE INDEX ix_follow_up_activities_history ON follow_up_activities (institution_id, occurred_at DESC, recorded_at DESC, id DESC)")

    op.create_table(
        "follow_up_activity_revisions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("activity_id", sa.Uuid(), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("factual_body", sa.Text(), nullable=False),
        sa.Column("participants", sa.Text()),
        sa.Column("customer_needs", sa.Text()),
        sa.Column("decision_participants", sa.Text()),
        sa.Column("objections_constraints", sa.Text()),
        sa.Column("commitments", sa.Text()),
        sa.Column("next_action", sa.Text()),
        sa.Column("next_action_owner_user_id", sa.Uuid()),
        sa.Column("next_action_target_date", sa.Date()),
        sa.Column("facts_to_verify", sa.Text()),
        sa.Column("evidence_reference", sa.Text()),
        sa.Column("shared_summary", sa.Text()),
        sa.Column("content_attribution", sa.String(40), nullable=False),
        sa.Column("created_by_user_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("change_reason", sa.Text()),
        sa.CheckConstraint("version_number >= 1", name="ck_follow_up_activity_revisions_version_positive"),
        sa.CheckConstraint("char_length(btrim(factual_body)) > 0", name="ck_follow_up_activity_revisions_body_not_blank"),
        sa.CheckConstraint("content_attribution IN ('salesperson_input','salesperson_confirmed_ai')", name="ck_follow_up_activity_revisions_content_attribution"),
        sa.CheckConstraint("(next_action IS NULL AND next_action_owner_user_id IS NULL AND next_action_target_date IS NULL) OR (next_action IS NOT NULL AND char_length(btrim(next_action)) > 0 AND next_action_owner_user_id IS NOT NULL)", name="ck_follow_up_activity_revisions_next_action_complete"),
        sa.ForeignKeyConstraint(["activity_id"], ["follow_up_activities.id"], name="fk_activity_revisions_activity", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["user_identities.id"], name="fk_activity_revisions_created_by", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["next_action_owner_user_id"], ["user_identities.id"], name="fk_activity_revisions_next_owner", ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name="pk_follow_up_activity_revisions"),
        sa.UniqueConstraint("activity_id", "version_number", name="uq_follow_up_activity_revision_version"),
    )
    op.create_index("ix_follow_up_activity_revisions_activity", "follow_up_activity_revisions", ["activity_id", "version_number"])

    op.create_table(
        "audit_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("actor_user_id", sa.Uuid()),
        sa.Column("action", sa.String(120), nullable=False),
        sa.Column("target_type", sa.String(80), nullable=False),
        sa.Column("target_id", sa.Uuid()),
        sa.Column("outcome", sa.String(16), nullable=False),
        sa.Column("reason", sa.Text()),
        sa.Column("before_state", sa.JSON()),
        sa.Column("after_state", sa.JSON()),
        sa.Column("failure_summary", sa.Text()),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("outcome IN ('success','denied','failure')", name="ck_audit_events_outcome_value"),
        sa.CheckConstraint("char_length(btrim(action)) > 0", name="ck_audit_events_action_not_blank"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["user_identities.id"], name="fk_audit_events_actor_user_id_user_identities", ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name="pk_audit_events"),
    )
    op.create_index("ix_audit_events_target_time", "audit_events", ["target_type", "target_id", sa.text("occurred_at DESC")])
    op.create_index("ix_audit_events_actor_time", "audit_events", ["actor_user_id", sa.text("occurred_at DESC")])

    op.create_table(
        "server_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_token_hash", sa.String(64), nullable=False),
        sa.Column("csrf_token_hash", sa.String(64), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("user_session_epoch", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("invalidated_at", sa.DateTime(timezone=True)),
        sa.Column("invalidation_reason", sa.Text()),
        sa.CheckConstraint("user_session_epoch >= 0", name="ck_server_sessions_session_epoch_nonnegative"),
        sa.CheckConstraint("expires_at > created_at", name="ck_server_sessions_expiry_after_creation"),
        sa.CheckConstraint("(invalidated_at IS NULL AND invalidation_reason IS NULL) OR (invalidated_at IS NOT NULL AND invalidation_reason IS NOT NULL)", name="ck_server_sessions_invalidation_complete"),
        sa.ForeignKeyConstraint(["user_id"], ["user_identities.id"], name="fk_server_sessions_user_id_user_identities", ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name="pk_server_sessions"),
        sa.UniqueConstraint("session_token_hash", name="uq_server_sessions_session_token_hash"),
    )
    op.create_index("ix_server_sessions_user_expiry", "server_sessions", ["user_id", "expires_at"])


def downgrade() -> None:
    op.drop_index("ix_server_sessions_user_expiry", table_name="server_sessions")
    op.drop_table("server_sessions")
    op.drop_index("ix_audit_events_actor_time", table_name="audit_events")
    op.drop_index("ix_audit_events_target_time", table_name="audit_events")
    op.drop_table("audit_events")
    op.drop_index("ix_follow_up_activity_revisions_activity", table_name="follow_up_activity_revisions")
    op.drop_table("follow_up_activity_revisions")
    op.drop_index("ix_follow_up_activities_history", table_name="follow_up_activities")
    op.drop_table("follow_up_activities")
    op.drop_index("ix_contacts_institution", table_name="contacts")
    op.drop_table("contacts")
    op.drop_index("ix_institution_owner_history_record_time", table_name="institution_owner_history")
    op.drop_table("institution_owner_history")
    op.drop_index("ix_institutions_owner", table_name="institutions")
    op.drop_table("institutions")
    op.drop_table("role_grants")
    op.drop_index("uq_user_identities_username_ci", table_name="user_identities")
    op.drop_table("user_identities")
