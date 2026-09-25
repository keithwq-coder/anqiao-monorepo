"""爬虫手动触发 API"""

import asyncio
import logging
from datetime import datetime

from fastapi import APIRouter

from crawlers.ccgp_list import CCGPListCrawler
from crawlers.industry import Cnsf99Crawler, YanglaoCrawler
from crawlers.policy import CncaprcCrawler, McaCrawler
from crawlers.search import BingSearchCrawler

router = APIRouter(prefix="/api/crawler", tags=["crawler"])

logger = logging.getLogger(__name__)

# 爬虫运行状态
_crawler_status: dict[str, str] = {}
_last_run: dict[str, datetime] = {}

# 爬虫名 → 工厂函数
CRAWLERS = {
    "ccgp_list": CCGPListCrawler,
    "bing_search": BingSearchCrawler,
    "cnsf99": Cnsf99Crawler,
    "yanglao": YanglaoCrawler,
    "mca": McaCrawler,
    "cncaprc": CncaprcCrawler,
}


@router.post("/run/{crawler_name}")
async def run_crawler(crawler_name: str):
    """手动触发指定爬虫"""
    if crawler_name not in CRAWLERS:
        return {"error": f"未知爬虫: {crawler_name}"}

    if _crawler_status.get(crawler_name) == "running":
        return {"error": f"爬虫 {crawler_name} 正在运行中"}

    _crawler_status[crawler_name] = "running"

    # 异步执行爬虫
    asyncio.create_task(_run_crawler_task(crawler_name))

    return {"ok": True, "message": f"爬虫 {crawler_name} 已启动"}


@router.get("/status")
async def crawler_status():
    """获取所有爬虫状态"""
    return {
        "crawlers": {
            name: {
                "status": _crawler_status.get(name, "idle"),
                "last_run": str(_last_run.get(name, "")),
            }
            for name in CRAWLERS
        }
    }


async def _run_crawler_task(crawler_name: str):
    """后台执行爬虫任务"""
    try:
        crawler = CRAWLERS[crawler_name]()
        await crawler.run()

        _crawler_status[crawler_name] = "success"
        _last_run[crawler_name] = datetime.now()
        logger.info(f"爬虫 {crawler_name} 完成")
    except Exception:
        _crawler_status[crawler_name] = "error"
        logger.exception(f"爬虫 {crawler_name} 失败")
