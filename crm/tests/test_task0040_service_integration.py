"""TASK-0040 (SPEC-0003 v0.4.0): service-level integration fixtures.

Verifies the wired chain end to end without any real external call:

- crawler adapter injected as the OpportunityService crawler source;
- AI reason (from the provider adapter) passes the R-013 leak scan and falls
  back to the deterministic local reason on a leak (AC-006);
- provider degradation keeps the synthetic default reason;
- crawler candidates never auto-create customers (AC-002/AC-003);
- 30-day retention is applied on the crawler candidate path.
"""

import os
import uuid as _uuid
from datetime import datetime, timedelta, timezone
from uuid import UUID

os.environ.setdefault("DATABASE_HOST", "localhost")
os.environ.setdefault("DATABASE_NAME", "t40s_test")
os.environ.setdefault("DATABASE_USER", "t40s_test")
os.environ.setdefault("DATABASE_PASSWORD", "t40s-test-synthetic-password")
os.environ.setdefault("SESSION_SECRET_KEY", "t40s-test-secret-not-for-production")
os.environ.setdefault("CRM_ENVIRONMENT", "test")
os.environ.setdefault("SESSION_COOKIE_SECURE", "false")

import pytest  # noqa: E402
from sqlalchemy import create_engine, event, select as sa_select  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from crm.persistence.base import Base  # noqa: E402
from crm.persistence.database import transaction_session  # noqa: E402
from crm.persistence.models import (  # noqa: E402
    InstitutionModel,
    OpportunityCandidateModel,
    RoleGrantModel,
    UserIdentityModel,
)
from crm.domain import Role, UserIdentity, UserStatus  # noqa: E402
from crm.application.opportunity import OpportunityService  # noqa: E402
from crm.ai.crawler import PublicProcurementCrawler  # noqa: E402
from crm.ai.provider import AiReasonProvider  # noqa: E402

from test_task0007_inmemory_fakes import InMemoryUserRepository  # noqa: E402
from crm.persistence.repositories import domain_institution_from_model  # noqa: E402


@pytest.fixture
def t40_env():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _reg(dbapi_connection, connection_record):
        dbapi_connection.create_function("btrim", 1, lambda s: s.strip())
        dbapi_connection.create_function("btrim", 2, lambda s, chars: s.strip(chars))
        dbapi_connection.create_function("char_length", 1, lambda s: len(s))

    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)

    user_repo = InMemoryUserRepository()
    now = datetime.now(timezone.utc)

    def _identity(username, display, roles):
        from crm.web.auth import hash_password

        ident = UserIdentity(
            username=username,
            display_name=display,
            password_hash=hash_password("t40spass123"),
            status=UserStatus.ENABLED,
        )
        user_repo.add(ident)
        return ident

    owner = _identity("t40owner", "Owner", [Role.BUSINESS_USER])
    with transaction_session(factory) as session:
        session.add(UserIdentityModel(
            id=owner.id, username=owner.username, display_name=owner.display_name,
            password_hash=owner.password_hash, status="enabled",
            session_epoch=0, created_at=now, updated_at=now,
        ))
        session.add(RoleGrantModel(
            user_id=owner.id, role="business_user", scope_reference=None,
            granted_by_user_id=owner.id, reason="seed", granted_at=now,
        ))

    class _InstRepo:
        def find_active_for_duplicate_check(self):
            s = factory()
            try:
                return [domain_institution_from_model(m) for m in s.execute(
                    sa_select(InstitutionModel).where(InstitutionModel.archived_at.is_(None))
                ).scalars().all()]
            finally:
                s.close()

    yield {
        "factory": factory,
        "user_repo": user_repo,
        "owner_id": owner.id,
        "inst_repo": _InstRepo(),
    }
    engine.dispose()


def _make_service(env, *, crawler_source=None, reason_generator=None, crawler_reason_generator=None):
    return OpportunityService(
        institution_repo=env["inst_repo"],
        user_repo=env["user_repo"],
        session_factory=env["factory"],
        crawler_source=crawler_source,
        reason_generator=reason_generator,
        crawler_reason_generator=crawler_reason_generator,
    )


def _crawler(fetcher=None, *, sources=None, network_allowed=True):
    return PublicProcurementCrawler(
        sources=sources or [{"name": "测试源", "url": "https://example.gov.cn/x"}],
        fetcher=fetcher,
        network_allowed=network_allowed,
    )


def _list_candidates(env, owner_id):
    with transaction_session(env["factory"]) as session:
        return session.execute(
            sa_select(OpportunityCandidateModel).where(
                OpportunityCandidateModel.recipient_user_id == owner_id
            )
        ).scalars().all()


