/**
 * 共享终端状态机与快速切人引擎（Shared Terminal FSM）
 * 依据：docs/LTC-WORKBENCH-SPEC.md §12.3
 */

export function createSharedTerminalFSM(config) {
  const state = {
    terminalId: config.terminalId,
    terminalType: config.terminalType || 'care_desk',
    wardOrArea: config.wardOrArea || '',
    roster: Array.isArray(config.roster) ? [...config.roster] : [],
    activeOperator: null,
    autoReturnCountdown: 30,
    preemptAlarm: null,
    stashedWorkState: null,
  }

  function getState() {
    return {
      terminalId: state.terminalId,
      terminalType: state.terminalType,
      wardOrArea: state.wardOrArea,
      roster: [...state.roster],
      activeOperator: state.activeOperator ? { ...state.activeOperator } : null,
      autoReturnCountdown: state.autoReturnCountdown,
      preemptAlarm: state.preemptAlarm ? { ...state.preemptAlarm } : null,
      stashedWorkState: state.stashedWorkState ? JSON.parse(JSON.stringify(state.stashedWorkState)) : null,
    }
  }

  function switchOperator(operatorId) {
    const op = state.roster.find((r) => r.id === operatorId)
    if (!op) {
      throw new Error(`OPERATOR_NOT_FOUND: 当班人员池中未找到工号为 ${operatorId} 的人员`)
    }
    state.activeOperator = { ...op }
    state.autoReturnCountdown = 30
    return getState()
  }

  function touch() {
    if (state.activeOperator) {
      state.autoReturnCountdown = 30
    }
    return getState()
  }

  function tick(seconds = 1) {
    if (state.activeOperator) {
      state.autoReturnCountdown = Math.max(0, state.autoReturnCountdown - seconds)
      if (state.autoReturnCountdown === 0) {
        state.activeOperator = null
        state.autoReturnCountdown = 30
      }
    }
    return getState()
  }

  function createDualSignedAction(action, payload) {
    if (!state.activeOperator) {
      throw new Error('OPERATOR_REQUIRED: 共享终端必须在当班作业员切入后方可执行临床签名动作')
    }
    return {
      terminal_id: state.terminalId,
      operator_id: state.activeOperator.id,
      operator_name: state.activeOperator.name,
      action,
      timestamp: new Date().toISOString(),
      payload,
    }
  }

  function triggerEmergency(alarm, workStateToStash = null) {
    state.preemptAlarm = { ...alarm }
    if (workStateToStash !== null && workStateToStash !== undefined) {
      state.stashedWorkState = JSON.parse(JSON.stringify(workStateToStash))
    }
    return getState()
  }

  function resolveEmergency(alertId) {
    if (state.preemptAlarm && state.preemptAlarm.alertId === alertId) {
      state.preemptAlarm = null
    }
    const stashed = state.stashedWorkState
    state.stashedWorkState = null
    touch()
    return stashed
  }

  return {
    getState,
    switchOperator,
    touch,
    tick,
    createDualSignedAction,
    triggerEmergency,
    resolveEmergency,
  }
}
