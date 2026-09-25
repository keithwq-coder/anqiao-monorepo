"""TASK-0047 (SPEC-0013): bulk-import UI.

Admin-only /imports pages: multipart upload form, batch list/detail showing
status/row counts/duplicate flags exactly as the API returns, undo control
rendered only for undo-eligible (status == 'active') batches with explicit
confirmation. Verification uses synthetic files only. Local-only.
"""

import os
import uuid as _uuid
from datetime import datetime, timezone
from uuid import UUID

os.environ.setdefault("DATABASE_HOST", "localhost")
os.environ.setdefault("DATABASE_NAME", "t47_test")
os.environ.setdefault("DATABASE_USER", "t47_test")
os.environ.setdefault("DATABASE_PASSWORD", "t47-test-synthetic-password")
os.environ.setdefault("SESSION_SECRET_KEY", "t47-test-secret-not-for-production")
os.environ.setdefault("CRM_ENVIRONMENT", "test")
os.environ.setdefault("SESSION_COOKIE_SECURE", "false")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, event, select as sa_select  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from crm.persistence.base import Base  # noqa: E402
from crm.persistence.database import transaction_session  # noqa: E402
from crm.persistence.models import (  # noqa: E402
    AuditEventModel,
    ImportBatchModel,
    ImportRowResultModel,
    InstitutionModel,
    RoleGrantModel,
    UserIdentityModel,
)
from crm.domain import Role, UserIdentity, UserStatus  # noqa: E402
from crm.web.auth import AuthenticationService, AuthSettings, hash_password  # noqa: E402


