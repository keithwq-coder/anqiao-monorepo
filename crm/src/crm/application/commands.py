"""Commands for creating and modifying business entities.

S4 application commands aligned with S2/S3 domain model.
All validation and authorization flows through the central policy layer (S3).
"""

import sqlalchemy as sa
from datetime import datetime, date, timezone
from typing import Optional
from uuid import UUID, uuid4

from crm.domain.models import (
    METHOD_CATEGORIES,
    UserIdentity,
    Institution,
    Contact,
    FollowUpActivity,
    Role,
    UserStatus,
    ContactabilityStatus,
    ContentAttribution,
    AiReviewStatus,
    CustomerType,
    compose_stored_interaction_method,
)
from crm.policy import project_record, PolicySubject, RecordSnapshot, ActivitySummarySource
from crm.persistence.models import (
    AuditEventModel,
    RoleGrantModel,
    InstitutionModel,
    InstitutionOwnerHistoryModel,
    UserIdentityModel,
)


# ============ Command: Create Institution ============

class CreateInstitutionCommand:
    """Command to create a new institution record."""

    def __init__(
        self,
        name: str,
        source_description: str,
        owner_user_id: UUID,
        created_by_user_id: UUID,
        idempotency_key: str,
        customer_type: CustomerType = CustomerType.DIRECT_PURCHASE,
        category: Optional[str] = None,
        region: Optional[str] = None,
        source_kind: Optional[str] = None,
        source_evidence_reference: Optional[str] = None,
        custodian_user_id: Optional[UUID] = None,
        amount: Optional[float] = None
    ):
        self.name = name
        self.source_description = source_description
        self.owner_user_id = owner_user_id
        self.created_by_user_id = created_by_user_id
        self.idempotency_key = idempotency_key
        self.customer_type = customer_type
        self.category = category
        self.region = region
        self.source_kind = source_kind
        self.source_evidence_reference = source_evidence_reference
        self.custodian_user_id = custodian_user_id
        self.amount = amount

    def validate(self, user: UserIdentity) -> tuple[bool, list[str]]:
        """Validate command data and user permissions."""
        errors = []

        # Validate required fields
        if not self.name or len(self.name.strip()) < 1:
            errors.append("Institution name is required")

        if not self.source_description or len(self.source_description.strip()) < 1:
            errors.append("Source description is required")

        if not self.idempotency_key or len(self.idempotency_key.strip()) < 1:
            errors.append("Idempotency key is required")

        # R-037 (SPEC-0001 v0.8.0): customer type is required and must be one
        # of the three approved labels.
        if not isinstance(self.customer_type, CustomerType):
            errors.append("Customer type is required (direct_purchase/individual/channel)")

        # Validate optional string fields
        if self.category and len(self.category.strip()) > 120:
            errors.append("Category exceeds maximum length of 120 characters")

        if self.region and len(self.region.strip()) > 160:
            errors.append("Region exceeds maximum length of 160 characters")

        # Authentication is enforced by the route layer (Depends(get_current_user));
        # here only account status is validated when a user object is supplied.
        if user is not None and user.status is not UserStatus.ENABLED:
            if user.status is UserStatus.DISABLED:
                errors.append("Account has been disabled")
            else:
                errors.append("Account is not yet enabled")

        return len(errors) == 0, errors

    def execute(self, repo) -> Institution:
        """Execute the command and create institution."""
        # Run validation again in transaction context
        valid, errors = self.validate(None)
        if not valid:
            raise ValueError(f"Validation failed: {'; '.join(errors)}")

        # Use repository's create method
        institution = repo.create(
            name=self.name,
            source_description=self.source_description,
            owner_user_id=self.owner_user_id,
            created_by_user_id=self.created_by_user_id,
            idempotency_key=self.idempotency_key,
            customer_type=self.customer_type,
            category=self.category,
            region=self.region,
            source_kind=self.source_kind,
            source_evidence_reference=self.source_evidence_reference,
            custodian_user_id=self.custodian_user_id,
            amount=self.amount
        )

        return institution


# ============ Command: Add Contact to Institution ============

