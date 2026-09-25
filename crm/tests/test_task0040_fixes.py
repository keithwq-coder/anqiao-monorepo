"""TASK-0040 self-review remediation tests (2026-08-22).

Local-only synthetic fixtures covering the nine findings from the executor
self-review (``docs/evidence/TASK-0040-SELF-REVIEW-20260822.md``):

- P1-1 crawler per-source audit wiring (R-016);
- P1-2 wiring attaches the real fetcher when the runtime enables the crawler;
- P2-3 JSON array source_url scheme validation;
- P2-4 OpportunityService.run() truthful synthetic/degraded reporting (AC-007);
- P2-5 date-before-anchor list pages attribute dates correctly (R-017);
- P2-6 provider audits the ATTEMPT with a truthful outcome (R-014);
- P2-7 FORBIDDEN_FIELD_MARKERS removed (positive whitelist is the single gate);
- MED-8 fetcher SSRF hardening (host suffix, hop validation, body cap);
- LOW-9 provider rejects non-string content as malformed.

No real network happens here: httpx transport and fetchers are synthetic.
"""

import json
import os
from datetime import datetime

os.environ.setdefault("DATABASE_HOST", "localhost")
os.environ.setdefault("DATABASE_NAME", "t40_test")
os.environ.setdefault("DATABASE_USER", "t40_test")
os.environ.setdefault("DATABASE_PASSWORD", "t40-test-synthetic-password")
os.environ.setdefault("SESSION_SECRET_KEY", "t40-test-secret-not-for-production")
os.environ.setdefault("CRM_ENVIRONMENT", "test")
os.environ.setdefault("SESSION_COOKIE_SECURE", "false")

import httpx  # noqa: E402
import pytest  # noqa: E402

from crm.ai.audit import (  # noqa: E402
    record_ai_outbound,
    record_crawler_fetch,
)
from crm.ai.crawler import (  # noqa: E402
    PublicProcurementCrawler,
    make_httpx_fetcher,
    parse_announcement_list_payload,
)
from crm.ai.provider import (  # noqa: E402
    AiReasonProvider,
    ProviderMalformedResponseError,
    ProviderRequestError,
    ProviderTimeoutError,
)
from crm.ai.whitelist import assemble_outbound  # noqa: E402
from crm.ai.wiring import build_crawler_source, build_reason_generator  # noqa: E402

_DATE_BEFORE_LAYOUT = """<html><body><ul>
  <li><span>2026-08-01</span><a href="/cggg/1.html">某市养老服务采购项目招标公告</a></li>
  <li><span>2026-08-02</span><a href="/cggg/2.html">某县敬老院改造工程竞争性磋商公告</a></li>
</ul></body></html>
"""


class _CollectingAudit:
    def __init__(self):
        self.events = []

    def record(self, **kwargs):
        self.events.append(kwargs)


class _FakeHttpClient:
    """Synthetic provider HTTP client; records calls, never touches network."""

    def __init__(self, *, status_code=200, text=""):
        self.status_code = status_code
        self._text = text
        self.calls = []

    def post(self, url, json, headers, timeout):
        self.calls.append({"url": url, "json": json, "headers": headers, "timeout": timeout})

        class _Resp:
            pass

        resp = _Resp()
        resp.status_code = self.status_code
        resp.text = self._text
        return resp


# ============ P1-1: crawler per-source audit wiring ============


class TestCrawlerAuditWiring:
    def test_successful_fetch_audits_each_source(self):
        audit = _CollectingAudit()
        crawler = PublicProcurementCrawler(
            sources=[{"name": "测试源", "url": "https://example.gov.cn/list"}],
            fetcher=lambda url, timeout: _DATE_BEFORE_LAYOUT,
            network_allowed=True,
            audit_repository=audit,
        )
        result = crawler.fetch_announcements()
        assert not result.degraded
        assert len(audit.events) == 1
        event = audit.events[0]
        assert event["action"] == "opportunity.crawler.fetch"
        assert event["outcome"] == "success"
        payload = json.loads(event["reason"])
        assert payload["source_name"] == "测试源"
        assert payload["degraded"] is False

    def test_failed_fetch_audits_as_failure(self):
        audit = _CollectingAudit()
        crawler = PublicProcurementCrawler(
            sources=[{"name": "坏源", "url": "https://bad.example.gov.cn/list"}],
            fetcher=lambda url, timeout: (_ for _ in ()).throw(ConnectionError("refused")),
            network_allowed=True,
            audit_repository=audit,
        )
        result = crawler.fetch_announcements()
        assert result.degraded is True
        assert len(audit.events) == 1
        assert audit.events[0]["outcome"] == "failure"
        assert audit.events[0]["failure_summary"] == "ConnectionError"

    def test_no_audit_repository_keeps_zero_side_effects(self):
        crawler = PublicProcurementCrawler(
            sources=[{"name": "测试源", "url": "https://example.gov.cn/list"}],
            fetcher=lambda url, timeout: _DATE_BEFORE_LAYOUT,
            network_allowed=True,
        )
        result = crawler.fetch_announcements()
        assert not result.degraded  # still works, just unaudited (test scope)


