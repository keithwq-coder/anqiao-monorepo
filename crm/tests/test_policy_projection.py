from dataclasses import replace
from datetime import date, datetime, timezone
from uuid import UUID, uuid4

import pytest

from crm.domain import (
    Contact,
    ContactabilityStatus,
    CustomerType,
    FollowUpActivity,
    Institution,
    Role,
    UserStatus,
)
from crm.policy import (
    ActivitySummarySource,
    PolicyDenied,
    PolicyInputError,
    PolicySubject,
    RecordSnapshot,
    RecordViewLevel,
    project_record,
)


OWNER_ID = UUID("00000000-0000-0000-0000-000000000001")
OTHER_USER_ID = UUID("00000000-0000-0000-0000-000000000002")
ADMIN_USER_ID = UUID("00000000-0000-0000-0000-000000000003")
MANAGER_USER_ID = UUID("00000000-0000-0000-0000-000000000004")
SHAREHOLDER_USER_ID = UUID("00000000-0000-0000-0000-000000000005")
INSTITUTION_ID = UUID("00000000-0000-0000-0000-000000000010")
EARLIER = datetime(2026, 7, 20, 9, 0, tzinfo=timezone.utc)
LATER = datetime(2026, 7, 21, 10, 0, tzinfo=timezone.utc)


def enabled_subject(user_id: UUID, *roles: Role, scopes: tuple[str, ...] = ()) -> PolicySubject:
    return PolicySubject(
        user_id=user_id,
        status=UserStatus.ENABLED,
        roles=frozenset(roles),
        management_scope_keys=frozenset(scopes),
    )


def sample_record() -> RecordSnapshot:
    institution = Institution(
        id=INSTITUTION_ID,
        name="Synthetic Care Institution",
        source_description="Synthetic referral source detail",
        customer_type=CustomerType.DIRECT_PURCHASE,
        source_kind="synthetic-private-source-kind",
        source_evidence_reference="synthetic-evidence-reference",
        category="care",
        region="synthetic-region",
        owner_user_id=OWNER_ID,
        created_by_user_id=OWNER_ID,
        idempotency_key="institution-submission-key",
        created_at=EARLIER,
        updated_at=LATER,
    )
    contact = Contact(
        institution_id=INSTITUTION_ID,
        created_by_user_id=OWNER_ID,
        contactability_status=ContactabilityStatus.AVAILABLE,
        idempotency_key="contact-submission-key",
        name="Synthetic Contact",
        role_label="Procurement contact",
        job_title="Director",
        phone="synthetic-phone-value",
        email="synthetic@example.invalid",
        wechat="synthetic-wechat",
        other_channel="synthetic-other-channel",
        channel_notes="Synthetic channel note",
        created_at=EARLIER,
        updated_at=LATER,
    )
    earlier_activity = FollowUpActivity(
        id=UUID("00000000-0000-0000-0000-000000000021"),
        institution_id=INSTITUTION_ID,
        recorded_by_user_id=OWNER_ID,
        occurred_at=EARLIER,
        interaction_method="Synthetic detailed call method",
        factual_body="Synthetic earlier raw follow-up body",
        idempotency_key="activity-submission-key-earlier",
        shared_summary="Synthetic earlier shared summary",
        recorded_at=EARLIER,
    )
    later_activity = FollowUpActivity(
        id=UUID("00000000-0000-0000-0000-000000000022"),
        institution_id=INSTITUTION_ID,
        recorded_by_user_id=OWNER_ID,
        occurred_at=LATER,
        interaction_method="Synthetic detailed meeting method",
        factual_body="Synthetic latest raw follow-up body",
        idempotency_key="activity-submission-key-later",
        shared_summary="Synthetic latest shared summary",
        next_action="Synthetic next action",
        next_action_owner_user_id=OWNER_ID,
        next_action_target_date=date(2026, 7, 25),
        recorded_at=LATER,
    )
    return RecordSnapshot(
        institution=institution,
        contacts=(contact,),
        activities=(
            ActivitySummarySource(earlier_activity, "synthetic-phone"),
            ActivitySummarySource(later_activity, "synthetic-in-person"),
        ),
        business_history=({"event": "synthetic-correction"},),
        audit_history=({"event": "synthetic-access-audit"},),
        collaborator_source_category="synthetic-referral",
        management_scope_key="synthetic-north",
    )