class AddContactToInstitutionCommand:
    """Command to add a contact to an institution."""

    def __init__(
        self,
        institution_id: UUID,
        created_by_user_id: UUID,
        contactability_status: ContactabilityStatus,
        idempotency_key: str,
        name: Optional[str] = None,
        role_label: Optional[str] = None,
        job_title: Optional[str] = None,
        phone: Optional[str] = None,
        email: Optional[str] = None,
        wechat: Optional[str] = None,
        other_channel: Optional[str] = None,
        channel_notes: Optional[str] = None
    ):
        self.institution_id = institution_id
        self.created_by_user_id = created_by_user_id
        self.contactability_status = contactability_status
        self.idempotency_key = idempotency_key
        self.name = name
        self.role_label = role_label
        self.job_title = job_title
        self.phone = phone
        self.email = email
        self.wechat = wechat
        self.other_channel = other_channel
        self.channel_notes = channel_notes

    def validate(self, user: UserIdentity) -> tuple[bool, list[str]]:
        """Validate command data against domain constraints."""
        errors = []

        # Validate required fields
        if not self.idempotency_key or len(self.idempotency_key.strip()) < 1:
            errors.append("Idempotency key is required")

        # Name or role_label is required
        if self.name is None and self.role_label is None:
            errors.append("A contact needs a name or identifiable role")

        # Channel/status consistency validation
        if self.contactability_status is ContactabilityStatus.AVAILABLE:
            has_channel = any([
                self.phone, self.email, self.wechat, self.other_channel
            ])
            if not has_channel:
                errors.append(
                    "Available status requires at least one storable channel (phone/email/wechat/other)"
                )
        else:
            # Not available status - channels must be null
            if any([self.phone, self.email, self.wechat, self.other_channel]):
                errors.append(
                    "Channel values require available contact status"
                )

        # Authentication is enforced by the route layer; validate status when supplied.
        if user is not None and user.status is not UserStatus.ENABLED:
            errors.append("Account is not enabled")

        return len(errors) == 0, errors

    def execute(self, repo) -> Contact:
        """Execute command and create contact."""
        valid, errors = self.validate(None)
        if not valid:
            raise ValueError(f"Validation failed: {'; '.join(errors)}")

        # Use repository's create method
        contact = repo.create(
            institution_id=self.institution_id,
            created_by_user_id=self.created_by_user_id,
            contactability_status=self.contactability_status,
            idempotency_key=self.idempotency_key,
            name=self.name,
            role_label=self.role_label,
            job_title=self.job_title,
            phone=self.phone,
            email=self.email,
            wechat=self.wechat,
            other_channel=self.other_channel,
            channel_notes=self.channel_notes
        )

        return contact


# ============ Command: Create FollowUp Activity ============

