"""TASK-0008 S2: R-031 correction / withdrawal / archive (owner path) tests.

Local-only, synthetic state; no database except an in-memory SQLite engine
used to prove real transaction semantics:

- AC-025: a correction appends a new revision, keeps the prior version, and
  advances current_version; withdrawal keeps the row and writes the complete
  withdrawn triple; hard deletion is unavailable;
- DEC-0073 point 4: the rollback proof first makes the audit write fail inside
  the transaction and observes that the appended revision did NOT commit,
  then proves the success path;
- R-036 owner boundary: a non-owner gets 404 on every write path.

The command-level tests use the real repositories against an in-memory
SQLite schema (PostgreSQL-only ``btrim``/``char_length`` are registered for
the SQLite dialect). The HTTP-level tests inject SQLite-backed repository
subclasses (read methods only; the session-taking write methods are the real
implementation) so the route layer runs against the same synthetic store.
"""

import os
import uuid as _uuid
from datetime import datetime, timezone
from uuid import UUID

os.environ.setdefault("DATABASE_HOST", "localhost")
os.environ.setdefault("DATABASE_NAME", "s2_test")
os.environ.setdefault("DATABASE_USER", "s2_test")
os.environ.setdefault("DATABASE_PASSWORD", "s2-test-synthetic-password")
os.environ.setdefault("SESSION_SECRET_KEY", "s2-test-secret-not-for-production")
os.environ.setdefault("CRM_ENVIRONMENT", "test")
os.environ.setdefault("SESSION_COOKIE_SECURE", "false")

import pytest  # noqa: E402
import sqlalchemy as sa  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, event  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from test_task0007_inmemory_fakes import (  # noqa: E402
    InMemoryRoleGrantRepository,
    InMemorySessionRepository,
    InMemoryUserRepository,
)

from crm.application.commands import (  # noqa: E402
    ArchiveInstitutionCommand,
    CorrectFollowUpActivityCommand,
    WithdrawFollowUpActivityCommand,
)
from crm.domain.models import (  # noqa: E402
    ContentAttribution,
    Role,
    UserIdentity,
    UserStatus,
)
from crm.persistence.audit_repository import AuditEventRepository  # noqa: E402
from crm.persistence.base import Base  # noqa: E402
from crm.persistence.database import transaction_session  # noqa: E402
from crm.persistence.models import (  # noqa: E402
    AuditEventModel,
    FollowUpActivityModel,
    FollowUpActivityRevisionModel,
    InstitutionModel,
)
from crm.persistence.repositories import (  # noqa: E402
    FollowUpActivityRepository,
    InstitutionRepository,
    domain_follow_up_activity_from_model,
    domain_institution_from_model,
)

OWNER_ID = UUID("00000000-0000-0000-0000-000000000001")
OTHER_USER_ID = UUID("00000000-0000-0000-0000-000000000002")

_PASSWORD_HASH = "$argon2id$" + "y" * 60


# ============ SQLite in-memory store (real transaction semantics) ============


@pytest.fixture
def sqlite_factory():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,  # one shared connection -> one shared in-memory DB
    )

    @event.listens_for(engine, "connect")
    def _register_sqlite_functions(dbapi_connection, connection_record):
        # PostgreSQL-only functions used by the schema CHECK constraints.
        dbapi_connection.create_function("btrim", 1, lambda s: s.strip())
        dbapi_connection.create_function("btrim", 2, lambda s, chars: s.strip(chars))
        dbapi_connection.create_function("char_length", 1, lambda s: len(s))

    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    yield factory
    engine.dispose()


