"""基础爬虫类 — 公共逻辑：去重、入库、错误处理、请求延迟"""

import hashlib
import logging
import random
import time
from abc import ABC, abstractmethod
from datetime import datetime

from db.models import Opportunity
from db.session import SessionLocal

logger = logging.getLogger(__name__)

# 随机 User-Agent 池
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
]


def get_random_ua() -> str:
    return random.choice(USER_AGENTS)


def compute_dedup_hash(title: str, source_url: str) -> str:
    """计算去重哈希：SHA256(title + source_url)"""
    raw = f"{title}|{source_url}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class BaseCrawler(ABC):
    """基础爬虫类，所有爬虫继承此类"""

    name: str = "base"

    def __init__(self) -> None:
        self.logger = logging.getLogger(f"crawler.{self.name}")

    @abstractmethod
    async def crawl(self) -> list[dict]:
        """执行爬取，返回原始数据列表（字典格式）"""
        ...

    def delay(self) -> None:
        """请求间随机延迟"""
        import config

        seconds = random.uniform(config.CRAWL_DELAY_MIN, config.CRAWL_DELAY_MAX)
        time.sleep(seconds)

    async def save(self, items: list[dict]) -> int:
        """
        批量入库，自动去重。
        返回实际新增的记录数。
        """
        saved = 0
        with SessionLocal() as session:
            # 本批次内已见 hash（DB 查询看不到尚未 commit 的同批记录）
            batch_seen: set[str] = set()
            # DB 中已存在的 hash
            db_hashes = set(
                h for (h,) in session.query(Opportunity.dedup_hash).all()
            )
            for item in items:
                title = item.get("title", "").strip()
                source_url = item.get("source_url", "").strip()
                if not title or not source_url:
                    continue

                dedup_hash = compute_dedup_hash(title, source_url)

                # 检查 DB 已有或本批次内重复
                if dedup_hash in db_hashes or dedup_hash in batch_seen:
                    continue

                opp = Opportunity(
                    title=title,
                    source_type=item.get("source_type", "招标"),
                    source_site=item.get("source_site", ""),
                    source_url=source_url,
                    publish_date=item.get("publish_date"),
                    region=item.get("region", ""),
                    amount=item.get("amount", ""),
                    deadline=item.get("deadline"),
                    content=item.get("content", ""),
                    purchaser=item.get("purchaser", ""),
                    agency=item.get("agency", ""),
                    contact=item.get("contact", ""),
                    dedup_hash=dedup_hash,
                    crawl_time=datetime.now(),
                )
                session.add(opp)
                batch_seen.add(dedup_hash)
                saved += 1
                self.logger.debug(f"新增: {title[:50]}")

            session.commit()

        self.logger.info(f"[{self.name}] 新增 {saved} 条，跳过 {len(items) - saved} 条重复")
        return saved

    async def run(self) -> int:
        """完整执行：爬取 + 入库 + AI 分类"""
        self.logger.info(f"[{self.name}] 开始爬取...")
        try:
            items = await self.crawl()
            self.logger.info(f"[{self.name}] 爬取到 {len(items)} 条原始数据")
            saved = await self.save(items)

            # 入库后触发 Kimi 三档分类（扫全表 grade IS NULL）
            import config

            if config.AI_GRADE_ON_SAVE:
                from ai.grader import grade_pending

                self.logger.info(f"[{self.name}] 触发 AI 分类...")
                await grade_pending()
            return saved
        except Exception:
            self.logger.exception(f"[{self.name}] 爬取失败")
            return 0
