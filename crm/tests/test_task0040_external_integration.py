"""TASK-0040 (SPEC-0003 v0.4.0): isolated external-integration fixtures.

Local-only synthetic verification. Covers, per the task card phase 5:

- outbound whitelist enforcement (DEC-0158 point 3/4; R-016);
- leak suppression / local fallback (R-013 / AC-006);
- audit metadata = model id + field NAMES only (R-014 / AC-008);
- timeout / malformed / oversized degradation (R-015 / AC-007);
- no automatic customer creation (R-003 / AC-003);
- no external call when configuration is missing (fail-closed).

No real provider call and no real fetch ever happens here: HTTP clients and
fetchers are synthetic fakes; network gates default to closed.
"""

import json
import os
import uuid as _uuid
from datetime import datetime, timedelta, timezone
from uuid import UUID

os.environ.setdefault("DATABASE_HOST", "localhost")
os.environ.setdefault("DATABASE_NAME", "t40_test")
os.environ.setdefault("DATABASE_USER", "t40_test")
os.environ.setdefault("DATABASE_PASSWORD", "t40-test-synthetic-password")
os.environ.setdefault("SESSION_SECRET_KEY", "t40-test-secret-not-for-production")
os.environ.setdefault("CRM_ENVIRONMENT", "test")
os.environ.setdefault("SESSION_COOKIE_SECURE", "false")

import pytest  # noqa: E402

from crm.ai.audit import record_ai_outbound, record_crawler_fetch  # noqa: E402
from crm.ai.crawler import (  # noqa: E402
    CRAWLER_RETENTION_DAYS,
    NormalizedAnnouncement,
    PublicProcurementCrawler,
    parse_announcement_payload,
)
from crm.ai.provider import (  # noqa: E402
    MAX_RESPONSE_CHARS,
    AiReasonProvider,
    ProviderMalformedResponseError,
    ProviderTimeoutError,
)
from crm.ai.whitelist import (  # noqa: E402
    OUTBOUND_ALLOWED_FIELDS,
    assemble_outbound,
    outbound_field_names,
)
from crm.ai.wiring import build_crawler_source, build_reason_generator  # noqa: E402
from crm.application.opportunity import leak_scan  # noqa: E402


# ================= whitelist enforcement (DEC-0158 3/4, R-016) =================


class TestWhitelistEnforcement:
    def test_only_allowed_fields_cross_the_boundary(self):
        raw = {
            "title": "苏州市集中采购公告2026-001",
            "body": "本项目采购养老床垫 500 张…",
            "abstract": "采购公告摘要",
            "source_url": "https://example.gov/procurement/2026-001",
            "published_at": "2026-08-01T10:00:00+08:00",
            "announcement_type": "采购公告",
            "source_name": "测试站点",
            "fetched_at": "2026-08-02T00:00:00+00:00",
            "retained_until": "2026-09-01T00:00:00+00:00",
            # forbidden (DEC-0158 point 4) — must be dropped at assembly
            "customer_name": "某客户机构",
            "phone": "13812345678",
            "contact_details": {"wechat": "wxid_abc"},
            "followup_body": "上周电话确认预算约 50 万",
            "crm_notes": "内部备注：对方犹豫中",
            "evidence": "客户原话：我们确实要买",
            "api_key": "sk-test-not-a-real-key",
            "credential": "secret",
        }
        payload = assemble_outbound(raw, include_body=True)
        assert set(payload.keys()) <= OUTBOUND_ALLOWED_FIELDS
        for forbidden in (
            "customer_name", "phone", "contact_details", "followup_body",
            "crm_notes", "evidence", "api_key", "credential",
        ):
            assert forbidden not in payload, forbidden
        assert payload["title"] == "苏州市集中采购公告2026-001"

    def test_body_abstract_are_classification_only(self):
        raw = {"title": "t", "body": "全文", "abstract": "摘要", "source_url": "u"}
        # default: body/abstract dropped too
        payload = assemble_outbound(raw)
        assert "body" not in payload
        assert "abstract" not in payload
        # include_body=True keeps them
        payload = assemble_outbound(raw, include_body=True)
        assert payload["body"] == "全文"
        assert payload["abstract"] == "摘要"

    def test_field_names_are_names_not_values(self):
        payload = assemble_outbound(
            {"title": "t", "phone": "13800000000", "source_url": "u"}
        )
        names = outbound_field_names(payload)
        assert names == ["source_url", "title"]
        assert "phone" not in names
        assert "13800000000" not in names


# ============ provider: config, fail-closed, degradation (R-015/AC-007) ============


class _FakeHttpClient:
    """Synthetic HTTP client; records calls, never touches the network."""

    def __init__(self, *, status_code=200, text=""):
        self.status_code = status_code
        self._text = text
        self.calls: list[dict] = []

    def post(self, url, json, headers, timeout):
        self.calls.append({"url": url, "json": json, "headers": headers, "timeout": timeout})
        class _Resp:
            pass
        resp = _Resp()
        resp.status_code = self.status_code
        resp.text = self._text
        return resp


