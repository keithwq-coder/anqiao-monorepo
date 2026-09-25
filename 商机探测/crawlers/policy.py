"""政策爬虫 — 民政部（通知公告）+ 中国老龄协会（政策法规）

两站均为静态 HTML，选择器已验证。
注：分页机制未验证，仅抓第1页。TODO: 后续验证 page-2 链接后扩展分页。
"""

import re
from datetime import date, datetime
from urllib.parse import urljoin

import httpx
from lxml import html

import config
from crawlers.base import BaseCrawler, get_random_ua


class McaCrawler(BaseCrawler):
    """民政部·通知公告"""

    name = "mca"
    BASE = "https://www.mca.gov.cn"

    async def crawl(self) -> list[dict]:
        items: list[dict] = []
        async with httpx.AsyncClient(
            timeout=30.0,
            follow_redirects=True,
            headers={"Accept": "text/html,application/xhtml+xml"},
        ) as client:
            try:
                resp = await client.get(
                    config.MCA_NOTICE_URL,
                    headers={"User-Agent": get_random_ua()},
                )
                if resp.status_code != 200:
                    self.logger.warning(f"HTTP {resp.status_code}")
                    return []
            except httpx.HTTPError as e:
                self.logger.warning(f"请求失败: {e}")
                return []

            list_items = self._parse_list(resp.text, config.MCA_NOTICE_URL)
            self.logger.info(f"列表页解析到 {len(list_items)} 条")

            for item in list_items:
                detail = await self._fetch_detail(client, item)
                if detail:
                    items.append(detail)
                self.delay()

        return items

    def _parse_list(self, page_html: str, base_url: str) -> list[dict]:
        """解析列表页：<a class="artitlelist" href="../../n152/n165/c<ID>/content.html">标题</a>"""
        tree = html.fromstring(page_html)
        items: list[dict] = []
        for a in tree.xpath('//a[contains(@class,"artitlelist")]'):
            title = a.text_content().strip()
            href = a.get("href", "").strip()
            if not title or not href:
                continue
            detail_url = urljoin(base_url, href)  # 处理 ../../ 相对路径
            items.append({
                "title": title,
                "source_type": "政策",
                "source_site": "民政部",
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
        content_el = tree.xpath(
            '//div[@class="content"] | //div[@id="zoom"] | //div[contains(@class,"article")]'
        )
        if content_el:
            item["content"] = content_el[0].text_content().strip()[:5000]
        else:
            body = tree.xpath('//body')
            if body:
                item["content"] = body[0].text_content().strip()[:5000]
        return item


class CncaprcCrawler(BaseCrawler):
    """中国老龄协会·政策法规"""

    name = "cncaprc"
    BASE = "http://www.cncaprc.gov.cn"

    async def crawl(self) -> list[dict]:
        items: list[dict] = []
        async with httpx.AsyncClient(
            timeout=30.0,
            follow_redirects=True,
            headers={"Accept": "text/html,application/xhtml+xml"},
        ) as client:
            try:
                resp = await client.get(
                    config.CNCAPRC_POLICY_URL,
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
        """解析列表页：<ul class="channel-news-list"><li><h3><a href="/xxzcfg/<ID>.jhtml">标题</a></h3>"""
        tree = html.fromstring(page_html)
        items: list[dict] = []
        for li in tree.xpath('//ul[contains(@class,"channel-news-list")]//li'):
            link = li.xpath('.//a[@href]')
            if not link:
                continue
            title = link[0].text_content().strip()
            href = link[0].get("href", "").strip()
            if not title or not href:
                continue
            detail_url = urljoin(self.BASE, href)
            # 日期（可能在 li 内的 span/time）
            date_text = ""
            date_el = li.xpath('.//span | .//time')
            if date_el:
                date_text = date_el[0].text_content().strip()
            publish_date = self._parse_date(date_text)
            items.append({
                "title": title,
                "source_type": "政策",
                "source_site": "中国老龄协会",
                "source_url": detail_url,
                "publish_date": publish_date,
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
        content_el = tree.xpath(
            '//div[@class="content"] | //div[contains(@class,"article")] | //div[contains(@class,"detail")]'
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
