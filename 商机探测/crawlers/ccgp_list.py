"""中国政府采购网 — 分类列表爬虫

目标：https://www.ccgp.gov.cn/cggg/{branch}/{category}/index_{N}.htm
方式：httpx + lxml（静态 HTML，无需 Playwright）
"""

import re
from datetime import date, datetime
from urllib.parse import urljoin

import httpx
from lxml import html

import config
from crawlers.base import BaseCrawler, get_random_ua

# 基础 URL
CCGP_BASE = "https://www.ccgp.gov.cn"


class CCGPListCrawler(BaseCrawler):
    name = "ccgp_list"

    def __init__(self, max_pages: int = 5):
        """
        Args:
            max_pages: 每个分类最多抓取的页数（每页 20 条）
        """
        super().__init__()
        self.max_pages = max_pages

    async def crawl(self) -> list[dict]:
        all_items: list[dict] = []

        async with httpx.AsyncClient(
            timeout=30.0,
            follow_redirects=True,
            headers={"Accept": "text/html,application/xhtml+xml"},
        ) as client:
            for (branch, cat_code), cat_name in config.CCGP_CATEGORIES.items():
                self.logger.info(f"抓取分类: {cat_name} ({branch}/{cat_code})")
                items = await self._crawl_category(client, branch, cat_code, cat_name)
                all_items.extend(items)

        return all_items

    async def _crawl_category(
        self,
        client: httpx.AsyncClient,
        branch: str,
        cat_code: str,
        cat_name: str,
    ) -> list[dict]:
        """抓取一个分类的所有列表页"""
        items: list[dict] = []

        for page in range(1, self.max_pages + 1):
            # URL 模式：第1页 index.htm，第2页起 index_2.htm
            if page == 1:
                url = f"{CCGP_BASE}/cggg/{branch}/{cat_code}/index.htm"
            else:
                url = f"{CCGP_BASE}/cggg/{branch}/{cat_code}/index_{page}.htm"

            self.logger.debug(f"  第 {page} 页: {url}")

            try:
                resp = await client.get(url, headers={"User-Agent": get_random_ua()})
                if resp.status_code != 200:
                    self.logger.warning(f"  HTTP {resp.status_code}: {url}")
                    break
            except httpx.HTTPError as e:
                self.logger.warning(f"  请求失败: {e}")
                break

            page_items = self._parse_list_page(resp.text, branch, cat_code, cat_name)
            if not page_items:
                # 空页 = 没有更多数据
                break

            items.extend(page_items)
            self.delay()

        # 逐条抓取详情页
        detail_items: list[dict] = []
        for item in items:
            detail = await self._crawl_detail(client, item)
            if detail:
                detail_items.append(detail)
            self.delay()

        return detail_items

    def _parse_list_page(
        self,
        page_html: str,
        branch: str,
        cat_code: str,
        cat_name: str,
    ) -> list[dict]:
        """解析列表页 HTML，提取每条公告的基本信息"""
        tree = html.fromstring(page_html)
        items: list[dict] = []

        # 列表项在 ul.c_list_bid 中
        rows = tree.xpath('//ul[@class="c_list_bid"]/li')
        if not rows:
            # 备用选择器
            rows = tree.xpath('//ul[contains(@class,"c_list")]/li')

        for row in rows:
            try:
                # 标题 & 链接
                link_el = row.xpath('.//a[@href]')[0]
                title = link_el.text_content().strip()
                href = link_el.get("href", "")
                if not title or not href:
                    continue

                # 补全 URL（相对路径基于当前分类页）
                if href.startswith("./"):
                    detail_url = f"{CCGP_BASE}/cggg/{branch}/{cat_code}/{href[2:]}"
                elif href.startswith("/"):
                    detail_url = f"{CCGP_BASE}{href}"
                else:
                    detail_url = urljoin(CCGP_BASE, href)

                # 发布时间：格式为 "发布时间：<em>2026-07-30 00:32</em>"
                date_text = ""
                date_els = row.xpath('.//em')
                # em 元素按顺序：发布时间、地域、采购人
                if len(date_els) >= 1:
                    date_text = date_els[0].text_content().strip()

                # 地区
                region = ""
                if len(date_els) >= 2:
                    region = date_els[1].text_content().strip()

                # 采购人
                purchaser = ""
                if len(date_els) >= 3:
                    purchaser = date_els[2].text_content().strip()

                publish_date = self._parse_date(date_text)

                items.append({
                    "title": title,
                    "source_type": "招标",
                    "source_site": "中国政府采购网",
                    "source_url": detail_url,
                    "publish_date": publish_date,
                    "region": region,
                    "purchaser": purchaser,
                    "content": "",  # 详情页填充
                })
            except (IndexError, ValueError) as e:
                self.logger.debug(f"  解析行失败: {e}")
                continue

        self.logger.debug(f"  列表页解析到 {len(items)} 条")
        return items

    async def _crawl_detail(
        self,
        client: httpx.AsyncClient,
        item: dict,
    ) -> dict | None:
        """抓取详情页，补充完整字段"""
        url = item.get("source_url", "")
        if not url:
            return item

        try:
            resp = await client.get(url, headers={"User-Agent": get_random_ua()})
            if resp.status_code != 200:
                self.logger.warning(f"  详情页 HTTP {resp.status_code}: {url}")
                return item
        except httpx.HTTPError as e:
            self.logger.warning(f"  详情页请求失败: {e}")
            return item

        tree = html.fromstring(resp.text)

        # 提取详情页字段
        # 金额
        amount = self._extract_field(tree, [
            './/td[contains(text(), "金额")]/following-sibling::td',
            './/td[contains(text(), "预算")]/following-sibling::td',
        ])

        # 截止日期
        deadline_text = self._extract_field(tree, [
            './/td[contains(text(), "截止")]/following-sibling::td',
            './/td[contains(text(), "开标时间")]/following-sibling::td',
        ])
        deadline = self._parse_date(deadline_text) if deadline_text else None

        # 代理机构
        agency = self._extract_field(tree, [
            './/td[contains(text(), "代理机构")]/following-sibling::td',
        ])

        # 联系方式
        contact = self._extract_field(tree, [
            './/td[contains(text(), "联系方式")]/following-sibling::td',
            './/td[contains(text(), "联系电话")]/following-sibling::td',
        ])

        # 正文内容
        content_el = tree.xpath('//div[@class="vF_detail_content"]| //div[@class="detail_content"]| //div[@id="detail"]')
        content = ""
        if content_el:
            content = content_el[0].text_content().strip()[:5000]  # 限制长度
        else:
            # 备用：取 body 全文
            body = tree.xpath('//body')
            if body:
                content = body[0].text_content().strip()[:5000]

        item["amount"] = amount
        item["deadline"] = deadline
        item["agency"] = agency
        item["contact"] = contact
        item["content"] = content

        return item

    @staticmethod
    def _extract_field(tree, xpaths: list[str]) -> str:
        """尝试多个 XPath 提取字段，返回第一个匹配的文本"""
        for xp in xpaths:
            els = tree.xpath(xp)
            if els:
                text = els[0].text_content().strip()
                if text:
                    return text
        return ""

    @staticmethod
    def _parse_date(text: str) -> date | None:
        """从文本中解析日期"""
        if not text:
            return None
        # 尝试多种日期格式
        for fmt in ("%Y-%m-%d", "%Y年%m月%d日", "%Y.%m.%d", "%Y/%m/%d"):
            m = re.search(r'\d{4}[-年./]\d{1,2}[-月./]\d{1,2}', text)
            if m:
                raw = m.group()
                # 统一分隔符
                raw = raw.replace("年", "-").replace("月", "-").replace("日", "").replace(".", "-").replace("/", "-")
                try:
                    return datetime.strptime(raw, "%Y-%m-%d").date()
                except ValueError:
                    continue
        return None
