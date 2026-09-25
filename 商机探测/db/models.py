"""SQLAlchemy 数据模型"""

from datetime import date, datetime

from sqlalchemy import Column, Date, DateTime, Integer, String, Text, func
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class Opportunity(Base):
    """商机数据表"""

    __tablename__ = "opportunities"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(500), nullable=False, comment="标题")
    source_type = Column(String(20), nullable=False, comment="信源类型：招标/资讯/政策")
    source_site = Column(String(100), comment="来源网站")
    source_url = Column(String(1000), comment="原文链接")
    publish_date = Column(Date, comment="发布日期")
    crawl_time = Column(DateTime, default=func.now(), comment="抓取时间")
    region = Column(String(100), comment="地区")
    amount = Column(String(100), comment="金额（原文格式）")
    deadline = Column(Date, comment="投标截止日期")
    summary = Column(Text, comment="AI 摘要")
    relevance_score = Column(Integer, comment="相关性评分 1-10（遗留字段，已改用 grade）")
    content = Column(Text, comment="正文")
    status = Column(String(20), default="新发现", comment="状态：新发现/已跟进/已关闭")
    # AI 三档分类（Kimi K2.7）：1=安樵产品相关，2=行业/政策，3=不合格
    grade = Column(Integer, index=True, comment="AI档位:1=安樵产品相关,2=行业/政策,3=不合格")
    grade_reason = Column(Text, comment="AI分类理由")
    purchaser = Column(String(200), comment="采购人")
    agency = Column(String(200), comment="代理机构")
    contact = Column(String(200), comment="联系方式")
    dedup_hash = Column(String(64), unique=True, index=True, comment="去重哈希")

    def __repr__(self) -> str:
        return f"<Opportunity(id={self.id}, title='{self.title[:30]}...', score={self.relevance_score})>"
