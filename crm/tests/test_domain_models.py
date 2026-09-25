from datetime import date, datetime, timezone
from uuid import uuid4

import pytest

from crm.domain import (
    Contact,
    ContactabilityStatus,
    CustomerType,
    DomainValidationError,
    FollowUpActivity,
    Institution,
    Role,
    RoleGrant,
    UserIdentity,
)


ARGON2ID_TEST_HASH = "$argon2id$v=19$m=65536,t=3,p=4$c3ludGhldGlj$dGVzdC1oYXNo"
NOW = datetime(2026, 7, 27, 8, 30, tzinfo=timezone.utc)


def test_user_identity_normalizes_username_and_requires_argon2id() -> None:
    user = UserIdentity(
        username="  Synthetic.User  ",
        display_name=" Synthetic User ",
        password_hash=ARGON2ID_TEST_HASH,
        created_at=NOW,
        updated_at=NOW,
    )

    assert user.username == "synthetic.user"
    assert user.display_name == "Synthetic User"

    with pytest.raises(DomainValidationError, match="Argon2id"):
        UserIdentity(
            username="synthetic.user",
            display_name="Synthetic User",
            password_hash="plaintext-is-forbidden",
            created_at=NOW,
            updated_at=NOW,
        )


def test_manager_grant_requires_an_explicit_scope() -> None:
    with pytest.raises(DomainValidationError, match="explicit scope"):
        RoleGrant(
            user_id=uuid4(),
            role=Role.MANAGER,
            granted_by_user_id=uuid4(),
            reason="Synthetic authorization",
            granted_at=NOW,
        )


def test_user_identity_phone_is_optional_and_normalized() -> None:
    with_phone = UserIdentity(
        username="agent1",
        display_name="Agent One",
        password_hash=ARGON2ID_TEST_HASH,
        phone="  15805243456  ",
        created_at=NOW,
        updated_at=NOW,
    )
    assert with_phone.phone == "15805243456"

    without_phone = UserIdentity(
        username="agent2",
        display_name="Agent Two",
        password_hash=ARGON2ID_TEST_HASH,
        created_at=NOW,
        updated_at=NOW,
    )
    assert without_phone.phone is None

    blank_phone = UserIdentity(
        username="agent3",
        display_name="Agent Three",
        password_hash=ARGON2ID_TEST_HASH,
        phone="   ",
        created_at=NOW,
        updated_at=NOW,
    )
    assert blank_phone.phone is None


def test_institution_accepts_only_minimum_fields_and_keeps_optionals_absent() -> None:
    institution = Institution(
        name=" Synthetic Institution ",
        source_description=" Synthetic referral ",
        customer_type=CustomerType.DIRECT_PURCHASE,
        owner_user_id=uuid4(),
        created_by_user_id=uuid4(),
        idempotency_key="institution-request-001",
        category=" ",
        region=None,
        created_at=NOW,
        updated_at=NOW,
    )

    assert institution.name == "Synthetic Institution"
    assert institution.source_description == "Synthetic referral"
    assert institution.customer_type is CustomerType.DIRECT_PURCHASE
    assert institution.in_pool is False
    assert institution.category is None
    assert institution.region is None


def test_institution_pool_state_must_match_owner_presence() -> None:
    """R-040: a record is in the pool iff it has no owner; an inconsistent
    in_pool/owner combination is rejected."""
    with pytest.raises(DomainValidationError, match="in_pool"):
        Institution(
            name="Pool customer",
            source_description="synthetic",
            customer_type=CustomerType.CHANNEL,
            owner_user_id=None,
            in_pool=False,
            created_by_user_id=uuid4(),
            idempotency_key="pool-inconsistent",
            created_at=NOW,
            updated_at=NOW,
        )
    with pytest.raises(DomainValidationError, match="in_pool"):
        Institution(
            name="Pool customer",
            source_description="synthetic",
            customer_type=CustomerType.CHANNEL,
            owner_user_id=uuid4(),
            in_pool=True,
            created_by_user_id=uuid4(),
            idempotency_key="pool-inconsistent-2",
            created_at=NOW,
            updated_at=NOW,
        )
    pool = Institution(
        name="Pool customer",
        source_description="synthetic",
        customer_type=CustomerType.CHANNEL,
        owner_user_id=None,
        in_pool=True,
        created_by_user_id=uuid4(),
        idempotency_key="pool-ok",
        created_at=NOW,
        updated_at=NOW,
    )
    assert pool.in_pool is True
    assert pool.owner_user_id is None