@pytest.fixture
def t47_env():
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

    from crm.web.main import app

    from test_task0007_inmemory_fakes import (
        InMemoryRoleGrantRepository,
        InMemorySessionRepository,
        InMemoryUserRepository,
    )
    from crm.persistence.audit_repository import AuditEventRepository
    from crm.persistence.repositories import _ensure_aware

    user_repo = InMemoryUserRepository()
    session_repo = InMemorySessionRepository()
    role_repo = InMemoryRoleGrantRepository()

    def _identity(username, display, roles):
        ident = UserIdentity(
            username=username,
            display_name=display,
            password_hash=hash_password(f"{username}pass123"),
            status=UserStatus.ENABLED,
        )
        user_repo.add(ident)
        role_repo.set_grants(ident.id, roles)
        return ident

    admin = _identity("t47admin", "Admin", [Role.ADMINISTRATOR])
    gm = _identity("t47gm", "GM", [Role.MANAGER])
    bu = _identity("t47bu", "BusinessUser", [Role.BUSINESS_USER])

    now = datetime.now(timezone.utc)

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
                    created_at=_ensure_aware(m.created_at), updated_at=_ensure_aware(m.updated_at),
                )
            finally:
                s.close()

        def find_by_username(self, username):
            return self._mem.find_by_username(username)

    class _SqliteAuditRepo(AuditEventRepository):
        def __init__(self, f):
            self._f = f

        def record(self, *, action, outcome, target_type, actor_user_id=None,
                   target_id=None, reason=None, failure_summary=None, session=None,
                   before_state=None, after_state=None) -> None:
            model = AuditEventModel(
                actor_user_id=actor_user_id, action=action, target_type=target_type,
                target_id=target_id, outcome=outcome, reason=reason,
                failure_summary=failure_summary,
                before_state=before_state, after_state=after_state,
            )
            if session is not None:
                session.add(model)
                return
            with transaction_session(self._f) as s:
                s.add(model)

    sqlite_user_repo = _DualUserRepo(factory, user_repo)
    audit_repo = _SqliteAuditRepo(factory)

    with transaction_session(factory) as session:
        for ident in (admin, gm, bu):
            session.add(UserIdentityModel(
                id=ident.id, username=ident.username, display_name=ident.display_name,
                password_hash=ident.password_hash, status="enabled",
                session_epoch=0, created_at=now, updated_at=now,
            ))
            grants = {
                admin.id: ("administrator", None),
                gm.id: ("manager", "east"),
                bu.id: ("business_user", None),
            }
            session.add(RoleGrantModel(
                user_id=ident.id, role=grants[ident.id][0], scope_reference=grants[ident.id][1],
                granted_by_user_id=admin.id, reason="seed", granted_at=now,
            ))

        batch_active = ImportBatchModel(
            id=_uuid.uuid4(), imported_by_user_id=admin.id,
            source_file_name="customers.csv",
            source_file_sha256="a" * 64,
            row_count=3, imported_count=2, duplicate_count=1, failed_count=0,
            status="active", imported_at=now,
        )
        batch_undone = ImportBatchModel(
            id=_uuid.uuid4(), imported_by_user_id=admin.id,
            source_file_name="old.csv",
            source_file_sha256="b" * 64,
            row_count=1, imported_count=1, duplicate_count=0, failed_count=0,
            status="undone", imported_at=now,
            undone_at=now, undone_by_user_id=admin.id, undo_reason="误导入",
        )
        session.add_all([batch_active, batch_undone])
        session.flush()

        inst_dup = InstitutionModel(
            id=_uuid.uuid4(), name="T47 重复机构", source_description="s47d",
            customer_type="direct_purchase", owner_user_id=admin.id, in_pool=False,
            created_by_user_id=admin.id, idempotency_key="t47-inst-dup",
            region="east", category="养老机构", created_at=now, updated_at=now,
        )
        session.add(inst_dup)
        session.flush()

        rows = [
            ImportRowResultModel(
                batch_id=batch_active.id, line_number=2, outcome="imported",
                institution_id=inst_dup.id, duplicate_of_institution_id=None,
                reason=None, created_at=now,
            ),
            ImportRowResultModel(
                batch_id=batch_active.id, line_number=3, outcome="flagged_duplicate",
                institution_id=inst_dup.id, duplicate_of_institution_id=inst_dup.id,
                reason="normalized name matches existing record", created_at=now,
            ),
            ImportRowResultModel(
                batch_id=batch_active.id, line_number=4, outcome="imported",
                institution_id=inst_dup.id, duplicate_of_institution_id=None,
                reason=None, created_at=now,
            ),
        ]
        session.add_all(rows)

    auth_service = AuthenticationService(
        user_repository=sqlite_user_repo,
        session_repository=session_repo,
        audit_repository=audit_repo,
        auth_settings=AuthSettings(
            session_max_age_seconds=3600,
            login_rate_limit_per_hour=100,
            csrf_token_lifetime_hours=1,
        ),
    )

    app.state.user_repository = sqlite_user_repo
    app.state.session_repository = session_repo
    app.state.audit_repository = audit_repo
    app.state.role_grant_repository = role_repo
    app.state.auth_service = auth_service
    app.state.session_factory = factory

    def _login(username):
        client = TestClient(app)
        resp = client.post("/api/auth/login", json={"username": username, "password": f"{username}pass123"})
        assert resp.status_code == 200, resp.text
        client.headers["X-CSRF-Token"] = resp.json()["csrf_token"]
        return client

    admin_client = _login("t47admin")
    gm_client = _login("t47gm")
    bu_client = _login("t47bu")
    anonymous_client = TestClient(app)

    yield {
        "app": app,
        "factory": factory,
        "batch_active_id": str(batch_active.id),
        "batch_undone_id": str(batch_undone.id),
        "admin_client": admin_client,
        "gm_client": gm_client,
        "bu_client": bu_client,
        "anonymous_client": anonymous_client,
    }
    for c in (admin_client, gm_client, bu_client, anonymous_client):
        c.close()
    engine.dispose()


# ============ Page access control ============

def test_imports_pages_200_for_admin(t47_env):
    """/imports and /imports/{id} render for the administrator with CSRF."""
    env = t47_env
    resp = env["admin_client"].get("/imports")
    assert resp.status_code == 200, resp.text
    assert 'name="csrf_token"' in resp.text
    detail = env["admin_client"].get(f"/imports/{env['batch_active_id']}")
    assert detail.status_code == 200, detail.text
    assert 'name="csrf_token"' in detail.text


def test_imports_pages_denied_for_non_admin(t47_env):
    """manager/business_user get 403; anonymous 302→/login."""
    env = t47_env
    for path in (f"/imports", f"/imports/{env['batch_active_id']}"):
        assert env["gm_client"].get(path).status_code == 403
        assert env["bu_client"].get(path).status_code == 403
        anon = env["anonymous_client"].get(path, follow_redirects=False)
        assert anon.status_code == 302
        assert anon.headers["location"] == "/login"


def test_upload_form_present(t47_env):
    """The list page carries a multipart upload form with a file input and a
    CSRF token, and documents the accepted CSV columns."""
    env = t47_env
    body = env["admin_client"].get("/imports").text
    assert 'enctype="multipart/form-data"' in body
    assert 'type="file"' in body
    assert 'name="file"' in body
    assert "name" in body and "source_description" in body