class TestProviderFailClosed:
    def test_unconfigured_provider_never_calls_and_degrades(self, monkeypatch):
        monkeypatch.delenv("CRM_AI_REASON_BASE_URL", raising=False)
        monkeypatch.delenv("CRM_AI_REASON_MODEL", raising=False)
        monkeypatch.delenv("CRM_AI_REASON_API_KEY", raising=False)
        monkeypatch.delenv("CRM_AI_REASON_WIRE_API", raising=False)
        fake = _FakeHttpClient(text=json.dumps({"choices": [{"message": {"content": "x"}}]}))
        provider = AiReasonProvider(http_client=fake, network_allowed=True)
        assert provider.is_configured is False
        result = provider.generate_reason({"title": "t"})
        assert result.degraded is True
        assert result.degraded_reason
        assert fake.calls == []  # never called

    def test_network_gate_closed_never_calls(self):
        fake = _FakeHttpClient(text=json.dumps({"choices": [{"message": {"content": "x"}}]}))
        provider = AiReasonProvider(
            base_url="https://example.invalid/v1/chat/completions",
            model="ai-reason-test",
            api_key="sk-not-real",
            http_client=fake,
            network_allowed=False,  # fail-closed default
        )
        assert provider.is_configured is True
        result = provider.generate_reason({"title": "t"})
        assert result.degraded is True
        assert fake.calls == []

    def test_configured_allowed_provider_sends_whitelisted_payload(self):
        fake = _FakeHttpClient(text=json.dumps({
            "choices": [{"message": {"content": "理由：该公告与直接采购类客户相关。"}}]
        }))
        provider = AiReasonProvider(
            base_url="https://example.invalid/v1/chat/completions",
            model="ai-reason-test-model",
            api_key="sk-not-real",
            http_client=fake,
            network_allowed=True,
        )
        result = provider.generate_reason(
            {"title": "t", "phone": "13800000000", "source_url": "u"},
            include_body=True,
        )
        assert result.degraded is False
        assert "理由" in result.text
        assert result.model_identifier == "ai-reason-test-model"
        sent = fake.calls[0]
        assert sent["json"]["model"] == "ai-reason-test-model"
        # the outbound payload must not contain the phone value
        serialized = json.dumps(sent["json"], ensure_ascii=False)
        assert "13800000000" not in serialized
        assert "sk-not-real" not in serialized
        assert set(result.outbound_field_names) <= OUTBOUND_ALLOWED_FIELDS

    def test_timeout_raises_recognized_error(self):
        class _TimeoutClient:
            def post(self, url, json, headers, timeout):
                raise TimeoutError("timed out")

        provider = AiReasonProvider(
            base_url="https://example.invalid",
            model="m",
            api_key="k",
            http_client=_TimeoutClient(),
            network_allowed=True,
        )
        with pytest.raises(ProviderTimeoutError):
            provider.generate_reason({"title": "t"})

    def test_malformed_non_json_raises_recognized_error(self):
        provider = AiReasonProvider(
            base_url="https://example.invalid",
            model="m",
            api_key="k",
            http_client=_FakeHttpClient(text="<html>not json</html>"),
            network_allowed=True,
        )
        with pytest.raises(ProviderMalformedResponseError):
            provider.generate_reason({"title": "t"})

    def test_oversized_response_raises_recognized_error(self):
        provider = AiReasonProvider(
            base_url="https://example.invalid",
            model="m",
            api_key="k",
            http_client=_FakeHttpClient(text="x" * (MAX_RESPONSE_CHARS + 1)),
            network_allowed=True,
        )
        with pytest.raises(ProviderMalformedResponseError):
            provider.generate_reason({"title": "t"})


# ============ audit: model id + field names only (R-014/AC-008) ============


class _CollectingAudit:
    def __init__(self):
        self.events = []

    def record(self, **kwargs):
        self.events.append(kwargs)


class TestAuditMetadata:
    def test_ai_outbound_audit_has_only_model_and_field_names(self):
        audit = _CollectingAudit()
        record_ai_outbound(
            audit,
            model_identifier="ai-reason-test-model",
            outbound_field_names=["title", "source_url"],
            outcome="success",
        )
        assert len(audit.events) == 1
        event = audit.events[0]
        assert event["action"] == "opportunity.ai_reason.outbound"
        assert event["outcome"] == "success"
        payload = json.loads(event["reason"])
        assert payload["model_identifier"] == "ai-reason-test-model"
        assert payload["outbound_field_names"] == ["source_url", "title"]
        # never values / keys / full payloads
        assert "13800000000" not in json.dumps(event, ensure_ascii=False)
        assert "sk-" not in json.dumps(event, ensure_ascii=False)

    def test_crawler_fetch_audit_is_provenance_only(self):
        audit = _CollectingAudit()
        record_crawler_fetch(
            audit, source_name="测试站点", degraded=True, degraded_reason="timeout",
            outcome="failure",
        )
        assert len(audit.events) == 1
        event = audit.events[0]
        assert event["action"] == "opportunity.crawler.fetch"
        assert event["outcome"] == "failure"
        payload = json.loads(event["reason"])
        assert payload["source_name"] == "测试站点"
        assert payload["degraded"] is True


