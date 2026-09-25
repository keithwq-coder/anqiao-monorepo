"""TASK-0008 试销期状态机金样本测试（TDD：先红后绿）。

契约来源：docs/tasks/active/TASK-0008-lifecycle-state-machine.md
（引用项目约束事实 9、手册 v3 第十八条；SPEC-0002 R-006 / R-008 / AC-002）。
"""

import pytest

from channel.application.lifecycle import (
    LifecycleEvent,
    LifecycleState,
    LifecycleTransitionError,
    region_protection_active,
    transition,
)


# ---- 金样本 1~7：正向迁移 ----

def test_intention_submit_reviewing() -> None:
    """意向 → submit → 资质审核中。"""
    assert transition(LifecycleState.INTENTION, LifecycleEvent.SUBMIT) is LifecycleState.REVIEWING


def test_reviewing_approve_pending_sign() -> None:
    """审核中 → approve → 待签约。"""
    assert transition(LifecycleState.REVIEWING, LifecycleEvent.APPROVE) is LifecycleState.PENDING_SIGN


def test_reviewing_reject_rejected() -> None:
    """审核中 → reject → 已拒绝（终态）。"""
    assert transition(LifecycleState.REVIEWING, LifecycleEvent.REJECT) is LifecycleState.REJECTED


def test_pending_sign_sign_trial() -> None:
    """待签约 → sign → 试销期。"""
    assert transition(LifecycleState.PENDING_SIGN, LifecycleEvent.SIGN) is LifecycleState.TRIAL


def test_trial_expire_both_met_converted() -> None:
    """试销届满 + 首批✓ + 销售✓ → 转正（区域保护激活）。"""
    result = transition(
        LifecycleState.TRIAL,
        LifecycleEvent.TRIAL_EXPIRE,
        has_first_purchase=True,
        has_terminal_sale=True,
    )
    assert result is LifecycleState.CONVERTED
    # R-008：转正 = 区域保护激活
    assert region_protection_active(result) is True


def test_trial_expire_no_first_purchase_dissolved() -> None:
    """试销届满 + 首批✗ → 解除。"""
    assert (
        transition(
            LifecycleState.TRIAL,
            LifecycleEvent.TRIAL_EXPIRE,
            has_first_purchase=False,
        )
        is LifecycleState.DISSOLVED
    )


def test_trial_expire_no_terminal_sale_dissolved() -> None:
    """试销届满 + 首批✓ 但 销售✗ → 解除。"""
    assert (
        transition(
            LifecycleState.TRIAL,
            LifecycleEvent.TRIAL_EXPIRE,
            has_first_purchase=True,
            has_terminal_sale=False,
        )
        is LifecycleState.DISSOLVED
    )


# ---- 金样本 8~9：错误路径 ----

def test_terminal_state_rejects_any_event() -> None:
    """终态（converted）任何事件 → LifecycleTransitionError。"""
    with pytest.raises(LifecycleTransitionError):
        transition(LifecycleState.CONVERTED, LifecycleEvent.SIGN)


def test_trial_illegal_event_raises() -> None:
    """试销期收到非届满事件（approve）→ 非法迁移报错。"""
    with pytest.raises(LifecycleTransitionError):
        transition(LifecycleState.TRIAL, LifecycleEvent.APPROVE)


# ---- 补充：终态三态 × 全事件（终态不可逆，R-006） ----

@pytest.mark.parametrize("state", [LifecycleState.CONVERTED, LifecycleState.DISSOLVED, LifecycleState.REJECTED])
@pytest.mark.parametrize("event", list(LifecycleEvent))
def test_terminal_states_reject_all_events(state: LifecycleState, event: LifecycleEvent) -> None:
    """converted / dissolved / rejected 为终态，任何事件都报错。"""
    with pytest.raises(LifecycleTransitionError):
        transition(state, event)


# ---- 补充：全状态×全事件穷举（表外组合 = 非法迁移） ----

_VALID_PAIRS: dict[tuple[LifecycleState, LifecycleEvent], list[tuple[tuple[bool, bool], LifecycleState]]] = {
    (LifecycleState.INTENTION, LifecycleEvent.SUBMIT): [((False, False), LifecycleState.REVIEWING)],
    (LifecycleState.REVIEWING, LifecycleEvent.APPROVE): [((False, False), LifecycleState.PENDING_SIGN)],
    (LifecycleState.REVIEWING, LifecycleEvent.REJECT): [((False, False), LifecycleState.REJECTED)],
    (LifecycleState.PENDING_SIGN, LifecycleEvent.SIGN): [((False, False), LifecycleState.TRIAL)],
    (LifecycleState.TRIAL, LifecycleEvent.TRIAL_EXPIRE): [
        ((True, True), LifecycleState.CONVERTED),  # 届满 + 首批✓ + 销售✓ → 转正
        ((False, False), LifecycleState.DISSOLVED),  # 首批✗ → 解除
        ((True, False), LifecycleState.DISSOLVED),  # 销售✗ → 解除
        ((False, True), LifecycleState.DISSOLVED),  # 首批✗ 销售✓ → 解除
    ],
}


@pytest.mark.parametrize("state", list(LifecycleState))
@pytest.mark.parametrize("event", list(LifecycleEvent))
def test_exhaustive_transition_table(state: LifecycleState, event: LifecycleEvent) -> None:
    """穷举校验：转换表内组合按表执行，表外组合一律非法迁移报错。"""
    valid = _VALID_PAIRS.get((state, event))
    if valid is None:
        with pytest.raises(LifecycleTransitionError):
            transition(state, event)
        return
    for (first_purchase, terminal_sale), expected in valid:
        actual = transition(
            state,
            event,
            has_first_purchase=first_purchase,
            has_terminal_sale=terminal_sale,
        )
        assert actual is expected, f"{state}--{event}->{actual}, expected {expected}"


# ---- 补充：字符串值兼容（DB 列存 StrEnum 值） ----

def test_transition_accepts_string_values() -> None:
    """transition 接受字符串值（与 DB 枚举值一致），结果同为枚举成员。"""
    assert transition("intention", "submit") is LifecycleState.REVIEWING
    assert transition("trial", "trial_expire", has_first_purchase=True, has_terminal_sale=True) is LifecycleState.CONVERTED


def test_unknown_state_or_event_raises() -> None:
    """未知状态 / 未知事件 → LifecycleTransitionError。"""
    with pytest.raises(LifecycleTransitionError):
        transition("not_a_state", "submit")
    with pytest.raises(LifecycleTransitionError):
        transition("intention", "not_an_event")


# ---- 补充：R-008 区域保护仅转正激活 ----

def test_region_protection_only_active_when_converted() -> None:
    """区域保护激活条件：仅 converted（R-008）。"""
    for state in LifecycleState:
        expected = state is LifecycleState.CONVERTED
        assert region_protection_active(state) is expected, state


# ---- 补充：应用层枚举 ↔ DB 层枚举无漂移（TASK-0007 已定 LifecycleStatus） ----

def test_state_enum_matches_persistence_enum() -> None:
    """channel.application.lifecycle.LifecycleState 与 models.LifecycleStatus 名称+值一致，防双定义漂移。"""
    from channel.persistence.models import LifecycleStatus

    app_members = {member.name: member.value for member in LifecycleState}
    db_members = {member.name: member.value for member in LifecycleStatus}
    assert app_members == db_members
