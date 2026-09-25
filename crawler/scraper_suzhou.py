# -*- coding: utf-8 -*-
"""
苏州及周边养老相关机构爬虫
核心策略：用 Playwright 拦截百度地图的网络请求，直接获取 POI JSON 数据
中科安樵 - 养老行业数据采集
"""

import re
import json
import asyncio
from typing import List, Dict
from urllib.parse import quote
from playwright.async_api import async_playwright, Page, Browser, BrowserContext, Response

import config
import utils


class SuzhouInstitutionScraper:
    """苏州养老机构爬虫"""

    def __init__(self):
        self.institutions: List[Dict] = []
        self.browser: Browser = None
        self.context: BrowserContext = None
        self.page: Page = None
        self._captured_pois: List[Dict] = []  # 拦截到的POI数据

    async def init_browser(self, playwright):
        """初始化浏览器"""
        self.browser = await playwright.chromium.launch(
            headless=config.HEADLESS,
            slow_mo=config.SLOW_MO,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
            ],
        )
        self.context = await self.browser.new_context(
            user_agent=config.USER_AGENT,
            viewport={"width": 1920, "height": 1080},
            locale="zh-CN",
        )
        self.page = await self.context.new_page()
        print("浏览器已启动")

    async def close_browser(self):
        """关闭浏览器"""
        if self.browser:
            await self.browser.close()
            print("浏览器已关闭")

    # ==================== 核心：百度地图（拦截网络请求） ====================

    async def scrape_baidu_map(self, keyword: str) -> List[Dict]:
        """
        百度地图搜索 - 通过拦截网络请求获取POI JSON数据
        百度地图搜索时会发起 /newmap=1&reqflag=pcmap&biz=1&from=webmap&qt=s 的请求
        返回的JSON中包含 name, addr, tel, area_name 等字段
        """
        results = []
        self._captured_pois = []
        print(f"\n  百度地图搜索：{keyword}")

        # 注册响应拦截器
        self.page.on("response", self._on_response)

        try:
            # 访问百度地图搜索页
            url = f"https://map.baidu.com/search/{quote(keyword)}"
            await self.page.goto(url, wait_until="networkidle", timeout=30000)
            await utils.async_random_delay(3, 5)

            # 等待搜索结果加载
            await self.page.wait_for_timeout(3000)

            # 滚动左侧面板加载更多结果
            for scroll_round in range(15):
                await self.page.evaluate("""
                    () => {
                        // 尝试多种面板选择器
                        const selectors = [
                            '.poi-list', '.card-list', '[class*="poiList"]',
                            '[class*="search-result"]', '[class*="list-container"]',
                            '.m-scrollbar', '[class*="scroll"]'
                        ];
                        for (let sel of selectors) {
                            const el = document.querySelector(sel);
                            if (el && el.scrollHeight > el.clientHeight) {
                                el.scrollTop += 600;
                                return true;
                            }
                        }
                        // 如果没找到特定面板，滚动整个页面
                        window.scrollBy(0, 600);
                        return false;
                    }
                """)
                await utils.async_random_delay(1, 2)

                # 尝试点击"加载更多"按钮
                try:
                    load_more = await self.page.query_selector(
                        '[class*="load-more"], [class*="loadmore"], .poi-more, button:has-text("更多")'
                    )
                    if load_more:
                        await load_more.click()
                        await utils.async_random_delay(2, 3)
                except:
                    pass

            # 等待最后的请求完成
            await self.page.wait_for_timeout(2000)

            # 处理拦截到的POI数据
            for poi in self._captured_pois:
                name = poi.get("name", "")
                if not name:
                    continue

                # 过滤：只要养老相关
                if not any(kw in name for kw in ["养老", "护理", "老年", "适老", "敬老", "照料", "康复", "医养", "托老", "颐养"]):
                    continue

                addr = poi.get("addr", "")
                tel = poi.get("tel", "")
                area = poi.get("area_name", "")
                tag = poi.get("tag", "")

                # 清理电话
                if tel:
                    tel = tel.split(";")[0].strip()
                    tel = utils.extract_phone(tel) or tel

                inst = {
                    "机构名称": name,
                    "机构类型": utils.classify_institution(name),
                    "所在区": area,
                    "详细地址": addr,
                    "联系电话": tel or "",
                    "联系人": "",
                    "经营范围/服务内容": tag,
                    "数据来源": "百度地图",
                    "备注": "",
                }
                results.append(inst)

            print(f"    找到 {len(results)} 条（拦截到 {len(self._captured_pois)} 个POI）")

        except Exception as e:
            print(f"    搜索出错：{e}")
        finally:
            # 移除拦截器
            self.page.remove_listener("response", self._on_response)

        return results

    async def _on_response(self, response: Response):
        """拦截网络响应，提取POI数据"""
        url = response.url

        # 百度地图POI搜索请求的特征
        if "qt=s" in url or "qt=con" in url or "newmap=1" in url:
            try:
                body = await response.text()
                # 百度地图返回的可能是JSON或JSONP
                # 尝试直接解析JSON
                try:
                    data = json.loads(body)
                except:
                    # 尝试去除JSONP包装
                    jsonp_match = re.search(r'\{.*\}', body, re.DOTALL)
                    if jsonp_match:
                        data = json.loads(jsonp_match.group())
                    else:
                        return

                # 提取content中的POI列表
                content = data.get("content", [])
                if isinstance(content, list):
                    for item in content:
                        if isinstance(item, dict) and item.get("name"):
                            self._captured_pois.append(item)
                elif isinstance(content, dict):
                    # 有时content是单个对象
                    if content.get("name"):
                        self._captured_pois.append(content)
                    # 有时content里有poi_list
                    poi_list = content.get("poi_list", [])
                    if isinstance(poi_list, list):
                        for item in poi_list:
                            if isinstance(item, dict) and item.get("name"):
                                self._captured_pois.append(item)

            except Exception:
                pass

    # ==================== 数据源2：58同城 ====================

    async def scrape_58tongcheng(self, keyword: str) -> List[Dict]:
        """从58同城搜索养老服务"""
        results = []
        print(f"\n  58同城搜索：{keyword}")

        try:
            url = f"https://su.58.com/sou/?key={quote(keyword)}"
            await self.page.goto(url, wait_until="domcontentloaded", timeout=20000)
            await utils.async_random_delay(3, 5)

            # 滚动加载
            for _ in range(5):
                await self.page.evaluate("window.scrollBy(0, 600)")
                await utils.async_random_delay(1, 2)

            html = await self.page.content()
            page_text = await self.page.inner_text("body")

            # 从文本中提取机构信息
            paragraphs = re.split(r'\n{2,}', page_text)
            for para in paragraphs:
                if len(para) < 10:
                    continue
                if not any(kw in para for kw in ["养老", "护理", "适老", "老年", "敬老", "照料"]):
                    continue

                phones = utils.extract_all_phones(para)
                name_match = re.search(
                    r'([\u4e00-\u9fa5]{2,30}(?:养老|护理|适老|老年|敬老|照料|康复|医养)[\u4e00-\u9fa5]{0,15}?(?:公司|中心|院|站|机构|公寓|家园|之家))',
                    para
                )

                if name_match:
                    name = name_match.group(1)
                    addr_match = re.search(r'(?:地址|位于|在)[：:]*\s*([^\n]{5,50})', para)
                    addr = addr_match.group(1).strip() if addr_match else ""

                    data = {
                        "机构名称": name,
                        "机构类型": utils.classify_institution(name),
                        "所在区": "",
                        "详细地址": addr,
                        "联系电话": phones[0] if phones else "",
                        "联系人": "",
                        "经营范围/服务内容": "58同城",
                        "数据来源": "58同城",
                        "备注": "",
                    }
                    for area in config.TARGET_DISTRICTS + config.SURROUNDING_CITIES:
                        if area in para or area in addr:
                            data["所在区"] = area
                            break
                    results.append(data)

            # 从HTML中补充电话
            phone_from_html = re.findall(r'(?:data-phone|data-tel|tel)="([^"]+)"', html)
            if phone_from_html:
                for i, inst in enumerate(results):
                    if not inst["联系电话"] and i < len(phone_from_html):
                        inst["联系电话"] = utils.extract_phone(phone_from_html[i]) or phone_from_html[i]

            print(f"    找到 {len(results)} 条")

        except Exception as e:
            print(f"    搜索出错：{e}")

        return results

    # ==================== 数据源3：百度搜索 ====================

    async def scrape_baidu_search(self, keyword: str) -> List[Dict]:
        """百度搜索"""
        results = []
        print(f"\n  百度搜索：{keyword}")

        try:
            url = f"https://www.baidu.com/s?wd={quote(keyword)}&rn=50"
            await self.page.goto(url, wait_until="domcontentloaded", timeout=25000)
            await utils.async_random_delay(2, 4)

            html = await self.page.content()

            # 从HTML中提取
            text_blocks = re.split(r'<[^>]+>', html)
            for block in text_blocks:
                if len(block) < 15:
                    continue
                if not any(kw in block for kw in ["养老", "护理", "适老", "老年", "敬老"]):
                    continue

                phones = utils.extract_all_phones(block)
                if not phones:
                    continue

                name_match = re.search(
                    r'([\u4e00-\u9fa5]{2,25}(?:养老|护理|适老|老年|敬老|照料|康复|医养)[\u4e00-\u9fa5]{0,15}?(?:公司|中心|院|站|机构|公寓|家园))',
                    block
                )
                if name_match:
                    data = {
                        "机构名称": name_match.group(1),
                        "机构类型": utils.classify_institution(name_match.group(1)),
                        "所在区": "",
                        "详细地址": "",
                        "联系电话": phones[0],
                        "联系人": "",
                        "经营范围/服务内容": "",
                        "数据来源": "百度搜索",
                        "备注": "",
                    }
                    results.append(data)

            print(f"    找到 {len(results)} 条")

        except Exception as e:
            print(f"    搜索出错：{e}")

        return results

    # ==================== 主流程 ====================

    async def scrape_all(self) -> List[Dict]:
        """执行全部爬取任务"""
        print("=" * 60)
        print("开始爬取苏州及周边养老相关机构")
        print("=" * 60)

        async with async_playwright() as p:
            await self.init_browser(p)

            try:
                # 1. 百度地图（主力数据源，拦截网络请求）
                print("\n【阶段1/3】百度地图（网络拦截）")
                map_keywords = [
                    "苏州养老院", "苏州护理院", "苏州养老服务中心", "苏州老年公寓",
                    "苏州敬老院", "苏州居家养老服务", "苏州适老化改造", "苏州康复护理中心",
                    "苏州医养结合", "苏州日间照料中心",
                    "昆山养老院", "昆山护理院", "常熟养老院", "常熟护理院",
                    "太仓养老院", "张家港养老院", "吴江养老院",
                ]
                for i, keyword in enumerate(map_keywords):
                    utils.print_progress(i + 1, len(map_keywords), keyword)
                    results = await self.scrape_baidu_map(keyword)
                    self.institutions.extend(results)
                    await utils.async_random_delay(3, 5)

                # 2. 58同城
                print("\n【阶段2/3】58同城")
                city58_keywords = [
                    "苏州养老院", "苏州护理院", "苏州居家养老",
                    "苏州适老化改造", "昆山养老院", "常熟养老院",
                    "太仓养老院", "张家港养老院",
                ]
                for i, keyword in enumerate(city58_keywords):
                    utils.print_progress(i + 1, len(city58_keywords), keyword)
                    results = await self.scrape_58tongcheng(keyword)
                    self.institutions.extend(results)
                    await utils.async_random_delay(2, 4)

                # 3. 百度搜索
                print("\n【阶段3/3】百度搜索")
                baidu_keywords = [
                    "苏州养老院电话", "苏州护理院电话",
                    "昆山养老院电话", "苏州适老化改造公司电话",
                ]
                for i, keyword in enumerate(baidu_keywords):
                    utils.print_progress(i + 1, len(baidu_keywords), keyword)
                    results = await self.scrape_baidu_search(keyword)
                    self.institutions.extend(results)
                    await utils.async_random_delay(2, 3)

            finally:
                await self.close_browser()

        # 去重
        self.institutions = utils.deduplicate_by_name(self.institutions, "机构名称")

        # 过滤：只保留苏州及周边相关的
        valid_areas = ["苏州"] + config.TARGET_DISTRICTS + config.SURROUNDING_CITIES
        self.institutions = [
            inst for inst in self.institutions
            if any(area in inst.get("机构名称", "") or area in inst.get("详细地址", "")
                   or area in inst.get("所在区", "")
                   for area in valid_areas)
        ]

        print(f"\n共采集到 {len(self.institutions)} 家机构（去重+地域过滤后）")
        return self.institutions

    def export(self) -> str:
        """导出到 Excel"""
        if not self.institutions:
            print("无数据可导出")
            return None

        # 按机构类型排序
        type_order = ["养老机构", "护理机构", "长护险机构", "适老化改造", "居家养老服务", "其他养老相关"]
        self.institutions.sort(
            key=lambda x: type_order.index(x.get("机构类型", "其他养老相关"))
            if x.get("机构类型") in type_order else 99
        )

        filepath = utils.export_to_excel(
            self.institutions,
            config.OUTPUT_FILES["suzhou_institutions"],
            sheet_name="苏州养老机构",
            title="苏州及周边养老相关机构名录"
        )

        # 统计信息
        print("\n【数据统计】")
        type_counts = {}
        source_counts = {}
        phone_count = 0
        for inst in self.institutions:
            t = inst.get("机构类型", "未知")
            s = inst.get("数据来源", "未知")
            type_counts[t] = type_counts.get(t, 0) + 1
            source_counts[s] = source_counts.get(s, 0) + 1
            if inst.get("联系电话"):
                phone_count += 1

        print("  按类型：")
        for t, count in sorted(type_counts.items(), key=lambda x: -x[1]):
            print(f"    {t}: {count} 家")
        print("  按来源：")
        for s, count in sorted(source_counts.items(), key=lambda x: -x[1]):
            print(f"    {s}: {count} 家")
        total = len(self.institutions)
        print(f"  含联系电话: {phone_count} 家 ({phone_count/total*100:.1f}%)" if total else "")

        return filepath


async def main():
    """主函数"""
    scraper = SuzhouInstitutionScraper()
    await scraper.scrape_all()
    scraper.export()


if __name__ == "__main__":
    asyncio.run(main())