class CreateFollowUpActivityCommand:
    """Command to append a follow-up activity to an institution."""

    def __init__(
        self,
        institution_id: UUID,
        recorded_by_user_id: UUID,
        occurred_at: datetime,
        interaction_method: str,
        factual_body: str,
        idempotency_key: str,
        communication_method_category: Optional[str] = None,
        participants: Optional[str] = None,
        customer_needs: Optional[str] = None,
        decision_participants: Optional[str] = None,
        objections_constraints: Optional[str] = None,
        commitments: Optional[str] = None,
        next_action: Optional[str] = None,
        next_action_owner_user_id: Optional[UUID] = None,
        next_action_target_date: Optional[date] = None,
        facts_to_verify: Optional[str] = None,
        evidence_reference: Optional[str] = None,
        shared_summary: Optional[str] = None,
        content_attribution: ContentAttribution = ContentAttribution.SALESPERSON_INPUT,
        ai_review_status: AiReviewStatus = AiReviewStatus.UNAVAILABLE
    ):
        self.institution_id = institution_id
        self.recorded_by_user_id = recorded_by_user_id
        self.occurred_at = occurred_at
        self.interaction_method = interaction_method
        self.communication_method_category = communication_method_category
        self.factual_body = factual_body
        self.idempotency_key = idempotency_key
        self.participants = participants
        self.customer_needs = customer_needs
        self.decision_participants = decision_participants
        self.objections_constraints = objections_constraints
        self.commitments = commitments
        self.next_action = next_action
        self.next_action_owner_user_id = next_action_owner_user_id
        self.next_action_target_date = next_action_target_date
        self.facts_to_verify = facts_to_verify
        self.evidence_reference = evidence_reference
        self.shared_summary = shared_summary
        self.content_attribution = content_attribution
        self.ai_review_status = ai_review_status

    def validate(self, user: UserIdentity) -> tuple[bool, list[str]]:
        """Validate command data against domain constraints."""
        errors = []

        # Validate required fields
        if not self.interaction_method or len(self.interaction_method.strip()) < 1:
            errors.append("Interaction method is required")

        if not self.factual_body or len(self.factual_body.strip()) < 1:
            errors.append("Factual body is required")

        if not self.idempotency_key or len(self.idempotency_key.strip()) < 1:
            errors.append("Idempotency key is required")

        # Validate next_action consistency
        if self.next_action is None:
            if self.next_action_owner_user_id is not None or self.next_action_target_date is not None:
                errors.append(
                    "Next-action owner or date requires next-action content"
                )
        elif self.next_action_owner_user_id is None:
            errors.append(
                "Next-action content requires an owner user ID"
            )

        # R-029: category must be a member of the fixed vocabulary when given.
        if (
            self.communication_method_category is not None
            and self.communication_method_category not in METHOD_CATEGORIES
        ):
            errors.append(
                "Communication method category must be one of "
                + ", ".join(sorted(METHOD_CATEGORIES))
            )

        # Authentication is enforced by the route layer; validate status when supplied.
        if user is not None and user.status is not UserStatus.ENABLED:
            if user.status is UserStatus.DISABLED:
                errors.append("Account has been disabled")
            else:
                errors.append("Account is not yet enabled")

        return len(errors) == 0, errors

    def execute(self, repo) -> FollowUpActivity:
        """Execute command and create follow-up activity."""
        valid, errors = self.validate(None)
        if not valid:
            raise ValueError(f"Validation failed: {'; '.join(errors)}")

        # Use repository's create method; the stored interaction_method carries
        # the R-029 category as a 【category】 prefix (see domain helpers).
        activity = repo.create(
            institution_id=self.institution_id,
            recorded_by_user_id=self.recorded_by_user_id,
            occurred_at=self.occurred_at,
            interaction_method=compose_stored_interaction_method(
                self.communication_method_category, self.interaction_method
            ),
            factual_body=self.factual_body,
            idempotency_key=self.idempotency_key,
            participants=self.participants,
            customer_needs=self.customer_needs,
            decision_participants=self.decision_participants,
            objections_constraints=self.objections_constraints,
            commitments=self.commitments,
            next_action=self.next_action,
            next_action_owner_user_id=self.next_action_owner_user_id,
            next_action_target_date=self.next_action_target_date,
            facts_to_verify=self.facts_to_verify,
            evidence_reference=self.evidence_reference,
            shared_summary=self.shared_summary,
            content_attribution=self.content_attribution,
            ai_review_status=self.ai_review_status
        )

        return activity


# ============ R-031 correction / withdrawal / archive (owner path) ============
#
# The route layer enforces owner-write authorization (404 default deny, no
# existence leakage) before these commands run; the commands own the
# transaction boundary. Every write (new revision + current_version bump +
# audit event; or withdrawal triple + audit event; or archive pair + audit
# event) commits or rolls back together inside `transaction_session`, per
# TASK-0008 S1 contract map §3.

def _default_session_factory():
    """Build the cached session factory for the resolved runtime settings."""
    from crm.config import Settings
    from crm.persistence.database import get_session_factory
    return get_session_factory(Settings())