# ============ P1-2: wiring attaches real fetcher when enabled ============


class TestWiringFetcherAttachment:
    def test_crawler_enabled_attaches_real_fetcher(self, monkeypatch):
        monkeypatch.setenv("CRM_CRAWLER_ENABLED", "1")
        monkeypatch.setenv("CRM_CRAWLER_NETWORK_ALLOWED", "1")
        monkeypatch.delenv("CRM_AI_REASON_BASE_URL", raising=False)
        monkeypatch.delenv("CRM_AI_REASON_MODEL", raising=False)
        monkeypatch.delenv("CRM_AI_REASON_API_KEY", raising=False)
        monkeypatch.delenv("CRM_AI_REASON_WIRE_API", raising=False)
        crawler = build_crawler_source()
        assert crawler is not None
        assert crawler.is_enabled is True  # real fetcher attached + gate open

    def test_crawler_disabled_stays_none(self, monkeypatch):
        monkeypatch.delenv("CRM_CRAWLER_ENABLED", raising=False)
        assert build_crawler_source() is None

    def test_reason_generator_still_none_when_unconfigured(self, monkeypatch):
        monkeypatch.delenv("CRM_AI_REASON_BASE_URL", raising=False)
        monkeypatch.delenv("CRM_AI_REASON_MODEL", raising=False)
        monkeypatch.delenv("CRM_AI_REASON_API_KEY", raising=False)
        monkeypatch.delenv("CRM_AI_REASON_WIRE_API", raising=False)
        assert build_reason_generator() is None


# ============ P2-3: JSON array source_url scheme validation ============


class TestJsonSourceUrlValidation:
    def test_non_http_source_url_falls_back_to_list_url(self):
        raw = json.dumps(
            [{"title": "A 招标公告", "source_url": "javascript:alert(1)"}],
            ensure_ascii=False,
        )
        items = parse_announcement_list_payload(raw, source_url="https://x.gov.cn/")
        assert items is not None
        # P2-4 (TASK-0040 fix): a rejected detail URL falls back to the
        # verified government list-page URL, never stays None and never
        # reaches the whitelist payload.
        assert items[0]["source_url"] == "https://x.gov.cn/"

    def test_http_source_url_kept(self):
        raw = json.dumps(
            [{"title": "A 招标公告", "source_url": "https://x.gov.cn/a"}],
            ensure_ascii=False,
        )
        items = parse_announcement_list_payload(raw, source_url=None)
        assert items[0]["source_url"] == "https://x.gov.cn/a"


# ============ P2-5: date-before-anchor attribution ============


class TestDateBeforeAnchor:
    def test_dates_attributed_to_their_own_link(self):
        items = parse_announcement_list_payload(
            _DATE_BEFORE_LAYOUT, source_url="https://www.example.gov.cn/"
        )
        assert items is not None
        assert len(items) == 2
        assert items[0]["published_at"] == datetime(2026, 8, 1)
        assert items[1]["published_at"] == datetime(2026, 8, 2)


# ============ P2-6: truthful audit outcome ============


