"""TASK-0003 区域互斥金样本测试（TDD：先红后绿）。

契约来源：docs/tasks/active/TASK-0003-price-ladder-region-guard.md
（引用项目约束事实 12：同地级市 地级市代理与区县代理互斥）。
"""

from channel.application.region_guard import (
    Region,
    check_region_conflict,
)


def test_city_blocks_district_same_city() -> None:
    """已有地级市(city X) + 候选区县(X, A) → 冲突。"""
    existing = {Region(city_code="X", district_code="")}
    candidate = Region(city_code="X", district_code="A")
    assert check_region_conflict(existing, candidate) is True


def test_district_blocks_city_same_city() -> None:
    """已有区县(X, A) + 候选地级市(X) → 冲突。"""
    existing = {Region(city_code="X", district_code="A")}
    candidate = Region(city_code="X", district_code="")
    assert check_region_conflict(existing, candidate) is True


def test_district_allows_sibling_district() -> None:
    """已有区县(X, A) + 候选区县(X, B) → 不冲突（同市异区）。"""
    existing = {Region(city_code="X", district_code="A")}
    candidate = Region(city_code="X", district_code="B")
    assert check_region_conflict(existing, candidate) is False


def test_district_allows_other_city() -> None:
    """已有区县(X, A) + 候选区县(Y, A) → 不冲突（异市）。"""
    existing = {Region(city_code="X", district_code="A")}
    candidate = Region(city_code="Y", district_code="A")
    assert check_region_conflict(existing, candidate) is False


def test_empty_existing_no_conflict() -> None:
    """无既有代理 → 任何候选都不冲突。"""
    assert check_region_conflict(set(), Region(city_code="X", district_code="A")) is False
    assert check_region_conflict(set(), Region(city_code="X", district_code="")) is False


def test_multiple_districts_city_still_blocks() -> None:
    """多区县已签，候选地级市仍冲突。"""
    existing = {
        Region(city_code="X", district_code="A"),
        Region(city_code="X", district_code="B"),
    }
    candidate = Region(city_code="X", district_code="")
    assert check_region_conflict(existing, candidate) is True