def test_crawler_candidate_path_with_synthetic_fetcher(t40_env):
    """Crawler adapter -> candidate with 30-day retention, no auto-create."""
    env = t40_env
    service = _make_service(
        env,
        crawler_source=_crawler(
            lambda url, timeout: '{"title": "潍坊市养老机构集采2026", "body": "正文"}'
        ),
    )
    result = service.run(env["owner_id"])
    assert result["generated"] >= 1

    rows = _list_candidates(env, env["owner_id"])
    crawler_rows = [r for r in rows if r.source == "crawler"]
    assert crawler_rows
    cand = crawler_rows[0]
    assert cand.status == "待处理"  # never auto-adopted
    assert cand.expires_at is not None
    expires = cand.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    assert abs((expires - datetime.now(timezone.utc)) - timedelta(days=30)) < timedelta(hours=1)
    # no institution was created by the run itself
    with transaction_session(env["factory"]) as session:
        institutions = session.execute(sa_select(InstitutionModel)).scalars().all()
    assert institutions == []


def test_leaky_ai_crawler_reason_suppressed_and_falls_back(t40_env):
    """AC-006: a provider reason echoing a phone value is suppressed and
    replaced by the deterministic local crawler reason."""
    env = t40_env

    class _FakeHttp:
        def post(self, url, json, headers, timeout):
            class _Resp:
                pass
            resp = _Resp()
            resp.status_code = 200
            resp.text = '{"choices": [{"message": {"content": "理由：请致电 13912345678 联系"}}]}'
            return resp

    provider = AiReasonProvider(
        base_url="https://example.invalid/v1/chat/completions",
        model="ai-reason-leak-test",
        api_key="sk-not-real",
        http_client=_FakeHttp(),
        network_allowed=True,
    )
    service = _make_service(
        env,
        crawler_source=_crawler(lambda url, timeout: '{"title": "公告T", "body": "b"}'),
        crawler_reason_generator=provider.generate_reason,
    )
    service.run(env["owner_id"])

    rows = _list_candidates(env, env["owner_id"])
    crawler_rows = [r for r in rows if r.source == "crawler"]
    assert crawler_rows
    cand = crawler_rows[0]
    assert "13912345678" not in cand.supporting_reason
    assert cand.ai_used is False  # model text suppressed
    assert "经爬虫采集" in cand.supporting_reason  # deterministic local reason


def test_provider_degradation_keeps_synthetic_default_reason(t40_env):
    """R-015: when the provider degrades (network gate closed), the synthetic
    default reason is used and the chain does not break."""
    env = t40_env
    provider = AiReasonProvider(
        base_url="https://example.invalid",
        model="ai-reason-test",
        api_key="sk-not-real",
        network_allowed=False,  # fail-closed
    )
    service = _make_service(
        env,
        crawler_source=_crawler(lambda url, timeout: '{"title": "公告T", "body": "b"}'),
        crawler_reason_generator=provider.generate_reason,
    )
    result = service.run(env["owner_id"])
    assert result["generated"] >= 1

    rows = _list_candidates(env, env["owner_id"])
    cand = next(r for r in rows if r.source == "crawler")
    assert cand.ai_used is True
    assert cand.model_identifier == "synthetic-stub"
    assert "经爬虫采集" in cand.supporting_reason


def test_human_adjudication_semantics_unchanged(t40_env):
    """R-003: crawler candidates still require human adjudication; a human
    can adopt (pool landing) or ignore — the AI never decides."""
    env = t40_env
    service = _make_service(
        env,
        crawler_source=_crawler(lambda url, timeout: '{"title": "潍坊市养老机构集采2026"}'),
    )
    service.run(env["owner_id"])
    rows = _list_candidates(env, env["owner_id"])
    cand = next(r for r in rows if r.source == "crawler")
    assert cand.status == "待处理"

    service.adjudicate(candidate_id=cand.id, actor_user_id=env["owner_id"], decision="采纳")
    with transaction_session(env["factory"]) as session:
        pool = session.execute(sa_select(InstitutionModel)).scalars().all()
    assert len(pool) == 1
    assert pool[0].owner_user_id is None
    assert pool[0].in_pool is True


def test_provider_failure_degrades_not_crashes(t40_env):
    """R-015/AC-007: a provider timeout/malformed failure degrades to the
    local deterministic reason; the discovery run must not raise."""
    env = t40_env

    class _TimeoutHttp:
        def post(self, url, json, headers, timeout):
            raise TimeoutError("simulated timeout")

    provider = AiReasonProvider(
        base_url="https://example.invalid/v1/chat/completions",
        model="ai-reason-fail-test",
        api_key="sk-not-real",
        http_client=_TimeoutHttp(),
        network_allowed=True,
    )
    service = _make_service(
        env,
        crawler_source=_crawler(lambda url, timeout: '{"title": "公告T"}'),
        crawler_reason_generator=provider.generate_reason,
    )
    result = service.run(env["owner_id"])  # must not raise
    assert result["generated"] >= 1

    rows = _list_candidates(env, env["owner_id"])
    cand = next(r for r in rows if r.source == "crawler")
    assert cand.ai_used is False
    assert "经爬虫采集" in cand.supporting_reason