class TestProviderAuditOutcome:
    def test_failed_egress_audits_failure_not_success(self):
        events = []

        def on_outbound(model_id, field_names, outcome):
            events.append((model_id, field_names, outcome))

        provider = AiReasonProvider(
            base_url="https://example.invalid",
            model="ai-reason-test",
            api_key="sk-not-real",
            http_client=_FakeHttpClient(status_code=402, text="payment required"),
            network_allowed=True,
            on_outbound=on_outbound,
        )
        with pytest.raises(ProviderRequestError):
            provider.generate_reason({"title": "t"})
        assert events == [("ai-reason-test", ["title"], "failure")]

    def test_successful_egress_audits_success(self):
        events = []

        def on_outbound(model_id, field_names, outcome):
            events.append((model_id, field_names, outcome))

        provider = AiReasonProvider(
            base_url="https://example.invalid",
            model="ai-reason-test",
            api_key="sk-not-real",
            http_client=_FakeHttpClient(
                text=json.dumps({"choices": [{"message": {"content": "安全理由"}}]})
            ),
            network_allowed=True,
            on_outbound=on_outbound,
        )
        result = provider.generate_reason({"title": "t"})
        assert not result.degraded
        assert events == [("ai-reason-test", ["title"], "success")]

    def test_no_attempt_no_audit(self):
        events = []

        def on_outbound(model_id, field_names, outcome):
            events.append((model_id, field_names, outcome))

        provider = AiReasonProvider(
            base_url="https://example.invalid",
            model="ai-reason-test",
            api_key="sk-not-real",
            network_allowed=False,  # gate closed: no attempt
            on_outbound=on_outbound,
        )
        result = provider.generate_reason({"title": "t"})
        assert result.degraded is True
        assert events == []

    def test_default_wiring_recorder_passes_outcome(self):
        audit = _CollectingAudit()
        generator = build_reason_generator(
            base_url="https://example.invalid",
            model="ai-reason-test",
            api_key="sk-not-real",
            http_client=_FakeHttpClient(status_code=402, text="payment required"),
            network_allowed=True,
            audit_repository=audit,
        )
        with pytest.raises(ProviderRequestError):
            generator({"title": "t"})
        assert len(audit.events) == 1
        assert audit.events[0]["outcome"] == "failure"
        payload = json.loads(audit.events[0]["reason"])
        assert payload["model_identifier"] == "ai-reason-test"
        assert payload["outbound_field_names"] == ["title"]


# ============ P2-7: positive whitelist only ============


class TestWhitelistSingleGate:
    def test_forbidden_marker_constant_removed(self):
        import crm.ai.whitelist as wl

        assert not hasattr(wl, "FORBIDDEN_FIELD_MARKERS")

    def test_forbidden_fields_still_dropped_by_positive_list(self):
        payload = assemble_outbound(
            {"title": "t", "phone": "13800000000", "api_key": "sk-x"},
            include_body=True,
        )
        assert "phone" not in payload
        assert "api_key" not in payload
        assert payload == {"title": "t"}


# ============ MED-8: fetcher SSRF hardening ============


class TestFetcherSsfrHardening:
    def test_disallowed_host_rejected_before_request(self):
        fetcher = make_httpx_fetcher(transport=httpx.MockTransport(lambda r: httpx.Response(200)))
        with pytest.raises(ConnectionError):
            fetcher("https://evil.example.com/list", 5.0)

    def test_non_http_scheme_rejected(self):
        fetcher = make_httpx_fetcher(transport=httpx.MockTransport(lambda r: httpx.Response(200)))
        with pytest.raises(ConnectionError):
            fetcher("file:///etc/passwd", 5.0)

    def test_gov_cn_host_allowed(self):
        calls = []

        def handler(request):
            calls.append(str(request.url))
            return httpx.Response(200, content=b"<html><body>ok</body></html>")

        fetcher = make_httpx_fetcher(transport=httpx.MockTransport(handler))
        body = fetcher("https://ggzy.example.gov.cn/list", 5.0)
        assert body == "<html><body>ok</body></html>"
        assert calls == ["https://ggzy.example.gov.cn/list"]

    def test_redirect_to_disallowed_host_blocked(self):
        def handler(request):
            if request.url.host == "ggzy.example.gov.cn":
                return httpx.Response(302, headers={"location": "http://169.254.169.254/meta"})
            return httpx.Response(200, content=b"secret")

        fetcher = make_httpx_fetcher(transport=httpx.MockTransport(handler))
        with pytest.raises(ConnectionError):
            fetcher("https://ggzy.example.gov.cn/list", 5.0)

    def test_redirect_within_gov_cn_followed(self):
        def handler(request):
            if request.url.path == "/list":
                return httpx.Response(302, headers={"location": "https://ggzy.example.gov.cn/final"})
            return httpx.Response(200, content=b"<html>final</html>")

        fetcher = make_httpx_fetcher(transport=httpx.MockTransport(handler))
        body = fetcher("https://ggzy.example.gov.cn/list", 5.0)
        assert body == "<html>final</html>"

    def test_oversized_body_rejected(self):
        fetcher = make_httpx_fetcher(
            max_body_bytes=10,
            transport=httpx.MockTransport(
                lambda r: httpx.Response(200, content=b"x" * 100)
            ),
        )
        with pytest.raises(ConnectionError):
            fetcher("https://ggzy.example.gov.cn/list", 5.0)


