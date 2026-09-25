"""商机 CRUD API + 页面路由"""

from datetime import date

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import HTMLResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from db.models import Opportunity
from db.session import get_session
from web.templates_config import render_template

router = APIRouter()


# ── 页面路由 ──


@router.get("/", response_class=HTMLResponse)
async def index(
    request: Request,
    source_type: str = Query(default=""),
    region: str = Query(default=""),
    min_score: int = Query(default=0),
    grade: int = Query(default=0),
    show_all: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=5, le=100),
    db: Session = Depends(get_session),
):
    """商机列表页（默认隐藏三档不合格，show_all=1 可见全部）"""
    query = db.query(Opportunity)

    # 默认隐藏三档（不合格）；show_all=1 时显示全部
    if not show_all:
        query = query.filter((Opportunity.grade != 3) | (Opportunity.grade.is_(None)))

    # 筛选
    if source_type:
        query = query.filter(Opportunity.source_type == source_type)
    if region:
        query = query.filter(Opportunity.region.contains(region))
    if min_score:
        query = query.filter(Opportunity.relevance_score >= min_score)
    if grade == -1:
        # -1 = 未分类（grade IS NULL）
        query = query.filter(Opportunity.grade.is_(None))
    elif grade:
        query = query.filter(Opportunity.grade == grade)

    # 统计
    total = query.count()

    # 排序 & 分页
    items = (
        query.order_by(Opportunity.crawl_time.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    # 各类型数量
    type_counts_raw = db.query(Opportunity.source_type, func.count(Opportunity.id)).group_by(Opportunity.source_type).all()
    type_counts = {str(k): v for k, v in type_counts_raw}

    # 各档位数量
    grade_counts_raw = db.query(Opportunity.grade, func.count(Opportunity.id)).group_by(Opportunity.grade).all()
    grade_counts = {(str(k) if k is not None else "未分类"): v for k, v in grade_counts_raw}

    # 评分选项
    score_options = list(range(1, 11))

    html = render_template("index.html",
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, (total + page_size - 1) // page_size),
        source_type=source_type,
        region=region,
        min_score=min_score,
        grade=grade,
        show_all=show_all,
        type_counts=type_counts,
        grade_counts=grade_counts,
        score_options=score_options,
    )
    return HTMLResponse(content=html)


@router.get("/detail/{item_id}", response_class=HTMLResponse)
async def detail(
    request: Request,
    item_id: int,
    db: Session = Depends(get_session),
):
    """商机详情页"""
    item = db.query(Opportunity).filter(Opportunity.id == item_id).first()
    if not item:
        return HTMLResponse("<h1>未找到该商机</h1>", status_code=404)

    html = render_template("detail.html", item=item)
    return HTMLResponse(content=html)


# ── JSON API ──


@router.get("/api/opportunities")
async def list_opportunities(
    source_type: str = Query(default=""),
    region: str = Query(default=""),
    min_score: int = Query(default=0),
    grade: int = Query(default=0),
    show_all: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=5, le=100),
    db: Session = Depends(get_session),
):
    """商机列表 JSON API（默认隐藏三档不合格）"""
    query = db.query(Opportunity)
    if not show_all:
        query = query.filter((Opportunity.grade != 3) | (Opportunity.grade.is_(None)))
    if source_type:
        query = query.filter(Opportunity.source_type == source_type)
    if region:
        query = query.filter(Opportunity.region.contains(region))
    if min_score:
        query = query.filter(Opportunity.relevance_score >= min_score)
    if grade == -1:
        query = query.filter(Opportunity.grade.is_(None))
    elif grade:
        query = query.filter(Opportunity.grade == grade)

    total = query.count()
    items = (
        query.order_by(Opportunity.crawl_time.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [
            {
                "id": o.id,
                "title": o.title,
                "source_type": o.source_type,
                "source_site": o.source_site,
                "source_url": o.source_url,
                "publish_date": str(o.publish_date) if o.publish_date else None,
                "region": o.region,
                "amount": o.amount,
                "deadline": str(o.deadline) if o.deadline else None,
                "summary": o.summary,
                "relevance_score": o.relevance_score,
                "grade": o.grade,
                "grade_reason": o.grade_reason,
                "status": o.status,
                "purchaser": o.purchaser,
            }
            for o in items
        ],
    }


@router.patch("/api/opportunities/{item_id}/status")
async def update_status(
    item_id: int,
    status: str = Query(...),
    db: Session = Depends(get_session),
):
    """更新商机状态"""
    item = db.query(Opportunity).filter(Opportunity.id == item_id).first()
    if not item:
        return {"error": "未找到"}, 404
    if status not in ("新发现", "已跟进", "已关闭"):
        return {"error": "无效状态"}, 400
    item.status = status
    db.commit()
    return {"ok": True, "status": status}
