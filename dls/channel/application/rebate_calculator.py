"""返利引擎：无副作用纯函数。

依据：项目约束.md 事实 4/5（返利基数=实际回款额、代理 7%/经销 4%）、
SPEC-0001 R-003/R-004、TASK-0002 契约（金样本见 tests/test_rebate_calculator.py）。
"""

from dataclasses import dataclass

VALID_ROLES = frozenset({"agent", "dealer"})
VALID_PERIODS = frozenset({"quarter", "annual"})

# 各结算周期的返利行类型（类型名 → 比例字段名）
QUARTER_LINES = (
    ("quarter_payment", "quarter_rate"),
    ("market_order", "market_rate"),
    ("process_metric", "process_rate"),
)
ANNUAL_LINES = (("annual_achievement", "annual_rate"),)


class RebateValidationError(ValueError):
    """非法输入。"""


@dataclass(frozen=True, slots=True)
class RebateInput:
    role: str
    quarter_rate: float
    annual_rate: float
    market_rate: float
    process_rate: float
    cap_rate: float
    annual_commitment: float
    quarter_paid: float
    annual_paid: float
    compliance_ok: bool
    process_ok: bool
    settle_period: str
    severe_violation: bool = False

    def __post_init__(self) -> None:
        if self.role not in VALID_ROLES:
            raise RebateValidationError(f"role must be one of {sorted(VALID_ROLES)}")
        if self.settle_period not in VALID_PERIODS:
            raise RebateValidationError(
                f"settle_period must be one of {sorted(VALID_PERIODS)}"
            )
        rates = (
            self.quarter_rate,
            self.annual_rate,
            self.market_rate,
            self.process_rate,
            self.cap_rate,
        )
        if any(rate < 0 for rate in rates):
            raise RebateValidationError("rates must be non-negative")
        amounts = (self.annual_commitment, self.quarter_paid, self.annual_paid)
        if any(amount < 0 for amount in amounts):
            raise RebateValidationError("amounts must be non-negative")


@dataclass(frozen=True, slots=True)
class RebateLine:
    rebate_type: str
    amount: float


@dataclass(frozen=True, slots=True)
class RebateResult:
    lines: list[RebateLine]
    total: float


def _round2(value: float) -> float:
    """金额四舍五入到分（钱的计算不允许浮点尘埃）。"""
    return round(value, 2)


def calculate_rebate(inp: RebateInput) -> RebateResult:
    """计算返利明细与封顶后总额。无副作用。

    规则（TASK-0002 契约，禁止自创）：
    - severe_violation → 当期全 0；
    - 季度结算：季度回款(达分解) / 市场秩序(合规) / 过程指标(达标)；
    - 年度结算：年度达标(达承诺)；
    - 行类型仅在其比例 > 0 时输出；
    - total = min(明细和, cap_rate × 基数)。
    """
    if inp.severe_violation:
        return RebateResult(lines=[], total=0.0)

    if inp.settle_period == "quarter":
        quarter_plan = inp.annual_commitment / 4
        amounts = {
            "quarter_payment": (
                inp.quarter_rate * inp.quarter_paid
                if inp.quarter_paid >= quarter_plan
                else 0.0
            ),
            "market_order": (
                inp.market_rate * inp.quarter_paid if inp.compliance_ok else 0.0
            ),
            "process_metric": (
                inp.process_rate * inp.quarter_paid if inp.process_ok else 0.0
            ),
        }
        line_specs = QUARTER_LINES
        base = inp.quarter_paid
    else:  # annual
        amounts = {
            "annual_achievement": (
                inp.annual_rate * inp.annual_paid
                if inp.annual_paid >= inp.annual_commitment
                else 0.0
            ),
        }
        line_specs = ANNUAL_LINES
        base = inp.annual_paid

    lines = [
        RebateLine(rebate_type=name, amount=_round2(amounts[name]))
        for name, rate_field in line_specs
        if getattr(inp, rate_field) > 0
    ]
    total = _round2(sum(line.amount for line in lines))
    capped = _round2(min(total, inp.cap_rate * base))
    return RebateResult(lines=lines, total=capped)
