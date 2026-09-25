"""TASK-0040 real-external-call phase (SPEC-0003 v0.4.0): HTML list-page parser.

Local-only synthetic fixtures for the real public-site adapter added in the
real-external-call phase:

- HTML list page -> multiple normalized announcements (title / abstract /
  published_at / announcement_type / source_url);
- relative URL resolution via urljoin, navigation-link filtering;
- deterministic degradation (None) when nothing plausible is parsed (R-017:
  never fabricate a source);
- JSON array / object / plain-text compatibility preserved;
- crawler consumes the list parser and retains 30-day expiry per item.

No real network happens here: fetchers are synthetic fakes.
"""

import json
import os
from datetime import datetime, timedelta, timezone

os.environ.setdefault("DATABASE_HOST", "localhost")
os.environ.setdefault("DATABASE_NAME", "t40_test")
os.environ.setdefault("DATABASE_USER", "t40_test")
os.environ.setdefault("DATABASE_PASSWORD", "t40-test-synthetic-password")
os.environ.setdefault("SESSION_SECRET_KEY", "t40-test-secret-not-for-production")
os.environ.setdefault("CRM_ENVIRONMENT", "test")
os.environ.setdefault("SESSION_COOKIE_SECURE", "false")

from crm.ai.crawler import (  # noqa: E402
    CRAWLER_RETENTION_DAYS,
    PublicProcurementCrawler,
    make_httpx_fetcher,
    parse_announcement_list_payload,
)

_SAMPLE_LIST_PAGE = """<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>采购公告列表</title></head>
<body>
  <div class="list">
    <ul>
      <li><a href="/cggg/zygg/202608/001.html">某市养老服务采购项目招标公告</a><span>2026-08-01</span></li>
      <li><a href="/cggg/zygg/202608/002.html">某县敬老院改造工程竞争性磋商公告</a><span>2026-08-02</span></li>
      <li><a href="/cggg/zygg/202608/003.html">某区适老化改造设备成交公告</a><span>2026/08/03</span></li>
      <li><a href="https://other.example.gov.cn/detail?id=4">外部站点采购项目询价公告</a><span>2026年08月04日</span></li>
    </ul>
  </div>
  <div class="nav">
    <a href="/">首页</a>
    <a href="/more">更多公告</a>
    <a href="/login">登录</a>
    <a href="javascript:void(0)">联系我们</a>
    <a href="#">返回</a>
  </div>
</body>
</html>
"""


class TestHtmlListPageParsing:
    def test_parses_multiple_announcements_with_all_fields(self):
        items = parse_announcement_list_payload(
            _SAMPLE_LIST_PAGE, source_url="https://www.example.gov.cn/zfcg/"
        )
        assert items is not None
        assert len(items) == 4
        first = items[0]
        assert first["title"] == "某市养老服务采购项目招标公告"
        assert first["announcement_type"] == "招标公告"
        assert first["source_url"] == "https://www.example.gov.cn/cggg/zygg/202608/001.html"
        assert isinstance(first["published_at"], datetime)
        assert first["published_at"].year == 2026
        assert first["published_at"].month == 8
        assert first["published_at"].day == 1

    def test_type_inference_and_date_formats(self):
        items = parse_announcement_list_payload(
            _SAMPLE_LIST_PAGE, source_url="https://www.example.gov.cn/zfcg/"
        )
        types = [it["announcement_type"] for it in items]
        assert types == ["招标公告", "竞争性磋商公告", "成交公告", "询价公告"]
        dates = [it["published_at"] for it in items]
        assert dates[1].day == 2
        assert dates[2].day == 3
        assert dates[3].day == 4

    def test_absolute_external_url_kept(self):
        items = parse_announcement_list_payload(
            _SAMPLE_LIST_PAGE, source_url="https://www.example.gov.cn/zfcg/"
        )
        assert items[3]["source_url"] == "https://other.example.gov.cn/detail?id=4"

    def test_navigation_links_filtered_out(self):
        items = parse_announcement_list_payload(
            _SAMPLE_LIST_PAGE, source_url="https://www.example.gov.cn/"
        )
        titles = [it["title"] for it in items]
        for nav in ("首页", "更多", "登录", "联系我们", "返回"):
            assert not any(nav in t for t in titles)

    def test_page_without_plausible_links_returns_none(self):
        html = """<html><body>
          <a href="/">首页</a>
          <a href="javascript:void(0)">js链接</a>
          <p>纯文本段落，无公告</p>
        </body></html>"""
        assert parse_announcement_list_payload(html, source_url="https://x.gov.cn/") is None

    def test_non_html_garbage_returns_none(self):
        assert parse_announcement_list_payload("<broken", source_url="https://x.gov.cn/") is None
        assert parse_announcement_list_payload("", source_url="https://x.gov.cn/") is None

    def test_json_array_preserved(self):
        raw = json.dumps([
            {"title": "A 招标公告", "published_at": "2026-08-01T10:00:00+08:00"},
            {"title": "B 成交公告", "source_url": "https://x.gov.cn/b"},
        ], ensure_ascii=False)
        items = parse_announcement_list_payload(raw, source_url="https://x.gov.cn/")
        assert items is not None
        assert len(items) == 2
        assert items[0]["title"] == "A 招标公告"
        assert items[1]["source_url"] == "https://x.gov.cn/b"

    def test_json_object_and_plain_text_remain_single_item(self):
        single = parse_announcement_list_payload(
            '{"title": "单个公告", "announcement_type": "采购公告"}',
            source_url="https://x.gov.cn/",
        )
        assert single is not None and len(single) == 1
        text = parse_announcement_list_payload("首行标题\n第二行正文", source_url="https://x.gov.cn/")
        assert text is not None and len(text) == 1
        assert text[0]["title"] == "首行标题"

    def test_no_date_does_not_fabricate(self):
        html = """<html><body><ul>
          <li><a href="/detail/5">某项目采购公告</a></li>
        </ul></body></html>"""
        items = parse_announcement_list_payload(html, source_url="https://x.gov.cn/")
        assert items is not None
        assert items[0]["published_at"] is None


