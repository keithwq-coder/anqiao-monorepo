"""TASK-0006 返利抵扣额度测试（AC-005）。

契约来源：docs/tasks/active/TASK-0006-credit-registration-banned.md
（引用项目约束事实 15：返利=货款抵扣）。
"""

import pytest

from channel.application.credit import CreditValidationError, apply_credit


def test_ac005_deduct_partial() -> None:
    """应付 100,000、可用额度 5,000 → 微信实付 95,000、抵扣 5,000、余额 0。"""
    assert apply_credit(100_000, 5_000) == (95_000, 5_000, 0)


def test_full_credit_deduction() -> None:
    """额度覆盖应付 → 全抵扣，微信实付 0。"""
    assert apply_credit(3_000, 5_000) == (0, 3_000, 2_000)


def test_zero_credit_balance() -> None:
    assert apply_credit(100_000, 0) == (100_000, 0, 0)


def test_exact_balance() -> None:
    assert apply_credit(5_000, 5_000) == (0, 5_000, 0)


def test_negative_rejected() -> None:
    with pytest.raises(CreditValidationError):
        apply_credit(-1, 0)
    with pytest.raises(CreditValidationError):
        apply_credit(100, -5)
