"""Queries for reading business entities with policy-based field masking.

S4 application queries aligned with S3 policy projection layer.
All read access decisions flow through project_record() central policy.
"""

from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field

from crm.domain.models import (
    Institution,
    Contact,
    FollowUpActivity,
    UserStatus,
    Role,
    ContentAttribution,
    AiReviewStatus,
    ContactabilityStatus,
    split_stored_interaction_method,
)
from crm.policy import (
    project_record,
    PolicySubject,
    RecordSnapshot,
    ActivitySummarySource,
    PolicyDenied
)


def _normalize_reason(value: str | None) -> str | None:
    """Canonical reason normalizer (mirrors policy's ``_optional_text``).

    A whitespace-only value is treated as None so that a blank
    ``administrator_reason`` behaves exactly like omitted input at every
    owned boundary: no withdrawn activities, no ``ADMINISTRATOR_EXCEPTION``
    view, and no ``admin.exception_read`` audit.
    """
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


# ============ Query Results (Pydantic models for API serialization) ============

class InstitutionSummary(BaseModel):
    """Minimal institution summary for listing views."""
    id: UUID
    name: str
    customer_type: Optional[str] = None
    in_pool: bool = False
    category: Optional[str] = None
    region: Optional[str] = None
    source_category: Optional[str] = None
    owner_user_id: Optional[UUID] = None
    custodian_user_id: Optional[UUID] = None

    @classmethod
    def from_projection(cls, data: dict) -> "InstitutionSummary":
        """Build a summary from a policy projection payload."""
        inst = data.get("institution", {})
        return cls(
            id=inst["id"],
            name=inst["name"],
            customer_type=inst.get("customer_type"),
            in_pool=bool(inst.get("in_pool")),
            category=inst.get("category"),
            region=inst.get("region"),
            source_category=inst.get("source_category"),
            owner_user_id=inst.get("owner_user_id"),
            custodian_user_id=inst.get("custodian_user_id"),
        )


class InstitutionDetail(BaseModel):
    """Full institution detail with all visible fields."""
    id: UUID
    name: str
    customer_type: Optional[str] = None
    in_pool: bool = False
    category: Optional[str] = None
    region: Optional[str] = None
    owner_user_id: Optional[UUID] = None
    source_description: Optional[str] = None
    source_kind: Optional[str] = None
    source_evidence_reference: Optional[str] = None
    contacts: List = Field(default_factory=list)
    activities: List = Field(default_factory=list)
    concise_progress: Optional[dict] = None

    @staticmethod
    def _unfreeze(value):
        """Convert frozen mappingproxy projection payloads to plain JSON-safe
        dicts/lists (the policy layer freezes every nested mapping)."""
        if isinstance(value, dict) or hasattr(value, "items") and not isinstance(value, (str, bytes)):
            return {k: InstitutionDetail._unfreeze(v) for k, v in value.items()}
        if isinstance(value, (tuple, list)):
            return [InstitutionDetail._unfreeze(v) for v in value]
        return value

    @classmethod
    def from_projection(cls, data: dict) -> "InstitutionDetail":
        """Build a detail from a policy projection payload."""
        inst = data.get("institution", {})
        return cls(
            id=inst["id"],
            name=inst["name"],
            customer_type=inst.get("customer_type"),
            in_pool=bool(inst.get("in_pool")),
            category=inst.get("category"),
            region=inst.get("region"),
            owner_user_id=inst.get("owner_user_id"),
            source_description=inst.get("source_description"),
            source_kind=inst.get("source_kind"),
            source_evidence_reference=inst.get("source_evidence_reference"),
            contacts=[cls._unfreeze(c) for c in (data.get("contacts") or [])],
            activities=[cls._unfreeze(a) for a in (data.get("activities") or [])],
            concise_progress=cls._unfreeze(data.get("concise_progress")),
        )


class ContactSummary(BaseModel):
    """Minimal contact summary."""
    id: UUID
    name_masked: Optional[str] = None
    role_label: Optional[str] = None
    job_title: Optional[str] = None
    has_storable_channel: bool = False


class ContactDetail(BaseModel):
    """Full contact detail as returned to the creating owner.

    ``name`` carries the contact's real name: this response model is used on
    the creation path where the owner sees their own input, not the masked
    collaborator view (the masked name lives in ``ContactSummary.name_masked``).
    """
    id: UUID
    name: Optional[str] = None
    role_label: Optional[str] = None
    job_title: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    wechat: Optional[str] = None
    other_channel: Optional[str] = None
    channel_notes: Optional[str] = None
    contactability_status: Optional[str] = None
    institution_id: UUID
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ActivitySummary(BaseModel):
    """Minimal follow-up activity summary."""
    id: UUID
    occurred_at: str
    interaction_method: str
    shared_summary: Optional[str] = None
    target_type: str = ""
    target_id: str = ""
    has_next_action: bool = False
    next_action_target_date: Optional[str] = None


