"""试销期生命周期状态机（纯函数）。

依据：项目约束事实 9（手册 v3 第十八条：试销期 3 个月，转正 = 完成首批进货 + 启动终端销售）、
SPEC-0002 R-006 / R-008、TASK-0008 契约。

- 无副作用纯函数：不接受时钟/DB/IO；外部信号（首批进货完成 / 启动终端销售 / 试销期届满）
  由订单域（SPEC-0003）提供，本模块不实现订单逻辑（SPEC-0002 技术要点）。
- 试销期届满（trial_expire）时才可能离开 trial 态；届满前不发送该事件即状态不变（"未届满 → 不变"）。
- 转正（converted）= 区域保护激活：region_protection_active 仅对 converted 返回 True（R-008）。
"""

from enum import StrEnum


class LifecycleTransitionError(ValueError):
    """非法生命周期迁移：终态收事件 / 表外组合 / 未知状态或事件。"""


class LifecycleState(StrEnum):
    """代理商生命周期状态（与 channel.persistence.models.LifecycleStatus 名称+值对齐）。"""

    INTENTION = "intention"
    REVIEWING = "reviewing"
    PENDING_SIGN = "pending_sign"
    TRIAL = "trial"
    CONVERTED = "converted"
    DISSOLVED = "dissolved"
    REJECTED = "rejected"


class LifecycleEvent(StrEnum):
    """生命周期事件。"""

    SUBMIT = "submit"
    APPROVE = "approve"
    REJECT = "reject"
    SIGN = "sign"
    TRIAL_EXPIRE = "trial_expire"


_TERMINAL_STATES = frozenset(
    {LifecycleState.CONVERTED, LifecycleState.DISSOLVED, LifecycleState.REJECTED}
)

# 转换表（TASK-0008 契约，禁止自创）；trial_expire 分支单独处理（见 transition）。
_TRANSITION_TABLE: dict[tuple[LifecycleState, LifecycleEvent], LifecycleState] = {
    (LifecycleState.INTENTION, LifecycleEvent.SUBMIT): LifecycleState.REVIEWING,
    (LifecycleState.REVIEWING, LifecycleEvent.APPROVE): LifecycleState.PENDING_SIGN,
    (LifecycleState.REVIEWING, LifecycleEvent.REJECT): LifecycleState.REJECTED,
    (LifecycleState.PENDING_SIGN, LifecycleEvent.SIGN): LifecycleState.TRIAL,
}


def _coerce_state(value: LifecycleState | str) -> LifecycleState:
    """接受枚举成员或字符串值（DB 列存 StrEnum 值）。"""
    if isinstance(value, LifecycleState):
        return value
    try:
        return LifecycleState(value)
    except ValueError:
        raise LifecycleTransitionError(f"unknown lifecycle state: {value!r}") from None


def _coerce_event(value: LifecycleEvent | str) -> LifecycleEvent:
    if isinstance(value, LifecycleEvent):
        return value
    try:
        return LifecycleEvent(value)
    except ValueError:
        raise LifecycleTransitionError(f"unknown lifecycle event: {value!r}") from None


def transition(
    state: LifecycleState | str,
    event: LifecycleEvent | str,
    *,
    has_first_purchase: bool = False,
    has_terminal_sale: bool = False,
) -> LifecycleState:
    """执行一次生命周期迁移，返回次态。

    规则（TASK-0008 契约）：
    - intention --submit--> reviewing
    - reviewing --approve--> pending_sign；--reject--> rejected
    - pending_sign --sign--> trial
    - trial --trial_expire-->（首批✓ 且 销售✓）converted，否则 dissolved
    - converted / dissolved / rejected 为终态，任何事件 → LifecycleTransitionError
    - 表外组合（非法迁移）→ LifecycleTransitionError
    """
    state = _coerce_state(state)
    event = _coerce_event(event)

    if state in _TERMINAL_STATES:
        raise LifecycleTransitionError(
            f"terminal state {state.value!r} accepts no events (got {event.value!r})"
        )

    if state is LifecycleState.TRIAL and event is LifecycleEvent.TRIAL_EXPIRE:
        if has_first_purchase and has_terminal_sale:
            return LifecycleState.CONVERTED
        return LifecycleState.DISSOLVED

    next_state = _TRANSITION_TABLE.get((state, event))
    if next_state is None:
        raise LifecycleTransitionError(
            f"illegal transition: {state.value!r} --{event.value!r}--> ?"
        )
    return next_state


def region_protection_active(state: LifecycleState | str) -> bool:
    """区域保护是否激活（SPEC-0002 R-008：仅转正 converted 才允许占用区域）。"""
    return _coerce_state(state) is LifecycleState.CONVERTED
