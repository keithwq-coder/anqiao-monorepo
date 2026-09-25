"""TASK-0002 返利引擎金样本测试（TDD：先红后绿）。

金样本来源：docs/tasks/active/TASK-0002-rebate-engine-tdd.md（引用项目约束事实 4/5）。
"""

import pytest

from channel.application.rebate_calculator import (
    RebateInput,
    RebateLine,
    RebateResult,
    calculate_rebate,
)

AGENT_RATES = dict(
    role="agent",
    quarter_rate=0.03,
    annual_rate=0.02,
    market_rate=0.01,
    process_rate=0.01,
    cap_rate=0.07,
)
DEALER_RATES = dict(
    role="dealer",
    quarter_rate=0.03,
    annual_rate=0.0,
    market_rate=0.01,
    process_rate=0.0,
    cap_rate=0.04,
)


def _lines(result: RebateResult) -> dict[str, float]:
    return {line.rebate_type: line.amount for line in result.lines}


# ---- 代理 · 区县（承诺 50 万，季度分解 12.5 万）----


def test_scenario_A_all_ok() -> None:
    """A：全达标 → 季度4500 + 秩序1500 + 过程1500 = 7500。"""
    result = calculate_rebate(
        RebateInput(
            **AGENT_RATES,
            annual_commitment=500_000,
            quarter_paid=150_000,
            annual_paid=150_000,
            compliance_ok=True,
            process_ok=True,
            settle_period="quarter",
        )
    )
    assert _lines(result) == {
        "quarter_payment": 4_500,
        "market_order": 1_500,
        "process_metric": 1_500,
    }
    assert result.total == 7_500


def test_scenario_B_not_reaching_plan() -> None:
    """B：回款 10 万 < 分解 12.5 万 → 季度0 + 秩序1000 + 过程1000 = 2000。"""
    result = calculate_rebate(
        RebateInput(
            **AGENT_RATES,
            annual_commitment=500_000,
            quarter_paid=100_000,
            annual_paid=100_000,
            compliance_ok=True,
            process_ok=True,
            settle_period="quarter",
        )
    )
    assert _lines(result) == {
        "quarter_payment": 0,
        "market_order": 1_000,
        "process_metric": 1_000,
    }
    assert result.total == 2_000


def test_scenario_C1_compliance_violation() -> None:
    """C1：窜货 → 市场秩序 0（全扣），季度+过程照算 → 4500 + 0 + 1500 = 6000。"""
    result = calculate_rebate(
        RebateInput(
            **AGENT_RATES,
            annual_commitment=500_000,
            quarter_paid=150_000,
            annual_paid=150_000,
            compliance_ok=False,
            process_ok=True,
            settle_period="quarter",
        )
    )
    assert _lines(result) == {
        "quarter_payment": 4_500,
        "market_order": 0,
        "process_metric": 1_500,
    }
    assert result.total == 6_000


def test_scenario_C2_severe_violation() -> None:
    """C2：情节严重 → 当期全 0。"""
    result = calculate_rebate(
        RebateInput(
            **AGENT_RATES,
            annual_commitment=500_000,
            quarter_paid=150_000,
            annual_paid=150_000,
            compliance_ok=False,
            process_ok=True,
            settle_period="quarter",
            severe_violation=True,
        )
    )
    assert result.total == 0
    assert result.lines == []


def test_scenario_D_annual_achievement() -> None:
    """D：年度结算，全年回款 55 万 ≥ 50 万 → 年度达标 2%×55万 = 11000。"""
    result = calculate_rebate(
        RebateInput(
            **AGENT_RATES,
            annual_commitment=500_000,
            quarter_paid=0,
            annual_paid=550_000,
            compliance_ok=True,
            process_ok=True,
            settle_period="annual",
        )
    )
    assert _lines(result) == {"annual_achievement": 11_000}
    assert result.total == 11_000


# ---- 经销（cap 4%）----


def test_scenario_E_dealer_ok() -> None:
    """E：经销季度回款 20 万 → 季度6000 + 秩序2000 = 8000。"""
    result = calculate_rebate(
        RebateInput(
            **DEALER_RATES,
            annual_commitment=500_000,
            quarter_paid=200_000,
            annual_paid=200_000,
            compliance_ok=True,
            process_ok=True,
            settle_period="quarter",
        )
    )
    assert _lines(result) == {
        "quarter_payment": 6_000,
        "market_order": 2_000,
    }
    assert result.total == 8_000


# ---- 封顶（安全上限）----


def test_cap_not_exceeded() -> None:
    """封顶：total 恒 ≤ cap_rate × 基数（agent 7%、dealer 4%）。"""
    agent = calculate_rebate(
        RebateInput(
            **AGENT_RATES,
            annual_commitment=500_000,
            quarter_paid=1_000_000,
            annual_paid=1_000_000,
            compliance_ok=True,
            process_ok=True,
            settle_period="quarter",
        )
    )
    assert agent.total <= 0.07 * 1_000_000
    dealer = calculate_rebate(
        RebateInput(
            **DEALER_RATES,
            annual_commitment=500_000,
            quarter_paid=1_000_000,
            annual_paid=1_000_000,
            compliance_ok=True,
            process_ok=True,
            settle_period="quarter",
        )
    )
    assert dealer.total <= 0.04 * 1_000_000


# ---- 契约校验：非法输入拒绝 ----


def test_invalid_role_rejected() -> None:
    with pytest.raises(ValueError):
        RebateInput(
            role="partner",  # 非法角色
            quarter_rate=0.03,
            annual_rate=0.0,
            market_rate=0.0,
            process_rate=0.0,
            cap_rate=0.0,
            annual_commitment=500_000,
            quarter_paid=100_000,
            annual_paid=100_000,
            compliance_ok=True,
            process_ok=True,
            settle_period="quarter",
        )


def test_invalid_settle_period_rejected() -> None:
    with pytest.raises(ValueError):
        RebateInput(
            **AGENT_RATES,
            annual_commitment=500_000,
            quarter_paid=100_000,
            annual_paid=100_000,
            compliance_ok=True,
            process_ok=True,
            settle_period="monthly",  # 非法结算周期
        )
