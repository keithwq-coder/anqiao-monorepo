"""返利抵扣额度：下单时冲抵应付额（AC-005）。

依据：项目约束事实 15（返利=货款抵扣，无现金提现）、SPEC-0001 R-007、TASK-0006 契约。
"""


class CreditValidationError(ValueError):
    """非法金额。"""


def apply_credit(payable: float, credit_balance: float) -> tuple[float, float, float]:
    """计算抵扣后的微信实付。

    返回 `(wechat_pay, credit_used, remaining)`：
    - `credit_used = min(credit_balance, payable)`
    - `wechat_pay = payable - credit_used`（全抵扣为 0）
    - `remaining = credit_balance - credit_used`
    """
    if payable < 0 or credit_balance < 0:
        raise CreditValidationError("amounts must be non-negative")
    credit_used = min(credit_balance, payable)
    wechat_pay = payable - credit_used
    remaining = credit_balance - credit_used
    return (
        round(wechat_pay, 2),
        round(credit_used, 2),
        round(remaining, 2),
    )
