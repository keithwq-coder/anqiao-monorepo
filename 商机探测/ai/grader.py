"""Kimi K2.7 三档分类模块

对每条商机记录，调用 Kimi 判定三档之一：
  1 = 安樵产品相关（直接商机：毫米波雷达健康监测/跌倒检测/无感监测/智能看护设备等）
  2 = 行业/政策（智慧养老行业资讯、政策文件、市场动态，非直接商机）
  3 = 不合格（与养老/安樵产品无关）

输出写入 opportunities.grade 与 grade_reason。
"""

import asyncio
import json
import logging
import re

import config
from db.models import Opportunity
from db.session import SessionLocal

logger = logging.getLogger(__name__)

# 三档分类系统提示
_SYSTEM_PROMPT = f"""你是商机筛选助手，负责判断一条商机信息与「中科安樵」产品/业务的相关性等级。

{config.ANQIAO_PRODUCT_INFO}

请将信息分为三档之一：
- 1（一档·安樵产品相关）：该商机涉及安樵可直接投标或供货的产品/服务，如毫米波雷达健康监测、跌倒检测、无感隔空监测、智能看护设备、适老化监测改造、养老院/社区/居家健康监护硬件等采购或招标需求。
- 2（二档·行业/政策）：智慧养老行业资讯、政策文件、市场动态、标准规范——行业相关但非安樵可直接投标的直接商机。
- 3（三档·不合格）：与养老/健康监测/安樵产品无关。

判断依据：标题 + 正文 + 信源类型。仅输出 JSON，格式为 {{"grade": 1|2|3, "reason": "不超过50字的分类理由"}}。"""

# 正则兜底：从模型输出中提取 {"grade": N, "reason": "..."}
_JSON_RE = re.compile(r'\{[^{}]*"grade"[^{}]*\}', re.DOTALL)
# 兜底：匹配 "grade":N 或 grade:N 或 grade：N（全角冒号），数字 1/2/3
_GRADE_RE = re.compile(r'"?grade"?\s*[:：]\s*([123])')


def _build_client():
    """构造 Kimi（Moonshot）异步客户端"""
    from openai import AsyncOpenAI

    return AsyncOpenAI(
        base_url=config.MOONSHOT_BASE_URL,
        api_key=config.MOONSHOT_API_KEY,
    )


async def grade_item(title: str, content: str, source_type: str) -> dict | None:
    """对单条信息进行三档分类。

    Returns:
        {"grade": 1|2|3, "reason": str} 或 None（调用失败/解析失败时）
    """
    if not config.MOONSHOT_API_KEY:
        logger.warning("MOONSHOT_API_KEY 未配置，跳过 AI 分类")
        return None

    # 正文截断控成本
    content = (content or "")[: config.AI_CONTENT_MAX_CHARS]
    user_msg = f"【标题】{title}\n【信源类型】{source_type}\n【正文】{content}"

    client = _build_client()
    try:
        resp = await client.chat.completions.create(
            model=config.MOONSHOT_MODEL,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            response_format={"type": "json_object"},
            temperature=0.0,
            max_tokens=120,
        )
        text_out = resp.choices[0].message.content or ""
    except Exception as e:
        logger.warning(f"Kimi 分类调用失败: {e}")
        return None

    return _parse_grade(text_out)


def _parse_grade(text: str) -> dict | None:
    """从模型输出解析 grade + reason，优先 JSON，失败则正则兜底"""
    # 1) 尝试直接 JSON 解析
    try:
        data = json.loads(text)
        grade = int(data.get("grade"))
        if grade in (1, 2, 3):
            return {"grade": grade, "reason": str(data.get("reason", ""))[:100]}
    except (json.JSONDecodeError, ValueError, TypeError):
        pass

    # 2) 正则提取 JSON 片段
    m = _JSON_RE.search(text)
    if m:
        try:
            data = json.loads(m.group())
            grade = int(data.get("grade"))
            if grade in (1, 2, 3):
                return {"grade": grade, "reason": str(data.get("reason", ""))[:100]}
        except (json.JSONDecodeError, ValueError, TypeError):
            pass

    # 3) 仅提取 grade 数字
    m = _GRADE_RE.search(text)
    if m:
        grade = int(m.group(1))
        if grade in (1, 2, 3):
            return {"grade": grade, "reason": ""}

    logger.warning(f"无法解析 Kimi 分类输出: {text[:120]}")
    return None


async def _grade_one(sem: asyncio.Semaphore, opp: Opportunity) -> None:
    """对单条记录评分并写回（带并发信号量）"""
    async with sem:
        result = await grade_item(opp.title, opp.content or "", opp.source_type)
        if result:
            opp.grade = result["grade"]
            opp.grade_reason = result["reason"]


async def grade_pending(limit: int = 50) -> int:
    """对所有 grade 为 NULL 的记录进行三档分类。

    扫全表 grade IS NULL（查询廉价），首个运行的爬虫处理全部待评，后续空扫。
    避免传递 ID 的耦合。

    Returns:
        成功评分的记录数
    """
    if not config.MOONSHOT_API_KEY:
        logger.warning("MOONSHOT_API_KEY 未配置，跳过 AI 分类")
        return 0

    with SessionLocal() as session:
        pending = (
            session.query(Opportunity)
            .filter(Opportunity.grade.is_(None))
            .limit(limit)
            .all()
        )
        if not pending:
            return 0

        logger.info(f"AI 分类待评 {len(pending)} 条")
        sem = asyncio.Semaphore(config.AI_CONCURRENCY)
        await asyncio.gather(*[_grade_one(sem, o) for o in pending])
        session.commit()

        graded = sum(1 for o in pending if o.grade is not None)
        logger.info(f"AI 分类完成：成功 {graded}/{len(pending)}")
        return graded
