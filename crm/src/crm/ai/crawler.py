"""SPEC-0003 v0.4.0 (TASK-0040): public procurement announcement crawler.

DEC-0158 point 2: the crawler only touches PUBLIC tender/procurement
announcement sources. No authenticated, private, customer, or contact-data
sources. Results are normalized into announcement objects and retained 30 days
(DEC-0152 / SPEC-0003 OD-001). Failure, timeout, or parse errors degrade to an
empty result plus a local deterministic reason (R-015/AC-007) — the crawler
never fabricates a source (R-017).

Source scope (product-owner direction, 2026-08-21): government public sites
only — national AND provincial/prefecture public-resource trading platforms
(``.gov.cn``); commercial (paid) aggregators are excluded. Provincial URLs in
``DEFAULT_PUBLIC_SOURCES`` are [PROPOSAL] candidates verified by the real-fetch
leg; unreachable/anti-crawl pages degrade per source.

Any real fetch requires an explicit ``network_allowed=True`` and product-owner
confirmation at execution time; local verification always injects a fake
fetcher.
"""

from __future__ import annotations

import os
import re
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from typing import Final
from urllib.parse import urljoin, urlsplit

CRAWLER_RETENTION_DAYS: Final[int] = 30
ENV_CRAWLER_ENABLED: Final[str] = "CRM_CRAWLER_ENABLED"

#: Public, unauthenticated government procurement-announcement sources
#: (see module doc). DEC-0158 point 2 + product-owner direction (2026-08-22):
#: government public sites only — national AND provincial/prefecture — never
#: commercial (paid) aggregators. Domains are government-owned ``.gov.cn``.
#:
#: VERIFIED 2026-08-23 (real-fetch leg #2, product-owner approved): every URL
#: below was discovered from OFFICIAL government navigation pages
#: (ggzy.gov.cn + reachable provincial platforms) — never guessed — and each
#: was fetched once with the real httpx fetcher, producing parsed
#: announcements. 287 prefecture-level candidates were probed; only reachable
#: trading/procurement platforms with parsed announcements are kept here.
#: Unreachable/anti-crawl/parse-failed candidates and non-trading government
#: department sites are recorded in
#: ``docs/evidence/TASK-0040-REAL-LLM-CALL-20260822.md`` and are NOT in this
#: default list (R-017: never keep a fabricated/unreachable source).
DEFAULT_PUBLIC_SOURCES: Final[tuple[dict[str, str], ...]] = (
    # national
    {"name": "全国公共资源交易平台", "url": "https://www.ggzy.gov.cn"},
    {"name": "中国政府采购网", "url": "https://www.ccgp.gov.cn"},
    # provincial (verified reachable 2026-08-23)
    {"name": "天津市公共资源交易平台", "url": "https://ggzy.zwfwb.tj.gov.cn"},
    {"name": "河北省公共资源交易平台", "url": "https://szj.hebei.gov.cn"},
    {"name": "山西省公共资源交易平台", "url": "https://prec.sxzwfw.gov.cn"},
    {"name": "内蒙古自治区公共资源交易网", "url": "https://ggzyjy.nmg.gov.cn"},
    {"name": "黑龙江省公共资源交易平台", "url": "https://ggzyjyw.hlj.gov.cn"},
    {"name": "浙江省公共资源交易平台", "url": "https://ggzy.zj.gov.cn"},
    {"name": "山东省公共资源交易平台", "url": "https://ggzyjy.shandong.gov.cn"},
    {"name": "四川省公共资源交易平台", "url": "https://ggzyjy.sc.gov.cn"},
    {"name": "贵州省公共资源交易平台", "url": "https://ggzy.guizhou.gov.cn"},
    {"name": "青海省公共资源交易平台", "url": "https://www.qhggzyjy.gov.cn"},
    {"name": "宁夏回族自治区公共资源交易平台", "url": "https://ggzyjy.fzggw.nx.gov.cn"},
    {"name": "新疆维吾尔自治区公共资源交易平台", "url": "https://ggzy.xinjiang.gov.cn"},
    {"name": "新疆生产建设兵团公共资源交易平台", "url": "https://ggzy.xjbt.gov.cn"},
    # prefecture / sub-national procurement platforms (verified 2026-08-23)
    {"name": "合肥市公共资源交易平台", "url": "https://ggzy.hefei.gov.cn"},
    {"name": "太原市公共资源交易平台", "url": "https://gcjs.ggzy.xzspglj.taiyuan.gov.cn"},
    {"name": "运城市公共资源交易平台", "url": "https://ggzyjyzx.yuncheng.gov.cn"},
    {"name": "大同市公共资源交易平台", "url": "https://ggzyjy.dt.gov.cn"},
    {"name": "晋中市公共资源交易平台", "url": "https://ggzy.sxjz.gov.cn"},
    {"name": "长治市公共资源交易平台", "url": "https://ggzy.changzhi.gov.cn"},
    {"name": "晋城市公共资源交易平台", "url": "https://ggzy.jcgov.gov.cn"},
    {"name": "贵阳市公共资源交易平台", "url": "https://ggzy.guiyang.gov.cn"},
    {"name": "遵义市公共资源交易平台", "url": "https://ggzyjy.zunyi.gov.cn"},
    {"name": "毕节市公共资源交易平台", "url": "https://ggzy.bijie.gov.cn"},
    {"name": "安顺市公共资源交易平台", "url": "https://ggzy.anshun.gov.cn"},
    {"name": "六盘水市公共资源交易平台", "url": "https://ggzy.gzlps.gov.cn"},
    {"name": "绵阳市公共资源交易平台", "url": "https://ggzy.my.gov.cn"},
    {"name": "阿勒泰地区公共资源交易平台", "url": "https://xjaltggzy.gov.cn"},
    {"name": "和田地区公共资源交易平台", "url": "https://ggzy.ht.gov.cn"},
    {"name": "伊犁州公共资源交易平台", "url": "https://ggzy.xjyl.gov.cn"},
    {"name": "天津市政府采购网", "url": "https://www.ccgp-tianjin.gov.cn"},
    {"name": "湖北政府采购网", "url": "https://www.ccgp-hubei.gov.cn"},
    {"name": "陕西政府采购网", "url": "https://www.ccgp-shaanxi.gov.cn"},
    {"name": "宁波政府采购网", "url": "https://www.ccgp-ningbo.gov.cn"},
    {"name": "宁夏政府采购网", "url": "https://www.ccgp-ningxia.gov.cn"},
    {"name": "山东省公共资源交易网（地市入口）", "url": "https://ggzyjyzx.shandong.gov.cn"},
    {"name": "兵团交易管理平台", "url": "https://jygl.xjbt.gov.cn"},
)

