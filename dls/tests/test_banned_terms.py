"""TASK-0006 合规禁用词扫描测试（AC-006）。

契约来源：docs/tasks/active/TASK-0006-credit-registration-banned.md
（引用项目约束事实 13：严禁 医疗级/诊断/治疗/医疗器械(产品级)）。
terms 由调用方传入（来自 banned_term 配置），代码不硬编码。
"""

from channel.application.banned_terms import scan_banned

TERMS = ["医疗级", "诊断", "治疗", "医疗器械(产品级)"]


def test_hit_single_term() -> None:
    assert scan_banned("本产品医疗级精准", TERMS) == ["医疗级"]


def test_no_hit_compliant_phrase() -> None:
    assert scan_banned("精准健康监测", TERMS) == []


def test_multiple_hits_ordered() -> None:
    assert scan_banned("医疗级诊断治疗", TERMS) == ["医疗级", "诊断", "治疗"]


def test_empty_text() -> None:
    assert scan_banned("", TERMS) == []


def test_empty_terms() -> None:
    assert scan_banned("医疗级", []) == []


def test_substring_not_misreported() -> None:
    """'医疗器械(产品级)' 只在其字面出现时命中，不因包含'器械'而误报。"""
    assert scan_banned("器械清单", TERMS) == []