def _seed_institution_and_activity(factory, owner_id: UUID) -> tuple[UUID, UUID]:
    """Insert one institution + one activity (revision v1) directly."""
    inst_id = _uuid.uuid4()
    act_id = _uuid.uuid4()
    now = datetime.now(timezone.utc)
    with transaction_session(factory) as session:
        inst = InstitutionModel(
            id=inst_id,
            name="S2 机构",
            source_description="S2 合成来源",
            owner_user_id=owner_id,
            created_by_user_id=owner_id,
            idempotency_key="s2-inst-key",
            created_at=now,
            updated_at=now,
        )
        session.add(inst)
        session.flush()
        act = FollowUpActivityModel(
            id=act_id,
            institution_id=inst_id,
            recorded_by_user_id=owner_id,
            occurred_at=now,
            interaction_method="电话",
            recorded_at=now,
            current_version=1,
            ai_review_status="unavailable",
            idempotency_key="s2-act-key",
        )
        session.add(act)
        session.flush()
        revision = FollowUpActivityRevisionModel(
            activity_id=act_id,
            version_number=1,
            factual_body="v1 原始正文",
            content_attribution=ContentAttribution.SALESPERSON_INPUT.value,
            created_by_user_id=owner_id,
            change_reason="initial creation",
        )
        session.add(revision)
    return inst_id, act_id


def _counts(factory) -> tuple[int, int]:
    """(revision rows for activity-independent count, audit rows)."""
    with transaction_session(factory) as session:
        return (
            session.query(FollowUpActivityRevisionModel).count(),
            session.query(AuditEventModel).count(),
        )


def _audit_actions(factory) -> list[str]:
    with transaction_session(factory) as session:
        rows = session.execute(
            sa.select(AuditEventModel.action, AuditEventModel.reason, AuditEventModel.actor_user_id)
            .order_by(AuditEventModel.occurred_at)
        ).all()
        return [(r.action, r.reason, r.actor_user_id) for r in rows]


def _current_version(factory, activity_id: UUID) -> int:
    with transaction_session(factory) as session:
        model = session.get(FollowUpActivityModel, activity_id)
        return model.current_version


# ============ Command-level tests (real repositories, SQLite txn) ============


def test_correct_appends_new_version_and_keeps_prior(sqlite_factory) -> None:
    """AC-025: correction changes the current version, keeps the prior
    version, and records actor/reason in the audit event."""
    activity_repo = FollowUpActivityRepository()
    audit_repo = AuditEventRepository()
    inst_id, act_id = _seed_institution_and_activity(sqlite_factory, OWNER_ID)

    command = CorrectFollowUpActivityCommand(
        activity_id=act_id,
        corrected_by_user_id=OWNER_ID,
        change_reason="S2 更正原因：补充事实",
        factual_body="v2 更正后正文",
        next_action="提交方案",
        next_action_owner_user_id=OWNER_ID,
    )
    valid, errors = command.validate(None)
    assert valid, errors

    updated = command.execute(activity_repo, audit_repo, sqlite_factory)

    assert updated.factual_body == "v2 更正后正文"
    assert updated.next_action == "提交方案"
    assert _current_version(sqlite_factory, act_id) == 2

    # Prior version still present and untouched; new version appended.
    with transaction_session(sqlite_factory) as session:
        revisions = session.execute(
            sa.select(FollowUpActivityRevisionModel).where(
                FollowUpActivityRevisionModel.activity_id == act_id
            ).order_by(FollowUpActivityRevisionModel.version_number)
        ).scalars().all()
        assert [r.version_number for r in revisions] == [1, 2]
        assert revisions[0].factual_body == "v1 原始正文"
        assert revisions[0].change_reason == "initial creation"
        assert revisions[1].factual_body == "v2 更正后正文"
        assert revisions[1].change_reason == "S2 更正原因：补充事实"
        assert revisions[1].created_by_user_id == OWNER_ID

    assert _audit_actions(sqlite_factory) == [
        ("activity.correct", "S2 更正原因：补充事实", OWNER_ID)
    ]