def test_contact_can_record_an_explicit_absence_of_storable_channels() -> None:
    contact = Contact(
        institution_id=uuid4(),
        created_by_user_id=uuid4(),
        contactability_status=ContactabilityStatus.NOT_PROVIDED_OR_NOT_STORABLE,
        idempotency_key="contact-request-001",
        role_label=" Synthetic purchasing contact ",
        created_at=NOW,
        updated_at=NOW,
    )

    assert contact.name is None
    assert contact.role_label == "Synthetic purchasing contact"
    assert contact.phone is None


@pytest.mark.parametrize(
    ("status", "phone", "message"),
    [
        (ContactabilityStatus.AVAILABLE, None, "requires a storable channel"),
        (ContactabilityStatus.NOT_YET_OBTAINED, "000-0000", "require available"),
    ],
)
def test_contact_channel_values_and_status_cannot_conflict(
    status: ContactabilityStatus,
    phone: str | None,
    message: str,
) -> None:
    with pytest.raises(DomainValidationError, match=message):
        Contact(
            institution_id=uuid4(),
            created_by_user_id=uuid4(),
            contactability_status=status,
            idempotency_key="contact-request-conflict",
            role_label="Synthetic contact",
            phone=phone,
            created_at=NOW,
            updated_at=NOW,
        )


def test_contact_needs_a_name_or_identifiable_role() -> None:
    with pytest.raises(DomainValidationError, match="name or identifiable role"):
        Contact(
            institution_id=uuid4(),
            created_by_user_id=uuid4(),
            contactability_status=ContactabilityStatus.NOT_YET_OBTAINED,
            idempotency_key="contact-request-no-identity",
            name=" ",
            role_label=None,
            created_at=NOW,
            updated_at=NOW,
        )


def test_follow_up_next_action_requires_owner_but_not_target_date() -> None:
    owner_id = uuid4()
    activity = FollowUpActivity(
        institution_id=uuid4(),
        recorded_by_user_id=uuid4(),
        occurred_at=NOW,
        interaction_method=" Synthetic meeting ",
        factual_body=" Synthetic facts only. ",
        idempotency_key="activity-request-001",
        next_action=" Synthetic next action ",
        next_action_owner_user_id=owner_id,
        next_action_target_date=None,
        recorded_at=NOW,
    )

    assert activity.next_action == "Synthetic next action"
    assert activity.next_action_owner_user_id == owner_id


@pytest.mark.parametrize(
    ("next_action", "owner_id", "target_date"),
    [
        (None, uuid4(), None),
        (None, None, date(2026, 8, 1)),
        ("Synthetic next action", None, None),
    ],
)
def test_follow_up_rejects_incomplete_next_action_pairs(
    next_action: str | None,
    owner_id: object,
    target_date: date | None,
) -> None:
    with pytest.raises(DomainValidationError, match="next-action"):
        FollowUpActivity(
            institution_id=uuid4(),
            recorded_by_user_id=uuid4(),
            occurred_at=NOW,
            interaction_method="Synthetic call",
            factual_body="Synthetic facts only.",
            idempotency_key="activity-request-incomplete",
            next_action=next_action,
            next_action_owner_user_id=owner_id,
            next_action_target_date=target_date,
            recorded_at=NOW,
        )


def test_domain_datetimes_must_include_timezone() -> None:
    with pytest.raises(DomainValidationError, match="timezone"):
        FollowUpActivity(
            institution_id=uuid4(),
            recorded_by_user_id=uuid4(),
            occurred_at=datetime(2026, 7, 27, 8, 30),
            interaction_method="Synthetic call",
            factual_body="Synthetic facts only.",
            idempotency_key="activity-request-naive-time",
            recorded_at=NOW,
        )
