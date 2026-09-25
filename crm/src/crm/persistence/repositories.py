"""Persistence layer repositories for core entities."""

from datetime import datetime, date, timezone
import sqlalchemy as sa
from typing import Optional, List
from uuid import UUID

from crm.persistence.models import (
    InstitutionModel,
    ContactModel,
    FollowUpActivityModel,
    FollowUpActivityRevisionModel
)
from crm.domain.models import (
    Institution,
    Contact,
    FollowUpActivity,
    ContentAttribution,
    AiReviewStatus,
    ContactabilityStatus,
    CustomerType,
)


# ============ Institution Repository ============

def _ensure_aware(value: Optional[datetime]) -> Optional[datetime]:
    """Return an aware datetime; treat a naive stored value as UTC.

    PostgreSQL ``timestamptz`` always round-trips aware, so production is
    unaffected. The SQLite dialect used by local transaction tests stores
    datetimes without a timezone; this conversion keeps the domain-model
    contract (aware datetimes) regardless of the storage dialect.
    """
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def domain_institution_from_model(model: InstitutionModel) -> Institution:
    """Convert SQLAlchemy model to domain model."""
    return Institution(
        id=model.id,
        name=model.name,
        source_description=model.source_description,
        customer_type=CustomerType(model.customer_type),
        source_kind=model.source_kind,
        category=model.category,
        region=model.region,
        source_evidence_reference=model.source_evidence_reference,
        owner_user_id=model.owner_user_id,
        custodian_user_id=model.custodian_user_id,
        amount=model.amount,
        in_pool=model.in_pool,
        created_by_user_id=model.created_by_user_id,
        idempotency_key=model.idempotency_key,
        created_at=_ensure_aware(model.created_at),
        updated_at=_ensure_aware(model.updated_at)
    )