class CorrectFollowUpActivityCommand:
    """Append a corrected version of a follow-up activity (SPEC-0001 R-031).

    Append-only: the previous revision is never modified or deleted, and the
    new version records who corrected, when, and why (AC-025).
    """

    def __init__(
        self,
        activity_id: UUID,
        corrected_by_user_id: UUID,
        change_reason: str,
        factual_body: str,
        participants: Optional[str] = None,
        customer_needs: Optional[str] = None,
        decision_participants: Optional[str] = None,
        objections_constraints: Optional[str] = None,
        commitments: Optional[str] = None,
        next_action: Optional[str] = None,
        next_action_owner_user_id: Optional[UUID] = None,
        next_action_target_date: Optional[date] = None,
        facts_to_verify: Optional[str] = None,
        evidence_reference: Optional[str] = None,
        shared_summary: Optional[str] = None,
        content_attribution: ContentAttribution = ContentAttribution.SALESPERSON_INPUT,
    ):
        self.activity_id = activity_id
        self.corrected_by_user_id = corrected_by_user_id
        self.change_reason = change_reason
        self.factual_body = factual_body
        self.participants = participants
        self.customer_needs = customer_needs
        self.decision_participants = decision_participants
        self.objections_constraints = objections_constraints
        self.commitments = commitments
        self.next_action = next_action
        self.next_action_owner_user_id = next_action_owner_user_id
        self.next_action_target_date = next_action_target_date
        self.facts_to_verify = facts_to_verify
        self.evidence_reference = evidence_reference
        self.shared_summary = shared_summary
        self.content_attribution = content_attribution

    def validate(self, user: UserIdentity) -> tuple[bool, list[str]]:
        """Validate the corrected content and account status."""
        errors = []

        if not self.change_reason or len(self.change_reason.strip()) < 1:
            errors.append("Change reason is required")

        if not self.factual_body or len(self.factual_body.strip()) < 1:
            errors.append("Factual body is required")

        # R-028 consistency: next-action content requires an owner.
        if self.next_action is None:
            if self.next_action_owner_user_id is not None or self.next_action_target_date is not None:
                errors.append("Next-action owner or date requires next-action content")
        elif self.next_action_owner_user_id is None:
            errors.append("Next-action content requires an owner user ID")

        if user is not None and user.status is not UserStatus.ENABLED:
            errors.append("Account is not enabled")

        return len(errors) == 0, errors

    def execute(
        self,
        activity_repo,
        audit_repo,
        session_factory=None,
    ) -> FollowUpActivity:
        """Append the corrected revision and the audit event in one transaction."""
        valid, errors = self.validate(None)
        if not valid:
            raise ValueError(f"Validation failed: {'; '.join(errors)}")

        from crm.persistence.database import transaction_session

        factory = session_factory or _default_session_factory()
        with transaction_session(factory) as session:
            new_version = activity_repo.append_revision(
                session=session,
                activity_id=self.activity_id,
                factual_body=self.factual_body,
                change_reason=self.change_reason,
                created_by_user_id=self.corrected_by_user_id,
                participants=self.participants,
                customer_needs=self.customer_needs,
                decision_participants=self.decision_participants,
                objections_constraints=self.objections_constraints,
                commitments=self.commitments,
                next_action=self.next_action,
                next_action_owner_user_id=self.next_action_owner_user_id,
                next_action_target_date=self.next_action_target_date,
                facts_to_verify=self.facts_to_verify,
                evidence_reference=self.evidence_reference,
                shared_summary=self.shared_summary,
                content_attribution=self.content_attribution,
            )
            activity_repo.bump_current_version(
                session=session,
                activity_id=self.activity_id,
                new_version=new_version,
            )
            audit_repo.record(
                session=session,
                action="activity.correct",
                outcome="success",
                target_type="activity",
                target_id=self.activity_id,
                actor_user_id=self.corrected_by_user_id,
                reason=self.change_reason,
            )

            # Read back inside the same transaction so the caller sees the new
            # current version without a second (separately committed) session.
            updated = activity_repo.find_in_session(session=session, activity_id=self.activity_id)
            if updated is None:
                raise ValueError("activity not found after correction")

        return updated