#: Real-fetch default user agent (public sites may reject empty/bot UAs).
DEFAULT_USER_AGENT: Final[str] = (
    "Mozilla/5.0 (compatible; CRM-opportunity-crawler/1.0; "
    "+https://crm.aibrain.wiki)"
)

#: Announcement-title keywords used to keep only real list items and to
#: infer the announcement type. Missing keywords degrade, never fabricate.
_ANNOUNCEMENT_KEYWORDS: Final[tuple[str, ...]] = (
    "公告", "招标", "采购", "中标", "成交", "磋商", "询价",
    "资格预审", "竞争性",
)
_NAVIGATION_EXCLUSIONS: Final[tuple[str, ...]] = (
    "首页", "更多", "登录", "注册", "联系我们", "网站首页",
    "政策法规", "加入收藏", "设为首页", "返回",
)
_HTML_DATE_RE: Final[re.Pattern[str]] = re.compile(
    r"(20\d{2})\s*[-/年.]\s*(\d{1,2})\s*[-/月.]\s*(\d{1,2})\s*日?"
)


@dataclass(frozen=True)
class NormalizedAnnouncement:
    """One normalized public announcement (whitelist-shaped fields only)."""

    title: str
    source_url: str
    published_at: datetime | None
    announcement_type: str
    source_name: str
    fetched_at: datetime
    retained_until: datetime
    abstract: str = ""
    #: Extra whitelisted audit metadata (names only; never protected values).
    audit_metadata: dict[str, str] = field(default_factory=dict)

    def to_subject_dict(self) -> dict:
        """Compatibility projection for the existing OpportunityService
        injection point (``list_external_subjects``)."""
        return {
            "name": self.title,
            "category": "direct_purchase",
            "region": None,
            "source_reference": self.source_url,
        }