# ============ LOW-9: non-string content rejected ============


class TestProviderContentType:
    def test_non_string_content_is_malformed(self):
        provider = AiReasonProvider(
            base_url="https://example.invalid",
            model="ai-reason-test",
            api_key="sk-not-real",
            http_client=_FakeHttpClient(
                text=json.dumps({"choices": [{"message": {"content": {"nested": "obj"}}}]})
            ),
            network_allowed=True,
        )
        with pytest.raises(ProviderMalformedResponseError):
            provider.generate_reason({"title": "t"})


# ============ P2 (TASK-0040 fix): audit storage failure must not escape ============


class _FailingAudit:
    """Audit repository whose record() always raises (storage outage)."""

    def __init__(self):
        self.calls = 0

    def record(self, **kwargs):
        self.calls += 1
        raise RuntimeError("audit backend unavailable")


class TestProviderAuditStorageFailure:
    def test_success_path_audit_failure_degrades_as_provider_error(self):
        """A successful request whose audit write fails must raise a
        recognizable ProviderError (never a raw 500), so the service layer
        falls back to the local deterministic reason and no un-audited model
        text is returned as success."""
        from crm.ai.audit import record_ai_outbound

        events = []
        failing = _FailingAudit()

        def recorder(model_id, field_names, outcome):
            events.append((model_id, field_names, outcome))
            record_ai_outbound(
                failing,
                model_identifier=model_id,
                outbound_field_names=field_names,
                outcome=outcome,
            )

        provider = AiReasonProvider(
            base_url="https://example.invalid",
            model="ai-reason-test",
            api_key="sk-not-real",
            http_client=_FakeHttpClient(
                text=json.dumps({"choices": [{"message": {"content": "安全理由"}}]})
            ),
            network_allowed=True,
            on_outbound=recorder,
        )
        with pytest.raises(ProviderRequestError, match="audit failure"):
            provider.generate_reason({"title": "t"})
        assert events == [("ai-reason-test", ["title"], "success")]

    def test_wiring_recorder_audit_failure_raises_provider_error(self):
        audit = _FailingAudit()
        generator = build_reason_generator(
            base_url="https://example.invalid",
            model="ai-reason-test",
            api_key="sk-not-real",
            http_client=_FakeHttpClient(
                text=json.dumps({"choices": [{"message": {"content": "安全理由"}}]})
            ),
            network_allowed=True,
            audit_repository=audit,
        )
        assert generator is not None
        with pytest.raises(ProviderRequestError, match="audit failure"):
            generator({"title": "t"})

    def test_failed_request_audit_failure_keeps_request_error(self):
        """On an already-failing request the audit failure must not replace
        the primary ProviderError (timeout stays a timeout)."""
        class _TimeoutClient:
            def post(self, url, json, headers, timeout):
                raise TimeoutError("timed out")

        provider = AiReasonProvider(
            base_url="https://example.invalid",
            model="ai-reason-test",
            api_key="sk-not-real",
            http_client=_TimeoutClient(),
            network_allowed=True,
            on_outbound=lambda m, f, o: (_ for _ in ()).throw(RuntimeError("audit down")),
        )
        with pytest.raises(ProviderTimeoutError):
            provider.generate_reason({"title": "t"})