class ActivityDetail(BaseModel):
    """Full activity detail with all visible fields."""
    id: UUID
    occurred_at: str
    interaction_method: str
    factual_body: Optional[str] = None
    participants: Optional[str] = None
    customer_needs: Optional[str] = None
    decision_participants: Optional[str] = None
    objections_constraints: Optional[str] = None
    commitments: Optional[str] = None
    next_action: Optional[str] = None
    facts_to_verify: Optional[str] = None
    evidence_reference: Optional[str] = None
    shared_summary: Optional[str] = None
    content_attribution: Optional[str] = None
    ai_review_status: Optional[str] = None
    recorded_at: Optional[str] = None


# ============ R-035 duplicate-suspicion detection (create-time) ============


def normalize_name_for_duplicate(value: str) -> str:
    """R-035 institution normalized-name basis: trim + collapse internal
    whitespace + casefold. Exact match only; no fuzzy/region matching
    (DEC-0080 engineering default)."""
    return " ".join((value or "").strip().split()).casefold()


def normalize_channel_for_duplicate(value: str) -> str:
    """R-035 contact channel basis: trim + casefold (channel identifiers are
    compared exactly; no fuzzy matching)."""
    return (value or "").strip().casefold()


def _category_from_stored_method(value: str) -> str | None:
    """R-029: extract the communication-method category from the stored
    interaction_method value (【category】 prefix); None when absent."""
    category, _ = split_stored_interaction_method(value or "")
    return category


