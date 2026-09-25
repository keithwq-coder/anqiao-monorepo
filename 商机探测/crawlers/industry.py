"""行业资讯爬虫 — 中国养老网（智慧养老专栏）+ 养老网（文章）

两个站点均为静态 HTML，选择器已验证。仅抓第1页（分页链接简单，保守先抓1页）。
TODO: 后续可扩展分页（中国养老网 /article_<N>；养老网同模式）。
"""

import re
from datetime import date, datetime
from urllib.parse import urljoin

import httpx
from lxml import html

import config
from crawlers.base import BaseCrawler, get_random_ua


class Cnsf99Crawler(BaseCrawler):
    """中国养老网·智慧养老专栏"""

    name = "cnsf99"
    BASE = "http://www.cnsf99.com"

    async def crawl(self) -> list[dict]:
        items: list[dict] = []
        async with httpx.AsyncClient(
            timeout=30.0,
            follow_redirects=True,
            headers={"Accept": "text/html,application/xhtml+xml"},
        ) as client:
            try:
                resp = await client.get(
                    config.CNSF99_SMART_ELDERCARE_URL,
                    headers={"User-Agent": get_random_ua()},
                )
                if resp.status_code != 200:
                    self.logger.warning(f"HTTP {resp.status_code}")
                    return []
            except httpx.HTTPError as e:
                self.logger.warning(f"请求失败: {e}")
                return []

            list_items = self._parse_list(resp.text)
            self.logger.info(f"列表页解析到 {len(list_items)} 条")

            for item in list_items:
                detail = await self._fetch_detail(client, item)
                if detail:
                    items.append(detail)
                self.delay()

        return items

    def _parse_list(self, page_html: str) -> list[dict]:
        """解析列表页：文章链接 href=/Detail/index.html?id=X&aid=Y

        每篇文章在 div.top_list_rtitle（标题）与 div.top_list_img（图片）中各出现一次，
        按 href 去重，只取有标题的。
        """
        tree = html.fromstring(page_html)
        items: list[dict] = []
        seen: set[str] = set()
        for a in tree.xpath('//a[contains(@href,"/Detail/index.html")]'):
            href = a.get("href", "").strip()
            if not href or href in seen:
                continue
            title = a.text_content().strip()
            if not title:  # 图片链接无标题，跳过
                continue
            seen.add(href)
            detail_url = urljoin(self.BASE, href)
            # 日期：标题所在 li/块内可能有 span，但本站日期在别处；留空交详情页
            items.append({
                "title": title,
                "source_type": "资讯",
                "source_site": "中国养老网",
                "source_url": detail_url,
                "content": "",
            })
        return items

    async def _fetch_detail(self, client: httpx.AsyncClient, item: dict) -> dict | None:
        """抓取详情页正文"""
        url = item.get("source_url", "")
        try:
            resp = await client.get(url, headers={"User-Agent": get_random_ua()})
            if resp.status_code != 200:
                return item
        except httpx.HTTPError:
            return item

        tree = html.fromstring(resp.text)
        # 正文容器（常见类名尝试）
        content_el = tree.xpath(
            '//div[@class="content"] | //div[@class="detail_content"] | //div[contains(@class,"article")]'
        )
        if content_el:
            item["content"] = content_el[0].text_content().strip()[:5000]
        else:
            body = tree.xpath('//body')
            if body:
                item["content"] = body[0].text_content().strip()[:5000]
        return item

    @staticmethod
    def _parse_date(text: str) -> date | None:
        if not text:
            return None
        m = re.search(r'\d{4}-\d{1,2}-\d{1,2}', text)
        if m:
            try:
                return datetime.strptime(m.group(), "%Y-%m-%d").date()
            except ValueError:
                pass
        return None


class YanglaoCrawler(BaseCrawler):
    """养老网·文章"""

    name = "yanglao"
    BASE = "http://www.yanglao.com"

    async def crawl(self) -> list[dict]:
        items: list[dict] = []
        async with httpx.AsyncClient(
            timeout=30.0,
            follow_redirects=True,
            headers={"Accept": "text/html,application/xhtml+xml"},
        ) as client:
            try:
                resp = await client.get(
                    config.YANGLAO_ARTICLE_URL,
                    headers={"User-Agent": get_random_ua()},
                )
                if resp.status_code != 200:
                    self.logger.warning(f"HTTP {resp.status_code}")
                    return []
            except httpx.HTTPError as e:
                self.logger.warning(f"请求失败: {e}")
                return []

            list_items = self._parse_list(resp.text)
            self.logger.info(f"列表页解析到 {len(list_items)} 条")

            for item in list_items:
                detail = await self._fetch_detail(client, item)
                if detail:
                    items.append(detail)
                self.delay()

        return items

    def _parse_list(self, page_html: str) -> list[dict]:
        """解析列表页：<div class="article_list_card"><div class="article_list_card_title">标题</div>..."""
        tree = html.fromstring(page_html)
        items: list[dict] = []
        for card in tree.xpath('//div[contains(@class,"article_list_card")]'):
            # 标题在 a 内或 card_title 内
            link = card.xpath('.//a[@href]')
            if not link:
                continue
            title = link[0].text_content().strip()
            href = link[0].get("href", "").strip()
            if not title or not href:
                continue
            detail_url = urljoin(self.BASE, href)
            # 摘要
            summary = ""
            sum_el = card.xpath('.//p[contains(@class,"txtNr")]')
            if sum_el:
                summary = sum_el[0].text_content().strip()
            items.append({
                "title": title,
                "source_type": "资讯",
                "source_site": "养老网",
                "source_url": detail_url,
                "content": summary,
            })
        return items

    async def _fetch_detail(self, client: httpx.AsyncClient, item: dict) -> dict | None:
        """抓取详情页正文"""
        url = item.get("source_url", "")
        try:
            resp = await client.get(url, headers={"User-Agent": get_random_ua()})
            if resp.status_code != 200:
                return item
        except httpx.HTTPError:
            return item

        tree = html.fromstring(resp.text)
        content_el = tree.xpath(
            '//div[@class="article_content"] | //div[contains(@class,"content")] | //article'
        )
        if content_el:
            item["content"] = content_el[0].text_content().strip()[:5000]
        else:
            body = tree.xpath('//body')
            if body:
                item["content"] = body[0].text_content().strip()[:5000]
        return item