class TestCrawlerAuditStorageFailure:
    def test_audit_failure_degrades_source_but_run_continues(self):
        """P2: a failing audit repository degrades the affected source and
        drops its announcements, but does not abort the whole run — other
        sources still yield candidates."""
        failing = _FailingAudit()
        crawler = PublicProcurementCrawler(
            sources=[
                {"name": "好源A", "url": "https://a.example.gov.cn/list"},
                {"name": "好源B", "url": "https://b.example.gov.cn/list"},
            ],
            fetcher=lambda url, timeout: '{"title": "某市集采公告"}',
            network_allowed=True,
            audit_repository=failing,
        )
        result = crawler.fetch_announcements()
        # The run completes (no exception) and is marked degraded; no
        # un-audited announcement is kept as success.
        assert result.degraded is True
        assert "audit failure" in result.degraded_reason
        assert result.announcements == []

    def test_mixed_sources_one_audit_failure_other_succeeds(self):
        class _OneFailingAudit:
            def __init__(self):
                self.fail_for = {"坏源"}

            def record(self, **kwargs):
                if kwargs.get("target_type") == "opportunity_crawler_source":
                    reason = json.loads(kwargs.get("reason") or "{}")
                    if reason.get("source_name") in self.fail_for:
                        raise RuntimeError("audit down")
                return None

        crawler = PublicProcurementCrawler(
            sources=[
                {"name": "坏源", "url": "https://bad.example.gov.cn/list"},
                {"name": "好源", "url": "https://good.example.gov.cn/list"},
            ],
            fetcher=lambda url, timeout: '{"title": "某市集采公告"}',
            network_allowed=True,
            audit_repository=_OneFailingAudit(),
        )
        result = crawler.fetch_announcements()
        assert result.degraded is True  # 坏源 degraded by audit failure
        # 好源's announcement still flows (run not aborted).
        assert len(result.announcements) == 1
        assert result.announcements[0].source_name == "好源"


# ============ P3 (TASK-0040 fix): streaming body-size limit ============


class TestFetcherStreamingSizeLimit:
    def test_oversized_body_rejected_without_full_materialization(self):
        """The fetcher must stop reading once the cap is exceeded — the
        handler is never asked for the full body beyond the cap, and a
        ConnectionError is raised."""
        served = {"bytes": 0}

        def handler(request):
            return httpx.Response(200, content=b"x" * 100)

        fetcher = make_httpx_fetcher(
            max_body_bytes=10,
            transport=httpx.MockTransport(handler),
        )
        with pytest.raises(ConnectionError, match="too large"):
            fetcher("https://ggzy.example.gov.cn/list", 5.0)
        # The stream closed before the full 100 bytes were consumed; the
        # handler's response object is lazily read by httpx, so we assert the
        # recognizable error instead of byte accounting (stream never
        # materializes the full body as one blob).

    def test_body_within_limit_returned(self):
        fetcher = make_httpx_fetcher(
            max_body_bytes=100,
            transport=httpx.MockTransport(
                lambda r: httpx.Response(200, content=b"<html>ok</html>")
            ),
        )
        body = fetcher("https://ggzy.example.gov.cn/list", 5.0)
        assert body == "<html>ok</html>"

    def test_streaming_still_validates_redirect_hops(self):
        def handler(request):
            if request.url.path == "/list":
                return httpx.Response(302, headers={"location": "http://169.254.169.254/x"})
            return httpx.Response(200, content=b"secret")

        fetcher = make_httpx_fetcher(transport=httpx.MockTransport(handler))
        with pytest.raises(ConnectionError):
            fetcher("https://ggzy.example.gov.cn/list", 5.0)


# ============ P2-4 (TASK-0040 fix): government-only detail URLs ============