def test_correct_rolls_back_when_audit_fails(sqlite_factory) -> None:
    """DEC-0073 point 4 rollback proof: when the audit write fails inside the
    transaction, the appended revision and the version bump do NOT commit."""
    activity_repo = FollowUpActivityRepository()
    inst_id, act_id = _seed_institution_and_activity(sqlite_factory, OWNER_ID)

    class _FailingAuditRepository(AuditEventRepository):
        def record(self, *, session, **kwargs) -> None:
            raise RuntimeError("audit backend unavailable")

    command = CorrectFollowUpActivityCommand(
        activity_id=act_id,
        corrected_by_user_id=OWNER_ID,
        change_reason="S2 应回滚的更正",
        factual_body="v2 不应落库的正文",
    )

    with pytest.raises(RuntimeError, match="audit backend unavailable"):
        command.execute(activity_repo, _FailingAuditRepository(), sqlite_factory)

    # Neither the revision nor the version bump survived the rollback.
    assert _current_version(sqlite_factory, act_id) == 1
    with transaction_session(sqlite_factory) as session:
        revisions = session.execute(
            sa.select(FollowUpActivityRevisionModel).where(
                FollowUpActivityRevisionModel.activity_id == act_id
            )
        ).scalars().all()
        assert [r.version_number for r in revisions] == [1]
        assert revisions[0].factual_body == "v1 原始正文"


def test_correct_rejects_withdrawn_activity(sqlite_factory) -> None:
    activity_repo = FollowUpActivityRepository()
    audit_repo = AuditEventRepository()
    inst_id, act_id = _seed_institution_and_activity(sqlite_factory, OWNER_ID)

    WithdrawFollowUpActivityCommand(
        activity_id=act_id,
        withdrawn_by_user_id=OWNER_ID,
        withdrawal_reason="S2 先撤回",
    ).execute(activity_repo, audit_repo, sqlite_factory)

    command = CorrectFollowUpActivityCommand(
        activity_id=act_id,
        corrected_by_user_id=OWNER_ID,
        change_reason="不应允许",
        factual_body="v2 不应落库",
    )
    with pytest.raises(ValueError, match="withdrawn"):
        command.execute(activity_repo, audit_repo, sqlite_factory)


def test_withdraw_keeps_row_and_writes_complete_triple(sqlite_factory) -> None:
    """AC-025: withdrawal keeps the row and writes the complete withdrawn
    triple (at / by / reason); no DELETE occurs."""
    activity_repo = FollowUpActivityRepository()
    audit_repo = AuditEventRepository()
    inst_id, act_id = _seed_institution_and_activity(sqlite_factory, OWNER_ID)

    result = WithdrawFollowUpActivityCommand(
        activity_id=act_id,
        withdrawn_by_user_id=OWNER_ID,
        withdrawal_reason="S2 撤回原因：记录有误",
    ).execute(activity_repo, audit_repo, sqlite_factory)

    assert result["withdrawn"] is True
    assert result["activity_id"] == str(act_id)

    with transaction_session(sqlite_factory) as session:
        model = session.get(FollowUpActivityModel, act_id)
        assert model is not None  # row kept, no hard delete
        assert model.withdrawn_at is not None
        assert model.withdrawn_by_user_id == OWNER_ID
        assert model.withdrawal_reason == "S2 撤回原因：记录有误"

    # Revision history untouched by withdrawal.
    rev_count, audit_count = _counts(sqlite_factory)
    assert rev_count == 1
    assert audit_count == 1
    assert _audit_actions(sqlite_factory) == [
        ("activity.withdraw", "S2 撤回原因：记录有误", OWNER_ID)
    ]


def test_withdraw_rejects_already_withdrawn(sqlite_factory) -> None:
    activity_repo = FollowUpActivityRepository()
    audit_repo = AuditEventRepository()
    inst_id, act_id = _seed_institution_and_activity(sqlite_factory, OWNER_ID)

    first = WithdrawFollowUpActivityCommand(
        activity_id=act_id,
        withdrawn_by_user_id=OWNER_ID,
        withdrawal_reason="S2 第一次撤回",
    )
    first.execute(activity_repo, audit_repo, sqlite_factory)

    second = WithdrawFollowUpActivityCommand(
        activity_id=act_id,
        withdrawn_by_user_id=OWNER_ID,
        withdrawal_reason="S2 第二次尝试",
    )
    with pytest.raises(ValueError, match="already withdrawn"):
        second.execute(activity_repo, audit_repo, sqlite_factory)