# ============ P2-4 (self-review fix): truthful run() reporting (AC-007) ============


def test_run_reports_synthetic_true_without_real_model(t40_env):
    """AC-007: with no real model injected, run() must report the synthetic
    state truthfully and surface crawler degradation state."""
    env = t40_env
    service = _make_service(
        env,
        crawler_source=_crawler(lambda url, timeout: '{"title": "公告T"}'),
    )
    result = service.run(env["owner_id"])
    assert result["generated"] >= 1
    assert result["synthetic"] is True
    assert result["crawler_degraded"] is False
    assert result["crawler_degraded_reason"] == ""


def test_run_reports_crawler_degradation_truthfully(t40_env):
    env = t40_env
    service = _make_service(
        env,
        crawler_source=_crawler(
            lambda url, timeout: (_ for _ in ()).throw(ConnectionError("refused"))
        ),
    )
    result = service.run(env["owner_id"])
    assert result["crawler_degraded"] is True
    assert "ConnectionError" in result["crawler_degraded_reason"]


def test_run_marks_non_synthetic_when_real_model_produces_reason(t40_env):
    from crm.ai.provider import ProviderResult

    class _RealReason:
        def generate_reason(self, announcement):
            return ProviderResult(
                text="理由：该公告与直接采购类客户相关。",
                model_identifier="ai-reason-v4-flash-0731",
                outbound_field_names=["title", "source_url"],
                degraded=False,
            )

    env = t40_env
    service = _make_service(
        env,
        crawler_source=_crawler(lambda url, timeout: '{"title": "公告T"}'),
        crawler_reason_generator=_RealReason().generate_reason,
    )
    result = service.run(env["owner_id"])
    assert result["synthetic"] is False


# ============ P1 (TASK-0040 fix): adjudication ownership enforcement ============


def _create_second_user(env, username="t40intruder"):
    """Register a second enabled business user (an intruder with no
    ownership of the candidate) in both repos and the SQLite tables."""
    user_repo = env["user_repo"]
    now = datetime.now(timezone.utc)
    from crm.web.auth import hash_password

    intruder = UserIdentity(
        username=username,
        display_name="Intruder",
        password_hash=hash_password("t40spass456"),
        status=UserStatus.ENABLED,
    )
    user_repo.add(intruder)
    with transaction_session(env["factory"]) as session:
        session.add(UserIdentityModel(
            id=intruder.id, username=intruder.username,
            display_name=intruder.display_name, password_hash=intruder.password_hash,
            status="enabled", session_epoch=0, created_at=now, updated_at=now,
        ))
        session.add(RoleGrantModel(
            user_id=intruder.id, role="business_user", scope_reference=None,
            granted_by_user_id=intruder.id, reason="seed", granted_at=now,
        ))
    return intruder.id


def _candidate_by_source(env, recipient_id, source="crawler"):
    with transaction_session(env["factory"]) as session:
        rows = session.execute(
            sa_select(OpportunityCandidateModel).where(
                OpportunityCandidateModel.recipient_user_id == recipient_id
            )
        ).scalars().all()
    return next(r for r in rows if r.source == source)


def _audit_events(env, action):
    from crm.persistence.models import AuditEventModel

    with transaction_session(env["factory"]) as session:
        rows = session.execute(
            sa_select(AuditEventModel).where(AuditEventModel.action == action)
        ).scalars().all()
    return list(rows)


def test_non_recipient_adjudication_rejected_with_no_side_effects(t40_env):
    """P1: user B must not adjudicate user A's candidate. The request is
    rejected before any state change, pool creation, or audit write; user A
    can still adjudicate afterwards."""
    env = t40_env
    service = _make_service(
        env,
        crawler_source=_crawler(lambda url, timeout: '{"title": "潍坊市养老机构集采2026"}'),
    )
    service.run(env["owner_id"])
    cand = _candidate_by_source(env, env["owner_id"], "crawler")

    intruder_id = _create_second_user(env)
    assert intruder_id != env["owner_id"]

    # B (intruder) tries to adopt A's candidate -> rejected.
    with pytest.raises(ValueError, match="candidate not found"):
        service.adjudicate(
            candidate_id=cand.id, actor_user_id=intruder_id, decision="采纳"
        )

    # Candidate state unchanged.
    with transaction_session(env["factory"]) as session:
        fresh = session.get(OpportunityCandidateModel, cand.id)
        assert fresh.status == "待处理"
        assert fresh.adjudicated_at is None

    # No pool record created.
    with transaction_session(env["factory"]) as session:
        institutions = session.execute(sa_select(InstitutionModel)).scalars().all()
    assert institutions == []

    # No successful adjudication audit record.
    assert _audit_events(env, "opportunity_candidate.adjudicate") == []

    # A (owner) can still adjudicate normally.
    result = service.adjudicate(
        candidate_id=cand.id, actor_user_id=env["owner_id"], decision="采纳"
    )
    assert result["status"] == "采纳"
    assert result["landed_as_pool"] is True