@dataclass(frozen=True)
class CrawlResult:
    """Outcome of one crawler run: announcements plus degradation state."""

    announcements: list[NormalizedAnnouncement] = field(default_factory=list)
    degraded: bool = False
    degraded_reason: str = ""


#: Fetcher contract: ``fetcher(source_url: str, timeout: float) -> str``
#: returning raw response text (or raising for failure/timeout). Tests inject
#: a fake; production uses httpx behind the fail-closed network gate.
Fetcher = Callable[[str, float], str]


class PublicProcurementCrawler:
    """Public-source crawler adapter (fail-closed, no authenticated sources)."""

    def __init__(
        self,
        *,
        sources: Sequence[dict[str, str]] = DEFAULT_PUBLIC_SOURCES,
        fetcher: Fetcher | None = None,
        network_allowed: bool = False,
        retention_days: int = CRAWLER_RETENTION_DAYS,
        timeout_seconds: float = 10.0,
        audit_repository=None,
        max_workers: int = 10,
    ) -> None:
        self._sources = list(sources)
        self._fetcher = fetcher
        self._network_allowed = network_allowed
        self._retention_days = retention_days
        self._timeout_seconds = timeout_seconds
        #: Optional audit repository (R-016 single auditable egress path).
        #: When set, every per-source fetch writes an
        #: ``opportunity.crawler.fetch`` audit record (source provenance and
        #: degradation state only — never payload values).
        self._audit_repository = audit_repository
        #: Maximum concurrent workers for parallel source fetching.
        #: Sources are fetched concurrently to reduce total crawl time
        #: from N × timeout_seconds to ~timeout_seconds + overhead.
        self._max_workers = max(1, max_workers)

    @property
    def is_enabled(self) -> bool:
        """True only when a fetcher is available AND the network gate is open."""
        return self._network_allowed and self._fetcher is not None

    @property
    def source_names(self) -> list[str]:
        return [s.get("name", "") for s in self._sources if s.get("name")]

    def fetch_announcements(self) -> CrawlResult:
        """Fetch and normalize announcements from the configured public
        sources. Any per-source failure/timeout/parse error degrades that
        source silently; a fully failed run returns an empty result with a
        deterministic reason. Never fabricates sources (R-017).

        Sources are fetched concurrently (``ThreadPoolExecutor``,
        ``max_workers``) to reduce total crawl time from
        N × timeout_seconds to ~timeout_seconds + overhead.
        Audit records are written sequentially after all fetches complete
        to preserve the single auditable egress path (R-016) without
        requiring a thread-safe audit repository."""
        if not self._sources:
            return CrawlResult(degraded=True, degraded_reason="no crawler sources configured")
        if not self._network_allowed:
            return CrawlResult(degraded=True, degraded_reason="crawler egress not allowed (fail-closed default)")
        if self._fetcher is None:
            return CrawlResult(degraded=True, degraded_reason="crawler fetcher unavailable")

        from concurrent.futures import ThreadPoolExecutor, as_completed
        import threading

        announcements: list[NormalizedAnnouncement] = []
        failures: list[str] = []
        # Collect (name, degraded, reason, source_anns_or_None) for
        # sequential audit writes after all fetches complete.
        pending_audits: list[tuple[str, bool, str, list[NormalizedAnnouncement] | None]] = []
        lock = threading.Lock()

        def _fetch_one(source: dict[str, str]) -> None:
            """Fetch and normalize ONE source. Runs in a worker thread."""
            url = source.get("url")
            name = source.get("name", url)
            if not url:
                with lock:
                    failures.append(f"{name}: missing url")
                    pending_audits.append((name, True, "missing url", None))
                return
            if not is_government_public_url(url):
                with lock:
                    failures.append(f"{name}: disallowed source url")
                    pending_audits.append((name, True, "disallowed source url", None))
                return
            try:
                raw = self._fetcher(url, self._timeout_seconds)
            except TimeoutError:
                with lock:
                    failures.append(f"{name}: timeout")
                    pending_audits.append((name, True, "timeout", None))
                return
            except Exception as exc:
                with lock:
                    failures.append(f"{name}: {type(exc).__name__}")
                    pending_audits.append((name, True, type(exc).__name__, None))
                return
            parsed_items = parse_announcement_list_payload(raw, source_url=url)
            if parsed_items is None:
                with lock:
                    failures.append(f"{name}: parse failure")
                    pending_audits.append((name, True, "parse failure", None))
                return
            fetched_at = datetime.now(timezone.utc)
            source_anns: list[NormalizedAnnouncement] = []
            for parsed in parsed_items:
                if not isinstance(parsed, dict) or not parsed.get("title"):
                    continue
                source_anns.append(
                    NormalizedAnnouncement(
                        title=parsed["title"],
                        source_url=parsed.get("source_url") or url,
                        published_at=parsed.get("published_at"),
                        announcement_type=parsed.get("announcement_type") or "采购公告",
                        source_name=name,
                        fetched_at=fetched_at,
                        retained_until=fetched_at + timedelta(days=self._retention_days),
                        abstract=parsed.get("abstract") or "",
                        audit_metadata={"source_name": name},
                    )
                )
            with lock:
                pending_audits.append((name, False, "", source_anns))

        with ThreadPoolExecutor(max_workers=self._max_workers) as executor:
            futures = [executor.submit(_fetch_one, s) for s in self._sources]
            for future in as_completed(futures):
                future.result()  # propagate any unexpected exception

        # Write audit records sequentially (R-016 single auditable path;
        # the audit repository may use non-thread-safe SQLAlchemy sessions).
        for name, degraded, reason, source_anns in pending_audits:
            if not degraded:
                # P2 (TASK-0040 fix): a failed audit degrades THIS source and
                # its announcements are NOT kept (an un-audited success must
                # not be persisted — R-016 single auditable path).
                if not self._audit_fetch(name, degraded=False, reason=""):
                    failures.append(f"{name}: audit failure")
                    continue
            else:
                self._audit_fetch(name, degraded=True, reason=reason)
            if source_anns:
                announcements.extend(source_anns)

        degraded = bool(failures)
        reason = ""
        if failures:
            reason = "; ".join(failures[:3]) + ("…" if len(failures) > 3 else "")
        return CrawlResult(announcements=announcements, degraded=degraded, degraded_reason=reason)

    def _audit_fetch(self, source_name: str, *, degraded: bool, reason: str) -> bool:
        """R-016 single auditable egress path: every per-source fetch is
        recorded (source provenance + degradation state only).

        P2 (TASK-0040 fix): returns True when the audit record was persisted;
        returns False when the audit repository raised — the CALLER then
        degrades this source (and drops its announcements) instead of
        aborting the whole discovery run. An audit failure never fabricates a
        successful fetch.
        """
        if self._audit_repository is None:
            return True
        from crm.ai.audit import record_crawler_fetch

        try:
            record_crawler_fetch(
                self._audit_repository,
                source_name=source_name,
                degraded=degraded,
                degraded_reason=reason,
                outcome="failure" if degraded else "success",
            )
            return True
        except Exception:
            return False

    # ----- compatibility with the existing OpportunityService injection -----

    def list_external_subjects(self) -> list[NormalizedAnnouncement]:
        """Return normalized announcements for the OpportunityService.

        The service accepts either ``NormalizedAnnouncement`` objects (new
        adapter) or plain subject dicts (legacy synthetic fakes). Default
        (network gate closed) returns no subjects, preserving the
        synthetic-stub behavior.
        """
        result = self.fetch_announcements()
        return list(result.announcements)