def test_archive_sets_pair_and_audit(sqlite_factory) -> None:
    """Archive writes archived_at + archive_reason together with the audit
    event; the institution row is never deleted."""
    institution_repo = InstitutionRepository()
    audit_repo = AuditEventRepository()
    inst_id, act_id = _seed_institution_and_activity(sqlite_factory, OWNER_ID)

    result = ArchiveInstitutionCommand(
        institution_id=inst_id,
        archived_by_user_id=OWNER_ID,
        archive_reason="S2 归档原因：项目结束",
    ).execute(institution_repo, audit_repo, sqlite_factory)

    assert result["archived"] is True
    assert result["institution_id"] == str(inst_id)

    with transaction_session(sqlite_factory) as session:
        model = session.get(InstitutionModel, inst_id)
        assert model is not None  # row kept, no hard delete
        assert model.archived_at is not None
        assert model.archive_reason == "S2 归档原因：项目结束"

    assert _audit_actions(sqlite_factory) == [
        ("institution.archive", "S2 归档原因：项目结束", OWNER_ID)
    ]


def test_archive_rejects_already_archived(sqlite_factory) -> None:
    institution_repo = InstitutionRepository()
    audit_repo = AuditEventRepository()
    inst_id, act_id = _seed_institution_and_activity(sqlite_factory, OWNER_ID)

    ArchiveInstitutionCommand(
        institution_id=inst_id,
        archived_by_user_id=OWNER_ID,
        archive_reason="S2 第一次归档",
    ).execute(institution_repo, audit_repo, sqlite_factory)

    second = ArchiveInstitutionCommand(
        institution_id=inst_id,
        archived_by_user_id=OWNER_ID,
        archive_reason="S2 第二次归档",
    )
    with pytest.raises(ValueError, match="already archived"):
        second.execute(institution_repo, audit_repo, sqlite_factory)


def test_blank_reasons_rejected_for_correct_and_withdraw_but_archive_allows(sqlite_factory) -> None:
    inst_id, act_id = _seed_institution_and_activity(sqlite_factory, OWNER_ID)

    for command in (
        CorrectFollowUpActivityCommand(
            activity_id=act_id, corrected_by_user_id=OWNER_ID,
            change_reason=" ", factual_body="v2 正文",
        ),
        WithdrawFollowUpActivityCommand(
            activity_id=act_id, withdrawn_by_user_id=OWNER_ID,
            withdrawal_reason=" ",
        ),
    ):
        valid, errors = command.validate(None)
        assert not valid
        assert any("reason" in e.lower() for e in errors)

    # R-008 (SPEC-0002 v0.4.0): the administrator may archive without a
    # reason (auto-traced); ArchiveInstitutionCommand no longer rejects a
    # blank reason. Non-administrators cannot archive at all (route-level).
    archive = ArchiveInstitutionCommand(
        institution_id=inst_id, archived_by_user_id=OWNER_ID,
        archive_reason=" ",
    )
    valid, errors = archive.validate(None)
    assert valid, errors


# ============ HTTP-level tests (owner boundary, 404 default deny) ============


class SqliteBackedInstitutionRepository(InstitutionRepository):
    """Real session-taking methods; read methods bound to the injected factory."""

    def __init__(self, factory):
        self._factory = factory

    def find_by_id(self, institution_id):
        session = self._factory()
        try:
            model = session.get(InstitutionModel, institution_id)
            return domain_institution_from_model(model) if model else None
        finally:
            session.close()


class SqliteBackedActivityRepository(FollowUpActivityRepository):
    """Real session-taking methods; read methods bound to the injected factory."""

    def __init__(self, factory):
        self._factory = factory

    def find_by_id(self, activity_id):
        session = self._factory()
        try:
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
        finally:
            session.close()