class WithdrawFollowUpActivityCommand:
    """Withdraw a follow-up activity, keeping the row and audit history (R-031).

    Hard deletion is unavailable; the withdrawn triple is written completely
    and the audit event records who withdrew, when, and why.
    """

    def __init__(
        self,
        activity_id: UUID,
        withdrawn_by_user_id: UUID,
        withdrawal_reason: str,
    ):
        self.activity_id = activity_id
        self.withdrawn_by_user_id = withdrawn_by_user_id
        self.withdrawal_reason = withdrawal_reason

    def validate(self, user: UserIdentity) -> tuple[bool, list[str]]:
        errors = []
        if not self.withdrawal_reason or len(self.withdrawal_reason.strip()) < 1:
            errors.append("Withdrawal reason is required")
        if user is not None and user.status is not UserStatus.ENABLED:
            errors.append("Account is not enabled")
        return len(errors) == 0, errors

    def execute(
        self,
        activity_repo,
        audit_repo,
        session_factory=None,
    ) -> dict:
        """Write the withdrawal triple and the audit event in one transaction."""
        valid, errors = self.validate(None)
        if not valid:
            raise ValueError(f"Validation failed: {'; '.join(errors)}")

        from crm.persistence.database import transaction_session

        factory = session_factory or _default_session_factory()
        with transaction_session(factory) as session:
            withdrawn_at = activity_repo.withdraw(
                session=session,
                activity_id=self.activity_id,
                withdrawn_by_user_id=self.withdrawn_by_user_id,
                withdrawal_reason=self.withdrawal_reason,
            )
            audit_repo.record(
                session=session,
                action="activity.withdraw",
                outcome="success",
                target_type="activity",
                target_id=self.activity_id,
                actor_user_id=self.withdrawn_by_user_id,
                reason=self.withdrawal_reason,
            )

        return {
            "activity_id": str(self.activity_id),
            "withdrawn": True,
            "withdrawn_at": withdrawn_at.isoformat(),
            "withdrawal_reason": self.withdrawal_reason,
        }


class ArchiveInstitutionCommand:
    """Archive an institution record (R-031/R-036); hard deletion unavailable."""

    def __init__(
        self,
        institution_id: UUID,
        archived_by_user_id: UUID,
        archive_reason: str | None,
    ):
        self.institution_id = institution_id
        self.archived_by_user_id = archived_by_user_id
        # R-008 (SPEC-0002 v0.4.0): the administrator may archive without a
        # reason; blank/whitespace is normalized to None.
        self.archive_reason = (archive_reason or "").strip() or None

    def validate(self, user: UserIdentity) -> tuple[bool, list[str]]:
        errors = []
        # R-008 (SPEC-0002 v0.4.0): the administrator may archive without a
        # reason; the route enforces administrator-only before this command
        # runs. The archive is auto-traced (who/when/what) in audit_events.
        if user is not None and user.status is not UserStatus.ENABLED:
            errors.append("Account is not enabled")
        return len(errors) == 0, errors

    def execute(
        self,
        institution_repo,
        audit_repo,
        session_factory=None,
    ) -> dict:
        """Write the archive pair and the audit event in one transaction."""
        valid, errors = self.validate(None)
        if not valid:
            raise ValueError(f"Validation failed: {'; '.join(errors)}")

        from crm.persistence.database import transaction_session

        factory = session_factory or _default_session_factory()
        with transaction_session(factory) as session:
            archived_at = institution_repo.archive(
                session=session,
                institution_id=self.institution_id,
                archive_reason=self.archive_reason,
            )
            audit_repo.record(
                session=session,
                action="institution.archive",
                outcome="success",
                target_type="institution",
                target_id=self.institution_id,
                actor_user_id=self.archived_by_user_id,
                reason=self.archive_reason,
            )

        return {
            "institution_id": str(self.institution_id),
            "archived": True,
            "archived_at": archived_at.isoformat(),
            "archive_reason": self.archive_reason,
        }


