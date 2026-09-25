"""TASK-0011 (SPEC-0013): bulk-import capability tests.

Local-only, synthetic state. Tests cover AC-001…AC-008 plus rerun/undo
negative paths. All state is synthetic in an in-memory SQLite database
with the btrim/char_length functions registered to mirror the PostgreSQL
CHECK constraints.

Test assertions and fixture repository helpers load candidate rows via
plain ``select(Model)`` and filter in Python, so no literal is passed
into a SQL predicate.
"""

import os
import datetime as dt
import uuid as _uuid
from uuid import UUID

os.environ.setdefault("DATABASE_HOST", "localhost")
os.environ.setdefault("DATABASE_NAME", "t11_test")
os.environ.setdefault("DATABASE_USER", "t11_test")
os.environ.setdefault("DATABASE_PASSWORD", "t11-test-synthetic-password")
os.environ.setdefault("SESSION_SECRET_KEY", "t11-test-secret-not-for-production")
os.environ.setdefault("CRM_ENVIRONMENT", "test")
os.environ.setdefault("SESSION_COOKIE_SECURE", "false")

import pytest  # noqa: E402
import sqlalchemy as sa  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, event  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from test_task0007_inmemory_fakes import (  # noqa: E402
    InMemoryAuditRepository,
    InMemoryRoleGrantRepository,
    InMemorySessionRepository,
    InMemoryUserRepository,
)

from crm.domain.models import (  # noqa: E402
    Role,
    UserIdentity,
    UserStatus,
)
from crm.persistence.audit_repository import AuditEventRepository  # noqa: E402
from crm.persistence.base import Base  # noqa: E402
from crm.persistence.database import transaction_session  # noqa: E402
from crm.persistence.models import (  # noqa: E402
    ContactModel,
    FollowUpActivityModel,
    ImportBatchModel,
    ImportRowResultModel,
    InstitutionModel,
    RoleGrantModel,
    UserIdentityModel,
    AuditEventModel,
)
from crm.persistence.repositories import (  # noqa: E402
    ContactRepository,
    FollowUpActivityRepository,
    ImportBatchService,
    InstitutionRepository,
    domain_institution_from_model,
    domain_contact_from_model,
)
from crm.web.auth import AuthenticationService, AuthSettings, hash_password  # noqa: E402


def _make_identity(username, password, roles):
    return UserIdentity(
        username=username,
        display_name=username,
        password_hash=hash_password(password),
        status=UserStatus.ENABLED,
    ), roles


