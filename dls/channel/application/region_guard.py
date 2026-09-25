"""区域互斥校验：同地级市内 地级市代理与区县代理互斥。

依据：项目约束事实 12（手册 v3 第十三条）、SPEC-0001 R-006、TASK-0003 契约。
"""

from dataclasses import dataclass


class RegionValidationError(ValueError):
    """区域非法。"""


@dataclass(frozen=True, slots=True)
class Region:
    city_code: str
    district_code: str = ""

    def __post_init__(self) -> None:
        city = self.city_code.strip()
        district = self.district_code.strip()
        if not city:
            raise RegionValidationError("city_code is required")
        object.__setattr__(self, "city_code", city)
        object.__setattr__(self, "district_code", district)


def check_region_conflict(existing_regions: set[Region], candidate: Region) -> bool:
    """候选区域与既有代理是否冲突。

    - 候选为地级市：同市任何既有代理（地级市或区县）都冲突；
    - 候选为区县：仅同市既有地级市代理冲突；同市其他区县、异市均不冲突。
    """
    if candidate.district_code == "":
        return any(region.city_code == candidate.city_code for region in existing_regions)
    return any(
        region.city_code == candidate.city_code and region.district_code == ""
        for region in existing_regions
    )
