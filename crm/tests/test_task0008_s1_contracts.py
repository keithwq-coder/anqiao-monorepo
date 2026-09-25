"""TASK-0008 S1: application-layer contract tests for the command/query slice.

Locks the contracts that remain after the dead-code removal authorized by
DEC-0081 Step 1:

- the three commands are constructed **directly** (the pattern the route layer
  uses) and run ``validate()`` -> ``execute(repo)`` against an in-memory
  repository; no ``from_dict`` path exists or is relied on (the former
  ``from_dict`` implementations always raised ``TypeError`` and were removed);
- ``QueryService.get_institution_detail`` projects contacts through the central
  policy layer (owner unmasked / collaborator masked) and its result no longer
  depends on the removed per-contact re-projection loop.

Local-only, synthetic state; reuses the S5 in-memory repositories.
"""

import os
from datetime import date, datetime, timezone
from uuid import UUID

# Same env pattern as the other test modules: crm.web.auth may build Settings()
# at import time, so provide database env before any app import.
os.environ.setdefault("DATABASE_HOST", "localhost")
os.environ.setdefault("DATABASE_NAME", "s1_test")
os.environ.setdefault("DATABASE_USER", "s1_test")
os.environ.setdefault("DATABASE_PASSWORD", "s1-test-synthetic-password")
os.environ.setdefault("SESSION_SECRET_KEY", "s1-test-secret-not-for-production")
os.environ.setdefault("CRM_ENVIRONMENT", "test")
os.environ.setdefault("SESSION_COOKIE_SECURE", "false")

from test_s5_pages_api_parity import (  # noqa: E402
    MemoryActivityRepository,
    MemoryContactRepository,
    MemoryInstitutionRepository,
)

from crm.application.commands import (  # noqa: E402
    AddContactToInstitutionCommand,
    CreateFollowUpActivityCommand,
    CreateInstitutionCommand,
)
from crm.application.queries import QueryService  # noqa: E402
from crm.domain.models import (  # noqa: E402
    ContactabilityStatus,
    Role,
    UserIdentity,
    UserStatus,
)

OWNER_ID = UUID("00000000-0000-0000-0000-000000000001")
OTHER_USER_ID = UUID("00000000-0000-0000-0000-000000000002")
INSTITUTION_ID = UUID("00000000-0000-0000-0000-000000000010")

_PASSWORD_HASH = "$argon2id$" + "x" * 60


def _enabled_user(user_id: UUID) -> UserIdentity:
    return UserIdentity(
        id=user_id,
        username=f"user-{user_id}",
        display_name="S1 test user",
        password_hash=_PASSWORD_HASH,
        status=UserStatus.ENABLED,
    )


def _create_institution(repo) -> "object":
    command = CreateInstitutionCommand(
        name="S1 契约机构",
        source_description="S1 合成来源说明",
        owner_user_id=OWNER_ID,
        created_by_user_id=OWNER_ID,
        idempotency_key="s1-inst-key",
    )
    valid, errors = command.validate(_enabled_user(OWNER_ID))
    assert valid, errors
    return command.execute(repo)


def _add_contact(repo, institution_id) -> "object":
    command = AddContactToInstitutionCommand(
        institution_id=institution_id,
        created_by_user_id=OWNER_ID,
        contactability_status=ContactabilityStatus.AVAILABLE,
        idempotency_key="s1-contact-key",
        name="S1 联系人",
        role_label="院长",
        phone="13800000000",
    )
    valid, errors = command.validate(_enabled_user(OWNER_ID))
    assert valid, errors
    return command.execute(repo)


# ============ Command contracts (direct construction, no from_dict) ============


def test_create_institution_command_direct_construction_contract() -> None:
    """The institution command validates and executes via direct construction
    (the route pattern); the former from_dict path is gone and not relied on."""
    repo = MemoryInstitutionRepository()
    institution = _create_institution(repo)

    assert institution.name == "S1 契约机构"
    assert institution.owner_user_id == OWNER_ID
    assert institution.created_by_user_id == OWNER_ID
    assert repo.find_by_id(institution.id) is institution
    assert not hasattr(CreateInstitutionCommand, "from_dict")


def test_create_institution_command_rejects_disabled_user() -> None:
    command = CreateInstitutionCommand(
        name="S1 契约机构",
        source_description="S1 合成来源说明",
        owner_user_id=OWNER_ID,
        created_by_user_id=OWNER_ID,
        idempotency_key="s1-inst-key",
    )
    valid, errors = command.validate(
        UserIdentity(
            id=OWNER_ID,
            username="disabled-user",
            display_name="S1 disabled user",
            password_hash=_PASSWORD_HASH,
            status=UserStatus.DISABLED,
        )
    )
    assert not valid
    assert any("disabled" in e.lower() for e in errors)