def _login(app, username, password):
    c = TestClient(app)
    resp = c.post("/api/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200, resp.text
    c.headers["X-CSRF-Token"] = resp.json()["csrf_token"]
    return c


def _institutions_named(session, names):
    """Load all institutions and return those whose name is in ``names``."""
    wanted = set(names)
    rows = session.scalars(sa.select(InstitutionModel)).all()
    return [r for r in rows if r.name in wanted]


def _count_institutions_named(session, names):
    return len(_institutions_named(session, names))


def _audit_events_for_target(session, target_id):
    """Load all audit events and return those targeting ``target_id``."""
    rows = session.scalars(sa.select(AuditEventModel)).all()
    return [e for e in rows if e.target_type == "import_batch" and e.target_id == target_id]


@pytest.fixture
def t11_env():
    """SQLite-backed app with admin, business user, no-role user, and an
    existing institution to test duplicate flagging."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _register_sqlite_functions(dbapi_connection, connection_record):
        dbapi_connection.create_function("btrim", 1, lambda s: (s or "").strip())
        dbapi_connection.create_function("btrim", 2, lambda s, chars: (s or "").strip(chars))
        dbapi_connection.create_function("char_length", 1, lambda s: len(s or ""))

    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)

    from crm.web.main import app

    user_repo = InMemoryUserRepository()
    session_repo = InMemorySessionRepository()
    role_repo = InMemoryRoleGrantRepository()

    admin, _ = _make_identity("t11admin", "t11passadmin", [Role.ADMINISTRATOR])
    user_repo.add(admin)
    role_repo.set_grants(admin.id, [Role.ADMINISTRATOR])

    biz, _ = _make_identity("t11biz", "t11passbiz", [Role.BUSINESS_USER])
    user_repo.add(biz)
    role_repo.set_grants(biz.id, [Role.BUSINESS_USER])

    no_role, _ = _make_identity("t11norole", "t11passnr", [])
    user_repo.add(no_role)
    role_repo.set_grants(no_role.id, [])

    # Dual user repo: SQLite-backed for identity rows the service queries.
    class _DualUserRepo:
        def __init__(self, f, mem):
            self._f = f
            self._mem = mem

        def find_by_id(self, user_id):
            if not isinstance(user_id, UUID):
                user_id = UUID(str(user_id))
            s = self._f()
            try:
                m = s.get(UserIdentityModel, user_id)
                if m is None:
                    return None
                return UserIdentity(
                    username=m.username, display_name=m.display_name,
                    password_hash=m.password_hash, status=UserStatus(m.status),
                    id=m.id, session_epoch=m.session_epoch,
                )
            finally:
                s.close()

        def find_by_username(self, username):
            return self._mem.find_by_username(username)

    sqlite_user_repo = _DualUserRepo(factory, user_repo)

    # Fixture institution/contact/activity repositories that load all rows
    # and filter in Python (keeps the test file free of SQL value
    # interpolation; mirrors the production repository contract).
    class _SqliteInstRepo(InstitutionRepository):
        def __init__(self, f):
            self._f = f

        def _all_models(self, s):
            return list(s.scalars(sa.select(InstitutionModel)).all())

        def find_by_id(self, iid):
            s = self._f()
            try:
                m = s.get(InstitutionModel, iid)
                return domain_institution_from_model(m) if m else None
            finally:
                s.close()

        def find_all(self, search_terms=None, limit=50, offset=0, searchable_fields=None):
            s = self._f()
            try:
                models = self._all_models(s)
                if search_terms:
                    pat = (search_terms or "").lower()
                    if searchable_fields is None:
                        searchable_fields = frozenset({"name", "category", "region"})
                    def _matches(m):
                        for fname in searchable_fields:
                            val = getattr(m, fname, None)
                            if val is not None and pat in val.lower():
                                return True
                        return False
                    models = [m for m in models if _matches(m)]
                models = models[offset:offset + limit]
                return [domain_institution_from_model(m) for m in models]
            finally:
                s.close()

        def find_active_for_duplicate_check(self):
            s = self._f()
            try:
                models = [m for m in self._all_models(s) if m.archived_at is None]
                return [domain_institution_from_model(m) for m in models]
            finally:
                s.close()

    class _SqliteContactRepo(ContactRepository):
        def __init__(self, f):
            self._f = f

        def find_by_institution(self, iid):
            s = self._f()
            try:
                models = list(s.scalars(sa.select(ContactModel)).all())
                return [domain_contact_from_model(m) for m in models if m.institution_id == iid]
            finally:
                s.close()

    class _SqliteActivityRepo(FollowUpActivityRepository):
        def __init__(self, f):
            self._f = f

        def find_by_target(self, target_type, target_id, include_withdrawn=False):
            return []

    class _SqliteAuditRepo(AuditEventRepository):
        def __init__(self, f):
            self._f = f

        def record(self, *, action, outcome, target_type, actor_user_id=None,
                   target_id=None, reason=None, failure_summary=None, session=None) -> None:
            model = AuditEventModel(
                actor_user_id=actor_user_id, action=action, target_type=target_type,
                target_id=target_id, outcome=outcome, reason=reason,
                failure_summary=failure_summary,
            )
            if session is not None:
                session.add(model)
                return
            with transaction_session(self._f) as s:
                s.add(model)

    audit_repo = _SqliteAuditRepo(factory)
    inst_repo = _SqliteInstRepo(factory)
    contact_repo = _SqliteContactRepo(factory)
    activity_repo = _SqliteActivityRepo(factory)

    from crm.application.queries import QueryService
    query_service = QueryService(inst_repo, contact_repo, activity_repo)

    auth_service = AuthenticationService(
        user_repository=sqlite_user_repo,
        session_repository=session_repo,
        audit_repository=audit_repo,
        auth_settings=AuthSettings(
            session_max_age_seconds=3600, login_rate_limit_per_hour=100,
            csrf_token_lifetime_hours=1,
        ),
    )

    app.state.user_repository = sqlite_user_repo
    app.state.role_grant_repository = role_repo
    app.state.audit_repository = audit_repo
    app.state.auth_service = auth_service
    app.state.institution_repository = inst_repo
    app.state.contact_repository = contact_repo
    app.state.activity_repository = activity_repo
    app.state.query_service = query_service
    app.state.session_factory = factory

    # Seed user identities + role grants + one existing institution.
    now = dt.datetime.now(dt.timezone.utc)
    existing_inst_id = _uuid.uuid4()
    with transaction_session(factory) as session:
        for uid, uname, dname, phash in [
            (admin.id, "t11admin", "t11admin", admin.password_hash),
            (biz.id, "t11biz", "t11biz", biz.password_hash),
            (no_role.id, "t11norole", "t11norole", no_role.password_hash),
        ]:
            session.add(UserIdentityModel(
                id=uid, username=uname, display_name=dname, password_hash=phash,
                status="enabled", session_epoch=0, created_at=now, updated_at=now,
            ))
        for uid, role_val, grantor_id in [
            (admin.id, "administrator", admin.id),
            (biz.id, "business_user", admin.id),
        ]:
            session.add(RoleGrantModel(
                user_id=uid, role=role_val, scope_reference=None,
                granted_by_user_id=grantor_id, reason="test seed", granted_at=now,
            ))
        session.add(InstitutionModel(
            id=existing_inst_id, name="Existing Org", source_description="manual seed",
            source_kind="manual", region="east", category="seed",
            owner_user_id=admin.id, created_by_user_id=admin.id,
            idempotency_key="t11-existing", created_at=now, updated_at=now,
        ))

    yield {
        "app": app,
        "admin_id": admin.id,
        "biz_id": biz.id,
        "no_role_id": no_role.id,
        "existing_inst_id": str(existing_inst_id),
        "factory": factory,
    }
    engine.dispose()


# ============ AC-001: multi-record import + batch identity ============


def test_ac001_admin_imports_multiple_records_returns_batch_identity(t11_env):
    """AC-001: importing valid records creates SPEC-0001 records with source
    and returns a stable batch identity."""
    env = t11_env
    client = _login(env["app"], "t11admin", "t11passadmin")
    csv_bytes = b"name,source_description\nOrg A,src A\nOrg B,src B\n"
    resp = client.post(
        "/api/imports/batches",
        files={"file": ("import.csv", csv_bytes, "text/csv")},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["row_count"] == 2
    assert data["imported_count"] == 2
    assert data["failed_count"] == 0
    assert data["duplicate_count"] == 0
    assert data["batch_id"]  # stable identity returned

    # The two institutions exist as normal SPEC-0001 records with source.
    with transaction_session(env["factory"]) as s:
        matched = _institutions_named(s, ["Org A", "Org B"])
    assert sorted(m.name for m in matched) == ["Org A", "Org B"]


# ============ AC-002: partial failure, per-row reporting ============


def test_ac002_partial_failure_reports_invalid_rows_no_all_success(t11_env):
    """AC-002: valid rows import; invalid rows report reasons; the response
    never claims 'all succeeded' when any row failed."""
    env = t11_env
    client = _login(env["app"], "t11admin", "t11passadmin")
    # Row 3 is missing name; row 4 is missing source_description.
    csv_bytes = b"name,source_description\nOrg A,src A\n,src no name\nOrg B,\nOrg C,src C\n"
    resp = client.post(
        "/api/imports/batches",
        files={"file": ("partial.csv", csv_bytes, "text/csv")},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["row_count"] == 4
    assert data["imported_count"] == 2
    assert data["failed_count"] == 2
    # Not "all succeeded": failed_count > 0.
    assert data["failed_count"] > 0
    reasons = {r["line_number"]: r["reason"] for r in data["row_results"] if r["outcome"] == "failed"}
    assert 3 in reasons  # missing name
    assert 4 in reasons  # missing source_description


# ============ AC-003: duplicate flag, no auto-merge ============


def test_ac003_duplicate_flagged_not_merged(t11_env):
    """AC-003: a record matching an existing institution is flagged for
    review, not auto-merged."""
    env = t11_env
    client = _login(env["app"], "t11admin", "t11passadmin")
    # "Existing Org" matches the seeded institution by normalized name.
    csv_bytes = b"name,source_description\nExisting Org,src dup\nOrg New,src new\n"
    resp = client.post(
        "/api/imports/batches",
        files={"file": ("dup.csv", csv_bytes, "text/csv")},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["duplicate_count"] == 1
    assert data["imported_count"] == 1
    flagged = [r for r in data["row_results"] if r["outcome"] == "flagged_duplicate"]
    assert len(flagged) == 1
    assert flagged[0]["duplicate_of_institution_id"] == env["existing_inst_id"]
    # The duplicate was still imported (trusted load, not merged): a second
    # institution row now exists with the same name.
    with transaction_session(env["factory"]) as s:
        count = len(_institutions_named(s, ["Existing Org"]))
    assert count == 2  # original + imported duplicate (not merged)


# ============ AC-004: idempotent rerun ============


def test_ac004_rerun_same_file_does_not_duplicate_imported_rows(t11_env):
    """AC-004: re-running the same file returns the existing batch and does
    not re-import already-succeeded rows."""
    env = t11_env
    client = _login(env["app"], "t11admin", "t11passadmin")
    csv_bytes = b"name,source_description\nOrg R1,src r1\nOrg R2,src r2\n"
    resp1 = client.post(
        "/api/imports/batches",
        files={"file": ("rerun.csv", csv_bytes, "text/csv")},
    )
    assert resp1.status_code == 201
    batch_id_1 = resp1.json()["batch_id"]

    resp2 = client.post(
        "/api/imports/batches",
        files={"file": ("rerun.csv", csv_bytes, "text/csv")},
    )
    assert resp2.status_code == 201
    data2 = resp2.json()
    assert data2["batch_id"] == batch_id_1  # same batch identity
    assert data2["idempotent_replay"] is True
    assert data2["imported_count"] == 2  # counts unchanged

    # No extra institution rows were created.
    with transaction_session(env["factory"]) as s:
        count = _count_institutions_named(s, ["Org R1", "Org R2"])
    assert count == 2  # still exactly one row per name


# ============ AC-005: unmodified batch undo ============


def test_ac005_undo_removes_unmodified_records(t11_env):
    """AC-005: an administrator can undo a batch whose records are untouched;
    the records are removed and the batch is auditable."""
    env = t11_env
    client = _login(env["app"], "t11admin", "t11passadmin")
    csv_bytes = b"name,source_description\nUndo A,src a\nUndo B,src b\n"
    resp = client.post(
        "/api/imports/batches",
        files={"file": ("undo.csv", csv_bytes, "text/csv")},
    )
    batch_id = resp.json()["batch_id"]

    undo_resp = client.post(
        f"/api/imports/batches/{batch_id}/undo",
        json={"undo_reason": "wrong file"},
    )
    assert undo_resp.status_code == 200, undo_resp.text
    undo = undo_resp.json()
    assert undo["undone"] is True
    assert undo["undone_count"] == 2
    assert undo["excluded_count"] == 0

    # The records are gone.
    with transaction_session(env["factory"]) as s:
        count = _count_institutions_named(s, ["Undo A", "Undo B"])
    assert count == 0

    # The batch status flipped to undone (auditable).
    with transaction_session(env["factory"]) as s:
        batch = s.get(ImportBatchModel, UUID(batch_id))
    assert batch.status == "undone"
    assert batch.undone_at is not None
    assert batch.undo_reason == "wrong file"


# ============ AC-006: undo excludes modified records (fail-closed) ============


def test_ac006_undo_excludes_modified_record_and_reports_it(t11_env):
    """AC-006: when a record in the batch was modified after import, undo
    excludes it, reports the reason, and still undoes the eligible ones."""
    env = t11_env
    client = _login(env["app"], "t11admin", "t11passadmin")
    csv_bytes = b"name,source_description\nMod Keep,src keep\nMod Drop,src drop\n"
    resp = client.post(
        "/api/imports/batches",
        files={"file": ("mixed.csv", csv_bytes, "text/csv")},
    )
    batch_id = resp.json()["batch_id"]

    # Simulate post-import modification on "Mod Drop": add a follow-up
    # activity, which makes it ineligible (fail-closed).
    with transaction_session(env["factory"]) as s:
        all_insts = list(s.scalars(sa.select(InstitutionModel)).all())
        drop = next(i for i in all_insts if i.name == "Mod Drop")
        s.add(FollowUpActivityModel(
            id=_uuid.uuid4(), institution_id=drop.id,
            recorded_by_user_id=env["admin_id"],
            occurred_at=dt.datetime.now(dt.timezone.utc),
            interaction_method="phone", recorded_at=dt.datetime.now(dt.timezone.utc),
            current_version=1, ai_review_status="unavailable",
            idempotency_key="mod-drop-act",
        ))

    undo_resp = client.post(
        f"/api/imports/batches/{batch_id}/undo",
        json={"undo_reason": "partial undo"},
    )
    assert undo_resp.status_code == 200, undo_resp.text
    undo = undo_resp.json()
    assert undo["undone_count"] == 1   # "Mod Keep" undone
    assert undo["excluded_count"] == 1  # "Mod Drop" excluded
    assert "follow-up activities have been added" in undo["excluded"][0]["reason"]

    # "Mod Keep" is gone; "Mod Drop" remains (its work is preserved).
    with transaction_session(env["factory"]) as s:
        all_insts = list(s.scalars(sa.select(InstitutionModel)).all())
        keep = next((i for i in all_insts if i.name == "Mod Keep"), None)
        drop = next((i for i in all_insts if i.name == "Mod Drop"), None)
    assert keep is None
    assert drop is not None


def test_ac006_undo_archived_record_excluded(t11_env):
    """AC-006 (extra): an archived record is excluded from undo."""
    env = t11_env
    client = _login(env["app"], "t11admin", "t11passadmin")
    csv_bytes = b"name,source_description\nArch Excl,src excl\nArch Keep,src keep\n"
    resp = client.post(
        "/api/imports/batches",
        files={"file": ("arch.csv", csv_bytes, "text/csv")},
    )
    batch_id = resp.json()["batch_id"]

    # Archive one imported record.
    with transaction_session(env["factory"]) as s:
        all_insts = list(s.scalars(sa.select(InstitutionModel)).all())
        excl = next(i for i in all_insts if i.name == "Arch Excl")
        excl.archived_at = dt.datetime.now(dt.timezone.utc)
        excl.archive_reason = "business correction"

    undo_resp = client.post(
        f"/api/imports/batches/{batch_id}/undo",
        json={"undo_reason": "cleanup"},
    )
    assert undo_resp.status_code == 200
    undo = undo_resp.json()
    assert undo["undone_count"] == 1
    assert undo["excluded_count"] == 1
    assert "archived" in undo["excluded"][0]["reason"]


def test_ac005_undo_includes_flagged_duplicate_records(t11_env):
    """R-003/R-006: flagged_duplicate records are real imported institutions
    (trusted load, not merged) and must be removed by batch undo just like
    plain imported records (coordinator audit fix, 2026-08-08)."""
    env = t11_env
    client = _login(env["app"], "t11admin", "t11passadmin")
    # "Existing Org" will be flagged as a duplicate of the seeded institution.
    csv_bytes = b"name,source_description\nExisting Org,src dup\nFresh Org,src fresh\n"
    resp = client.post(
        "/api/imports/batches",
        files={"file": ("dup_undo.csv", csv_bytes, "text/csv")},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["duplicate_count"] == 1
    assert data["imported_count"] == 1
    batch_id = data["batch_id"]

    # Both the flagged-duplicate institution and the plain-imported institution
    # are real records; undo must remove both.
    undo_resp = client.post(
        f"/api/imports/batches/{batch_id}/undo",
        json={"undo_reason": "wrong batch"},
    )
    assert undo_resp.status_code == 200, undo_resp.text
    undo = undo_resp.json()
    # undone_count must be 2: the plain import AND the flagged duplicate.
    assert undo["undone_count"] == 2, (
        f"Expected 2 records undone (1 imported + 1 flagged_duplicate); got {undo['undone_count']}"
    )
    assert undo["excluded_count"] == 0

    # The original seeded "Existing Org" must still exist (only the one that
    # was imported in this batch is removed; the seed is untouched).
    with transaction_session(env["factory"]) as s:
        all_insts = list(s.scalars(sa.select(InstitutionModel)).all())
        existing_count = sum(1 for i in all_insts if i.name == "Existing Org")
        fresh_count = sum(1 for i in all_insts if i.name == "Fresh Org")
    assert existing_count == 1, "Original seeded institution must survive undo"
    assert fresh_count == 0, "Imported plain record must be removed by undo"


def test_undo_idempotent_second_undo_rejected(t11_env):
    """A second undo of an already-undone batch is rejected (fail-closed)."""
    env = t11_env
    client = _login(env["app"], "t11admin", "t11passadmin")
    csv_bytes = b"name,source_description\nDouble Undo,src du\n"
    resp = client.post(
        "/api/imports/batches",
        files={"file": ("double.csv", csv_bytes, "text/csv")},
    )
    batch_id = resp.json()["batch_id"]
    client.post(f"/api/imports/batches/{batch_id}/undo", json={"undo_reason": "first"})
    second = client.post(f"/api/imports/batches/{batch_id}/undo", json={"undo_reason": "second"})
    assert second.status_code == 400


def test_undo_whitespace_reason_rejected_cleanly(t11_env):
    """DEC-0096: whitespace-only undo reason is rejected with 4xx before DB work."""
    env = t11_env
    client = _login(env["app"], "t11admin", "t11passadmin")
    csv_bytes = b"name,source_description\nWS Test,src ws\n"
    resp = client.post(
        "/api/imports/batches",
        files={"file": ("ws.csv", csv_bytes, "text/csv")},
    )
    batch_id = resp.json()["batch_id"]
    ws_resp = client.post(
        f"/api/imports/batches/{batch_id}/undo", json={"undo_reason": "   "}
    )
    assert ws_resp.status_code == 400
    # Batch still active (no DB work done).
    with transaction_session(env["factory"]) as s:
        batch = s.get(ImportBatchModel, UUID(batch_id))
    assert batch.status == "active"


# ============ AC-007: imported records obey masking/ownership ============


def test_ac007_imported_records_obey_policy_projection(t11_env):
    """AC-007: imported records become normal SPEC-0001 records; a
    non-owner business user sees only the masked summary, not source detail."""
    env = t11_env
    admin_client = _login(env["app"], "t11admin", "t11passadmin")
    csv_bytes = b"name,source_description,region\nMask Test,secret source,west\n"
    admin_client.post(
        "/api/imports/batches",
        files={"file": ("mask.csv", csv_bytes, "text/csv")},
    )

    # Business user (non-owner) lists institutions: sees the name but not
    # the source_description (masked per SPEC-0001 field matrix).
    biz_client = _login(env["app"], "t11biz", "t11passbiz")
    resp = biz_client.get("/api/institutions?q=Mask")
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert any(i["name"] == "Mask Test" for i in items)
    # InstitutionSummary carries no source_description field at all (masked).
    for i in items:
        assert "source_description" not in i


# ============ AC-008: non-admin denied ============


def test_ac008_business_user_cannot_import(t11_env):
    """AC-008: a business user is denied bulk import."""
    env = t11_env
    client = _login(env["app"], "t11biz", "t11passbiz")
    csv_bytes = b"name,source_description\nDenied,src\n"
    resp = client.post(
        "/api/imports/batches",
        files={"file": ("deny.csv", csv_bytes, "text/csv")},
    )
    assert resp.status_code == 403


def test_ac008_no_role_user_cannot_import(t11_env):
    """AC-008: a no-role user is denied bulk import."""
    env = t11_env
    client = _login(env["app"], "t11norole", "t11passnr")
    csv_bytes = b"name,source_description\nDenied,src\n"
    resp = client.post(
        "/api/imports/batches",
        files={"file": ("deny.csv", csv_bytes, "text/csv")},
    )
    assert resp.status_code == 403


def test_ac008_non_admin_cannot_undo(t11_env):
    """AC-008 (extra): a business user cannot undo a batch."""
    env = t11_env
    admin_client = _login(env["app"], "t11admin", "t11passadmin")
    csv_bytes = b"name,source_description\nUndo Deny,src\n"
    resp = admin_client.post(
        "/api/imports/batches",
        files={"file": ("ud.csv", csv_bytes, "text/csv")},
    )
    batch_id = resp.json()["batch_id"]
    biz_client = _login(env["app"], "t11biz", "t11passbiz")
    undo_resp = biz_client.post(
        f"/api/imports/batches/{batch_id}/undo", json={"undo_reason": "attempt"}
    )
    assert undo_resp.status_code == 403


# ============ File-level validation (SPEC-0013 §8) ============


def test_unparseable_file_rejected_no_half_batch(t11_env):
    """SPEC-0013 §8: a file missing a required column is rejected before any
    import — no half-batch is produced."""
    env = t11_env
    client = _login(env["app"], "t11admin", "t11passadmin")
    # Missing source_description column entirely.
    csv_bytes = b"name\nNo Source\n"
    resp = client.post(
        "/api/imports/batches",
        files={"file": ("bad.csv", csv_bytes, "text/csv")},
    )
    assert resp.status_code == 400
    # No batch row created.
    with transaction_session(env["factory"]) as s:
        count = len(list(s.scalars(sa.select(ImportBatchModel)).all()))
    assert count == 0


def test_list_batches_and_get_batch_detail(t11_env):
    """The review surface: an administrator can list batches and view one
    batch's per-row results."""
    env = t11_env
    client = _login(env["app"], "t11admin", "t11passadmin")
    csv_bytes = b"name,source_description\nList A,src a\nList B,src b\n"
    resp = client.post(
        "/api/imports/batches",
        files={"file": ("list.csv", csv_bytes, "text/csv")},
    )
    batch_id = resp.json()["batch_id"]

    list_resp = client.get("/api/imports/batches")
    assert list_resp.status_code == 200
    summaries = list_resp.json()
    assert any(s["batch_id"] == batch_id for s in summaries)

    detail_resp = client.get(f"/api/imports/batches/{batch_id}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["batch_id"] == batch_id
    assert len(detail["row_results"]) == 2


def test_owner_username_column_resolves_owner(t11_env):
    """The optional owner_username column assigns the imported record's
    owner to the named enabled user (OD-001/OD-002)."""
    env = t11_env
    client = _login(env["app"], "t11admin", "t11passadmin")
    csv_bytes = b"name,source_description,owner_username\nOwner Test,src,t11biz\n"
    resp = client.post(
        "/api/imports/batches",
        files={"file": ("owner.csv", csv_bytes, "text/csv")},
    )
    assert resp.status_code == 201
    with transaction_session(env["factory"]) as s:
        all_insts = list(s.scalars(sa.select(InstitutionModel)).all())
        inst = next(i for i in all_insts if i.name == "Owner Test")
    assert inst.owner_user_id == env["biz_id"]


def test_owner_username_unknown_user_fails_row(t11_env):
    """An unknown owner_username makes the row fail with a clear reason."""
    env = t11_env
    client = _login(env["app"], "t11admin", "t11passadmin")
    csv_bytes = b"name,source_description,owner_username\nBad Owner,src,ghost_user\n"
    resp = client.post(
        "/api/imports/batches",
        files={"file": ("badowner.csv", csv_bytes, "text/csv")},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["failed_count"] == 1
    assert "ghost_user" in data["row_results"][0]["reason"]


# ============ Audit hygiene ============


def test_import_and_undo_audited_without_personal_values(t11_env):
    """Import and undo write audit events; the reason carries no personal
    values beyond file name + counts."""
    env = t11_env
    client = _login(env["app"], "t11admin", "t11passadmin")
    csv_bytes = b"name,source_description\nAudit Org,src\n"
    resp = client.post(
        "/api/imports/batches",
        files={"file": ("audit.csv", csv_bytes, "text/csv")},
    )
    batch_id = resp.json()["batch_id"]
    client.post(f"/api/imports/batches/{batch_id}/undo", json={"undo_reason": "audit test"})

    with transaction_session(env["factory"]) as s:
        events = _audit_events_for_target(s, UUID(batch_id))
    actions = sorted(e.action for e in events)
    assert "import.batch.run" in actions
    assert "import.batch.undo" in actions
