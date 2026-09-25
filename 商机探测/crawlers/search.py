"""Bing 搜索爬虫 — 通过 cn.bing.com HTML 抓取搜索结果

注：百度对裸 httpx 返回空页（不可用）；Bing Web Search API 已于 2025-08 退役。
选 cn.bing.com HTML（httpx 可用，结果项 li.b_algo，href 为真实 URL，无重定向包裹）。

搜索结果类型混合，统一标 source_type="资讯"；真正有效的分类由 AI grade 完成。
"""

import logging
from urllib.parse import quote

import httpx
from lxml import html

import config
from crawlers.base import BaseCrawler, get_random_ua

logger = logging.getLogger(__name__)


class BingSearchCrawler(BaseCrawler):
    name = "bing_search"

    def __init__(self):
        super().__init__()

    async def crawl(self) -> list[dict]:
        all_items: list[dict] = []
        async with httpx.AsyncClient(
            timeout=30.0,
            follow_redirects=True,
            headers={
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "zh-CN,zh;q=0.9",
            },
        ) as client:
            for kw in config.SEARCH_KEYWORDS:
                self.logger.info(f"搜索关键词: {kw}")
                kw_items = await self._crawl_keyword(client, kw)
                all_items.extend(kw_items)
                self.delay()
        return all_items

    async def _crawl_keyword(self, client: httpx.AsyncClient, keyword: str) -> list[dict]:
        """对单个关键词抓取多页搜索结果"""
        items: list[dict] = []
        for page in range(1, config.SEARCH_MAX_PAGES + 1):
            # Bing 分页：first=1（第1-10条），first=11（第11-20条）...
            first = (page - 1) * 10 + 1
            url = (
                f"{config.BING_SEARCH_URL}?q={quote(keyword)}"
                f"&first={first}&count=10&setlang=zh-CN&mkt=zh-CN"
            )
            self.logger.debug(f"  第 {page} 页: {url}")
            try:
                resp = await client.get(url, headers={"User-Agent": get_random_ua()})
                if resp.status_code != 200:
                    self.logger.warning(f"  HTTP {resp.status_code}: {url}")
                    break
            except httpx.HTTPError as e:
                self.logger.warning(f"  请求失败: {e}")
                break

            page_items = self._parse_serp(resp.text)
            if not page_items:
                break
            items.extend(page_items)
            self.delay()

        # 对前 N 条抓取详情页补充正文
        detail_items: list[dict] = []
        for i, item in enumerate(items):
            if i >= config.SEARCH_DETAIL_LIMIT:
                # 超出限额的仅保留摘要
                detail_items.append(item)
                continue
            detail = await self._fetch_detail(client, item)
            detail_items.append(detail)
            self.delay()

        return detail_items

    def _parse_serp(self, page_html: str) -> list[dict]:
        """解析 Bing 搜索结果页，提取有机结果（排除广告）"""
        tree = html.fromstring(page_html)
        items: list[dict] = []

        # 有机结果：li.b_algo；广告：li.b_ad（排除）
        for li in tree.xpath('//li[contains(@class,"b_algo")]'):
            # 排除广告项（class 同时含 b_ad）
            cls = li.get("class", "")
            if "b_ad" in cls:
                continue

            # 标题 + 真实 URL
            link = li.xpath('.//h2/a[@href]')
            if not link:
                continue
            title = link[0].text_content().strip()
            url = link[0].get("href", "").strip()
            if not title or not url:
                continue

            # 摘要
            snippet = ""
            snip_els = li.xpath('.//div[contains(@class,"b_caption")]//p')
            if snip_els:
                snippet = snip_els[0].text_content().strip()

            items.append({
                "title": title,
                "source_type": "资讯",
                "source_site": "Bing搜索",
                "source_url": url,
                "content": snippet,
            })

        self.logger.debug(f"  解析到 {len(items)} 条搜索结果")
        return items

    async def _fetch_detail(self, client: httpx.AsyncClient, item: dict) -> dict:
        """抓取搜索结果详情页，补充正文（容错：失败则保留摘要）"""
        url = item.get("source_url", "")
        try:
            resp = await client.get(url, headers={"User-Agent": get_random_ua()}, timeout=20.0)
            if resp.status_code != 200:
                return item
        except httpx.HTTPError:
            return item

        try:
            tree = html.fromstring(resp.text)
        except Exception:
            return item

        # 取正文：优先 article，其次 body
        body_el = tree.xpath('//article') or tree.xpath('//body')
        if body_el:
            content = body_el[0].text_content().strip()
            # 清理多余空白
            content = " ".join(content.split())[:5000]
            if content:
                item["content"] = (item.get("content", "") + "\n" + content)[:5000]

        return item