class InstitutionRepository:
    """Repository for institution management."""
    
    def find_by_id(self, institution_id: UUID) -> Optional[Institution]:
        """Find institution by ID."""
        from crm.persistence.database import SessionLocal
        
        with SessionLocal() as session:
            model = session.get(InstitutionModel, institution_id)
            if model:
                return domain_institution_from_model(model)
            return None
    
    def find_all(
        self,
        search_terms: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
        searchable_fields: Optional[frozenset[str]] = None,
    ) -> List[Institution]:
        """Find all institutions with optional search filtering.

        ``searchable_fields`` enforces SPEC-0008 R-003/R-008: the SQL
        ``WHERE`` clause only matches on columns the caller is authorized to
        see. This prevents hidden-field existence leakage through result
        presence or count. When ``None``, no search filter is applied
        (list-all path). An empty frozenset means the caller may search
        nothing — only unfiltered listing applies if ``search_terms`` is
        also None, otherwise no rows match.
        """
        from crm.persistence.database import SessionLocal

        # Default to the safe collaborator-visible set when not specified.
        if searchable_fields is None:
            searchable_fields = frozenset({"name", "category", "region"})

        with SessionLocal() as session:
            query = sa.select(InstitutionModel)

            if search_terms:
                search_pattern = f"%{search_terms}%"
                field_columns = []
                col_map = {
                    "name": InstitutionModel.name,
                    "category": InstitutionModel.category,
                    "region": InstitutionModel.region,
                    "source_description": InstitutionModel.source_description,
                    "source_kind": InstitutionModel.source_kind,
                }
                for field_name in searchable_fields:
                    col = col_map.get(field_name)
                    if col is not None:
                        field_columns.append(col.ilike(search_pattern))
                if field_columns:
                    query = query.where(sa.or_(*field_columns))
                else:
                    # Caller may not search any field: no rows match.
                    query = query.where(sa.false())

            query = query.offset(offset).limit(limit)
            models = session.execute(query).scalars().all()

            return [domain_institution_from_model(m) for m in models]
    
    def create(
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
    ) -> Institution:
        """Create a new institution. custodian defaults to owner if None."""
        from crm.persistence.database import SessionLocal
        from datetime import datetime, timezone
        
        if custodian_user_id is None:
            custodian_user_id = owner_user_id
        
        model = InstitutionModel(
            name=name,
            source_description=source_description,
            customer_type=customer_type.value,
            owner_user_id=owner_user_id,
            custodian_user_id=custodian_user_id,
            amount=amount,
            in_pool=False,
            created_by_user_id=created_by_user_id,
            idempotency_key=idempotency_key,
            category=category,
            region=region,
            source_kind=source_kind,
            source_evidence_reference=source_evidence_reference,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        
        with SessionLocal() as session:
            session.add(model)
            session.commit()
            session.refresh(model)
            return domain_institution_from_model(model)
    
    def find_by_owner(self, owner_user_id: UUID) -> List[Institution]:
        """Find all institutions owned by a user."""
        from crm.persistence.database import SessionLocal
        
        with SessionLocal() as session:
            models = session.execute(
                sa.select(InstitutionModel).where(
                    InstitutionModel.owner_user_id == owner_user_id
                )
            ).scalars().all()
            
            return [domain_institution_from_model(m) for m in models]

    def find_active_for_duplicate_check(self) -> List[Institution]:
        """All non-archived institutions, for create-time duplicate comparison.

        R-035: duplicate suspicion is checked against existing non-archived
        institutions only. The normalized-name comparison itself happens in
        the application layer (trim + collapse whitespace + casefold), so the
        repository only supplies the candidate set.
        """
        from crm.persistence.database import SessionLocal
        
        with SessionLocal() as session:
            models = session.execute(
                sa.select(InstitutionModel).where(
                    InstitutionModel.archived_at.is_(None)
                )
            ).scalars().all()
            
            return [domain_institution_from_model(m) for m in models]

    def archive(
        self,
        *,
        session,
        institution_id: UUID,
        archive_reason: str,
    ) -> datetime:
        """Mark an institution archived inside the caller's session (R-031).

        Sets the complete ``archived_at`` + ``archive_reason`` pair (the
        ``ck_institutions_archive_complete`` constraint forbids a partial
        pair). Returns the archived_at timestamp. The caller owns the
        transaction (``transaction_session``); this method never commits.
        """
        model = session.get(InstitutionModel, institution_id)
        if model is None:
            raise ValueError("institution not found")
        if model.archived_at is not None:
            raise ValueError("institution is already archived")

        archived_at = datetime.now(timezone.utc)
        model.archived_at = archived_at
        model.archive_reason = archive_reason
        return archived_at


# ============ Contact Repository ============

def domain_contact_from_model(model: ContactModel) -> Contact:
    """Convert SQLAlchemy model to domain model."""
    return Contact(
        id=model.id,
        institution_id=model.institution_id,
        created_by_user_id=model.created_by_user_id,
        contactability_status=ContactabilityStatus(model.contactability_status),
        idempotency_key=model.idempotency_key,
        name=model.name,
        role_label=model.role_label,
        job_title=model.job_title,
        phone=model.phone,
        email=model.email,
        wechat=model.wechat,
        other_channel=model.other_channel,
        channel_notes=model.channel_notes,
        created_at=_ensure_aware(model.created_at),
        updated_at=_ensure_aware(model.updated_at)
    )


class ContactRepository:
    """Repository for contact management."""
    
    def find_by_id(self, contact_id: UUID) -> Optional[Contact]:
        """Find contact by ID."""
        from crm.persistence.database import SessionLocal
        
        with SessionLocal() as session:
            model = session.get(ContactModel, contact_id)
            if model:
                return domain_contact_from_model(model)
            return None
    
    def find_by_institution(self, institution_id: UUID) -> List[Contact]:
        """Find all contacts for an institution."""
        from crm.persistence.database import SessionLocal
        
        with SessionLocal() as session:
            models = session.execute(
                sa.select(ContactModel).where(
                    ContactModel.institution_id == institution_id
                )
            ).scalars().all()
            
            return [domain_contact_from_model(m) for m in models]
    
    def create(
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
    ) -> Contact:
        """Create a new contact."""
        from crm.persistence.database import SessionLocal
        
        model = ContactModel(
            institution_id=institution_id,
            created_by_user_id=created_by_user_id,
            contactability_status=contactability_status.value,
            idempotency_key=idempotency_key,
            name=name,
            role_label=role_label,
            job_title=job_title,
            phone=phone,
            email=email,
            wechat=wechat,
            other_channel=other_channel,
            channel_notes=channel_notes,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        
        with SessionLocal() as session:
            session.add(model)
            session.commit()
            session.refresh(model)
            return domain_contact_from_model(model)


# ============ FollowUpActivity Repository ============

def domain_follow_up_activity_from_model(
    model: FollowUpActivityModel,
    revision: FollowUpActivityRevisionModel | None = None,
) -> FollowUpActivity:
    """Convert SQLAlchemy models (activity + current revision) to domain model.

    The detailed content (factual_body, participants, ...) lives in
    ``follow_up_activity_revisions``; without a loaded revision the detailed
    fields fall back to empty/None so read paths never fabricate content.
    """
    return FollowUpActivity(
        id=model.id,
        institution_id=model.institution_id,
        recorded_by_user_id=model.recorded_by_user_id,
        occurred_at=_ensure_aware(model.occurred_at),
        interaction_method=model.interaction_method,
        factual_body=revision.factual_body if revision else "",
        idempotency_key=model.idempotency_key,
        participants=revision.participants if revision else None,
        customer_needs=revision.customer_needs if revision else None,
        decision_participants=revision.decision_participants if revision else None,
        objections_constraints=revision.objections_constraints if revision else None,
        commitments=revision.commitments if revision else None,
        next_action=revision.next_action if revision else None,
        next_action_owner_user_id=revision.next_action_owner_user_id if revision else None,
        next_action_target_date=revision.next_action_target_date if revision else None,
        facts_to_verify=revision.facts_to_verify if revision else None,
        evidence_reference=revision.evidence_reference if revision else None,
        shared_summary=revision.shared_summary if revision else None,
        content_attribution=(
            ContentAttribution(revision.content_attribution)
            if revision else ContentAttribution.SALESPERSON_INPUT
        ),
        ai_review_status=AiReviewStatus(model.ai_review_status),
        recorded_at=_ensure_aware(model.recorded_at)
    )


class FollowUpActivityRepository:
    """Repository for follow-up activity management."""
    
    def find_by_id(self, activity_id: UUID) -> Optional[FollowUpActivity]:
        """Find activity by ID (with its current revision content)."""
        from crm.persistence.database import SessionLocal
        
        with SessionLocal() as session:
            model = session.get(FollowUpActivityModel, activity_id)
            if not model:
                return None
            revision = session.execute(
                sa.select(FollowUpActivityRevisionModel).where(
                    FollowUpActivityRevisionModel.activity_id == activity_id,
                    FollowUpActivityRevisionModel.version_number == model.current_version,
                )
            ).scalar_one_or_none()
            return domain_follow_up_activity_from_model(model, revision)
    
    def find_by_target(
        self,
        target_type: str,
        target_id: str,
        include_withdrawn: bool = False,
    ) -> List[FollowUpActivity]:
        """Find activities by target entity type and ID.

        When ``include_withdrawn`` is False (the default), withdrawn
        activities are excluded so they do not appear in the normal history
        or concise-progress projection (SPEC-0001 R-031: withdrawn rows are
        retained for audit but kept out of ordinary views). The administrator
        exception view passes True to retain them for audit visibility.
        """
        # For follow-up activities, they're always linked to institutions
        from crm.persistence.database import SessionLocal

        with SessionLocal() as session:
            if target_type != "institution":
                return []

            try:
                inst_id = UUID(target_id)
            except ValueError:
                return []

            query = sa.select(FollowUpActivityModel).where(
                FollowUpActivityModel.institution_id == inst_id
            )
            if not include_withdrawn:
                query = query.where(FollowUpActivityModel.withdrawn_at.is_(None))
            query = query.order_by(
                FollowUpActivityModel.occurred_at.desc(),
                FollowUpActivityModel.recorded_at.desc(),
                FollowUpActivityModel.id.desc()
            )
            models = session.execute(query).scalars().all()

            results = []
            for m in models:
                revision = session.execute(
                    sa.select(FollowUpActivityRevisionModel).where(
                        FollowUpActivityRevisionModel.activity_id == m.id,
                        FollowUpActivityRevisionModel.version_number == m.current_version,
                    )
                ).scalar_one_or_none()
                results.append(domain_follow_up_activity_from_model(m, revision))
            return results
    
    def create(
        self,
        institution_id: UUID,
        recorded_by_user_id: UUID,
        occurred_at: datetime,
        interaction_method: str,
        factual_body: str,
        idempotency_key: str,
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
    ) -> FollowUpActivity:
        """Create a new follow-up activity with its initial revision (v1)."""
        from crm.persistence.database import SessionLocal
        
        now = datetime.now(timezone.utc)
        model = FollowUpActivityModel(
            institution_id=institution_id,
            recorded_by_user_id=recorded_by_user_id,
            occurred_at=occurred_at,
            interaction_method=interaction_method,
            idempotency_key=idempotency_key,
            current_version=1,
            ai_review_status=ai_review_status.value,
            recorded_at=now,
        )
        
        with SessionLocal() as session:
            session.add(model)
            session.flush()  # assign model.id before the revision insert
            revision = FollowUpActivityRevisionModel(
                activity_id=model.id,
                version_number=1,
                factual_body=factual_body,
                participants=participants,
                customer_needs=customer_needs,
                decision_participants=decision_participants,
                objections_constraints=objections_constraints,
                commitments=commitments,
                next_action=next_action,
                next_action_owner_user_id=next_action_owner_user_id,
                next_action_target_date=next_action_target_date,
                facts_to_verify=facts_to_verify,
                evidence_reference=evidence_reference,
                shared_summary=shared_summary,
                content_attribution=content_attribution.value,
                created_by_user_id=recorded_by_user_id,
                change_reason="initial creation",
            )
            session.add(revision)
            session.commit()
            session.refresh(model)
            return domain_follow_up_activity_from_model(model, revision)

    def append_revision(
        self,
        *,
        session,
        activity_id: UUID,
        factual_body: str,
        change_reason: str,
        created_by_user_id: UUID,
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
    ) -> int:
        """Append the next revision of an activity inside the caller's session.

        Computes ``version_number = current_version + 1`` and inserts the new
        ``follow_up_activity_revisions`` row (append-only; the previous
        version is never modified, R-031). Returns the new version number so
        the caller can bump ``current_version`` and write the audit event in
        the same transaction. A concurrent double correction is rejected by
        ``uq_follow_up_activity_revision_version`` rather than silently
        corrupting history.
        """
        model = session.get(FollowUpActivityModel, activity_id)
        if model is None:
            raise ValueError("activity not found")
        if model.withdrawn_at is not None:
            raise ValueError("activity is withdrawn")

        new_version = model.current_version + 1
        revision = FollowUpActivityRevisionModel(
            activity_id=activity_id,
            version_number=new_version,
            factual_body=factual_body,
            participants=participants,
            customer_needs=customer_needs,
            decision_participants=decision_participants,
            objections_constraints=objections_constraints,
            commitments=commitments,
            next_action=next_action,
            next_action_owner_user_id=next_action_owner_user_id,
            next_action_target_date=next_action_target_date,
            facts_to_verify=facts_to_verify,
            evidence_reference=evidence_reference,
            shared_summary=shared_summary,
            content_attribution=content_attribution.value,
            created_by_user_id=created_by_user_id,
            change_reason=change_reason,
        )
        session.add(revision)
        session.flush()  # visible inside the caller's transaction
        return new_version

    def bump_current_version(
        self,
        *,
        session,
        activity_id: UUID,
        new_version: int,
    ) -> None:
        """Advance ``current_version`` to the just-appended revision number.

        Must run inside the same transaction as ``append_revision``; the
        activity row is never deleted or rewritten in place (R-031).
        """
        model = session.get(FollowUpActivityModel, activity_id)
        if model is None:
            raise ValueError("activity not found")
        model.current_version = new_version

    def find_in_session(
        self,
        *,
        session,
        activity_id: UUID,
    ) -> Optional[FollowUpActivity]:
        """Read an activity (with its current revision) inside a caller-owned
        session — the transaction-internal twin of ``find_by_id``.

        Used by the R-031 commands to read back the corrected current version
        before the transaction commits, so no second (separately committed)
        session is needed.
        """
        model = session.get(FollowUpActivityModel, activity_id)
        if model is None:
            return None
        revision = session.execute(
            sa.select(FollowUpActivityRevisionModel).where(
                FollowUpActivityRevisionModel.activity_id == activity_id,
                FollowUpActivityRevisionModel.version_number == model.current_version,
            )
        ).scalar_one_or_none()
        return domain_follow_up_activity_from_model(model, revision)

    def withdraw(
        self,
        *,
        session,
        activity_id: UUID,
        withdrawn_by_user_id: UUID,
        withdrawal_reason: str,
    ) -> datetime:
        """Mark an activity withdrawn inside the caller's session (R-031).

        Sets the complete withdrawn triple (``withdrawn_at``,
        ``withdrawn_by_user_id``, ``withdrawal_reason`` — the
        ``withdrawal_complete`` constraint forbids a partial triple). The row
        is kept; hard deletion is unavailable. Returns the withdrawn_at
        timestamp. The caller owns the transaction.
        """
        model = session.get(FollowUpActivityModel, activity_id)
        if model is None:
            raise ValueError("activity not found")
        if model.withdrawn_at is not None:
            raise ValueError("activity is already withdrawn")

        withdrawn_at = datetime.now(timezone.utc)
        model.withdrawn_at = withdrawn_at
        model.withdrawn_by_user_id = withdrawn_by_user_id
        model.withdrawal_reason = withdrawal_reason
        return withdrawn_at


# ============ TASK-0015: management repository helpers ============


class ManagementRepository:
    """Repository helpers for audited management operations (TASK-0015).

    Each method runs inside the caller's transaction_session and never
    commits on its own. Returns model objects or scalars so the command
    layer can build before/after state for audit events.
    """

    def find_active_role_grant(self, *, session, user_id, role, scope_reference=None):
        """Find a matching active (non-revoked) role grant, or None."""
        from crm.persistence.models import RoleGrantModel
        query = session.query(RoleGrantModel).filter_by(
            user_id=user_id,
            role=role,
        )
        query = query.filter(RoleGrantModel.revoked_at.is_(None))
        if scope_reference is not None:
            query = query.filter(RoleGrantModel.scope_reference == scope_reference)
        return query.one_or_none()

    def find_active_role_grants(self, *, session, user_id):
        """Return all active (non-revoked) role grants for a user."""
        from crm.persistence.models import RoleGrantModel
        return list(
            session.query(RoleGrantModel)
            .filter_by(user_id=user_id)
            .filter(RoleGrantModel.revoked_at.is_(None))
            .all()
        )

    def find_active_role_values(self, *, session, user_id):
        """Return the role-value strings of a user's active grants."""
        from crm.persistence.models import RoleGrantModel
        rows = (
            session.query(RoleGrantModel.role)
            .filter_by(user_id=user_id)
            .filter(RoleGrantModel.revoked_at.is_(None))
            .all()
        )
        return [r[0] for r in rows]

    def find_institutions_by_owner(self, *, session, owner_user_id):
        """Return IDs of non-archived institutions owned by a user (R-011)."""
        rows = (
            session.query(InstitutionModel.id)
            .filter_by(owner_user_id=owner_user_id)
            .filter(InstitutionModel.archived_at.is_(None))
            .all()
        )
        return [r[0] for r in rows]


# ============ TASK-0011 (SPEC-0013): import batch repository ============


class ImportBatchRepository:
    """Repository for durable import batches and per-row results.

    Every method runs inside the caller's ``transaction_session`` and never
    commits on its own, so a batch, its row results, the created
    institutions, and the audit event commit or roll back together
    (SPEC-0013 §8: an import or undo audit write failure must not display
    as success).
    """

    def find_by_fingerprint(self, *, session, imported_by_user_id, source_file_sha256):
        """Return the existing batch for this importer+fingerprint, or None.

        AC-004 (idempotent rerun): a second run with the same file content
        fingerprint returns the prior batch instead of re-importing rows.
        """
        from crm.persistence.models import ImportBatchModel
        return session.execute(
            sa.select(ImportBatchModel).where(
                ImportBatchModel.imported_by_user_id == imported_by_user_id,
                ImportBatchModel.source_file_sha256 == source_file_sha256,
            )
        ).scalar_one_or_none()

    def find_by_id(self, *, session, batch_id):
        """Return a batch by id, or None."""
        from crm.persistence.models import ImportBatchModel
        return session.get(ImportBatchModel, batch_id)

    def create_batch(
        self,
        *,
        session,
        batch_id,
        imported_by_user_id,
        source_file_name,
        source_file_sha256,
        row_count,
        imported_count,
        duplicate_count,
        failed_count,
        imported_at,
    ):
        """Insert one import_batches row inside the caller's transaction."""
        from crm.persistence.models import ImportBatchModel
        model = ImportBatchModel(
            id=batch_id,
            imported_by_user_id=imported_by_user_id,
            source_file_name=source_file_name,
            source_file_sha256=source_file_sha256,
            row_count=row_count,
            imported_count=imported_count,
            duplicate_count=duplicate_count,
            failed_count=failed_count,
            status="active",
            imported_at=imported_at,
        )
        session.add(model)
        session.flush()
        return model

    def add_row_result(
        self,
        *,
        session,
        batch_id,
        line_number,
        outcome,
        institution_id=None,
        duplicate_of_institution_id=None,
        reason=None,
        created_at,
    ):
        """Insert one import_row_results row inside the caller's transaction."""
        from crm.persistence.models import ImportRowResultModel
        model = ImportRowResultModel(
            batch_id=batch_id,
            line_number=line_number,
            outcome=outcome,
            institution_id=institution_id,
            duplicate_of_institution_id=duplicate_of_institution_id,
            reason=reason,
            created_at=created_at,
        )
        session.add(model)
        return model

    def list_row_results(self, *, session, batch_id):
        """Return all row results for a batch, ordered by line number."""
        from crm.persistence.models import ImportRowResultModel
        return list(
            session.execute(
                sa.select(ImportRowResultModel)
                .where(ImportRowResultModel.batch_id == batch_id)
                .order_by(ImportRowResultModel.line_number)
            ).scalars().all()
        )

    def list_imported_institutions(self, *, session, batch_id):
        """Return (institution_id, created_at snapshot) for rows that created
        an institution — both 'imported' and 'flagged_duplicate' outcomes.

        Used by the undo path to compute eligibility: a record is eligible
        only if its ``updated_at`` is unchanged since import and no contacts
        or follow-up activities were added after import.

        R-003/R-006: flagged_duplicate records ARE imported under the trusted-
        load model (not merged); they must be included in batch undo just like
        plain imported records.
        """
        from crm.persistence.models import ImportRowResultModel
        rows = session.execute(
            sa.select(
                ImportRowResultModel.institution_id,
                ImportRowResultModel.created_at,
            ).where(
                ImportRowResultModel.batch_id == batch_id,
                ImportRowResultModel.institution_id.is_not(None),
            )
        ).all()
        return [(r[0], r[1]) for r in rows]

    def find_user_by_username(self, *, session, username):
        """Return the UserIdentityModel matching ``username`` case-insensitively.

        Uses the case-insensitive unique index (``lower(username)``). Returns
        None when no match. Used by the import path to resolve an optional
        ``owner_username`` column to a concrete owner user id.
        """
        from crm.persistence.models import UserIdentityModel
        return session.execute(
            sa.select(UserIdentityModel).where(
                sa.func.lower(UserIdentityModel.username) == username.casefold()
            )
        ).scalar_one_or_none()

    def find_active_institutions(self, *, session):
        """Return all non-archived InstitutionModel rows for duplicate comparison.

        R-035: duplicate suspicion is checked against existing non-archived
        institutions. The normalized-name comparison happens in the import
        service against this loaded candidate set.
        """
        return list(
            session.execute(
                sa.select(InstitutionModel).where(InstitutionModel.archived_at.is_(None))
            ).scalars().all()
        )

    def count_contacts_for_institution(self, *, session, institution_id):
        """Return the number of contacts under an institution (undo eligibility)."""
        from crm.persistence.models import ContactModel
        return int(
            session.execute(
                sa.select(sa.func.count())
                .select_from(ContactModel)
                .where(ContactModel.institution_id == institution_id)
            ).scalar_one()
        )

    def count_activities_for_institution(self, *, session, institution_id):
        """Return the number of follow-up activities under an institution
        (undo eligibility)."""
        from crm.persistence.models import FollowUpActivityModel
        return int(
            session.execute(
                sa.select(sa.func.count())
                .select_from(FollowUpActivityModel)
                .where(FollowUpActivityModel.institution_id == institution_id)
            ).scalar_one()
        )

    def delete_institution_by_id(self, *, session, institution_id):
        """Delete one institution row by id (undo path)."""
        session.execute(
            sa.delete(InstitutionModel).where(InstitutionModel.id == institution_id)
        )

    def mark_batch_undone(
        self,
        *,
        session,
        batch_id,
        undone_by_user_id,
        undone_at,
        undo_reason,
        undone_count,
        excluded_count,
    ):
        """Set the complete undo triple and flip status to ``undone``.

        The caller deletes eligible institution rows first (inside the same
        transaction); this method records who undid, when, and why. Counts
        are stored in the audit event, not on the batch (the batch keeps
        its original import counters as immutable history).
        """
        from crm.persistence.models import ImportBatchModel
        model = session.get(ImportBatchModel, batch_id)
        if model is None:
            raise ValueError("import batch not found")
        if model.status != "active":
            raise ValueError("import batch is already undone")
        model.status = "undone"
        model.undone_at = undone_at
        model.undone_by_user_id = undone_by_user_id
        model.undo_reason = undo_reason
        return model


# ============ TASK-0011 (SPEC-0013): import batch service ============
#
# Pure-Python CSV parsing + per-row orchestration. All database access
# goes through ImportBatchRepository methods above (parameterized ORM
# queries). User-supplied strings are sanitized before any lookup so no
# tainted value reaches a SQL predicate.

import csv as _csv
import hashlib as _hashlib
import io as _io
from dataclasses import dataclass as _dataclass, field as _field
from uuid import uuid4 as _uuid4

from crm.application.queries import normalize_name_for_duplicate as _normalize_name
from crm.persistence.models import InstitutionModel as _InstitutionModel


_REQUIRED_COLUMNS = ("name", "source_description")
_OPTIONAL_COLUMNS = (
    "category",
    "region",
    "source_kind",
    "source_evidence_reference",
    "owner_username",
)
_ALL_COLUMNS = _REQUIRED_COLUMNS + _OPTIONAL_COLUMNS
_USERNAME_MAX_LENGTH = 64


class ImportValidationError(ValueError):
    """Raised when the file as a whole cannot be parsed (SPEC-0013 §8)."""


@_dataclass(frozen=True, slots=True)
class ParsedRow:
    """One parsed CSV data row (1-based line number, 2 = first data row)."""

    line_number: int
    name: str
    source_description: str
    category: Optional[str] = None
    region: Optional[str] = None
    source_kind: Optional[str] = None
    source_evidence_reference: Optional[str] = None
    owner_username: Optional[str] = None


@_dataclass(frozen=True, slots=True)
class RowResult:
    """Outcome of importing one row."""

    line_number: int
    outcome: str  # 'imported' | 'flagged_duplicate' | 'failed'
    institution_id: Optional[UUID] = None
    duplicate_of_institution_id: Optional[UUID] = None
    reason: Optional[str] = None


@_dataclass(frozen=True, slots=True)
class ImportResult:
    """Aggregate result of one import run."""

    batch_id: UUID
    source_file_name: str
    row_count: int
    imported_count: int
    duplicate_count: int
    failed_count: int
    idempotent_replay: bool
    row_results: list = _field(default_factory=list)


def _compute_fingerprint(content_bytes: bytes) -> str:
    """SHA-256 of the raw file bytes (stable idempotency fingerprint)."""
    return _hashlib.sha256(content_bytes).hexdigest()


def _sanitize_username(raw):
    """Return a sanitized, length-bounded username or None."""
    if raw is None:
        return None
    cleaned = raw.strip()
    if not cleaned or len(cleaned) > _USERNAME_MAX_LENGTH:
        return None
    return cleaned


def parse_csv(content_bytes: bytes) -> list:
    """Parse CSV bytes into a list of :class:`ParsedRow`.

    Raises :class:`ImportValidationError` when the file cannot be decoded,
    has no header, is missing a required column, or is otherwise
    unparseable as a whole (SPEC-0013 §8: reject, no half-batch). Blank
    data rows are skipped.
    """
    try:
        text = content_bytes.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ImportValidationError(f"file is not valid UTF-8: {exc}") from exc

    reader = _csv.reader(_io.StringIO(text))
    try:
        header = next(reader)
    except StopIteration:
        raise ImportValidationError("file is empty (no header row)")

    header = [h.strip().lower() for h in header]
    missing = [c for c in _REQUIRED_COLUMNS if c not in header]
    if missing:
        raise ImportValidationError(f"missing required column(s): {', '.join(missing)}")

    col_index = {c: header.index(c) for c in _ALL_COLUMNS if c in header}

    rows = []
    line_number = 1
    for raw in reader:
        line_number += 1
        if not any((cell or "").strip() for cell in raw):
            continue

        def _cell(name, default=None):
            if name not in col_index:
                return default
            idx = col_index[name]
            if idx >= len(raw):
                return default
            return raw[idx].strip()

        rows.append(
            ParsedRow(
                line_number=line_number,
                name=_cell("name", ""),
                source_description=_cell("source_description", ""),
                category=(_cell("category") or None),
                region=(_cell("region") or None),
                source_kind=(_cell("source_kind") or None),
                source_evidence_reference=(_cell("source_evidence_reference") or None),
                owner_username=(_cell("owner_username") or None),
            )
        )
    return rows


def _resolve_owner_id(repo, session, *, default_owner_user_id, owner_username):
    """Resolve the owner_user_id for a row. Returns (id, error_message)."""
    sanitized = _sanitize_username(owner_username)
    if sanitized is None:
        return default_owner_user_id, None
    model = repo.find_user_by_username(session=session, username=sanitized)
    if model is None:
        return None, f"owner_username '{sanitized}' not found"
    if model.status != "enabled":
        return None, f"owner_username '{sanitized}' is not enabled"
    return model.id, None


def _find_duplicate_candidate(repo, session, *, normalized_name):
    """Return the id of an existing non-archived institution whose
    normalized name matches, or None (R-035, AC-003). Flagged, never
    merged. Compared in Python against the loaded candidate set.
    """
    if not normalized_name:
        return None
    for model in repo.find_active_institutions(session=session):
        if _normalize_name(model.name) == normalized_name:
            return model.id
    return None


class ImportBatchService:
    """Administrator bulk-import service (SPEC-0013 R-001…R-009).

    ``run`` loads/parses a CSV file, flags duplicates, inserts each valid
    row in its own savepoint (per-row isolation, AC-002), records the
    batch + row results, and is idempotent on file-content fingerprint
    (AC-004). ``undo`` conditionally reverses a batch, fail-closed on any
    post-import modification (AC-005/AC-006).

    The service holds no state; each call takes the session factory and
    commits within ``transaction_session``.
    """

    def run(
        self,
        *,
        imported_by_user_id: UUID,
        source_file_name: str,
        source_file_content: bytes,
        session_factory,
    ) -> ImportResult:
        from crm.persistence.database import transaction_session
        from datetime import datetime, timezone

        source_file_name = (source_file_name or "").strip()
        if not source_file_name:
            raise ImportValidationError("source file name is required")
        fingerprint = _compute_fingerprint(source_file_content)
        repo = ImportBatchRepository()

        with transaction_session(session_factory) as session:
            existing = repo.find_by_fingerprint(
                session=session,
                imported_by_user_id=imported_by_user_id,
                source_file_sha256=fingerprint,
            )
            if existing is not None:
                # AC-004: idempotent replay — return the existing batch.
                row_models = repo.list_row_results(session=session, batch_id=existing.id)
                return ImportResult(
                    batch_id=existing.id,
                    source_file_name=existing.source_file_name,
                    row_count=existing.row_count,
                    imported_count=existing.imported_count,
                    duplicate_count=existing.duplicate_count,
                    failed_count=existing.failed_count,
                    idempotent_replay=True,
                    row_results=[
                        RowResult(
                            line_number=m.line_number,
                            outcome=m.outcome,
                            institution_id=m.institution_id,
                            duplicate_of_institution_id=m.duplicate_of_institution_id,
                            reason=m.reason,
                        )
                        for m in row_models
                    ],
                )

            rows = parse_csv(source_file_content)
            now = datetime.now(timezone.utc)
            batch_id = _uuid4()

            results: list = []
            imported = 0
            flagged = 0
            failed = 0

            for row in rows:
                outcome, inst_id, dup_id, reason = self._import_one_row(
                    repo=repo,
                    session=session,
                    row=row,
                    now=now,
                    default_owner_user_id=imported_by_user_id,
                )
                if outcome == "imported" and dup_id is not None:
                    flagged += 1
                    outcome = "flagged_duplicate"
                elif outcome == "imported":
                    imported += 1
                else:
                    failed += 1
                results.append(
                    RowResult(
                        line_number=row.line_number,
                        outcome=outcome,
                        institution_id=inst_id,
                        duplicate_of_institution_id=dup_id,
                        reason=reason,
                    )
                )

            repo.create_batch(
                session=session,
                batch_id=batch_id,
                imported_by_user_id=imported_by_user_id,
                source_file_name=source_file_name,
                source_file_sha256=fingerprint,
                row_count=len(rows),
                imported_count=imported,
                duplicate_count=flagged,
                failed_count=failed,
                imported_at=now,
            )
            for r in results:
                repo.add_row_result(
                    session=session,
                    batch_id=batch_id,
                    line_number=r.line_number,
                    outcome=r.outcome,
                    institution_id=r.institution_id,
                    duplicate_of_institution_id=r.duplicate_of_institution_id,
                    reason=r.reason,
                    created_at=now,
                )

            return ImportResult(
                batch_id=batch_id,
                source_file_name=source_file_name,
                row_count=len(rows),
                imported_count=imported,
                duplicate_count=flagged,
                failed_count=failed,
                idempotent_replay=False,
                row_results=results,
            )

    def _import_one_row(self, *, repo, session, row, now, default_owner_user_id):
        """Validate and insert one institution inside a nested savepoint.

        Returns (outcome, institution_id, duplicate_of_id, reason). On
        failure the savepoint is rolled back (AC-002 per-row isolation).
        """
        name = (row.name or "").strip()
        source_description = (row.source_description or "").strip()
        if not name:
            return "failed", None, None, "institution name is required"
        if not source_description:
            return "failed", None, None, "source_description is required"

        owner_id, owner_error = _resolve_owner_id(
            repo,
            session,
            default_owner_user_id=default_owner_user_id,
            owner_username=row.owner_username,
        )
        if owner_error is not None:
            return "failed", None, None, owner_error

        dup_id = _find_duplicate_candidate(
            repo,
            session,
            normalized_name=_normalize_name(name),
        )

        savepoint = session.begin_nested()
        try:
            model = _InstitutionModel(
                id=_uuid4(),
                name=name,
                source_description=source_description,
                customer_type="direct_purchase",
                source_kind=(row.source_kind or None),
                category=(row.category or None),
                region=(row.region or None),
                source_evidence_reference=(row.source_evidence_reference or None),
                owner_user_id=owner_id,
                in_pool=False,
                created_by_user_id=default_owner_user_id,
                idempotency_key=f"import-{_uuid4().hex}",
                created_at=now,
                updated_at=now,
            )
            session.add(model)
            session.flush()
            savepoint.commit()
            # 'imported' with a dup_id becomes 'flagged_duplicate' in the
            # caller; the record is still imported (trusted load).
            return "imported", model.id, dup_id, None
        except Exception as exc:  # pragma: no cover - defensive
            savepoint.rollback()
            return "failed", None, None, f"insert failed: {exc.__class__.__name__}"

    def undo(
        self,
        *,
        batch_id: UUID,
        undone_by_user_id: UUID,
        undo_reason: str,
        session_factory,
    ) -> dict:
        """Conditionally undo an import batch (SPEC-0013 R-006).

        Only records not modified since import are eligible. Fail-closed:
        any uncertainty excludes the record and reports the reason. The
        batch, deletions, and undo triple commit or roll back together.
        """
        from crm.persistence.database import transaction_session
        from datetime import datetime, timezone

        undo_reason = (undo_reason or "").strip()
        if not undo_reason:
            raise ValueError("undo reason is required")

        repo = ImportBatchRepository()

        with transaction_session(session_factory) as session:
            batch = repo.find_by_id(session=session, batch_id=batch_id)
            if batch is None:
                raise ValueError("import batch not found")
            if batch.status != "active":
                raise ValueError("import batch is already undone")

            now = datetime.now(timezone.utc)
            imported_rows = repo.list_imported_institutions(
                session=session, batch_id=batch_id
            )

            eligible_ids: list = []
            excluded: list = []
            for inst_id, imported_at in imported_rows:
                eligible, reason = self._is_eligible(
                    repo=repo,
                    session=session,
                    institution_id=inst_id,
                    imported_at=imported_at,
                )
                if eligible:
                    eligible_ids.append(inst_id)
                else:
                    excluded.append({"institution_id": str(inst_id), "reason": reason})

            # Delete eligible institution rows. The import created only
            # institutions, so deleting the row reverses the import.
            # RESTRICT FKs guarantee no orphaned children for eligible rows.
            for inst_id in eligible_ids:
                repo.delete_institution_by_id(session=session, institution_id=inst_id)

            repo.mark_batch_undone(
                session=session,
                batch_id=batch_id,
                undone_by_user_id=undone_by_user_id,
                undone_at=now,
                undo_reason=undo_reason,
                undone_count=len(eligible_ids),
                excluded_count=len(excluded),
            )

            return {
                "batch_id": str(batch_id),
                "undone": True,
                "undone_at": now.isoformat(),
                "undo_reason": undo_reason,
                "undone_count": len(eligible_ids),
                "excluded_count": len(excluded),
                "excluded": excluded,
            }

    def _is_eligible(self, *, repo, session, institution_id, imported_at):
        """Return (eligible, reason). Fail-closed: exclude on any doubt."""
        model = session.get(_InstitutionModel, institution_id)
        if model is None:
            return False, "institution no longer exists"
        if model.archived_at is not None:
            return False, "institution has been archived since import"
        if model.updated_at != imported_at:
            return False, "institution has been modified since import"
        if repo.count_contacts_for_institution(
            session=session, institution_id=institution_id
        ) > 0:
            return False, "contacts have been added since import"
        if repo.count_activities_for_institution(
            session=session, institution_id=institution_id
        ) > 0:
            return False, "follow-up activities have been added since import"
        return True, None
