"""TASK-0008 S3: R-035 / AC-028 duplicate-suspicion prompt at create time.

Local-only, synthetic state; reuses the S5 in-memory environment (memory
repositories + central policy projection + in-memory auth).

Covered:
- exact normalized-name duplicate detection for institutions (trim +
  collapse internal whitespace + casefold) and exact channel match for
  contacts (same institution + same non-empty phone/email/wechat value);
- HTTP contract: 409 + duplicates + confirm_required when a visible
  candidate exists and confirm_duplicate is not set — nothing is created;
- confirm_duplicate=true creates a second, independent record (no merge);
- no-leak (AC-028): candidates are projected through project_record, so a
  non-owner caller never receives protected detail (source_description /
  source_kind / evidence), and a caller with no visibility at all receives
  no candidate detail (creation proceeds without existence disclosure).
"""

import os
from uuid import UUID

os.environ.setdefault("DATABASE_HOST", "localhost")
os.environ.setdefault("DATABASE_NAME", "s3_test")
os.environ.setdefault("DATABASE_USER", "s3_test")
os.environ.setdefault("DATABASE_PASSWORD", "s3-test-synthetic-password")
os.environ.setdefault("SESSION_SECRET_KEY", "s3-test-secret-not-for-production")
os.environ.setdefault("CRM_ENVIRONMENT", "test")
os.environ.setdefault("SESSION_COOKIE_SECURE", "false")

from test_s5_pages_api_parity import _login_as, s5_env  # noqa: E402

from crm.application.queries import (  # noqa: E402
    QueryService,
    normalize_channel_for_duplicate,
    normalize_name_for_duplicate,
)
from crm.domain.models import Role, UserStatus  # noqa: E402
from crm.policy import PolicyDenied  # noqa: E402


# ============ Normalization units (DEC-0080 engineering default) ============


def test_normalize_name_trims_collapses_whitespace_and_casefolds() -> None:
    assert normalize_name_for_duplicate("  苏州市  养老服务中心  ") == "苏州市 养老服务中心".casefold()
    assert normalize_name_for_duplicate("苏州 养老 中心") == "苏州 养老 中心".casefold()
    assert normalize_name_for_duplicate("  ") == ""
    assert normalize_name_for_duplicate("ABC 养老") == "abc 养老"


def test_normalize_channel_trims_and_casefolds() -> None:
    assert normalize_channel_for_duplicate("  13800000000  ") == "13800000000"
    assert normalize_channel_for_duplicate("  ZhangSan@Example.COM ") == "zhangsan@example.com"
    assert normalize_channel_for_duplicate("") == ""


# ============ QueryService duplicate detection (projected, no-leak) ============


def _fresh_query_service(inst_repo, contact_repo):
    return QueryService(inst_repo, contact_repo, object())


def test_detect_duplicate_institutions_exact_normalized_match(s5_env) -> None:
    client = s5_env["client"]
    # Admin (owner) creates one institution.
    inst = client.post(
        "/api/institutions",
        json={
            "name": "苏州市养老服务中心",
            "source_description": "S3 来源",
            "idempotency_key": "s3-inst-1",
        },
    )
    assert inst.status_code == 201, inst.text

    query_service = s5_env["client"].app.state.query_service
    # Same name with outer whitespace -> exact normalized match.
    dupes = query_service.detect_duplicate_institutions(
        "  苏州市养老服务中心 ",
        user_id=s5_env["other"].id,
        user_status=UserStatus.ENABLED,
        roles=frozenset({Role.BUSINESS_USER}),
    )
    assert len(dupes) == 1
    assert dupes[0]["name"] == "苏州市养老服务中心"
    assert dupes[0]["id"] == str(inst.json()["id"])
    # Protected detail is not part of the candidate payload.
    serialized = repr(dupes)
    assert "S3 来源" not in serialized
    assert "source_kind" not in dupes[0]

    # A genuinely different name is not a candidate.
    assert query_service.detect_duplicate_institutions(
        "北京养老服务有限公司",
        user_id=s5_env["other"].id,
        user_status=UserStatus.ENABLED,
        roles=frozenset({Role.BUSINESS_USER}),
    ) == []


