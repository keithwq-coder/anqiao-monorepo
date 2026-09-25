"""SPEC-0016 v0.1.0: reporting service — aggregation queries.

All aggregations use only records the caller is authorized to see (R-005).
Each public method receives a ``project_record``-ready subject and the
raw institution records already filtered by policy.
"""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone
from uuid import UUID


def customer_stats(
    institutions: list,
    time_range_days: int | None = None,
) -> dict:
    """R-001: aggregate customer counts by type, region, source category."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=time_range_days) if time_range_days else None

    filtered = institutions
    if cutoff is not None:
        filtered = [i for i in institutions if i.created_at >= cutoff]

    by_type = Counter(i.customer_type.value if hasattr(i.customer_type, 'value') else str(i.customer_type) for i in filtered)
    by_region = Counter(i.region or "未标注" for i in filtered)
    by_source = Counter(i.source_kind or "未标注" for i in filtered)
    pool_count = sum(1 for i in filtered if getattr(i, 'in_pool', False))
    new_count = sum(1 for i in filtered if cutoff and i.created_at >= cutoff)

    return {
        "total": len(filtered),
        "in_pool": pool_count,
        "new_count": new_count if cutoff else 0,
        "by_type": dict(by_type.most_common()),
        "by_region": dict(by_region.most_common()),
        "by_source": dict(by_source.most_common()),
    }


def sales_performance(
    institutions: list,
    users: dict,  # user_id -> {username, display_name}
    by_owner: bool = True,
    time_range_days: int | None = None,
) -> list[dict]:
    """R-002: aggregate by owner or custodian with counts and amount totals."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=time_range_days) if time_range_days else None

    filtered = institutions
    if cutoff is not None:
        filtered = [i for i in institutions if i.created_at >= cutoff]

    key_attr = "owner_user_id" if by_owner else "custodian_user_id"
    groups: dict[str, dict] = {}

    for inst in filtered:
        uid = getattr(inst, key_attr, None)
        if uid is None:
            continue
        uid_str = str(uid)
        if uid_str not in groups:
            uinfo = users.get(uid_str, {})
            groups[uid_str] = {
                "user_id": uid_str,
                "username": uinfo.get("username", uid_str[:8]),
                "display_name": uinfo.get("display_name", ""),
                "customer_count": 0,
                "new_count": 0,
                "amount_total": 0.0,
                "has_amount": False,
            }
        g = groups[uid_str]
        g["customer_count"] += 1
        if cutoff and inst.created_at >= cutoff:
            g["new_count"] += 1
        amt = getattr(inst, "amount", None)
        if amt is not None:
            g["amount_total"] += float(amt)
            g["has_amount"] = True

    result = sorted(groups.values(), key=lambda x: x["customer_count"], reverse=True)
    return result


def followup_stats(
    activities: list,
    time_range_days: int | None = None,
) -> dict:
    """R-003: aggregate follow-up counts by method, person, month."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=time_range_days) if time_range_days else None

    filtered = activities
    if cutoff is not None:
        filtered = [a for a in activities if a.occurred_at >= cutoff]

    by_method = Counter(
        (getattr(a, "interaction_method", None) or "其他")
        for a in filtered
    )
    total = len(filtered)

    return {
        "total": total,
        "by_method": dict(by_method.most_common()),
        "time_range_days": time_range_days,
    }


def pool_stats(
    institutions: list,
    time_range_days: int | None = None,
) -> dict:
    """R-004: pool dynamics — counts by type/region, claim/release records."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=time_range_days) if time_range_days else None

    pool_items = [i for i in institutions if getattr(i, 'in_pool', False)]
    new_pool = pool_items
    if cutoff is not None:
        new_pool = [i for i in pool_items if i.created_at >= cutoff]

    by_type = Counter(
        i.customer_type.value if hasattr(i.customer_type, 'value') else str(i.customer_type)
        for i in pool_items
    )
    by_region = Counter(i.region or "未标注" for i in pool_items)

    return {
        "total": len(pool_items),
        "new_count": len(new_pool),
        "by_type": dict(by_type.most_common()),
        "by_region": dict(by_region.most_common()),
    }