def test_non_recipient_ignore_rejected_no_side_effects(t40_env):
    """P1: the ownership gate also applies to 忽略."""
    env = t40_env
    service = _make_service(
        env,
        crawler_source=_crawler(lambda url, timeout: '{"title": "某市集采公告"}'),
    )
    service.run(env["owner_id"])
    cand = _candidate_by_source(env, env["owner_id"], "crawler")
    intruder_id = _create_second_user(env, "t40intruder2")

    with pytest.raises(ValueError, match="candidate not found"):
        service.adjudicate(
            candidate_id=cand.id, actor_user_id=intruder_id, decision="忽略"
        )
    with transaction_session(env["factory"]) as session:
        fresh = session.get(OpportunityCandidateModel, cand.id)
        assert fresh.status == "待处理"
    assert _audit_events(env, "opportunity_candidate.adjudicate") == []


def test_administrator_cannot_bypass_ownership_gate(t40_env):
    """P1: an administrator actor is still bound by the service-layer
    ownership check — the route-level role check never bypasses it."""
    env = t40_env
    service = _make_service(
        env,
        crawler_source=_crawler(lambda url, timeout: '{"title": "某县采购公告"}'),
    )
    service.run(env["owner_id"])
    cand = _candidate_by_source(env, env["owner_id"], "crawler")

    user_repo = env["user_repo"]
    now = datetime.now(timezone.utc)
    from crm.web.auth import hash_password

    admin = UserIdentity(
        username="t40admin",
        display_name="Admin",
        password_hash=hash_password("t40spass789"),
        status=UserStatus.ENABLED,
    )
    user_repo.add(admin)
    with transaction_session(env["factory"]) as session:
        session.add(UserIdentityModel(
            id=admin.id, username=admin.username, display_name=admin.display_name,
            password_hash=admin.password_hash, status="enabled",
            session_epoch=0, created_at=now, updated_at=now,
        ))
        session.add(RoleGrantModel(
            user_id=admin.id, role="administrator", scope_reference=None,
            granted_by_user_id=admin.id, reason="seed", granted_at=now,
        ))

    with pytest.raises(ValueError, match="candidate not found"):
        service.adjudicate(
            candidate_id=cand.id, actor_user_id=admin.id, decision="采纳"
        )
    with transaction_session(env["factory"]) as session:
        fresh = session.get(OpportunityCandidateModel, cand.id)
        assert fresh.status == "待处理"
    assert _audit_events(env, "opportunity_candidate.adjudicate") == []


def test_audit_storage_failure_degrades_reason_not_crashes(t40_env):
    """P2: when the provider audit write fails, the run() must not 500 and
    must not persist the un-audited model text — the candidate falls back to
    the deterministic local reason (ai_used=False)."""
    from crm.ai.audit import record_ai_outbound

    class _FailingAudit:
        def record(self, **kwargs):
            raise RuntimeError("audit backend unavailable")

    class _OkHttp:
        def post(self, url, json, headers, timeout):
            class _Resp:
                pass
            resp = _Resp()
            resp.status_code = 200
            resp.text = '{"choices": [{"message": {"content": "理由：模型生成的正文"}}]}'
            return resp

    failing_audit = _FailingAudit()

    def recorder(model_id, field_names, outcome):
        record_ai_outbound(
            failing_audit,
            model_identifier=model_id,
            outbound_field_names=field_names,
            outcome=outcome,
        )

    provider = AiReasonProvider(
        base_url="https://example.invalid/v1/chat/completions",
        model="ai-reason-audit-fail",
        api_key="sk-not-real",
        http_client=_OkHttp(),
        network_allowed=True,
        on_outbound=recorder,
    )
    env = t40_env
    service = _make_service(
        env,
        crawler_source=_crawler(lambda url, timeout: '{"title": "公告T"}'),
        crawler_reason_generator=provider.generate_reason,
    )
    result = service.run(env["owner_id"])  # must not raise
    assert result["generated"] >= 1

    rows = _list_candidates(env, env["owner_id"])
    cand = next(r for r in rows if r.source == "crawler")
    # The un-audited model text must NOT be persisted as success.
    assert "模型生成的正文" not in cand.supporting_reason
    assert cand.ai_used is False
    assert "经爬虫采集" in cand.supporting_reason  # deterministic local reason