def parse_announcement_payload(raw: str) -> dict | None:
    """Normalize raw source text into announcement fields.

    Accepts JSON (``{"title": ..., "body"/"abstract": ..., "published_at":
    ..., "announcement_type": ...}``) or a simple text block where the first
    non-empty line is the title. Returns None on malformed input (caller
    degrades). Never invents fields that were not present.
    """
    if not raw or not raw.strip():
        return None
    stripped = raw.strip()
    if stripped.startswith("{"):
        import json as _json

        try:
            data = _json.loads(stripped)
        except ValueError:
            return None
        if not isinstance(data, dict):
            return None
        title = data.get("title")
        if not isinstance(title, str) or not title.strip():
            return None
        published_at = data.get("published_at")
        parsed_at = None
        if isinstance(published_at, str) and published_at.strip():
            try:
                parsed_at = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
            except ValueError:
                parsed_at = None
        abstract = data.get("abstract") or data.get("body") or ""
        return {
            "title": title.strip(),
            "abstract": str(abstract).strip() if isinstance(abstract, str) else "",
            "published_at": parsed_at,
            "announcement_type": str(data.get("announcement_type") or "采购公告").strip(),
        }
    # Plain-text fallback: first non-empty line is the title.
    lines = [ln.strip() for ln in stripped.splitlines() if ln.strip()]
    return {
        "title": lines[0],
        "abstract": "",
        "published_at": None,
        "announcement_type": "采购公告",
    }


