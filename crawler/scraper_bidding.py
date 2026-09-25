# -*- coding: utf-8 -*-
"""
招投标信息爬虫（改进版）
数据源：中国政府采购网 (ccgp.gov.cn) + 中国招标投标公共服务平台
中科安樵 - 养老行业数据采集
"""

import re
import asyncio
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from urllib.parse import quote
from playwright.async_api import async_playwright, Page, Browser

import config
import utils


class BiddingScraper:
    """招投标信息爬虫"""
    
    def __init__(self):
        self.bidding_announcements: List[Dict] = []  # 招标公告
        self.winning_bids: List[Dict] = []           # 中标公告
        self.browser: Browser = None
        self.context = None
        self.page: Page = None
    
    async def init_browser(self, playwright):
        """初始化浏览器"""
        self.browser = await playwright.chromium.launch(
            headless=config.HEADLESS,
            slow_mo=config.SLOW_MO,
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
    
    async def search_ccgp(self, keyword: str, bid_type: str = "招标") -> List[Dict]:
        """
        在中国政府采购网搜索
        bid_type: "招标" 或 "中标"
        """
        results = []
        print(f"\n正在搜索 [{bid_type}]：{keyword}")
        
        # 中国政府采购网搜索
        # bidType: 1=招标公告, 2=竞争性谈判, 3=询价, 4=单一来源, 7=中标公告
        type_code = "1" if bid_type == "招标" else "7"
        
        # 计算时间范围（近90天）
        end_date = datetime.now()
        start_date = end_date - timedelta(days=config.BIDDING_VALID_DAYS)
        start_str = start_date.strftime("%Y-%m-%d")  # 必须用短横线，不能用冒号
        end_str = end_date.strftime("%Y-%m-%d")
        
        for page_num in range(1, config.MAX_PAGES_PER_KEYWORD + 1):
            # 重试机制
            for retry in range(config.MAX_RETRIES):
                try:
                    # 正确的搜索URL格式（日期用短横线分隔）
                    search_url = (
                        f"http://search.ccgp.gov.cn/bxsearch?"
                        f"searchtype=1&page_index={page_num}&bidSort=0&buyerName=&projectId=&"
                        f"pinMu=0&bidType={type_code}&dbselect=bidx&kw={quote(keyword)}&"
                        f"start_time={start_str}&end_time={end_str}&timeType=6&displayZone=&zoneId=&"
                        f"pppStatus=0&agentName="
                    )
                    
                    await self.page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
                    await utils.async_random_delay(3, 5)
                    break  # 成功则跳出重试
                except Exception as e:
                    if retry < config.MAX_RETRIES - 1:
                        print(f"  第{page_num}页重试({retry+1})...")
                        await utils.async_random_delay(5, 8)
                    else:
                        print(f"  第{page_num}页失败：{e}")
                        return results
            
            # 等待页面加载
            await self.page.wait_for_timeout(2000)
            
            # 获取页面内容
            content = await self.page.content()
            
            # 检查是否有搜索结果
            if "没有找到" in content or "未找到" in content:
                print(f"  第{page_num}页无结果")
                break
            
            # 解析搜索结果
            page_results = await self._parse_ccgp_results(content, bid_type)
            
            if not page_results:
                # 尝试从页面元素提取
                page_results = await self._extract_ccgp_items(bid_type)
            
            if page_results:
                results.extend(page_results)
                print(f"  第{page_num}页：找到 {len(page_results)} 条记录")
            else:
                print(f"  第{page_num}页：解析失败")
                break
            
            await utils.async_random_delay(2, 4)
        
        return results
    
    async def _parse_ccgp_results(self, html: str, bid_type: str) -> List[Dict]:
        """从HTML解析搜索结果"""
        results = []
        
        # 匹配列表项
        # 格式: <li>...<a href="...">标题</a>...<span>日期</span>...</li>
        item_pattern = r'<li[^>]*>.*?<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>.*?</li>'
        items = re.findall(item_pattern, html, re.DOTALL)
        
        for url, title in items[:20]:
            title = re.sub(r'<[^>]+>', '', title).strip()
            
            if not title or len(title) < 5:
                continue
            
            # 过滤相关关键词
            if not any(kw in title for kw in ["养老", "适老", "护理", "长护", "老年", "居家"]):
                continue
            
            data = {
                "公告类型": bid_type,
                "项目名称": title,
                "招标单位": "",
                "招标单位联系电话": "",
                "中标单位": "",
                "中标金额": "",
                "预算金额": "",
                "发布日期": "",
                "截止日期": "",
                "项目地区": "",
                "公告链接": url if url.startswith("http") else "http:" + url,
            }
            
            # 提取日期
            date_match = re.search(r'(\d{4})[年.-](\d{1,2})[月.-](\d{1,2})', title)
            if date_match:
                data["发布日期"] = f"{date_match.group(1)}-{int(date_match.group(2)):02d}-{int(date_match.group(3)):02d}"
            
            results.append(data)
        
        return results
    
    async def _extract_ccgp_items(self, bid_type: str) -> List[Dict]:
        """从页面元素提取搜索结果"""
        results = []
        
        try:
            # 尝试多种选择器
            selectors = [
                "ul.vT-srch-result-list-bid li",
                ".vT-srch-result-list li",
                ".list-box li",
                "[class*='result'] li",
            ]
            
            items = []
            for selector in selectors:
                items = await self.page.query_selector_all(selector)
                if items:
                    break
            
            for item in items[:20]:
                try:
                    # 提取链接和标题
                    link_el = await item.query_selector("a")
                    if not link_el:
                        continue
                    
                    title = utils.clean_text(await link_el.inner_text())
                    href = await link_el.get_attribute("href") or ""
                    
                    if not title or len(title) < 5:
                        continue
                    
                    # 过滤
                    if not any(kw in title for kw in ["养老", "适老", "护理", "长护", "老年", "居家"]):
                        continue
                    
                    if href and not href.startswith("http"):
                        href = "http:" + href if href.startswith("//") else "http://www.ccgp.gov.cn" + href
                    
                    data = {
                        "公告类型": bid_type,
                        "项目名称": title,
                        "招标单位": "",
                        "招标单位联系电话": "",
                        "中标单位": "",
                        "中标金额": "",
                        "预算金额": "",
                        "发布日期": "",
                        "截止日期": "",
                        "项目地区": "",
                        "公告链接": href,
                    }
                    
                    # 提取日期
                    date_el = await item.query_selector("span, .date, [class*='date']")
                    if date_el:
                        date_text = await date_el.inner_text()
                        data["发布日期"] = utils.parse_date(date_text) or ""
                    
                    results.append(data)
                    
                except:
                    continue
                    
        except Exception as e:
            pass
        
        return results
    
    async def enrich_detail(self, item: Dict) -> Dict:
        """进入详情页补充信息"""
        url = item.get("公告链接", "")
        if not url or not url.startswith("http"):
            return item
        
        try:
            detail_page = await self.context.new_page()
            await detail_page.goto(url, wait_until="domcontentloaded", timeout=20000)
            await utils.async_random_delay(1, 2)
            
            # 获取页面文本
            text = await detail_page.inner_text("body")
            
            # 提取电话
            phones = utils.extract_all_phones(text)
            if phones:
                item["招标单位联系电话"] = phones[0]
            
            # 提取招标单位
            buyer_patterns = [
                r'采购人[名称]*[：:]\s*([^\s<,，。;；\n]+)',
                r'招标人[名称]*[：:]\s*([^\s<,，。;；\n]+)',
                r'采购单位[：:]\s*([^\s<,，。;；\n]+)',
            ]
            for pattern in buyer_patterns:
                match = re.search(pattern, text)
                if match:
                    item["招标单位"] = utils.clean_text(match.group(1))
                    break
            
            # 提取预算
            budget_patterns = [
                r'预算金额[（(]?[万元]*[)）]?[：:]\s*([\d,.]+)',
                r'采购预算[：:]\s*([\d,.]+)',
            ]
            for pattern in budget_patterns:
                match = re.search(pattern, text)
                if match:
                    item["预算金额"] = match.group(1) + "万元"
                    break
            
            # 如果是中标公告
            if item.get("公告类型") == "中标":
                winner_patterns = [
                    r'中标[供应商单位]*[名称]*[：:]\s*([^\s<,，。;；\n]+)',
                    r'成交[供应商单位]*[名称]*[：:]\s*([^\s<,，。;；\n]+)',
                ]
                for pattern in winner_patterns:
                    match = re.search(pattern, text)
                    if match:
                        item["中标单位"] = utils.clean_text(match.group(1))
                        break
                
                amount_patterns = [
                    r'中标[金额价格]*[：:]\s*([\d,.]+)',
                    r'成交[金额价格]*[：:]\s*([\d,.]+)',
                ]
                for pattern in amount_patterns:
                    match = re.search(pattern, text)
                    if match:
                        item["中标金额"] = match.group(1) + "万元"
                        break
            
            # 提取地区
            area_patterns = [
                r'所属地区[：:]\s*([^\s<,，。;；\n]+)',
                r'项目地区[：:]\s*([^\s<,，。;；\n]+)',
            ]
            for pattern in area_patterns:
                match = re.search(pattern, text)
                if match:
                    item["项目地区"] = utils.clean_text(match.group(1))
                    break
            
            await detail_page.close()
            
        except Exception as e:
            pass
        
        return item
    
    async def scrape_all(self):
        """执行全部爬取任务"""
        print("=" * 60)
        print("开始爬取全国养老相关招投标信息")
        print("=" * 60)
        
        async with async_playwright() as p:
            await self.init_browser(p)
            
            try:
                total_keywords = len(config.BIDDING_KEYWORDS)
                
                for i, keyword in enumerate(config.BIDDING_KEYWORDS):
                    print(f"\n{'='*40}")
                    print(f"关键词 [{i+1}/{total_keywords}]：{keyword}")
                    print(f"{'='*40}")
                    
                    # 搜索招标公告
                    bidding_results = await self.search_ccgp(keyword, "招标")
                    self.bidding_announcements.extend(bidding_results)
                    
                    await utils.async_random_delay(2, 3)
                    
                    # 搜索中标公告
                    winning_results = await self.search_ccgp(keyword, "中标")
                    self.winning_bids.extend(winning_results)
                    
                    await utils.async_random_delay(2, 3)
                
                # 补充详情页信息（限制数量避免太慢）
                print("\n【补充详情页信息】")
                
                # 招标详情
                print("处理招标公告详情...")
                for i, item in enumerate(self.bidding_announcements[:30]):
                    if not item.get("招标单位联系电话"):
                        utils.print_progress(i + 1, min(30, len(self.bidding_announcements)))
                        await self.enrich_detail(item)
                        await utils.async_random_delay(1, 2)
                
                # 中标详情
                print("\n处理中标公告详情...")
                for i, item in enumerate(self.winning_bids[:30]):
                    if not item.get("中标单位") or not item.get("招标单位联系电话"):
                        utils.print_progress(i + 1, min(30, len(self.winning_bids)))
                        await self.enrich_detail(item)
                        await utils.async_random_delay(1, 2)
                
            finally:
                await self.close_browser()
        
        # 去重
        self.bidding_announcements = utils.deduplicate_by_name(self.bidding_announcements, "项目名称")
        self.winning_bids = utils.deduplicate_by_name(self.winning_bids, "项目名称")
        
        print(f"\n【汇总】")
        print(f"  招标公告：{len(self.bidding_announcements)} 条")
        print(f"  中标公告：{len(self.winning_bids)} 条")
    
    def export(self):
        """导出到 Excel"""
        # 导出招标公告
        if self.bidding_announcements:
            self.bidding_announcements.sort(
                key=lambda x: x.get("发布日期", ""), 
                reverse=True
            )
            
            utils.export_to_excel(
                self.bidding_announcements,
                config.OUTPUT_FILES["bidding_announcements"],
                sheet_name="招标公告",
                title="养老相关招标公告"
            )
            
            phone_count = sum(1 for x in self.bidding_announcements if x.get("招标单位联系电话"))
            print(f"  招标公告含电话：{phone_count} 条 ({phone_count/len(self.bidding_announcements)*100:.1f}%)" if self.bidding_announcements else "")
        
        # 导出中标公告
        if self.winning_bids:
            self.winning_bids.sort(
                key=lambda x: x.get("发布日期", ""), 
                reverse=True
            )
            
            utils.export_to_excel(
                self.winning_bids,
                config.OUTPUT_FILES["winning_bids"],
                sheet_name="中标信息",
                title="养老相关中标信息（中标单位线索）"
            )
            
            # 统计中标单位
            winners = set()
            for bid in self.winning_bids:
                if bid.get("中标单位"):
                    winners.add(bid["中标单位"])
            print(f"  涉及中标单位：{len(winners)} 家")
            
            if winners:
                print("\n【中标单位列表（潜在客户）】")
                for w in sorted(winners)[:20]:
                    print(f"  - {w}")
                if len(winners) > 20:
                    print(f"  ... 等共 {len(winners)} 家")


async def main():
    """主函数"""
    scraper = BiddingScraper()
    await scraper.scrape_all()
    scraper.export()


if __name__ == "__main__":
    asyncio.run(main())