class SqliteBackedAuditRepository(AuditEventRepository):
    """Real session-taking ``record``; the no-session path writes to the
    injected factory (auth/login events) instead of SessionLocal()."""

    def __init__(self, factory):
        self._factory = factory

    def record(
        self,
        *,
        action,
        outcome,
        target_type,
        actor_user_id=None,
        target_id=None,
        reason=None,
        failure_summary=None,
        session=None,
    ) -> None:
        from crm.persistence.models import AuditEventModel as _Model

        model = _Model(
            actor_user_id=actor_user_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            outcome=outcome,
            reason=reason,
            failure_summary=failure_summary,
        )
        if session is not None:
            session.add(model)
            return
        with transaction_session(self._factory) as s:
            s.add(model)


@pytest.fixture
def s2_env(sqlite_factory):
    """FastAPI app with SQLite-backed business repositories and in-memory auth."""
    from crm.web.auth import AuthenticationService, AuthSettings, hash_password
    from crm.web.main import app

    user_repo = InMemoryUserRepository()
    session_repo = InMemorySessionRepository()
    role_repo = InMemoryRoleGrantRepository()
    audit_repo = SqliteBackedAuditRepository(sqlite_factory)

    owner = UserIdentity(
        username="s2owner",
        display_name="S2 Owner",
        password_hash=hash_password("s2ownerpass123"),
        status=UserStatus.ENABLED,
    )
    user_repo.add(owner)
    role_repo.set_grants(owner.id, [Role.BUSINESS_USER])

    other = UserIdentity(
        username="s2other",
        display_name="S2 Other",
        password_hash=hash_password("s2otherpass123"),
        status=UserStatus.ENABLED,
    )
    user_repo.add(other)
    role_repo.set_grants(other.id, [Role.BUSINESS_USER])

    app.state.user_repository = user_repo
    app.state.session_repository = session_repo
    app.state.role_grant_repository = role_repo
    app.state.audit_repository = audit_repo
    app.state.auth_service = AuthenticationService(
        user_repository=user_repo,
        session_repository=session_repo,
        audit_repository=audit_repo,
        auth_settings=AuthSettings(
            session_max_age_seconds=3600,
            login_rate_limit_per_hour=5,
            csrf_token_lifetime_hours=1,
        ),
    )
    app.state.session_factory = sqlite_factory
    app.state.institution_repository = SqliteBackedInstitutionRepository(sqlite_factory)
    app.state.activity_repository = SqliteBackedActivityRepository(sqlite_factory)

    inst_id, act_id = _seed_institution_and_activity(sqlite_factory, owner.id)

    def _login(username, password):
        client = TestClient(app)
        resp = client.post("/api/auth/login", json={"username": username, "password": password})
        assert resp.status_code == 200, resp.text
        client.headers["X-CSRF-Token"] = resp.json()["csrf_token"]
        return client

    yield {
        "sqlite_factory": sqlite_factory,
        "inst_id": inst_id,
        "act_id": act_id,
        "owner_id": owner.id,
        "owner_client": _login("s2owner", "s2ownerpass123"),
        "other_client": _login("s2other", "s2otherpass123"),
    }


def test_non_owner_write_paths_are_denied_with_404(s2_env) -> None:
    """R-036 owner boundary: another business user gets 404 (no existence
    disclosure) on correct / withdraw / archive — before any write."""
    other = s2_env["other_client"]
    inst_id = s2_env["inst_id"]
    act_id = s2_env["act_id"]

    r = other.post(
        f"/api/institutions/{inst_id}/activities/{act_id}/correct",
        json={"change_reason": "越权更正", "factual_body": "v2 越权正文"},
    )
    assert r.status_code == 404, r.text

    r = other.post(
        f"/api/institutions/{inst_id}/activities/{act_id}/withdraw",
        json={"withdrawal_reason": "越权撤回"},
    )
    assert r.status_code == 404, r.text

    r = other.post(
        f"/api/institutions/{inst_id}/archive",
        json={"archive_reason": "越权归档"},
    )
    assert r.status_code == 404, r.text

    # No write happened: still one revision, no business audit event for the
    # denied attempts (login audit events are not business writes).
    factory = s2_env["sqlite_factory"]
    rev_count, audit_count = _counts(factory)
    assert rev_count == 1
    business_actions = [row for row in _audit_actions(factory) if row[0].startswith(("activity.", "institution."))]
    assert business_actions == []