def crawler_enabled_by_env() -> bool:
    """Env gate for the crawler; False unless explicitly enabled."""
    return os.environ.get(ENV_CRAWLER_ENABLED, "").strip().lower() in {"1", "true", "yes"}


# ============ HTML list-page parsing (real public sites) ============

#: Announcement-type inference keywords (title -> normalized type). The
#: default is the SPEC-0003 "直接采购" classification.
_TYPE_HINTS: Final[tuple[tuple[str, str], ...]] = (
    ("资格预审", "资格预审公告"),
    ("竞争性磋商", "竞争性磋商公告"),
    ("中标", "中标公告"),
    ("成交", "成交公告"),
    ("询价", "询价公告"),
    ("招标", "招标公告"),
    ("采购", "采购公告"),
)


class _AnnouncementLinkParser(HTMLParser):
    """Extract ``<a href>`` announcement links plus the text immediately
    BEFORE and AFTER each link (list pages place the date right before or
    right after the anchor). Uses only the stdlib (no new dependency)."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        #: (href, title, before_text, after_text)
        self.links: list[tuple[str, str, str, str]] = []
        self._current_href: str | None = None
        self._current_text: list[str] = []
        #: Rolling text window since the previous anchor closed (becomes the
        #: next link's ``before_text`` when its ``<a>`` opens).
        self._pending_before: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag == "a":
            href = dict(attrs).get("href")
            if href:
                # Freeze the pending text as this link's before-context and
                # reset it for the link's own after-context.
                self._current_href = href
                self._current_text = []

    def handle_data(self, data: str) -> None:
        if self._current_href is not None:
            self._current_text.append(data)
        else:
            # No anchor open: this text belongs after the previous anchor
            # AND before the next one (bounded rolling window).
            self._pending_before.append(data)
            if len(self._pending_before) > 40:
                self._pending_before = self._pending_before[-40:]
            if self.links:
                prev = self.links[-1]
                after = (prev[3] + data)[-120:]
                self.links[-1] = (prev[0], prev[1], prev[2], after)

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self._current_href is not None:
            title = "".join(self._current_text).strip()
            if title:
                before = "".join(self._pending_before)
                self.links.append((self._current_href, title, before, ""))
                self._pending_before = []
            self._current_href = None
            self._current_text = []


def _is_announcement_link(title: str, href: str) -> bool:
    """Keep only plausible announcement links; drop navigation/decoration."""
    if not title or len(title) < 6:
        return False
    if any(nav in title for nav in _NAVIGATION_EXCLUSIONS):
        return False
    if href.startswith(("#", "javascript:", "mailto:", "tel:")):
        return False
    return any(kw in title for kw in _ANNOUNCEMENT_KEYWORDS)


def is_government_public_url(url: object) -> bool:
    """P2 (TASK-0040 fix): uniform detail-URL gate for both the HTML and the
    JSON parse paths.

    True only for http(s) URLs whose host is exactly ``gov.cn`` or ends with
    ``.gov.cn`` (government public domains). Everything else — non-http
    schemes (``javascript:``/``mailto:``/``tel:``/``file:``), protocol-
    relative non-government hosts, and non-government absolute hosts — is
    rejected so a crafted detail URL can never reach
    ``external_subject.source_reference``, candidate persistence, or the
    model whitelist payload. Relative paths stay legal: they resolve against
    the (already-verified) list-page URL and inherit its government host.
    """
    if not isinstance(url, str):
        return False
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https"):
        return False
    host = (parts.hostname or "").lower()
    return host == "gov.cn" or host.endswith(".gov.cn")


def _extract_date(text: str) -> datetime | None:
    """Extract the first plausible date (e.g. 2026-08-01, 2026/08/01,
    2026年08月01日). Returns None when absent — never invents a date."""
    if not text:
        return None
    match = _HTML_DATE_RE.search(text)
    if not match:
        return None
    year, month, day = (int(g) for g in match.groups())
    try:
        return datetime(year, month, day)
    except ValueError:
        return None


def _extract_date_near_anchor(after_text: str, before_text: str) -> datetime | None:
    """Attribute the date to THIS link only when it sits closest to the
    anchor (R-017 association accuracy).

    ``after_text`` is the text between this anchor's end and the NEXT
    anchor's start; ``before_text`` is the text between the PREVIOUS anchor's
    end and this anchor's start. A date inside either window may belong to
    this link (date-after-title layout) or to the neighbor (date-before-title
    layout); the anchor it is physically closer to wins. Distances: for
    ``after_text`` the offset from this anchor's end (match start); for
    ``before_text`` the offset from this anchor's start (chars after the
    match end).
    """
    best_match = None
    best_dist: float = float("inf")

    after_match = _HTML_DATE_RE.search(after_text or "")
    if after_match is not None:
        best_match, best_dist = after_match, float(after_match.start())

    last = None
    for match in _HTML_DATE_RE.finditer(before_text or ""):
        last = match
    if last is not None:
        dist = float(len(before_text) - last.end())
        if dist < best_dist:
            best_match, best_dist = last, dist

    if best_match is None:
        return None
    year, month, day = (int(g) for g in best_match.groups())
    try:
        return datetime(year, month, day)
    except ValueError:
        return None


def _infer_announcement_type(title: str) -> str:
    for keyword, kind in _TYPE_HINTS:
        if keyword in title:
            return kind
    return "采购公告"


def _parse_html_list_page(raw: str, source_url: str | None) -> list[dict] | None:
    """Parse an HTML list page into announcement dicts.

    Each item: ``title / abstract / published_at / announcement_type /
    source_url`` (absolute URL via urljoin). Returns None when nothing
    plausible is found (caller degrades, R-017: never fabricates sources).
    """
    parser = _AnnouncementLinkParser()
    try:
        parser.feed(raw)
        parser.close()
    except Exception:
        return None

    out: list[dict] = []
    seen: set[str] = set()
    for href, title, before_text, after_text in parser.links:
        if not _is_announcement_link(title, href):
            continue
        absolute = urljoin(source_url or "", href)
        # P2 (TASK-0040 fix): only government public detail URLs are kept;
        # a rejected link is DROPPED (never falls through to a non-government
        # host, and never enters source_reference / persistence / payload).
        if not is_government_public_url(absolute) or absolute in seen:
            continue
        seen.add(absolute)
        out.append({
            "title": title,
            "abstract": "",
            "published_at": _extract_date_near_anchor(after_text, before_text),
            "announcement_type": _infer_announcement_type(title),
            "source_url": absolute,
        })
    return out or None


def parse_announcement_list_payload(
    raw: str,
    source_url: str | None = None,
) -> list[dict] | None:
    """Normalize raw source text into a LIST of announcement dicts.

    Accepts:
      - JSON object (single announcement) or JSON array (list page API);
      - an HTML list page (real public sites: extract ``<a>`` titles, dates,
        types, absolute URLs);
      - plain text (first non-empty line is the title, legacy behavior).

    Returns None when nothing can be parsed (caller degrades). Never invents
    fields, dates, or sources (R-017).
    """
    if not raw or not raw.strip():
        return None
    stripped = raw.strip()

    # JSON object / array
    if stripped.startswith(("{", "[")):
        import json as _json

        try:
            data = _json.loads(stripped)
        except ValueError:
            return None
        items = data if isinstance(data, list) else [data]
        out: list[dict] = []
        for item in items:
            if not isinstance(item, dict) or not isinstance(item.get("title"), str):
                continue
            single = parse_announcement_payload(_json.dumps(item, ensure_ascii=False))
            if single is not None:
                # P2 (TASK-0040 fix): uniform government-public URL gate —
                # a non-government source_url is DROPPED and the caller falls
                # back to the already-verified list-page URL, so it never
                # enters source_reference / persistence / whitelist payload.
                raw_src = item.get("source_url")
                single["source_url"] = (
                    str(raw_src)
                    if isinstance(raw_src, str) and is_government_public_url(raw_src)
                    else (source_url if is_government_public_url(source_url) else None)
                )
                out.append(single)
        return out or None

    # HTML list page (real public sites). Anything that starts with "<"
    # (or contains typical HTML markers) is attempted as HTML; a page with
    # no plausible announcement link degrades to None (R-017).
    lowered = stripped.lower()
    if (
        stripped.startswith("<")
        or "<html" in lowered
        or "<a " in lowered
        or "<!doctype" in lowered
        or "<head" in lowered
    ):
        return _parse_html_list_page(stripped, source_url)

    # Plain-text fallback: first non-empty line is the title.
    lines = [ln.strip() for ln in stripped.splitlines() if ln.strip()]
    if not lines:
        return None
    return [{
        "title": lines[0],
        "abstract": "",
        "published_at": None,
        "announcement_type": "采购公告",
        # P2 (TASK-0040 fix): uniform gate — the list-page URL is kept only
        # when it is a verified government public URL.
        "source_url": source_url if is_government_public_url(source_url) else None,
    }]


# ============ real HTTP fetcher (httpx; used only when network allowed) ============


def make_httpx_fetcher(
    *,
    user_agent: str = DEFAULT_USER_AGENT,
    allowed_host_suffixes: tuple[str, ...] = (".gov.cn",),
    max_redirects: int = 3,
    max_body_bytes: int = 2_000_000,
    transport=None,
) -> Fetcher:
    """Build a real fetcher backed by httpx.

    Only used when the crawler is constructed with ``network_allowed=True``
    after product-owner confirmation (DEC-0158 point 5). SSRF hardening:
    every hop (initial URL and each redirect) must be http(s) with a host
    ending in an allowed suffix (government domains only, default
    ``.gov.cn``); redirects are followed manually so each hop is validated;
    response bodies are capped at ``max_body_bytes``. Timeouts, HTTP errors,
    and oversized bodies raise so the crawler degrades that source.
    Government sites are often GBK/GB2312 encoded, so the body is decoded
    via the declared charset first and falls back to utf-8 then gb18030 (a
    superset of GBK/GB2312). ``transport`` is an httpx transport override
    for tests (e.g. ``httpx.MockTransport``).
    """

    def _decode_body(content: bytes, declared: str | None) -> str:
        for encoding in (declared, "utf-8", "gb18030"):
            if not encoding:
                continue
            try:
                return content.decode(encoding)
            except (LookupError, UnicodeDecodeError):
                continue
        return content.decode("utf-8", errors="replace")

    def _validate_hop(current: str) -> str:
        """Return the validated http(s) URL or raise ConnectionError."""
        parts = urlsplit(current)
        if parts.scheme not in ("http", "https"):
            raise ConnectionError(f"disallowed fetch scheme for {parts.scheme or '?'}")
        host = (parts.hostname or "").lower()
        if not host or not any(host == s.lstrip(".") or host.endswith(s) for s in allowed_host_suffixes):
            raise ConnectionError(f"disallowed fetch host {host or '?'}")
        return current

    def _fetch(url: str, timeout: float) -> str:
        import httpx

        current = _validate_hop(url)
        try:
            with httpx.Client(
                timeout=timeout,
                follow_redirects=False,  # manual hop-by-hop validation
                headers={"User-Agent": user_agent},
                transport=transport,
            ) as client:
                for _ in range(max_redirects + 1):
                    # P2 (TASK-0040 fix): stream the body incrementally and
                    # cap the TOTAL at max_body_bytes while reading — the
                    # response is never fully materialized when oversized, so
                    # a huge page cannot exhaust memory before the check.
                    with client.stream("GET", current) as response:
                        if response.status_code in (301, 302, 303, 307, 308):
                            location = response.headers.get("location")
                            if not location:
                                break
                            current = _validate_hop(str(httpx.URL(current).join(location)))
                            continue
                        if response.status_code >= 400:
                            raise ConnectionError(
                                f"fetch returned status {response.status_code} for {current}"
                            )
                        chunks: list[bytes] = []
                        total = 0
                        for chunk in response.iter_bytes():
                            total += len(chunk)
                            if total > max_body_bytes:
                                raise ConnectionError(
                                    f"fetch response too large (>{max_body_bytes} bytes) for {current}"
                                )
                            chunks.append(chunk)
                        return _decode_body(b"".join(chunks), response.encoding)
                raise ConnectionError(f"too many redirects for {url}")
        except httpx.TimeoutException as exc:
            raise TimeoutError(f"fetch timeout for {url}") from exc
        except httpx.HTTPError as exc:
            raise ConnectionError(f"fetch failed for {url}: {type(exc).__name__}") from exc

    return _fetch