def test_add_contact_command_direct_construction_contract() -> None:
    """Contact command: name-or-role and channel/status consistency hold on the
    direct-construction path."""
    inst_repo = MemoryInstitutionRepository()
    contact_repo = MemoryContactRepository()
    institution = _create_institution(inst_repo)

    contact = _add_contact(contact_repo, institution.id)
    assert contact.name == "S1 联系人"
    assert contact.phone == "13800000000"
    assert contact.institution_id == institution.id
    assert contact_repo.find_by_institution(institution.id) == [contact]
    assert not hasattr(AddContactToInstitutionCommand, "from_dict")

    # Available status without any channel is rejected.
    missing_channel = AddContactToInstitutionCommand(
        institution_id=institution.id,
        created_by_user_id=OWNER_ID,
        contactability_status=ContactabilityStatus.AVAILABLE,
        idempotency_key="s1-contact-no-channel",
        name="S1 无渠道联系人",
    )
    valid, errors = missing_channel.validate(_enabled_user(OWNER_ID))
    assert not valid
    assert any("channel" in e.lower() for e in errors)


def test_follow_up_command_direct_construction_contract() -> None:
    """Follow-up command: required fields and the R-028 next-action/owner
    consistency rule hold on the direct-construction path."""
    repo = MemoryActivityRepository()

    command = CreateFollowUpActivityCommand(
        institution_id=INSTITUTION_ID,
        recorded_by_user_id=OWNER_ID,
        occurred_at=datetime(2026, 8, 1, 9, 0, tzinfo=timezone.utc),
        interaction_method="电话",
        factual_body="S1 首次跟进正文",
        idempotency_key="s1-activity-key",
        next_action="提交服务方案",
        next_action_owner_user_id=OWNER_ID,
        next_action_target_date=date(2026, 8, 10),
    )
    valid, errors = command.validate(_enabled_user(OWNER_ID))
    assert valid, errors

    activity = command.execute(repo)
    assert activity.factual_body == "S1 首次跟进正文"
    assert activity.next_action == "提交服务方案"
    assert activity.recorded_by_user_id == OWNER_ID
    assert not hasattr(CreateFollowUpActivityCommand, "from_dict")

    # R-028: next-action content without an owner is rejected.
    no_owner = CreateFollowUpActivityCommand(
        institution_id=INSTITUTION_ID,
        recorded_by_user_id=OWNER_ID,
        occurred_at=datetime(2026, 8, 1, 10, 0, tzinfo=timezone.utc),
        interaction_method="电话",
        factual_body="S1 第二次跟进正文",
        idempotency_key="s1-activity-no-owner",
        next_action="缺少负责人的下一步",
    )
    valid, errors = no_owner.validate(_enabled_user(OWNER_ID))
    assert not valid
    assert any("owner" in e.lower() for e in errors)


# ============ QueryService detail contract (no re-projection loop) ============


def _seeded_detail_fixture():
    inst_repo = MemoryInstitutionRepository()
    contact_repo = MemoryContactRepository()
    activity_repo = MemoryActivityRepository()
    institution = _create_institution(inst_repo)
    _add_contact(contact_repo, institution.id)
    return QueryService(inst_repo, contact_repo, activity_repo), institution


def test_detail_contacts_owner_sees_unmasked_contact() -> None:
    """Owner detail: contacts carry the unmasked name/phone straight from the
    central projection (this is what the removed per-contact loop never did)."""
    query_service, institution = _seeded_detail_fixture()

    detail = query_service.get_institution_detail(
        institution_id=institution.id,
        user_id=OWNER_ID,
        user_status=UserStatus.ENABLED,
        roles=frozenset({Role.BUSINESS_USER}),
    )

    assert detail is not None
    assert len(detail.contacts) == 1
    contact = detail.contacts[0]
    assert contact["name"] == "S1 联系人"
    assert contact["phone"] == "13800000000"


def test_detail_contacts_collaborator_sees_only_masked_contact() -> None:
    """Non-owner detail: the same contact is projected masked (name_masked,
    no phone), i.e. the detail path enforces R-010/R-013 without a second
    projection pass."""
    query_service, institution = _seeded_detail_fixture()

    detail = query_service.get_institution_detail(
        institution_id=institution.id,
        user_id=OTHER_USER_ID,
        user_status=UserStatus.ENABLED,
        roles=frozenset({Role.BUSINESS_USER}),
    )

    assert detail is not None
    assert len(detail.contacts) == 1
    contact = detail.contacts[0]
    assert contact["name_masked"] == "***"
    assert "name" not in contact
    assert "phone" not in contact