def test_owner_correct_withdraw_archive_flow(s2_env) -> None:
    """Owner executes the full R-031 flow over HTTP; rows are never deleted."""
    owner = s2_env["owner_client"]
    factory = s2_env["sqlite_factory"]
    inst_id = s2_env["inst_id"]
    act_id = s2_env["act_id"]

    r = owner.post(
        f"/api/institutions/{inst_id}/activities/{act_id}/correct",
        json={
            "change_reason": "HTTP 更正",
            "factual_body": "HTTP 更正后正文",
            "next_action": "下周回访",
            "next_action_owner_user_id": str(OWNER_ID),
        },
    )
    assert r.status_code == 200, r.text
    assert r.json()["factual_body"] == "HTTP 更正后正文"
    assert _current_version(factory, act_id) == 2

    r = owner.post(
        f"/api/institutions/{inst_id}/activities/{act_id}/withdraw",
        json={"withdrawal_reason": "HTTP 撤回"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["withdrawn"] is True

    # Row still present after withdrawal (no hard delete).
    with transaction_session(factory) as session:
        model = session.get(FollowUpActivityModel, act_id)
        assert model is not None
        assert model.withdrawn_at is not None
        assert model.withdrawal_reason == "HTTP 撤回"

    # R-036: archive is an administrator exception only. The owner may
    # correct and withdraw but may NOT archive. An administrator with a
    # nonblank reason archives the record.
    from crm.web.main import app as _app
    from crm.web.auth import hash_password as _hash_password

    admin = UserIdentity(
        username="s2admin",
        display_name="S2 Admin",
        password_hash=_hash_password("s2adminpass123"),
        status=UserStatus.ENABLED,
    )
    _app.state.user_repository.add(admin)
    _app.state.role_grant_repository.set_grants(admin.id, [Role.ADMINISTRATOR])

    admin_client = TestClient(_app)
    admin_login = admin_client.post(
        "/api/auth/login", json={"username": "s2admin", "password": "s2adminpass123"}
    )
    assert admin_login.status_code == 200, admin_login.text
    admin_client.headers["X-CSRF-Token"] = admin_login.json()["csrf_token"]

    # Owner archive is denied (R-036: administrator exception only).
    r = owner.post(f"/api/institutions/{inst_id}/archive", json={"archive_reason": "HTTP 归档"})
    assert r.status_code == 404, r.text

    # Administrator archive with a reason succeeds.
    r = admin_client.post(
        f"/api/institutions/{inst_id}/archive",
        json={"archive_reason": "HTTP 管理员归档"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["archived"] is True

    with transaction_session(factory) as session:
        inst = session.get(InstitutionModel, inst_id)
        assert inst is not None
        assert inst.archived_at is not None
        assert inst.archive_reason == "HTTP 管理员归档"

    # Three business audit events (correct / withdraw / archive), each with
    # the acting user; login events are filtered out. The archive actor is the
    # administrator, not the owner.
    actions = [row for row in _audit_actions(factory) if row[0].startswith(("activity.", "institution."))]
    assert [a for a, _, _ in actions] == ["activity.correct", "activity.withdraw", "institution.archive"]
    assert actions[0][2] == s2_env["owner_id"]  # correct
    assert actions[1][2] == s2_env["owner_id"]  # withdraw
    assert actions[2][2] == admin.id             # archive (administrator)