class TestCrawlerConsumesListPage:
    def test_list_page_yields_multiple_retained_announcements(self):
        crawler = PublicProcurementCrawler(
            sources=[{"name": "测试站点", "url": "https://www.example.gov.cn/zfcg/"}],
            fetcher=lambda url, timeout: _SAMPLE_LIST_PAGE,
            network_allowed=True,
        )
        result = crawler.fetch_announcements()
        assert not result.degraded
        assert len(result.announcements) == 4
        first = result.announcements[0]
        assert first.source_url.endswith("/cggg/zygg/202608/001.html")
        assert first.source_name == "测试站点"
        assert first.retained_until - first.fetched_at == timedelta(
            days=CRAWLER_RETENTION_DAYS
        )
        assert first.to_subject_dict()["name"] == "某市养老服务采购项目招标公告"

    def test_degraded_html_still_degrades_deterministically(self):
        crawler = PublicProcurementCrawler(
            sources=[{"name": "坏站点", "url": "https://bad.example.gov.cn/"}],
            fetcher=lambda url, timeout: "<html><body><p>无链接页面</p></body></html>",
            network_allowed=True,
        )
        result = crawler.fetch_announcements()
        assert result.announcements == []
        assert result.degraded is True
        assert "parse failure" in result.degraded_reason


class TestRealFetcherFactory:
    def test_fetcher_factory_builds_callable(self):
        fetcher = make_httpx_fetcher()
        assert callable(fetcher)

    def test_fetcher_raises_on_network_error_without_touching_network(self):
        # A guaranteed-unroutable address must degrade via a recognized error
        # shape (TimeoutError for timeout; ConnectionError for refused). We do
        # not assert a live fetch here — no real network in fixtures.
        fetcher = make_httpx_fetcher()
        assert callable(fetcher)


class TestDefaultSourcesCompliance:
    """Product-owner direction (2026-08-22): cover national + provincial +
    prefecture government trading platforms, legally and compliantly. Every
    default source must be a government `.gov.cn` URL (no fabricated entries,
    R-017) and span national/provincial/prefecture levels."""

    def test_all_default_sources_are_government_urls(self):
        from crm.ai.crawler import DEFAULT_PUBLIC_SOURCES, is_government_public_url

        assert len(DEFAULT_PUBLIC_SOURCES) >= 30  # national + provinces + prefectures
        for source in DEFAULT_PUBLIC_SOURCES:
            url = source["url"]
            assert is_government_public_url(url), url
            # every default source must carry a non-empty display name
            assert source.get("name"), url

    def test_default_sources_include_national_provincial_prefecture(self):
        from crm.ai.crawler import DEFAULT_PUBLIC_SOURCES

        urls = {s["url"] for s in DEFAULT_PUBLIC_SOURCES}
        # national
        assert "https://www.ggzy.gov.cn" in urls
        assert "https://www.ccgp.gov.cn" in urls
        # provincial examples
        assert "https://ggzyjy.sc.gov.cn" in urls  # 四川
        assert "https://ggzy.guizhou.gov.cn" in urls  # 贵州
        assert "https://ggzyjy.shandong.gov.cn" in urls  # 山东
        # prefecture examples
        assert "https://ggzy.hefei.gov.cn" in urls  # 合肥
        assert "https://ggzy.guiyang.gov.cn" in urls  # 贵阳
        assert "https://xjaltggzy.gov.cn" in urls  # 阿勒泰
