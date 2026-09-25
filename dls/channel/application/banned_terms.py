"""合规禁用词扫描（AC-006）。

依据：项目约束事实 13（严禁 医疗级/诊断/治疗/医疗器械(产品级)）、
SPEC-0001 R-008、TASK-0006 契约。terms 由调用方传入（来自 banned_term 配置），代码不硬编码。
"""


def scan_banned(text: str, terms: list[str]) -> list[str]:
    """扫描文本中命中的禁用词，按 terms 顺序返回。"""
    if not text:
        return []
    return [term for term in terms if term and term in text]