def test_detect_duplicate_institutions_hides_candidates_from_invisible_subject(s5_env) -> None:
    """AC-028: a subject with no visibility at all (enabled but no business
    or administrator role, default deny R-006) receives no candidate detail —
    not even the candidate id/name. (R-008: an administrator is always
    visible, so administrator-without-reason is no longer an invisible
    subject.)"""
    client = s5_env["client"]
    inst = client.post(
        "/api/institutions",
        json={
            "name": "不可见候选机构",
            "source_description": "S3 敏感来源",
            "idempotency_key": "s3-inst-2",
        },
    )
    assert inst.status_code == 201, inst.text

    query_service = s5_env["client"].app.state.query_service
    dupes = query_service.detect_duplicate_institutions(
        "不可见候选机构",
        user_id=s5_env["other"].id,
        user_status=UserStatus.ENABLED,
        roles=frozenset(),  # no role -> default deny (R-006)
    )
    assert dupes == []


# ============ HTTP: institution create 409 / confirm / no-merge ============


def _create_institution(client, name, confirm=False, idempotency_key=None):
    import uuid as _uuid
    return client.post(
        "/api/institutions",
        json={
            "name": name,
            "source_description": "S3 来源说明",
            "idempotency_key": idempotency_key or f"s3-{_uuid.uuid4().hex[:8]}",
            "confirm_duplicate": confirm,
        },
    )


def test_institution_duplicate_without_confirm_409_and_not_created(s5_env) -> None:
    client = s5_env["client"]
    assert _create_institution(client, "重复机构甲").status_code == 201

    # Same normalized name, no confirm -> 409, nothing created.
    resp = _create_institution(client, "  重复机构甲 ")
    assert resp.status_code == 409, resp.text
    detail = resp.json()["detail"]
    assert detail["duplicates_found"] is True
    assert detail["confirm_required"] is True
    assert len(detail["duplicates"]) == 1
    assert detail["duplicates"][0]["name"] == "重复机构甲"

    # Only the first record exists.
    listing = client.get("/api/institutions").json()
    names = [i["name"] for i in listing["items"]]
    assert names.count("重复机构甲") == 1


def test_institution_duplicate_with_confirm_creates_independent_record(s5_env) -> None:
    """confirm_duplicate=true creates a second record; no auto-merge."""
    client = s5_env["client"]
    first = _create_institution(client, "重复机构乙")
    assert first.status_code == 201
    second = _create_institution(client, "重复机构乙", confirm=True)
    assert second.status_code == 201, second.text

    assert first.json()["id"] != second.json()["id"]
    listing = client.get("/api/institutions").json()
    names = [i["name"] for i in listing["items"]]
    assert names.count("重复机构乙") == 2


def test_institution_distinct_name_creates_without_409(s5_env) -> None:
    client = s5_env["client"]
    assert _create_institution(client, "唯一机构").status_code == 201
    resp = _create_institution(client, "另一家机构")
    assert resp.status_code == 201, resp.text


def test_institution_duplicate_candidate_payload_is_projected_no_leak(s5_env) -> None:
    """AC-028 no-leak: a non-owner caller sees only the projected candidate
    fields (id/name/category/region) — never the owner's protected detail."""
    client = s5_env["client"]
    owner = client.post(
        "/api/institutions",
        json={
            "name": "苏州安樵养老",
            "source_description": "机密来源说明-不得泄露",
            "source_kind": "internal-leak-check",
            "source_evidence_reference": "evidence-42",
            "idempotency_key": "s3-no-leak-owner",
        },
    )
    assert owner.status_code == 201, owner.text

    # The other business user attempts to create the same normalized name.
    other_client = _login_as("s5other", "s5other123")
    resp = other_client.post(
        "/api/institutions",
        json={
            "name": "  苏州安樵养老 ",
            "source_description": "S3 他人视角",
            "idempotency_key": "s3-no-leak-creator",
        },
    )
    assert resp.status_code == 409, resp.text
    dupes = resp.json()["detail"]["duplicates"]
    assert len(dupes) == 1
    assert dupes[0]["name"] == "苏州安樵养老"
    # Protected detail never appears anywhere in the warning payload.
    serialized = repr(resp.json())
    for protected in ("机密来源说明-不得泄露", "internal-leak-check", "evidence-42"):
        assert protected not in serialized


