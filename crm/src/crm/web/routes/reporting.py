"""SPEC-0016 v0.1.0: reporting API routes."""

from io import BytesIO
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from crm.domain.models import Role, UserStatus
from crm.web.deps import get_current_user

router = APIRouter(prefix="/api/reporting", tags=["reporting"])


def _require_reporting_access(user: dict) -> frozenset[Role]:
    """R-011: only administrator and shareholder may access reports."""
    if user.get("status") != UserStatus.ENABLED.value:
        raise HTTPException(status_code=403, detail="Account not enabled")
    roles = frozenset(user.get("roles") or [])
    if Role.ADMINISTRATOR not in roles and Role.SHAREHOLDER not in roles:
        raise HTTPException(status_code=403, detail="Reporting requires administrator or shareholder role")
    return roles


def _get_institutions(request: Request) -> list:
    """Fetch all non-archived institutions the caller is authorized to see."""
    insts = request.app.state.institution_repository.find_active_for_duplicate_check()
    return insts


def _get_users(request: Request) -> dict:
    """Fetch user id->{username, display_name} map."""
    from crm.persistence.database import SessionLocal
    from crm.persistence.models import UserIdentityModel
    import sqlalchemy as sa

    users = {}
    with SessionLocal() as session:
        rows = session.execute(
            sa.select(UserIdentityModel.id, UserIdentityModel.username, UserIdentityModel.display_name)
        ).all()
        for row in rows:
            users[str(row[0])] = {"username": row[1], "display_name": row[2]}
    return users


@router.get("/customer-stats")
async def customer_stats(
    request: Request,
    time_range_days: int | None = Query(None, ge=1, le=365),
    current_user: dict = Depends(get_current_user),
):
    _require_reporting_access(current_user)
    from crm.application.reporting import customer_stats as _customer_stats
    insts = _get_institutions(request)
    return _customer_stats(insts, time_range_days=time_range_days)


@router.get("/sales-performance")
async def sales_performance(
    request: Request,
    by: str = Query("owner", pattern="^(owner|custodian)$"),
    time_range_days: int | None = Query(None, ge=1, le=365),
    current_user: dict = Depends(get_current_user),
):
    _require_reporting_access(current_user)
    from crm.application.reporting import sales_performance as _sales_perf
    insts = _get_institutions(request)
    users = _get_users(request)
    return _sales_perf(insts, users, by_owner=(by == "owner"), time_range_days=time_range_days)


@router.get("/followup-stats")
async def followup_stats(
    request: Request,
    time_range_days: int | None = Query(None, ge=1, le=365),
    current_user: dict = Depends(get_current_user),
):
    _require_reporting_access(current_user)
    from crm.application.reporting import followup_stats as _fup_stats
    from crm.persistence.database import SessionLocal
    from crm.persistence.models import FollowUpActivityModel as ActivityModel
    import sqlalchemy as sa

    with SessionLocal() as session:
        activities = session.execute(
            sa.select(ActivityModel).where(ActivityModel.withdrawn_at.is_(None))
        ).scalars().all()
        return _fup_stats(list(activities), time_range_days=time_range_days)


@router.get("/pool-stats")
async def pool_stats(
    request: Request,
    time_range_days: int | None = Query(None, ge=1, le=365),
    current_user: dict = Depends(get_current_user),
):
    _require_reporting_access(current_user)
    from crm.application.reporting import pool_stats as _pool_stats
    insts = _get_institutions(request)
    return _pool_stats(insts, time_range_days=time_range_days)


@router.get("/export")
async def export_report(
    request: Request,
    report: str = Query(..., pattern="^(customer-stats|sales-performance|followup-stats|pool-stats)$"),
    by: str = Query("owner", pattern="^(owner|custodian)$"),
    time_range_days: int | None = Query(None, ge=1, le=365),
    current_user: dict = Depends(get_current_user),
):
    """Export a report as .xlsx (R-008)."""
    _require_reporting_access(current_user)

    from crm.application.reporting import (
        customer_stats as _customer_stats,
        sales_performance as _sales_perf,
        followup_stats as _fup_stats,
        pool_stats as _pool_stats,
    )
    from crm.persistence.database import SessionLocal
    from crm.persistence.models import FollowUpActivityModel as ActivityModel
    import sqlalchemy as sa

    try:
        import openpyxl
    except ImportError:
        raise HTTPException(status_code=500, detail="Excel export library not available (openpyxl)")

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = report

    insts = _get_institutions(request)
    users = _get_users(request)

    if report == "customer-stats":
        data = _customer_stats(insts, time_range_days=time_range_days)
        ws.append(["指标", "值"])
        ws.append(["客户总数", data["total"]])
        ws.append(["公池数", data["in_pool"]])
        ws.append(["新增数", data["new_count"]])
        ws.append([])
        ws.append(["按类型分布"])
        for k, v in data["by_type"].items():
            ws.append([k, v])
        ws.append([])
        ws.append(["按地区分布"])
        for k, v in data["by_region"].items():
            ws.append([k, v])

    elif report == "sales-performance":
        data = _sales_perf(insts, users, by_owner=(by == "owner"), time_range_days=time_range_days)
        ws.append(["用户", "客户数", "新增数", "金额合计(元)"])
        for row in data:
            ws.append([
                row["username"],
                row["customer_count"],
                row["new_count"],
                row["amount_total"] if row["has_amount"] else "—",
            ])

    elif report == "followup-stats":
        with SessionLocal() as session:
            activities = session.execute(
                sa.select(ActivityModel).where(ActivityModel.withdrawn_at.is_(None))
            ).scalars().all()
            data = _fup_stats(list(activities), time_range_days=time_range_days)
        ws.append(["跟进总数", data["total"]])
        ws.append([])
        ws.append(["按方式分布"])
        for k, v in data["by_method"].items():
            ws.append([k, v])

    elif report == "pool-stats":
        data = _pool_stats(insts, time_range_days=time_range_days)
        ws.append(["公池总数", data["total"]])
        ws.append(["新增入池", data["new_count"]])
        ws.append([])
        ws.append(["按类型分布"])
        for k, v in data["by_type"].items():
            ws.append([k, v])
        ws.append([])
        ws.append(["按地区分布"])
        for k, v in data["by_region"].items():
            ws.append([k, v])

    output = BytesIO()
    wb.save(output)
    output.seek(0)

    filename = f"{report}-{datetime.now().strftime('%Y%m%d')}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )