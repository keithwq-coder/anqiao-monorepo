"""定时任务定义"""

import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from crawlers.ccgp_list import CCGPListCrawler
from crawlers.industry import Cnsf99Crawler, YanglaoCrawler
from crawlers.policy import CncaprcCrawler, McaCrawler
from crawlers.search import BingSearchCrawler

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def _run_crawler(crawler, label: str):
    """通用爬虫执行包装"""
    logger.info(f"定时任务：{label} 启动")
    await crawler.run()
    logger.info(f"定时任务：{label} 完成")


async def _run_ccgp_list():
    await _run_crawler(CCGPListCrawler(), "政府采购网爬虫")


async def _run_bing_search():
    await _run_crawler(BingSearchCrawler(), "Bing搜索爬虫")


async def _run_industry():
    await _run_crawler(Cnsf99Crawler(), "中国养老网爬虫")
    await _run_crawler(YanglaoCrawler(), "养老网爬虫")


async def _run_policy():
    await _run_crawler(McaCrawler(), "民政部政策爬虫")
    await _run_crawler(CncaprcCrawler(), "中国老龄协会政策爬虫")


def setup_jobs():
    """配置定时任务（错峰执行）"""
    # 政府采购网：每天 06:00
    scheduler.add_job(
        _run_ccgp_list,
        CronTrigger(hour=6, minute=0),
        id="ccgp_list",
        name="政府采购网爬虫",
        replace_existing=True,
    )
    # Bing 搜索：每天 04:00
    scheduler.add_job(
        _run_bing_search,
        CronTrigger(hour=4, minute=0),
        id="bing_search",
        name="Bing搜索爬虫",
        replace_existing=True,
    )
    # 行业资讯：每天 05:00
    scheduler.add_job(
        _run_industry,
        CronTrigger(hour=5, minute=0),
        id="industry",
        name="行业资讯爬虫",
        replace_existing=True,
    )
    # 政策：每天 06:30
    scheduler.add_job(
        _run_policy,
        CronTrigger(hour=6, minute=30),
        id="policy",
        name="政策爬虫",
        replace_existing=True,
    )

    logger.info("定时任务已配置")