class ChangeCustomerTypeCommand:
    """R-039a (SPEC-0001 v0.8.0): change a customer's type, with audit.

    The customer type is a pure label; changing it records who changed it,
    when, and from what to what (auto-traced). No behavior depends on the
    label, so no re-projection is needed.
    """

    def __init__(
        self,
        institution_id: UUID,
        changed_by_user_id: UUID,
        new_customer_type: CustomerType,
    ):
        self.institution_id = institution_id
        self.changed_by_user_id = changed_by_user_id
        self.new_customer_type = new_customer_type

    def validate(self, user: UserIdentity | None) -> tuple[bool, list[str]]:
        errors = []
        if not isinstance(self.new_customer_type, CustomerType):
            errors.append("Customer type must be one of direct_purchase/individual/channel")
        if user is not None and user.status is not UserStatus.ENABLED:
            errors.append("Account is not enabled")
        return len(errors) == 0, errors

    def execute(
        self,
        institution_repo,
        audit_repo,
        session_factory=None,
    ) -> dict:
        """Write the type change and the audit event in one transaction."""
        valid, errors = self.validate(None)
        if not valid:
            raise ValueError(f"Validation failed: {'; '.join(errors)}")

        from crm.persistence.database import transaction_session

        factory = session_factory or _default_session_factory()
        with transaction_session(factory) as session:
            inst = session.get(InstitutionModel, self.institution_id)
            if inst is None:
                raise ValueError("institution not found")
            if inst.archived_at is not None:
                raise ValueError("archived institution type cannot be changed")

            before = {"customer_type": inst.customer_type}
            inst.customer_type = self.new_customer_type.value
            inst.updated_at = datetime.now(timezone.utc)
            after = {"customer_type": inst.customer_type}

            session.add(AuditEventModel(
                actor_user_id=self.changed_by_user_id,
                action="institution.customer_type_change",
                target_type="institution",
                target_id=self.institution_id,
                outcome="success",
                before_state=before,
                after_state=after,
            ))

        return {
            "institution_id": str(self.institution_id),
            "customer_type": self.new_customer_type.value,
            "changed": True,
        }


# ============ SPEC-0014: account credentials self-modification ============
#
# TASK-0019: enabled business users and administrators may modify their own
# username and password. Both operations require current-password
# verification (R-001/R-003). Username changes for sa/dl-prefixed accounts
# are rejected (R-004). On success, session_epoch is bumped to invalidate
# all existing sessions (R-006), and an audit event is written inside the
# same transaction (R-007/R-008: audit failure rolls back the credential
# change too).

PROTECTED_USERNAME_PREFIXES = ("sa", "dl")
USERNAME_MAX_LENGTH = 64


class CredentialError(ValueError):
    """Raised when a credential change is rejected by SPEC-0014 rules.

    The route layer translates these into the appropriate HTTP status and
    message. ``fail_silent`` indicates the rejection should use a generic
    message that does not disclose account information (R-001).
    """


def _is_prefix_protected(username: str) -> bool:
    """R-004: lower(username).startswith('sa' or 'dl') -> protected."""
    lowered = (username or "").lower()
    return any(lowered.startswith(prefix) for prefix in PROTECTED_USERNAME_PREFIXES)


class ChangePasswordCommand:
    """Change the current user's password (SPEC-0014 R-001, R-002, R-006…R-008).

    Requires current-password verification; writes the new argon2id hash,
    bumps session_epoch, and records an audit event — all in one
    transaction. Audit failure rolls back the password change (R-008).
    """

    def __init__(self, user_id: UUID, current_password: str, new_password: str):
        self.user_id = user_id
        self.current_password = current_password
        self.new_password = new_password

    def execute(self, audit_repo, session_factory=None) -> dict:
        from crm.persistence.database import transaction_session
        from crm.persistence.models import UserIdentityModel
        from crm.web.auth import hash_password, verify_password

        factory = session_factory or _default_session_factory()

        with transaction_session(factory) as session:
            model = session.get(UserIdentityModel, self.user_id)
            if model is None or model.status != "enabled":
                raise CredentialError("Invalid credentials")

            if not verify_password(self.current_password, model.password_hash):
                raise CredentialError("Invalid credentials")

            same_password = verify_password(self.new_password, model.password_hash)

            model.password_hash = hash_password(self.new_password)
            model.session_epoch = (model.session_epoch or 0) + 1
            model.updated_at = datetime.now(timezone.utc)

            audit_repo.record(
                session=session,
                action="user.password_change",
                outcome="success",
                target_type="user_identity",
                target_id=self.user_id,
                actor_user_id=self.user_id,
                reason="password changed",
            )

            return {
                "success": True,
                "message": "新密码与当前密码相同" if same_password else "密码修改成功",
                "same_password": same_password,
            }