def pool_record() -> RecordSnapshot:
    """A record whose owner is empty (in the public pool)."""
    record = sample_record()
    institution = replace(record.institution, owner_user_id=None, in_pool=True)
    return replace(record, institution=institution)


def test_owner_receives_detailed_record_but_not_internal_submission_keys() -> None:
    projection = project_record(
        enabled_subject(OWNER_ID, Role.BUSINESS_USER),
        sample_record(),
    )

    assert projection.decision.view_level is RecordViewLevel.OWNER
    assert projection.decision.read_only is True
    assert projection.data["institution"]["source_description"] == "Synthetic referral source detail"
    assert projection.data["contacts"][0]["phone"] == "synthetic-phone-value"
    assert [item["factual_body"] for item in projection.data["activities"]] == [
        "Synthetic latest raw follow-up body",
        "Synthetic earlier raw follow-up body",
    ]
    assert projection.data["business_history"] == ({"event": "synthetic-correction"},)
    assert "audit_history" not in projection.data
    assert "idempotency_key" not in projection.data["institution"]
    assert "idempotency_key" not in projection.data["contacts"][0]
    assert "idempotency_key" not in projection.data["activities"][0]


def test_other_business_user_is_denied_for_other_business_users_record() -> None:
    # SPEC-0001 v0.9.0 R-014/R-046: a business_user must not see another
    # business user's non-pool record (not even the masked projection).
    with pytest.raises(PolicyDenied, match="^record access denied$"):
        project_record(
            enabled_subject(OTHER_USER_ID, Role.BUSINESS_USER),
            sample_record(),
        )


def test_business_user_receives_masked_projection_for_pool_record() -> None:
    # R-042/R-046: a pool record (owner empty) is masked-visible to any
    # business role and remains claimable.
    projection = project_record(
        enabled_subject(OTHER_USER_ID, Role.BUSINESS_USER),
        pool_record(),
    )

    assert projection.decision.view_level is RecordViewLevel.COLLABORATOR
    institution = projection.data["institution"]
    contact = projection.data["contacts"][0]
    progress = projection.data["concise_progress"]

    assert institution["source_category"] == "synthetic-referral"
    assert "source_kind" not in institution
    assert "source_description" not in institution
    assert "source_evidence_reference" not in institution
    assert contact["name_masked"] == "***"
    assert contact["role_label"] == "Procurement contact"
    assert contact["has_storable_channel"] is True
    assert "name" not in contact
    assert "phone" not in contact
    assert "email" not in contact
    assert "wechat" not in contact
    assert "other_channel" not in contact
    assert "channel_notes" not in contact
    assert "activities" not in projection.data
    assert "business_history" not in projection.data
    assert "audit_history" not in projection.data
    assert progress == {
        "latest_follow_up_date": date(2026, 7, 21),
        "latest_follow_up_method_category": "synthetic-in-person",
        "shared_summary": "Synthetic latest shared summary",
        "has_next_action": True,
        "next_action_target_date": date(2026, 7, 25),
    }

    serialized_projection = repr(projection.data)
    for protected_value in (
        "Synthetic referral source detail",
        "synthetic-private-source-kind",
        "synthetic-evidence-reference",
        "Synthetic Contact",
        "synthetic-phone-value",
        "Synthetic latest raw follow-up body",
    ):
        assert protected_value not in serialized_projection


def test_unclassified_communication_method_is_hidden_from_concise_progress() -> None:
    record = pool_record()
    unclassified_latest = replace(record.activities[1], communication_method_category=None)
    record = replace(record, activities=(record.activities[0], unclassified_latest))

    projection = project_record(
        enabled_subject(OTHER_USER_ID, Role.BUSINESS_USER),
        record,
    )

    assert projection.data["concise_progress"]["latest_follow_up_method_category"] is None
    assert "Synthetic detailed meeting method" not in repr(projection.data)


@pytest.mark.parametrize("status", [UserStatus.PENDING, UserStatus.DISABLED])
def test_pending_or_disabled_identity_is_denied_without_record_disclosure(status: UserStatus) -> None:
    with pytest.raises(PolicyDenied, match="^record access denied$"):
        project_record(
            PolicySubject(OWNER_ID, status, frozenset({Role.BUSINESS_USER})),
            sample_record(),
        )