class QueryService:
    """
    Service layer for read operations using S3 policy projection.
    
    All queries use project_record() central policy to ensure
    consistent field masking across pages, APIs, and exports.
    """
    
    def __init__(self, institution_repo, contact_repo, activity_repo):
        self.institution_repo = institution_repo
        self.contact_repo = contact_repo
        self.activity_repo = activity_repo
    
    def find_institutions(
        self,
        user_id: UUID,
        user_status: UserStatus,
        roles: frozenset[Role],
        management_scope_keys: frozenset[str] = frozenset(),
        search_terms: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
        administrator_reason: Optional[str] = None,
    ) -> list[InstitutionSummary]:
        """List institutions with policy-based access control.

        ``administrator_reason`` is an optional trace value (SPEC-0002
        v0.4.0 R-008): the administrator reads every record in full detail
        without a reason; a supplied reason is passed to ``project_record``
        and the caller may record it. A non-administrator subject is never
        upgraded by supplying a reason. The caller is responsible for
        writing the optional audit event for every returned record.
        """
        
        # Create policy subject
        subject = PolicySubject(
            user_id=user_id,
            status=user_status,
            roles=roles,
            management_scope_keys=management_scope_keys
        )

        # R-031/R-008: normalize the reason once (strip() or None) so a
        # whitespace-only value is treated as omitted at every boundary:
        # project_record and the caller's optional audit decision.
        normalized_reason = _normalize_reason(administrator_reason)

        # R-008 (SPEC-0002 v0.4.0): the administrator always sees full
        # detail, so withdrawn activities are always included for admin.
        include_withdrawn = Role.ADMINISTRATOR in roles or Role.SHAREHOLDER in roles

        # SPEC-0008 R-003/R-008: the searchable predicate must only match
        # fields the caller can see. The administrator sees all records in
        # detail (R-008), so may search source_description/source_kind;
        # collaborator and management views may only search visible fields.
        if Role.ADMINISTRATOR in roles or Role.SHAREHOLDER in roles:
            searchable_fields = frozenset({
                "name", "category", "region",
                "source_description", "source_kind",
            })
        elif Role.BUSINESS_USER in roles or Role.MANAGER in roles:
            searchable_fields = frozenset({"name", "category", "region"})
        else:
            # No searchable role: deny match on any field.
            searchable_fields = frozenset()

        results = []
        institutions = self.institution_repo.find_all(
            search_terms, limit, offset,
            searchable_fields=searchable_fields,
        )

        for institution in institutions:
            try:
                # Build record snapshot
                contacts = self.contact_repo.find_by_institution(institution.id)
                activities = self.activity_repo.find_by_target(
                    "institution", str(institution.id),
                    include_withdrawn=include_withdrawn,
                )

                # R2 fix (DEC-0101 residual): populate management_scope_key
                # from institution.region so a scoped MANAGER whose
                # scope_reference matches the region gains COLLABORATOR access
                # (SPEC-0002 R-020). A None region means no scope match →
                # fail-closed deny, exactly R-020's "没有明确管理范围时默认
                # 不返回业务数据".
                snapshot = RecordSnapshot(
                    institution=institution,
                    contacts=tuple(contacts),
                    activities=tuple(
                        ActivitySummarySource(
                            activity, _category_from_stored_method(activity.interaction_method)
                        ) for activity in activities
                    ),
                    management_scope_key=institution.region,
                )

                # Apply policy projection
                projection = project_record(
                    subject, snapshot, administrator_reason=normalized_reason
                )
                results.append(InstitutionSummary.from_projection(projection.data))

            except PolicyDenied:
                # Skip institutions this user cannot access
                continue
        
        return results
    
    def count_visible_institutions(
        self,
        user_id: UUID,
        user_status: UserStatus,
        roles: frozenset[Role],
        management_scope_keys: frozenset[str] = frozenset(),
    ) -> int:
        """Count institutions visible to the subject via policy projection."""
        from crm.policy.projection import project_record, PolicyDenied, RecordSnapshot

        subject = PolicySubject(
            user_id=user_id,
            status=user_status,
            roles=roles,
            management_scope_keys=management_scope_keys,
        )
        all_insts = self.institution_repo.find_active_for_duplicate_check()
        total = 0
        for inst in all_insts:
            try:
                project_record(subject, RecordSnapshot(
                    institution=inst,
                    contacts=(),
                    activities=(),
                    management_scope_key=inst.region,
                ))
            except PolicyDenied:
                continue
            total += 1
        return total
    
    def get_institution_detail(
        self,
        institution_id: UUID,
        user_id: UUID,
        user_status: UserStatus,
        roles: frozenset[Role],
        management_scope_keys: frozenset[str] = frozenset(),
        administrator_reason: Optional[str] = None,
    ) -> Optional[InstitutionDetail]:
        """Get full institution detail with policy-based field masking.

        ``administrator_reason`` enables the audited administrator-exception
        view (R-015): passed to ``project_record`` so an administrator-only
        subject can read a record they do not own; a non-administrator
        subject is never upgraded by supplying a reason (the policy only
        opens the exception branch for ``ADMINISTRATOR`` + non-blank reason).
        The caller is responsible for writing the audit event after a
        successful exception read.
        """
        
        # Fetch raw entity
        institution = self.institution_repo.find_by_id(institution_id)
        if not institution:
            return None
        
        # Create policy subject
        subject = PolicySubject(
            user_id=user_id,
            status=user_status,
            roles=roles,
            management_scope_keys=management_scope_keys
        )

        # R-031/R-015: normalize the reason once so a whitespace-only value
        # is treated as omitted at every boundary.
        normalized_reason = _normalize_reason(administrator_reason)

        try:
            # Build record snapshot
            # R-008 (SPEC-0002 v0.4.0): the administrator always sees full
            # detail, so withdrawn activities are always included for admin.
            include_withdrawn = Role.ADMINISTRATOR in roles or Role.SHAREHOLDER in roles
            contacts = self.contact_repo.find_by_institution(institution_id)
            activities = self.activity_repo.find_by_target(
                "institution", str(institution_id),
                include_withdrawn=include_withdrawn,
            )

            snapshot = RecordSnapshot(
                institution=institution,
                contacts=tuple(contacts),
                activities=tuple(
                    ActivitySummarySource(
                        activity, _category_from_stored_method(activity.interaction_method)
                    ) for activity in activities
                ),
                management_scope_key=institution.region,
            )

            # Apply policy projection (R-008: the administrator reads full
            # detail without needing a reason; reason is optional trace).
            projection = project_record(
                subject, snapshot, administrator_reason=normalized_reason
            )
            
            # Build detail from projection (contacts/activities arrive in
            # policy-projection order from project_record; no per-contact
            # re-projection pass is needed here — get_contacts() covers the
            # dedicated contact list path).
            detail = InstitutionDetail.from_projection(projection.data)
            
            return detail
            
        except PolicyDenied:
            return None
    
    def get_contacts(
        self,
        institution_id: UUID,
        user_id: UUID,
        user_status: UserStatus,
        roles: frozenset[Role],
        management_scope_keys: frozenset[str] = frozenset()
    ) -> list[ContactSummary]:
        """List contacts for an institution with policy-based masking."""
        
        # Create policy subject
        subject = PolicySubject(
            user_id=user_id,
            status=user_status,
            roles=roles,
            management_scope_keys=management_scope_keys
        )
        
        contacts = self.contact_repo.find_by_institution(institution_id)
        results = []
        
        for contact in contacts:
            try:
                # Build minimal snapshot
                institution = self.institution_repo.find_by_id(institution_id)
                if not institution:
                    continue
                
                snapshot = RecordSnapshot(
                    institution=institution,
                    contacts=(contact,),
                    activities=(),
                    management_scope_key=institution.region,
                )
                
                # Apply policy projection
                projection = project_record(subject, snapshot)
                proj_contact_data = projection.data.get("contacts", [{}])[0]
                
                results.append(ContactSummary(
                    id=str(projection.data["contacts"][0].get("id")),
                    name_masked=proj_contact_data.get("name_masked"),
                    role_label=proj_contact_data.get("role_label"),
                    job_title=proj_contact_data.get("job_title"),
                    has_storable_channel=proj_contact_data.get("has_storable_channel", False)
                ))
                
            except PolicyDenied:
                continue
        
        return results
    
    def get_activity_summaries(
        self,
        target_type: str,
        target_id: UUID,
        user_id: UUID,
        user_status: UserStatus,
        roles: frozenset[Role],
        management_scope_keys: frozenset[str] = frozenset()
    ) -> list[ActivitySummary]:
        """Get ordered follow-up activities with policy-based masking."""
        
        if target_type != "institution":
            return []
        
        # Create policy subject
        subject = PolicySubject(
            user_id=user_id,
            status=user_status,
            roles=roles,
            management_scope_keys=management_scope_keys
        )
        
        try:
            # Fetch institution and build full snapshot
            institution = self.institution_repo.find_by_id(target_id)
            if not institution:
                return []
            
            activities = self.activity_repo.find_by_target("institution", str(target_id))
            
            snapshot = RecordSnapshot(
                institution=institution,
                contacts=tuple(self.contact_repo.find_by_institution(target_id)),
                activities=tuple(
                    ActivitySummarySource(
                        activity, _category_from_stored_method(activity.interaction_method)
                    ) for activity in activities
                ),
                management_scope_key=institution.region,
            )
            
            projection = project_record(subject, snapshot)
            
            results = []
            for act_data in projection.data.get("activities", []):
                results.append(ActivitySummary(
                    id=str(act_data.get("id")),
                    occurred_at=act_data.get("occurred_at", "").isoformat() 
                        if hasattr(act_data.get("occurred_at"), "isoformat")
                        else str(act_data.get("occurred_at")),
                    interaction_method=act_data.get("interaction_method"),
                    shared_summary=act_data.get("shared_summary"),
                    target_type=target_type,
                    target_id=str(target_id),
                    has_next_action=act_data.get("next_action") is not None,
                    next_action_target_date=
                        act_data.get("next_action_target_date").isoformat() 
                            if hasattr(act_data.get("next_action_target_date"), "isoformat")
                            else str(act_data.get("next_action_target_date"))
                ))
            
            return results
            
        except PolicyDenied:
            return []

    def detect_duplicate_institutions(
        self,
        name: str,
        user_id: UUID,
        user_status: UserStatus,
        roles: frozenset[Role],
        management_scope_keys: frozenset[str] = frozenset(),
    ) -> list[dict]:
        """R-035 institution duplicate candidates visible to this subject.

        Exact normalized-name match (trim + collapse internal whitespace +
        casefold) against existing non-archived institutions. Every candidate
        is projected through ``project_record``; candidates the subject may
        not see are skipped, so the returned detail never carries fields the
        caller is not allowed to read (AC-028 no-leak). Never merges or
        overwrites.
        """
        normalized = normalize_name_for_duplicate(name)
        if not normalized:
            return []

        subject = PolicySubject(
            user_id=user_id,
            status=user_status,
            roles=roles,
            management_scope_keys=management_scope_keys,
        )

        results = []
        for candidate in self.institution_repo.find_active_for_duplicate_check():
            if normalize_name_for_duplicate(candidate.name) != normalized:
                continue
            try:
                projection = project_record(
                    subject,
                    RecordSnapshot(
                        institution=candidate,
                        contacts=(),
                        activities=(),
                        management_scope_key=candidate.region,
                    ),
                )
            except PolicyDenied:
                continue
            inst = projection.data.get("institution", {})
            results.append({
                "id": str(inst["id"]),
                "name": inst["name"],
                "category": inst.get("category"),
                "region": inst.get("region"),
            })
        return results

    def detect_duplicate_contacts(
        self,
        institution_id: UUID,
        *,
        phone: Optional[str] = None,
        email: Optional[str] = None,
        wechat: Optional[str] = None,
        user_id: UUID,
        user_status: UserStatus,
        roles: frozenset[Role],
        management_scope_keys: frozenset[str] = frozenset(),
    ) -> list[dict]:
        """R-035 contact duplicate candidates inside one institution.

        Exact match on the same non-empty channel value (phone / email /
        wechat, each normalized trim + casefold) among the institution's
        existing contacts. Candidates are projected through
        ``project_record`` and skipped on ``PolicyDenied`` (AC-028 no-leak).
        Contacts without any storable channel are never compared (nothing to
        match). Never merges or overwrites.
        """
        channels = {
            label: normalized
            for label, value in (("phone", phone), ("email", email), ("wechat", wechat))
            if value is not None
            and (normalized := normalize_channel_for_duplicate(value))
        }
        if not channels:
            return []

        institution = self.institution_repo.find_by_id(institution_id)
        if institution is None:
            return []

        subject = PolicySubject(
            user_id=user_id,
            status=user_status,
            roles=roles,
            management_scope_keys=management_scope_keys,
        )

        results = []
        for contact in self.contact_repo.find_by_institution(institution_id):
            matched = any(
                normalize_channel_for_duplicate(getattr(contact, label) or "")
                == normalized
                for label, normalized in channels.items()
            )
            if not matched:
                continue
            try:
                projection = project_record(
                    subject,
                    RecordSnapshot(
                        institution=institution,
                        contacts=(contact,),
                        activities=(),
                        management_scope_key=institution.region,
                    ),
                )
            except PolicyDenied:
                continue
            data = projection.data.get("contacts", [{}])[0]
            results.append({
                "id": str(data.get("id")),
                "name_display": data.get("name_masked") or data.get("name"),
                "role_label": data.get("role_label"),
                "job_title": data.get("job_title"),
            })
        return results

    def get_management_summary(
        self,
        user_id: UUID,
        user_status: UserStatus,
        roles: frozenset[Role],
        management_scope_keys: frozenset[str] = frozenset(),
    ) -> dict:
        """Read-only management summary (SPEC-0002 R-019/R-020/R-021,
        AC-013/AC-014/AC-015/AC-017).

        ADMINISTRATOR sees company-wide summaries. Scoped MANAGER sees
        only records within their authorized scope (region matches a
        management_scope_key). The summary is computed from the collaborator
        projection (masked) — no raw contact values, factual_body, or
        source_description. Small-sample groups (<3 records) suppress
        breakdown to prevent inference (R-023/AC-017).

        Returns counts and concise_progress only. Read-only: no write
        capability is exposed (R-021/AC-015).
        """
        if Role.ADMINISTRATOR not in roles and Role.MANAGER not in roles and Role.SHAREHOLDER not in roles:
            return {"total": 0, "active": 0, "archived": 0,
                    "has_next_action": 0, "scope": "none", "breakdown": []}

        subject = PolicySubject(
            user_id=user_id,
            status=user_status,
            roles=roles,
            management_scope_keys=management_scope_keys,
        )

        # Fetch all institutions (non-archived only for the summary).
        institutions = self.institution_repo.find_active_for_duplicate_check()

        visible_count = 0
        archived_count = 0
        has_next_action_count = 0
        latest_dates: list[str] = []

        for institution in institutions:
            try:
                activities = self.activity_repo.find_by_target(
                    "institution", str(institution.id),
                )
                snapshot = RecordSnapshot(
                    institution=institution,
                    contacts=tuple(self.contact_repo.find_by_institution(institution.id)),
                    activities=tuple(
                        ActivitySummarySource(
                            a, _category_from_stored_method(a.interaction_method)
                        ) for a in activities
                    ),
                    management_scope_key=institution.region,
                )
                projection = project_record(subject, snapshot)
            except PolicyDenied:
                continue

            visible_count += 1
            cp = projection.data.get("concise_progress", {})
            if cp.get("has_next_action"):
                has_next_action_count += 1
            latest = cp.get("latest_follow_up_date")
            if latest is not None:
                latest_dates.append(str(latest))

        # R-023/AC-017: suppress breakdown for small samples.
        breakdown = []
        if visible_count >= 3:
            breakdown = [
                {"metric": "visible_institutions", "count": visible_count},
                {"metric": "has_next_action", "count": has_next_action_count},
            ]

        scope = "company" if (Role.ADMINISTRATOR in roles or Role.SHAREHOLDER in roles) else "scoped"

        return {
            "total": visible_count,
            "active": visible_count,
            "archived": archived_count,
            "has_next_action": has_next_action_count,
            "scope": scope,
            "breakdown": breakdown,
        }