# ============ Batch list ============

def test_batch_list_fields_match_api(t47_env):
    """Batch list renders exactly the API summary fields (batch_id /
    source_file_name / status / counts / imported_at / undone_at)."""
    env = t47_env
    api = env["admin_client"].get("/api/imports/batches")
    assert api.status_code == 200, api.text
    api_batches = {b["batch_id"]: b for b in api.json()}

    body = env["admin_client"].get("/imports").text
    assert api_batches[env["batch_active_id"]]["source_file_name"] in body
    assert api_batches[env["batch_undone_id"]]["source_file_name"] in body
    # raw sha fingerprint must never render.
    assert "a" * 64 not in body


def test_undo_control_only_for_eligible_batches(t47_env):
    """The undo form renders only for status == 'active' batches; the undone
    batch shows no undo control."""
    env = t47_env
    body = env["admin_client"].get("/imports").text
    assert f'data-batch="{env["batch_active_id"]}"' in body
    assert f'data-batch="{env["batch_undone_id"]}"' not in body
    assert "已撤销" in body


def test_detail_rows_include_duplicate_flags(t47_env):
    """Batch detail renders per-row outcomes including the duplicate flag."""
    env = t47_env
    body = env["admin_client"].get(f"/imports/{env['batch_active_id']}").text
    assert "重复标记" in body
    assert "已导入" in body
    assert "3" in body  # row_count
    assert "1" in body  # duplicate_count


def test_detail_undo_control_gated(t47_env):
    """Detail page shows the undo form for an active batch and hides it for
    an undone batch."""
    env = t47_env
    active_body = env["admin_client"].get(f"/imports/{env['batch_active_id']}").text
    assert 'id="detail-undo-form"' in active_body
    undone_body = env["admin_client"].get(f"/imports/{env['batch_undone_id']}").text
    assert 'id="detail-undo-form"' not in undone_body


# ============ API paths (form POST targets, synthetic files only) ============

def test_upload_api_with_synthetic_csv(t47_env):
    """Uploading a synthetic CSV via the multipart API creates a batch."""
    env = t47_env
    csv_bytes = b"name,source_description\nOrg A,src A\nOrg B,src B\n"
    resp = env["admin_client"].post(
        "/api/imports/batches",
        files={"file": ("synthetic.csv", csv_bytes, "text/csv")},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["row_count"] == 2
    assert data["imported_count"] == 2

    # It appears in the page list.
    body = env["admin_client"].get("/imports").text
    assert "synthetic.csv" in body


def test_upload_idempotent_replay(t47_env):
    """Re-uploading identical bytes returns the existing batch (AC-004)."""
    env = t47_env
    csv_bytes = b"name,source_description\nOrg X,src X\n"
    first = env["admin_client"].post(
        "/api/imports/batches", files={"file": ("x.csv", csv_bytes, "text/csv")}
    )
    assert first.status_code == 201, first.text
    second = env["admin_client"].post(
        "/api/imports/batches", files={"file": ("x.csv", csv_bytes, "text/csv")}
    )
    assert second.status_code == 201, second.text
    assert second.json()["batch_id"] == first.json()["batch_id"]
    assert second.json()["idempotent_replay"] is True


def test_undo_api_path(t47_env):
    """Undo works for an active batch; an undone batch is rejected."""
    env = t47_env
    r = env["admin_client"].post(
        f"/api/imports/batches/{env['batch_active_id']}/undo",
        json={"undo_reason": "测试撤销"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["undone"] is True

    again = env["admin_client"].post(
        f"/api/imports/batches/{env['batch_active_id']}/undo",
        json={"undo_reason": "再次撤销"},
    )
    assert again.status_code == 400

    blank = env["admin_client"].post(
        f"/api/imports/batches/{env['batch_undone_id']}/undo",
        json={"undo_reason": "   "},
    )
    assert blank.status_code == 400


# ============ Nav gating ============

def test_nav_imports_entry_role_gated(t47_env):
    """批量导入 nav entry renders for administrator only."""
    env = t47_env
    assert 'href="/imports"' in env["admin_client"].get("/dashboard").text
    assert 'href="/imports"' not in env["gm_client"].get("/dashboard").text
    assert 'href="/imports"' not in env["bu_client"].get("/dashboard").text
