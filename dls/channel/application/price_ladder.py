"""价盘阶梯查表：数据驱动、禁止自动出价。

依据：项目约束事实 2（月累计 3 档 1380/1280/1180，>1600 面议）、
DEC-0007（规则即数据）、SPEC-0001 R-005、TASK-0003 契约。
"""

from dataclasses import dataclass


class LadderValidationError(ValueError):
    """阶梯配置非法。"""


@dataclass(frozen=True, slots=True)
class LadderBand:
    lower_inclusive: int
    upper_exclusive: int | None
    unit_price: float | None


def _validate_ladder(ladder: tuple[LadderBand, ...] | list[LadderBand]) -> None:
    """校验阶梯：从 0 起、连续无重叠、开放档只能收尾且无单价。"""
    bands = sorted(ladder, key=lambda b: b.lower_inclusive)
    if not bands:
        return  # 空阶梯 = 全部面议（无自动价，安全）
    if bands[0].lower_inclusive != 0:
        raise LadderValidationError("ladder must start at quantity 0")
    for index, band in enumerate(bands):
        if band.lower_inclusive < 0:
            raise LadderValidationError("band lower bound must be non-negative")
        if band.upper_exclusive is None:
            if band.unit_price is not None:
                raise LadderValidationError(
                    "open band (negotiable) must not carry a unit price"
                )
            if index != len(bands) - 1:
                raise LadderValidationError("open band (upper=None) must be the last band")
            continue
        if band.unit_price is None:
            raise LadderValidationError("closed band must carry a unit price")
        if band.upper_exclusive <= band.lower_inclusive:
            raise LadderValidationError("band upper bound must exceed lower bound")
        if index + 1 < len(bands):
            nxt = bands[index + 1]
            if nxt.lower_inclusive < band.upper_exclusive:
                raise LadderValidationError("bands must not overlap")
            if nxt.lower_inclusive > band.upper_exclusive:
                raise LadderValidationError("bands must not have gaps")


def lookup_unit_price(
    monthly_qty: int,
    ladder: tuple[LadderBand, ...] | list[LadderBand],
) -> float | None:
    """按月累计采购量查单价；开放档/无匹配返回 None（面议，禁止自动出价）。"""
    if monthly_qty < 0:
        raise LadderValidationError("monthly quantity must be non-negative")
    _validate_ladder(ladder)
    for band in sorted(ladder, key=lambda b: b.lower_inclusive):
        if band.upper_exclusive is None:
            if monthly_qty >= band.lower_inclusive:
                return None  # 面议
            continue
        if band.lower_inclusive <= monthly_qty < band.upper_exclusive:
            return band.unit_price
    return None  # 无匹配 → 面议