class ChangeUsernameCommand:
    """Change the current user's username (SPEC-0014 R-003…R-008).

    Requires current-password verification; rejects sa/dl-prefixed current
    usernames; enforces uniqueness and length (R-005); bumps session_epoch
    and writes audit inside one transaction (R-006…R-008).
    """

    def __init__(self, user_id: UUID, current_password: str, new_username: str):
        self.user_id = user_id
        self.current_password = current_password
        self.new_username = new_username

    def execute(self, audit_repo, session_factory=None) -> dict:
        from crm.persistence.database import transaction_session
        from crm.persistence.models import UserIdentityModel
        from crm.web.auth import verify_password

        factory = session_factory or _default_session_factory()

        new_username = (self.new_username or "").strip()
        if not new_username or len(new_username) > USERNAME_MAX_LENGTH:
            raise CredentialError("用户名不能为空且不能超过64个字符")

        with transaction_session(factory) as session:
            model = session.get(UserIdentityModel, self.user_id)
            if model is None or model.status != "enabled":
                raise CredentialError("Invalid credentials")

            if not verify_password(self.current_password, model.password_hash):
                raise CredentialError("Invalid credentials")

            if _is_prefix_protected(model.username):
                raise CredentialError("该用户名前缀受保护，不可修改")

            # R-005: uniqueness check (case-insensitive, excludes self).
            conflict = session.execute(
                sa.select(UserIdentityModel).where(
                    sa.func.lower(UserIdentityModel.username) == new_username.lower(),
                    UserIdentityModel.id != self.user_id,
                )
            ).scalar_one_or_none()
            if conflict is not None:
                raise CredentialError("该用户名已被占用")

            old_username = model.username
            model.username = new_username
            model.session_epoch = (model.session_epoch or 0) + 1
            model.updated_at = datetime.now(timezone.utc)

            audit_repo.record(
                session=session,
                action="user.username_change",
                outcome="success",
                target_type="user_identity",
                target_id=self.user_id,
                actor_user_id=self.user_id,
                reason="username changed",
            )

            return {
                "success": True,
                "message": "用户名修改成功",
                "old_username": old_username,
                "new_username": new_username,
            }


# ============ Command: Change Custodian ============

class ChangeCustodianCommand:
    """SPEC-0002 v0.5.0 R-031: change the custodian (管理人) of an institution.

    The custodian is the person who manages daily follow-up for the
    institution, distinct from the owner (业绩归属). The command writes
    audit (actor / before / after).  Permission: owner, custodian, or
    administrator/shareholder.
    """

    def __init__(
        self,
        institution_id: UUID,
        new_custodian_user_id: UUID | None,
        actor_user_id: UUID,
    ):
        self.institution_id = institution_id
        self.new_custodian_user_id = new_custodian_user_id
        self.actor_user_id = actor_user_id

    def execute(self, repo, session) -> dict:
        from crm.persistence.models import InstitutionModel, AuditEventModel
        import sqlalchemy as sa

        model = session.get(InstitutionModel, self.institution_id)
        if model is None:
            raise ValueError("institution not found")

        old = model.custodian_user_id
        if old == self.new_custodian_user_id:
            return {"changed": False, "custodian_user_id": str(old) if old else None}

        old_str = str(old) if old else None
        new_str = str(self.new_custodian_user_id) if self.new_custodian_user_id else None

        model.custodian_user_id = self.new_custodian_user_id
        session.add(AuditEventModel(
            actor_user_id=self.actor_user_id,
            action="custodian.change",
            target_type="institution",
            target_id=self.institution_id,
            outcome="success",
            reason="管理人变更",
            before_state={"custodian_user_id": old_str},
            after_state={"custodian_user_id": new_str},
        ))
        return {"changed": True, "custodian_user_id": new_str}