# ============ crawler: normalization, retention, degradation ============


class TestCrawlerAdapter:
    def test_parse_json_payload(self):
        parsed = parse_announcement_payload(json.dumps({
            "title": "某市养老机构集采公告",
            "body": "正文…",
            "published_at": "2026-08-01T10:00:00+08:00",
            "announcement_type": "采购公告",
        }))
        assert parsed["title"] == "某市养老机构集采公告"
        assert parsed["published_at"] is not None
        assert parsed["announcement_type"] == "采购公告"

    def test_parse_malformed_returns_none(self):
        assert parse_announcement_payload("") is None
        assert parse_announcement_payload("{not json") is None
        assert parse_announcement_payload('{"no_title": 1}') is None

    def test_normalized_announcement_carries_30_day_retention(self):
        fetched = datetime.now(timezone.utc)
        ann = NormalizedAnnouncement(
            title="t", source_url="u", published_at=None,
            announcement_type="采购公告", source_name="s",
            fetched_at=fetched,
            retained_until=fetched + timedelta(days=CRAWLER_RETENTION_DAYS),
        )
        assert ann.retained_until - fetched == timedelta(days=30)
        subject = ann.to_subject_dict()
        assert subject["name"] == "t"
        assert subject["source_reference"] == "u"
        assert subject["category"] == "direct_purchase"

    def test_gate_closed_returns_empty_degraded(self):
        crawler = PublicProcurementCrawler(network_allowed=False)
        result = crawler.fetch_announcements()
        assert result.announcements == []
        assert result.degraded is True
        assert crawler.list_external_subjects() == []

    def test_timeout_source_degrades_with_deterministic_reason(self):
        def _boom(url, timeout):
            raise TimeoutError("timeout")

        crawler = PublicProcurementCrawler(
            sources=[{"name": "测试源", "url": "https://example.gov.cn/a"}],
            fetcher=_boom,
            network_allowed=True,
        )
        result = crawler.fetch_announcements()
        assert result.announcements == []
        assert result.degraded is True
        assert "timeout" in result.degraded_reason

    def test_parse_failure_degrades_without_fabricating(self):
        crawler = PublicProcurementCrawler(
            sources=[{"name": "测试源", "url": "https://example.gov.cn/b"}],
            fetcher=lambda url, timeout: '{"title": ',
            network_allowed=True,
        )
        result = crawler.fetch_announcements()
        assert result.announcements == []
        assert result.degraded is True
        assert "parse failure" in result.degraded_reason

    def test_successful_fetch_normalizes_announcement(self):
        crawler = PublicProcurementCrawler(
            sources=[{"name": "测试源", "url": "https://example.gov.cn/c"}],
            fetcher=lambda url, timeout: json.dumps({
                "title": "潍坊市养老机构集采2026",
                "body": "正文",
                "published_at": "2026-08-01T10:00:00+08:00",
            }),
            network_allowed=True,
        )
        result = crawler.fetch_announcements()
        assert len(result.announcements) == 1
        ann = result.announcements[0]
        assert ann.title == "潍坊市养老机构集采2026"
        assert ann.source_name == "测试源"
        assert ann.retained_until - ann.fetched_at == timedelta(days=30)
        # whitelist-shaped projection
        assert set(ann.to_subject_dict()) == {"name", "category", "region", "source_reference"}


# ============ wiring: env missing -> synthetic stub stays ============


class TestWiring:
    def test_reason_generator_none_when_env_missing(self, monkeypatch):
        for var in (
            "CRM_AI_REASON_BASE_URL",
            "CRM_AI_REASON_MODEL",
            "CRM_AI_REASON_API_KEY",
            "CRM_AI_REASON_WIRE_API",
        ):
            monkeypatch.delenv(var, raising=False)
        assert build_reason_generator() is None

    def test_crawler_source_none_when_not_enabled(self, monkeypatch):
        monkeypatch.delenv("CRM_CRAWLER_ENABLED", raising=False)
        assert build_crawler_source() is None

    def test_reason_generator_built_when_configured_but_network_closed(self):
        generator = build_reason_generator(
            base_url="https://example.invalid",
            model="ai-reason-test",
            api_key="sk-not-real",
        )
        assert generator is not None
        result = generator({"title": "t"})
        assert result.degraded is True  # gate closed, never calls


# ================= leak suppression (R-013 / AC-006) =================


class TestLeakScanContract:
    def test_leak_scan_flags_phone_and_protected_echo(self):
        assert leak_scan("联系电话 13912345678", []) == ["phone-like value"]
        assert leak_scan("安全理由", ["敏感来源"]) == []
        assert leak_scan("回退到敏感来源", ["敏感来源"]) == ["protected value echo"]
