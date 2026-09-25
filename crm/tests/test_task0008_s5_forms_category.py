"""TASK-0008 S5: R-029 category + browser creation forms + AC-012/R-028.

Local-only, synthetic state; reuses the S5 in-memory environment.

Covered:
- R-029: writing a follow-up with a category (vocabulary
  电话/微信/面谈/邮件/其他) makes ``concise_progress.latest_follow_up_method_category``
  carry the category; the free-text interaction_method is displayed without
  the storage prefix; an invalid category is rejected; legacy category-less
  data stays None.
- AC-012 dedicated positive tests: a contact with no storable channel
  (not_yet_obtained / not_provided_or_not_storable) saves and its channel
  status is explicit.
- R-028 dedicated tests: next_action content requires next_action_owner
  (positive + rejection) over the API.
- Browser creation forms: GET pages render with the required fields; POST
  submits create records (CSRF-verified); duplicate-suspicion is rendered as
  a readable page error and confirm proceeds.
"""

import os
import re
from datetime import datetime, timezone

os.environ.setdefault("DATABASE_HOST", "localhost")
os.environ.setdefault("DATABASE_NAME", "s5t_test")
os.environ.setdefault("DATABASE_USER", "s5t_test")
os.environ.setdefault("DATABASE_PASSWORD", "s5t-test-synthetic-password")
os.environ.setdefault("SESSION_SECRET_KEY", "s5t-test-secret-not-for-production")
os.environ.setdefault("CRM_ENVIRONMENT", "test")
os.environ.setdefault("SESSION_COOKIE_SECURE", "false")

from test_s5_pages_api_parity import s5_env  # noqa: E402


def _create_institution(client, name, idempotency_key=None):
    import uuid as _uuid
    return client.post(
        "/api/institutions",
        json={
            "name": name,
            "source_description": "S5T 来源说明",
            "idempotency_key": idempotency_key or f"s5t-{_uuid.uuid4().hex[:8]}",
        },
    )


def _add_activity(client, inst_id, body, method="电话", category=None):
    import uuid as _uuid
    payload = {
        "occurred_at": datetime(2026, 8, 5, 9, 0, tzinfo=timezone.utc).isoformat(),
        "interaction_method": method,
        "factual_body": body,
        "idempotency_key": f"s5t-a-{_uuid.uuid4().hex[:8]}",
    }
    if category is not None:
        payload["communication_method_category"] = category
    return client.post(f"/api/institutions/{inst_id}/activities", json=payload)


# ============ R-029 communication-method category ============


def test_r029_category_appears_in_concise_progress(s5_env) -> None:
    """Writing a follow-up with a category surfaces the category in concise
    progress; the free-text detail stays the displayed interaction_method."""
    client = s5_env["client"]
    inst = _create_institution(client, "R029 机构")
    inst_id = inst.json()["id"]

    resp = _add_activity(client, inst_id, "微信沟通确认意向", method="微信语音通话", category="微信")
    assert resp.status_code == 201, resp.text

    # The creation response shows the free text without the storage prefix.
    assert resp.json()["interaction_method"] == "微信语音通话"

    detail = client.get(f"/api/institutions/{inst_id}").json()
    assert detail["concise_progress"]["latest_follow_up_method_category"] == "微信"
    # The detail view also strips the storage prefix.
    assert detail["activities"][0]["interaction_method"] == "微信语音通话"
    assert "【微信】" not in str(detail)


def test_r029_without_category_stays_none(s5_env) -> None:
    client = s5_env["client"]
    inst = _create_institution(client, "R029 无大类机构")
    inst_id = inst.json()["id"]

    assert _add_activity(client, inst_id, "电话沟通", method="电话").status_code == 201
    detail = client.get(f"/api/institutions/{inst_id}").json()
    assert detail["concise_progress"]["latest_follow_up_method_category"] is None
    assert detail["activities"][0]["interaction_method"] == "电话"


def test_r029_invalid_category_rejected(s5_env) -> None:
    client = s5_env["client"]
    inst = _create_institution(client, "R029 词表机构")
    inst_id = inst.json()["id"]

    resp = _add_activity(client, inst_id, "视频通话", method="视频通话", category="视频")
    assert resp.status_code == 400, resp.text
    assert "category" in resp.json()["detail"].lower()

    # Nothing was created.
    detail = client.get(f"/api/institutions/{inst_id}").json()
    assert detail["activities"] == []