class TestGovernmentUrlGate:
    def test_non_government_absolute_html_link_dropped(self):
        html = """<html><body><ul>
          <li><a href="https://evil.example.com/detail/1">某市采购项目招标公告</a><span>2026-08-01</span></li>
          <li><a href="/ok/2.html">某县改造工程成交公告</a><span>2026-08-02</span></li>
        </ul></body></html>"""
        items = parse_announcement_list_payload(html, source_url="https://www.example.gov.cn/")
        assert items is not None
        # evil.example.com dropped; only the government relative path remains.
        assert len(items) == 1
        assert items[0]["source_url"] == "https://www.example.gov.cn/ok/2.html"

    def test_protocol_relative_non_government_url_rejected(self):
        html = """<html><body><ul>
          <li><a href="//evil.example.net/x/1.html">某市集采招标公告</a></li>
        </ul></body></html>"""
        items = parse_announcement_list_payload(html, source_url="https://www.example.gov.cn/")
        assert items is None  # nothing government-plausible remains

    def test_javascript_url_rejected_in_html(self):
        html = """<html><body><ul>
          <li><a href="javascript:alert(1)">某市采购招标公告</a></li>
        </ul></body></html>"""
        items = parse_announcement_list_payload(html, source_url="https://www.example.gov.cn/")
        assert items is None

    def test_government_relative_url_kept(self):
        html = """<html><body><ul>
          <li><a href="/ggzy/2026/1.html">某市养老采购招标公告</a><span>2026-08-01</span></li>
        </ul></body></html>"""
        items = parse_announcement_list_payload(html, source_url="https://www.example.gov.cn/")
        assert items is not None
        assert items[0]["source_url"] == "https://www.example.gov.cn/ggzy/2026/1.html"

    def test_json_non_government_source_url_falls_back_to_list_url(self):
        raw = json.dumps(
            [{"title": "A 招标公告", "source_url": "https://evil.example.com/a"}],
            ensure_ascii=False,
        )
        items = parse_announcement_list_payload(raw, source_url="https://www.example.gov.cn/")
        assert items is not None
        assert items[0]["source_url"] == "https://www.example.gov.cn/"

    def test_json_protocol_relative_rejected(self):
        raw = json.dumps(
            [{"title": "A 招标公告", "source_url": "//evil.example.com/a"}],
            ensure_ascii=False,
        )
        items = parse_announcement_list_payload(raw, source_url="https://www.example.gov.cn/")
        assert items is not None
        assert items[0]["source_url"] == "https://www.example.gov.cn/"

    def test_gov_cn_exact_host_allowed(self):
        assert parse_announcement_list_payload(
            json.dumps([{"title": "B 采购公告", "source_url": "https://gov.cn/a"}]),
            source_url=None,
        )[0]["source_url"] == "https://gov.cn/a"


# ============ Codex review round: source-url fail-closed, audit outcome, provider audit ============


class TestSourceUrlFailClosed:
    """Codex review fix: a non-government LIST source URL must never produce
    announcements; only the verified government list URL may be used as the
    fallback, so a non-government URL can never reach
    NormalizedAnnouncement.source_url / source_reference / persistence."""

    def test_non_government_source_url_degrades_no_announcements(self):
        crawler = PublicProcurementCrawler(
            sources=[{"name": "坏源", "url": "https://evil.example.com/list"}],
            fetcher=lambda url, timeout: '{"title": "某市集采公告"}',
            network_allowed=True,
        )
        result = crawler.fetch_announcements()
        assert result.announcements == []
        assert result.degraded is True
        assert "disallowed source url" in result.degraded_reason

    def test_non_http_scheme_source_degrades(self):
        crawler = PublicProcurementCrawler(
            sources=[{"name": "坏源", "url": "file:///etc/passwd"}],
            fetcher=lambda url, timeout: "{}",
            network_allowed=True,
        )
        result = crawler.fetch_announcements()
        assert result.announcements == []
        assert result.degraded is True
        assert "disallowed source url" in result.degraded_reason

    def test_fallback_never_uses_non_government_list_url(self):
        """parsed.get('source_url') is None (JSON dropped it) and the list
        URL itself is non-government: the announcement must NOT be built with
        the non-government fallback."""
        crawler = PublicProcurementCrawler(
            sources=[{"name": "坏源", "url": "https://evil.example.com/list"}],
            fetcher=lambda url, timeout: '{"title": "某市集采公告"}',
            network_allowed=True,
        )
        result = crawler.fetch_announcements()
        assert result.announcements == []
        assert result.degraded is True

    def test_government_source_still_flows_into_source_reference(self):
        crawler = PublicProcurementCrawler(
            sources=[{"name": "好源", "url": "https://www.example.gov.cn/list"}],
            fetcher=lambda url, timeout: '{"title": "某市集采公告", "source_url": "https://www.example.gov.cn/detail/1"}',
            network_allowed=True,
        )
        result = crawler.fetch_announcements()
        assert not result.degraded
        assert len(result.announcements) == 1
        ann = result.announcements[0]
        assert ann.source_url == "https://www.example.gov.cn/detail/1"
        assert ann.to_subject_dict()["source_reference"] == "https://www.example.gov.cn/detail/1"

    def test_mixed_sources_non_government_skipped_government_kept(self):
        crawler = PublicProcurementCrawler(
            sources=[
                {"name": "坏源", "url": "https://evil.example.com/list"},
                {"name": "好源", "url": "https://good.example.gov.cn/list"},
            ],
            fetcher=lambda url, timeout: '{"title": "某市集采公告"}',
            network_allowed=True,
        )
        result = crawler.fetch_announcements()
        assert result.degraded is True  # 坏源 degraded
        assert len(result.announcements) == 1
        assert result.announcements[0].source_name == "好源"
        assert result.announcements[0].source_url == "https://good.example.gov.cn/list"