# ============ HTTP: contact duplicate 409 / confirm / no-merge ============


def _add_contact(client, inst_id, name, phone=None, email=None, wechat=None,
                 status="available", confirm=False):
    import uuid as _uuid
    body = {
        "name": name,
        "role_label": "院长",
        "contactability_status": status,
        "idempotency_key": f"s3-c-{_uuid.uuid4().hex[:8]}",
        "confirm_duplicate": confirm,
    }
    if phone:
        body["phone"] = phone
    if email:
        body["email"] = email
    if wechat:
        body["wechat"] = wechat
    return client.post(f"/api/institutions/{inst_id}/contacts", json=body)


def test_contact_duplicate_channel_without_confirm_409_and_not_created(s5_env) -> None:
    client = s5_env["client"]
    inst = client.post(
        "/api/institutions",
        json={
            "name": "联系人查重机构",
            "source_description": "S3 来源",
            "idempotency_key": "s3-c-inst",
        },
    )
    inst_id = inst.json()["id"]
    assert _add_contact(client, inst_id, "张三", phone="13800000000").status_code == 201

    # Same institution + same phone (outer whitespace) -> 409.
    resp = _add_contact(client, inst_id, "李四", phone="  13800000000  ")
    assert resp.status_code == 409, resp.text
    detail = resp.json()["detail"]
    assert detail["duplicates_found"] is True
    assert detail["confirm_required"] is True
    assert detail["duplicates"][0]["role_label"] == "院长"

    # Still exactly one contact in the institution.
    api = client.get(f"/api/institutions/{inst_id}")
    assert len(api.json()["contacts"]) == 1


def test_contact_duplicate_with_confirm_creates_independent_contact(s5_env) -> None:
    client = s5_env["client"]
    inst = client.post(
        "/api/institutions",
        json={
            "name": "联系人确认机构",
            "source_description": "S3 来源",
            "idempotency_key": "s3-c-inst-2",
        },
    )
    inst_id = inst.json()["id"]
    first = _add_contact(client, inst_id, "王五", phone="13900000000")
    assert first.status_code == 201
    second = _add_contact(client, inst_id, "王五-同名不同人", phone="13900000000", confirm=True)
    assert second.status_code == 201, second.text
    assert first.json()["id"] != second.json()["id"]

    api = client.get(f"/api/institutions/{inst_id}")
    assert len(api.json()["contacts"]) == 2  # two independent records, no merge


def test_contact_without_channel_is_not_compared(s5_env) -> None:
    """A contact with no storable channel has nothing to match: creation is
    not blocked by duplicate suspicion (R-035 matches non-empty channels)."""
    client = s5_env["client"]
    inst = client.post(
        "/api/institutions",
        json={
            "name": "无渠道机构",
            "source_description": "S3 来源",
            "idempotency_key": "s3-c-inst-3",
        },
    )
    inst_id = inst.json()["id"]
    resp = _add_contact(client, inst_id, "赵六", status="not_yet_obtained")
    assert resp.status_code == 201, resp.text


def test_contact_duplicate_different_channel_is_not_a_match(s5_env) -> None:
    """Only the same channel value is a duplicate; a different channel is not
    a candidate even for the same name."""
    client = s5_env["client"]
    inst = client.post(
        "/api/institutions",
        json={
            "name": "渠道区分机构",
            "source_description": "S3 来源",
            "idempotency_key": "s3-c-inst-4",
        },
    )
    inst_id = inst.json()["id"]
    assert _add_contact(client, inst_id, "钱七", phone="13700000000").status_code == 201
    resp = _add_contact(client, inst_id, "钱七", email="qian@example.com")
    assert resp.status_code == 201, resp.text  # different channel, no 409