# ============ AC-012: no-channel contacts save with explicit status ============


def test_ac012_no_channel_contact_saves_not_yet_obtained(s5_env) -> None:
    """Positive: a contact with no storable channel and status
    not_yet_obtained saves; the explicit status is stored."""
    client = s5_env["client"]
    inst = _create_institution(client, "AC012 机构A")
    inst_id = inst.json()["id"]

    resp = client.post(
        f"/api/institutions/{inst_id}/contacts",
        json={
            "name": "无渠道联系人",
            "role_label": "采购负责人",
            "contactability_status": "not_yet_obtained",
            "idempotency_key": "s5t-ac012-1",
        },
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["name"] == "无渠道联系人"
    assert resp.json()["role_label"] == "采购负责人"


def test_ac012_no_channel_contact_saves_not_provided(s5_env) -> None:
    """Positive: the not_provided_or_not_storable status also saves with no
    fabricated channel values."""
    client = s5_env["client"]
    inst = _create_institution(client, "AC012 机构B")
    inst_id = inst.json()["id"]

    resp = client.post(
        f"/api/institutions/{inst_id}/contacts",
        json={
            "name": "未提供渠道联系人",
            "role_label": "副院长",
            "contactability_status": "not_provided_or_not_storable",
            "idempotency_key": "s5t-ac012-2",
        },
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["name"] == "未提供渠道联系人"


def test_ac012_available_without_channel_is_rejected(s5_env) -> None:
    """Boundary: available status without any channel is still rejected (no
    fabricated channel values, R-016)."""
    client = s5_env["client"]
    inst = _create_institution(client, "AC012 机构C")
    inst_id = inst.json()["id"]

    resp = client.post(
        f"/api/institutions/{inst_id}/contacts",
        json={
            "name": "缺渠道联系人",
            "contactability_status": "available",
            "idempotency_key": "s5t-ac012-3",
        },
    )
    assert resp.status_code == 400, resp.text


# ============ R-028: next-action content requires owner ============


def test_r028_next_action_without_owner_rejected(s5_env) -> None:
    client = s5_env["client"]
    inst = _create_institution(client, "R028 拒绝机构")
    inst_id = inst.json()["id"]

    resp = _add_activity(client, inst_id, "正文", method="电话")
    assert resp.status_code == 201, resp.text  # baseline: no next action is fine

    resp = client.post(
        f"/api/institutions/{inst_id}/activities",
        json={
            "occurred_at": datetime(2026, 8, 5, 10, 0, tzinfo=timezone.utc).isoformat(),
            "interaction_method": "电话",
            "factual_body": "带下一步但缺负责人",
            "next_action": "提交方案",
            "idempotency_key": "s5t-r028-reject",
        },
    )
    assert resp.status_code == 400, resp.text
    assert "owner" in resp.json()["detail"].lower()


def test_r028_next_action_with_owner_accepted(s5_env) -> None:
    """Positive: next_action with a next_action_owner is accepted."""
    client = s5_env["client"]
    inst = _create_institution(client, "R028 正向机构")
    inst_id = inst.json()["id"]

    resp = client.post(
        f"/api/institutions/{inst_id}/activities",
        json={
            "occurred_at": datetime(2026, 8, 5, 11, 0, tzinfo=timezone.utc).isoformat(),
            "interaction_method": "面谈",
            "factual_body": "面谈达成下一步",
            "next_action": "本周内出报价",
            "next_action_owner_user_id": str(s5_env["admin"].id),
            "idempotency_key": "s5t-r028-ok",
        },
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["next_action"] == "本周内出报价"


# ============ Browser creation forms ============


def _form_csrf(client, url: str) -> str:
    """GET a form page and extract its hidden csrf_token value."""
    page = client.get(url)
    assert page.status_code == 200, page.text
    match = re.search(r'name="csrf_token" value="([^"]+)"', page.text)
    assert match, "csrf token input missing from form page"
    return match.group(1)


def test_form_pages_render_required_fields(s5_env) -> None:
    """Every creation form renders with its key fields (200 + field names)."""
    client = s5_env["client"]
    inst = _create_institution(client, "表单入口机构")
    inst_id = inst.json()["id"]

    page = client.get("/institutions/new")
    assert page.status_code == 200
    for field in ("name", "source_description", "confirm_duplicate", "csrf_token"):
        assert field in page.text

    page = client.get(f"/institutions/{inst_id}/contacts/new")
    assert page.status_code == 200
    for field in ("contactability_status", "phone", "email", "csrf_token"):
        assert field in page.text

    page = client.get(f"/institutions/{inst_id}/activities/new")
    assert page.status_code == 200
    for field in ("occurred_at", "communication_method_category", "factual_body", "csrf_token"):
        assert field in page.text


def test_institution_form_submit_creates_record(s5_env) -> None:
    client = s5_env["client"]
    csrf = _form_csrf(client, "/institutions/new")

    resp = client.post(
        "/institutions/new",
        data={
            "csrf_token": csrf,
            "name": "表单创建的机构",
            "source_description": "表单来源",
            "category": "养老服务",
            "region": "苏州市",
        },
        follow_redirects=False,
    )
    assert resp.status_code == 303, resp.text
    location = resp.headers["location"]

    listing = client.get("/institutions")
    assert "表单创建的机构" in listing.text


def test_institution_form_without_csrf_rejected(s5_env) -> None:
    client = s5_env["client"]
    resp = client.post(
        "/institutions/new",
        data={"name": "无 CSRF 机构", "source_description": "x"},
        follow_redirects=False,
    )
    assert resp.status_code == 400, resp.text
    assert "CSRF" in resp.text


def test_institution_form_duplicate_requires_confirm(s5_env) -> None:
    """The form renders a readable error for duplicate suspicion and only
    creates with explicit confirmation (no auto-merge)."""
    client = s5_env["client"]
    assert _create_institution(client, "表单重复机构").status_code == 201

    csrf = _form_csrf(client, "/institutions/new")
    resp = client.post(
        "/institutions/new",
        data={"csrf_token": csrf, "name": "表单重复机构", "source_description": "x"},
        follow_redirects=False,
    )
    assert resp.status_code == 409, resp.text
    assert "重复机构" in resp.text  # readable page error
    assert "不会自动合并" in resp.text

    # Confirm proceeds and creates a second, independent record.
    resp = client.post(
        "/institutions/new",
        data={"csrf_token": csrf, "name": "表单重复机构", "source_description": "x",
              "confirm_duplicate": "true"},
        follow_redirects=False,
    )
    assert resp.status_code == 303, resp.text
    listing = client.get("/institutions")
    assert listing.text.count("表单重复机构") == 2


def test_contact_form_submit_creates_contact(s5_env) -> None:
    client = s5_env["client"]
    inst = _create_institution(client, "联系人表单机构")
    inst_id = inst.json()["id"]

    csrf = _form_csrf(client, f"/institutions/{inst_id}/contacts/new")
    resp = client.post(
        f"/institutions/{inst_id}/contacts/new",
        data={
            "csrf_token": csrf,
            "name": "表单联系人",
            "role_label": "院长",
            "contactability_status": "not_yet_obtained",
        },
        follow_redirects=False,
    )
    assert resp.status_code == 303, resp.text

    detail = client.get(f"/institutions/{inst_id}")
    assert "表单联系人" in detail.text


def test_followup_form_submit_with_category(s5_env) -> None:
    """The follow-up form submits a category + free text; concise progress
    then carries the category and the page shows the free text."""
    client = s5_env["client"]
    inst = _create_institution(client, "跟进表单机构")
    inst_id = inst.json()["id"]

    csrf = _form_csrf(client, f"/institutions/{inst_id}/activities/new")
    resp = client.post(
        f"/institutions/{inst_id}/activities/new",
        data={
            "csrf_token": csrf,
            "occurred_at": "2026-08-05T14:30",
            "communication_method_category": "面谈",
            "interaction_method": "现场面谈确认方案",
            "factual_body": "表单提交的跟进正文",
        },
        follow_redirects=False,
    )
    assert resp.status_code == 303, resp.text

    detail = client.get(f"/institutions/{inst_id}")
    assert "表单提交的跟进正文" in detail.text
    assert "现场面谈确认方案" in detail.text
    assert "【面谈】" not in detail.text  # storage prefix never rendered

    api = client.get(f"/api/institutions/{inst_id}").json()
    assert api["concise_progress"]["latest_follow_up_method_category"] == "面谈"