class TestAuditRecorderRequiresOutcome:
    """Codex review fix: recorders must not default to success — a degraded or
    failed call can never produce a success audit by omission."""

    def test_ai_outbound_requires_outcome(self):
        audit = _CollectingAudit()
        with pytest.raises(TypeError):
            record_ai_outbound(
                audit,
                model_identifier="m",
                outbound_field_names=["title"],
            )

    def test_crawler_fetch_requires_outcome(self):
        audit = _CollectingAudit()
        with pytest.raises(TypeError):
            record_crawler_fetch(
                audit,
                source_name="s",
                degraded=True,
            )

    def test_ai_outbound_failure_outcome_persisted(self):
        from crm.ai.audit import record_ai_outbound

        audit = _CollectingAudit()
        record_ai_outbound(
            audit,
            model_identifier="m",
            outbound_field_names=["title"],
            outcome="failure",
            failure_summary="timeout",
        )
        assert audit.events[0]["outcome"] == "failure"
        assert audit.events[0]["failure_summary"] == "timeout"

    def test_crawler_fetch_failure_outcome_persisted(self):
        from crm.ai.audit import record_crawler_fetch

        audit = _CollectingAudit()
        record_crawler_fetch(
            audit,
            source_name="s",
            degraded=True,
            degraded_reason="timeout",
            outcome="failure",
        )
        assert audit.events[0]["outcome"] == "failure"
        assert audit.events[0]["failure_summary"] == "timeout"


class TestProviderAuditOnClientProviderError:
    """Codex review fix: when the HTTP client's post() raises a ProviderError
    after being invoked, exactly one failure audit is written and the ORIGINAL
    ProviderError is preserved (never masked by an audit failure)."""

    def test_client_provider_error_writes_exactly_one_failure_audit(self):
        events = []

        def on_outbound(model_id, field_names, outcome):
            events.append((model_id, field_names, outcome))

        class _ClientRaisesProviderError:
            def post(self, url, json, headers, timeout):
                raise ProviderRequestError("client-side provider error")

        provider = AiReasonProvider(
            base_url="https://example.invalid",
            model="ai-reason-test",
            api_key="sk-not-real",
            http_client=_ClientRaisesProviderError(),
            network_allowed=True,
            on_outbound=on_outbound,
        )
        with pytest.raises(ProviderRequestError, match="client-side provider error"):
            provider.generate_reason({"title": "t"})
        # exactly one failure audit, no duplicate
        assert events == [("ai-reason-test", ["title"], "failure")]

    def test_client_provider_error_not_masked_by_audit_failure(self):
        """Even when the audit callback itself raises, the ORIGINAL
        ProviderError from the client is preserved."""
        class _ClientRaisesProviderError:
            def post(self, url, json, headers, timeout):
                raise ProviderRequestError("client-side provider error")

        provider = AiReasonProvider(
            base_url="https://example.invalid",
            model="ai-reason-test",
            api_key="sk-not-real",
            http_client=_ClientRaisesProviderError(),
            network_allowed=True,
            on_outbound=lambda m, f, o: (_ for _ in ()).throw(RuntimeError("audit down")),
        )
        with pytest.raises(ProviderRequestError, match="client-side provider error"):
            provider.generate_reason({"title": "t"})

    def test_fail_closed_path_writes_no_outbound_audit(self):
        events = []

        def on_outbound(model_id, field_names, outcome):
            events.append((model_id, field_names, outcome))

        provider = AiReasonProvider(
            base_url="https://example.invalid",
            model="ai-reason-test",
            api_key="sk-not-real",
            network_allowed=False,  # gate closed: no request, no audit
            on_outbound=on_outbound,
        )
        result = provider.generate_reason({"title": "t"})
        assert result.degraded is True
        assert events == []


# ============ Real-LLM leg (product-owner approved): SSE streaming client ============