def test_enabled_identity_without_a_role_is_denied() -> None:
    with pytest.raises(PolicyDenied, match="^record access denied$"):
        project_record(enabled_subject(OTHER_USER_ID), sample_record())


def test_administrator_reads_full_detail_without_an_exception_reason() -> None:
    administrator = enabled_subject(ADMIN_USER_ID, Role.ADMINISTRATOR)

    # R-008 (SPEC-0002 v0.4.0): no exception reason is required; the
    # administrator always reads full detail.
    projection = project_record(administrator, sample_record())

    assert projection.decision.view_level is RecordViewLevel.ADMINISTRATOR_EXCEPTION
    assert projection.data["contacts"][0]["phone"] == "synthetic-phone-value"
    assert projection.data["audit_history"] == ({"event": "synthetic-access-audit"},)

    # A blank reason is treated as omitted and never causes a denial.
    projection_blank = project_record(
        administrator, sample_record(), administrator_reason=" "
    )
    assert projection_blank.decision.view_level is RecordViewLevel.ADMINISTRATOR_EXCEPTION

    # A voluntarily supplied reason is retained on the decision (optional
    # trace) but is never required.
    projection_reason = project_record(
        administrator,
        sample_record(),
        administrator_reason="Synthetic incident review",
    )
    assert projection_reason.decision.access_reason == "Synthetic incident review"
    assert "access_reason" not in projection_reason.data


def test_administrator_with_business_role_also_reads_full_detail() -> None:
    projection = project_record(
        enabled_subject(ADMIN_USER_ID, Role.ADMINISTRATOR, Role.BUSINESS_USER),
        sample_record(),
    )

    assert projection.decision.view_level is RecordViewLevel.ADMINISTRATOR_EXCEPTION
    assert projection.data["contacts"][0]["phone"] == "synthetic-phone-value"


def test_shareholder_reads_full_detail_despite_business_isolation() -> None:
    # SPEC-0002 R-008 + SPEC-0001 R-046: shareholder (赵/武, shareholder +
    # business_user) keeps global visibility and is not subject to the
    # business_user isolation.
    projection = project_record(
        enabled_subject(SHAREHOLDER_USER_ID, Role.SHAREHOLDER, Role.BUSINESS_USER),
        sample_record(),
    )

    assert projection.decision.view_level is RecordViewLevel.ADMINISTRATOR_EXCEPTION
    assert projection.data["contacts"][0]["phone"] == "synthetic-phone-value"


def test_management_roles_receive_only_collaborator_projection_with_scope_checks() -> None:
    record = sample_record()

    scoped_manager = project_record(
        enabled_subject(MANAGER_USER_ID, Role.MANAGER, scopes=("synthetic-north",)),
        record,
    )

    assert scoped_manager.decision.view_level is RecordViewLevel.COLLABORATOR
    assert "activities" not in scoped_manager.data

    with pytest.raises(PolicyDenied):
        project_record(
            enabled_subject(MANAGER_USER_ID, Role.MANAGER, scopes=("synthetic-south",)),
            record,
        )
    with pytest.raises(PolicyDenied):
        project_record(enabled_subject(MANAGER_USER_ID, Role.MANAGER), record)


def test_cross_record_children_are_rejected_before_projection() -> None:
    record = sample_record()
    unrelated_contact = Contact(
        institution_id=uuid4(),
        created_by_user_id=OWNER_ID,
        contactability_status=ContactabilityStatus.NOT_YET_OBTAINED,
        idempotency_key="synthetic-unrelated-contact",
        role_label="Synthetic unrelated role",
        created_at=EARLIER,
        updated_at=EARLIER,
    )

    with pytest.raises(PolicyInputError, match="different institution"):
        replace(record, contacts=(unrelated_contact,))


def test_projection_mapping_cannot_be_mutated_into_a_raw_fallback() -> None:
    projection = project_record(
        enabled_subject(OWNER_ID, Role.BUSINESS_USER),
        sample_record(),
    )

    with pytest.raises(TypeError):
        projection.data["unapproved_field"] = "must not be added"
