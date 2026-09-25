"""TASK-0003 价盘阶梯金样本测试（TDD：先红后绿）。

契约来源：docs/tasks/active/TASK-0003-price-ladder-region-guard.md
（引用项目约束事实 2：月累计 3 档 1380/1280/1180，>1600 面议）。
阶梯由调用方传入，代码不硬编码（DEC-0007 规则即数据）。
"""

import pytest

from channel.application.price_ladder import (
    LadderBand,
    lookup_unit_price,
)

# 0730 口径阶梯（月累计采购量，[下限含, 上限不含, 单价]）
LADDER_0730 = (
    LadderBand(lower_inclusive=0, upper_exclusive=200, unit_price=1380),
    LadderBand(lower_inclusive=200, upper_exclusive=700, unit_price=1280),
    LadderBand(lower_inclusive=700, upper_exclusive=1600, unit_price=1180),
    LadderBand(lower_inclusive=1600, upper_exclusive=None, unit_price=None),  # 面议
)


@pytest.mark.parametrize(
    ("monthly_qty", "expected"),
    [
        (150, 1380),
        (199, 1380),
        (200, 1280),
        (500, 1280),
        (700, 1180),
        (1599, 1180),
        (1600, None),  # 面议
        (1800, None),  # 面议
    ],
)
def test_ladder_lookup(monthly_qty: int, expected: float | None) -> None:
    """价盘阶梯：边界含下限、不含上限；>1600 面议（单价 None）。"""
    assert lookup_unit_price(monthly_qty, LADDER_0730) == expected


def test_ladder_no_auto_price_for_negotiable() -> None:
    """AC-003：面议档禁止自动出价（单价必须为 None，不得回落上一档）。"""
    price = lookup_unit_price(1800, LADDER_0730)
    assert price is None


def test_ladder_negative_qty_rejected() -> None:
    """负采购量 → 校验错误。"""
    with pytest.raises(ValueError):
        lookup_unit_price(-1, LADDER_0730)


def test_ladder_overlapping_bands_rejected() -> None:
    """重叠档位（含相同边界）→ 校验错误，禁止歧义。"""
    bad = (
        LadderBand(0, 200, 1380),
        LadderBand(150, 400, 1280),  # 与上一档重叠
    )
    with pytest.raises(ValueError):
        lookup_unit_price(300, bad)


def test_ladder_gap_rejected() -> None:
    """档位间留空档（如 200~400 缺失）→ 校验错误，禁止漏价。"""
    gapped = (
        LadderBand(0, 200, 1380),
        LadderBand(400, 700, 1280),  # 200~400 无覆盖
    )
    with pytest.raises(ValueError):
        lookup_unit_price(300, gapped)