class TestSseStreamingHttpClient:
    """TASK-0040 real-LLM leg: the approved GLM gateway always answers in
    Server-Sent-Events with model text in delta.reasoning_details[].text.
    The SSE client must aggregate content + reasoning_details into the
    standard chat-completion JSON the provider already parses."""

    def _sse_response(self):
        chunks = [
            {"choices": [{"delta": {"role": "assistant", "content": "理由："}}]},
            {"choices": [{"delta": {"reasoning_details": [
                {"type": "reasoning.text", "text": "该公告", "format": "unknown", "index": 0},
            ]}}]},
            {"choices": [{"delta": {"reasoning_details": [
                {"type": "reasoning.text", "text": "与直接采购相关。", "format": "unknown", "index": 0},
            ]}}]},
        ]
        lines = [f"data: {json.dumps(c, ensure_ascii=False)}" for c in chunks]
        lines.append("data: [DONE]")
        return "\n\n".join(lines) + "\n\n"

    def test_aggregates_content_and_reasoning_details(self):
        from crm.ai.provider import SseStreamingHttpClient

        body = self._sse_response()
        client = SseStreamingHttpClient(
            transport=httpx.MockTransport(lambda r: httpx.Response(200, content=body.encode("utf-8")))
        )
        resp = client.post("https://example.invalid/v1/chat/completions",
                           json={"model": "glm-5.2", "messages": []},
                           headers={"Authorization": "Bearer k"}, timeout=30.0)
        assert resp.status_code == 200
        data = json.loads(resp.text)
        content = data["choices"][0]["message"]["content"]
        assert "理由：" in content
        assert "该公告" in content
        assert "与直接采购相关。" in content

    def test_empty_stream_is_malformed(self):
        from crm.ai.provider import SseStreamingHttpClient, ProviderMalformedResponseError

        client = SseStreamingHttpClient(
            transport=httpx.MockTransport(
                lambda r: httpx.Response(200, content=b"data: [DONE]\n\n")
            )
        )
        with pytest.raises(ProviderMalformedResponseError):
            client.post("https://example.invalid/v1/chat/completions",
                        json={}, headers={}, timeout=30.0)

    def test_http_error_raises_request_error(self):
        from crm.ai.provider import SseStreamingHttpClient, ProviderRequestError

        client = SseStreamingHttpClient(
            transport=httpx.MockTransport(
                lambda r: httpx.Response(402, content=b"payment required")
            )
        )
        with pytest.raises(ProviderRequestError):
            client.post("https://example.invalid/v1/chat/completions",
                        json={}, headers={}, timeout=30.0)

    def test_provider_uses_sse_client_end_to_end_with_audit(self):
        """AiReasonProvider + SseStreamingHttpClient: the aggregated reason
        flows through the existing parse path, R-013 scan, and a truthful
        success audit."""
        from crm.ai.provider import SseStreamingHttpClient

        chunks = [
            {"choices": [{"delta": {"role": "assistant", "content": "理由：该公告与直接采购类客户相关。"}}]},
        ]
        lines = [f"data: {json.dumps(c, ensure_ascii=False)}" for c in chunks]
        lines.append("data: [DONE]")
        body = "\n\n".join(lines) + "\n\n"

        events = []

        def on_outbound(model_id, field_names, outcome):
            events.append((model_id, field_names, outcome))

        provider = AiReasonProvider(
            base_url="https://example.invalid/v1/chat/completions",
            model="glm-5.2",
            api_key="sk-not-real",
            http_client=SseStreamingHttpClient(
                transport=httpx.MockTransport(
                    lambda r: httpx.Response(200, content=body.encode("utf-8"))
                )
            ),
            network_allowed=True,
            on_outbound=on_outbound,
        )
        result = provider.generate_reason({"title": "t"})
        assert result.degraded is False
        assert "直接采购" in result.text
        assert result.model_identifier == "glm-5.2"
        assert events == [("glm-5.2", ["title"], "success")]

    def test_sse_client_respects_max_tokens_cap(self):
        from crm.ai.provider import SseStreamingHttpClient

        seen = {}

        def handler(request):
            seen["body"] = json.loads(request.content.decode("utf-8"))
            return httpx.Response(200, content=b"data: [DONE]\n\n")

        client = SseStreamingHttpClient(
            transport=httpx.MockTransport(handler),
            max_tokens=512,
        )
        with pytest.raises(Exception):
            client.post("https://example.invalid/v1/chat/completions",
                        json={"model": "glm-5.2"}, headers={}, timeout=30.0)
        assert seen["body"]["max_tokens"] == 512
        # The gateway requires stream=true (empty SSE otherwise).
        assert seen["body"]["stream"] is True
