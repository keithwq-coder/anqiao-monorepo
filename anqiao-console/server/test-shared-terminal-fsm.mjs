/**
 * TDD 单元测试：共享终端状态机与快速切人引擎（Shared Terminal FSM）
 * 依据：docs/LTC-WORKBENCH-SPEC.md §12.3
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { createSharedTerminalFSM } from './shared-terminal-fsm.js'

test('TDD 1: 共享终端初始状态应为公共全域监护态', () => {
  const fsm = createSharedTerminalFSM({
    terminalId: 'station_4f_01',
    terminalType: 'care_desk',
    wardOrArea: '4F',
    roster: [
      { id: 'kaijian_nurse01', name: '何丽', avatar: '👩‍⚕️', roleTitle: '4F责任护士', bedRange: '401-410', onDuty: true },
      { id: 'kaijian_nurse02', name: '周丽', avatar: '👩‍⚕️', roleTitle: '4F轮值护士', bedRange: '411-420', onDuty: true },
    ],
  })

  const state = fsm.getState()
  assert.equal(state.terminalId, 'station_4f_01')
  assert.equal(state.terminalType, 'care_desk')
  assert.equal(state.wardOrArea, '4F')
  assert.equal(state.activeOperator, null, '初始无特定个人操作员，处于公共监护态')
  assert.equal(state.preemptAlarm, null, '初始无抢占告警')
  assert.equal(state.autoReturnCountdown, 30, '默认自动复位倒计时为 30 秒')
})

test('TDD 2: 当班作业员极速切换（秒切）应立即生效并重置30秒倒计时', () => {
  const fsm = createSharedTerminalFSM({
    terminalId: 'station_4f_01',
    terminalType: 'care_desk',
    wardOrArea: '4F',
    roster: [
      { id: 'kaijian_nurse01', name: '何丽', avatar: '👩‍⚕️', roleTitle: '4F责任护士', bedRange: '401-410', onDuty: true },
    ],
  })

  // 何丽点击自己头像切入
  fsm.switchOperator('kaijian_nurse01')
  let state = fsm.getState()
  assert.ok(state.activeOperator, '应成功切换至作业员')
  assert.equal(state.activeOperator.id, 'kaijian_nurse01')
  assert.equal(state.activeOperator.name, '何丽')
  assert.equal(state.autoReturnCountdown, 30)

  // 模拟经过 10 秒
  fsm.tick(10)
  state = fsm.getState()
  assert.equal(state.autoReturnCountdown, 20)

  // 发生任何交互，重置时钟
  fsm.touch()
  state = fsm.getState()
  assert.equal(state.autoReturnCountdown, 30, '交互动作后应重置为 30 秒')
})

test('TDD 3: 30秒无操作后自动平滑归位至公共大盘态，防止占坑', () => {
  const fsm = createSharedTerminalFSM({
    terminalId: 'station_4f_01',
    terminalType: 'care_desk',
    wardOrArea: '4F',
    roster: [
      { id: 'kaijian_nurse01', name: '何丽', avatar: '👩‍⚕️', roleTitle: '4F责任护士', bedRange: '401-410', onDuty: true },
    ],
  })

  fsm.switchOperator('kaijian_nurse01')
  assert.equal(fsm.getState().activeOperator?.id, 'kaijian_nurse01')

  // 经过 30 秒无任何 touch
  fsm.tick(30)
  const state = fsm.getState()
  assert.equal(state.activeOperator, null, '30秒倒计时结束必须自动归位至公共监护大盘')
  assert.equal(state.autoReturnCountdown, 30)
})

test('TDD 4: 写入动作必须严格绑定终端与当班操作员双重签名审计', () => {
  const fsm = createSharedTerminalFSM({
    terminalId: 'station_4f_01',
    terminalType: 'care_desk',
    wardOrArea: '4F',
    roster: [
      { id: 'kaijian_nurse01', name: '何丽', avatar: '👩‍⚕️', roleTitle: '4F责任护士', bedRange: '401-410', onDuty: true },
    ],
  })

  // 未切换操作员时执行高危写入应抛错拒绝
  assert.throws(() => {
    fsm.createDualSignedAction('turn_pressure_relief', { patient_id: 'P000401', posture: 'left_lateral' })
  }, /OPERATOR_REQUIRED/, '无当班操作员切入时严禁生成个人临床操作签名')

  // 何丽登入后执行
  fsm.switchOperator('kaijian_nurse01')
  const signed = fsm.createDualSignedAction('turn_pressure_relief', { patient_id: 'P000401', posture: 'left_lateral' })
  assert.equal(signed.terminal_id, 'station_4f_01')
  assert.equal(signed.operator_id, 'kaijian_nurse01')
  assert.equal(signed.operator_name, '何丽')
  assert.equal(signed.action, 'turn_pressure_relief')
  assert.equal(signed.payload.patient_id, 'P000401')
  assert.ok(signed.timestamp, '必须携带时间戳')
})

test('TDD 5: 突发 Level 1 呼叫/危象告警全局强行抢占，并无损暂存作业员草稿（Stash & Pop）', () => {
  const fsm = createSharedTerminalFSM({
    terminalId: 'station_4f_01',
    terminalType: 'care_desk',
    wardOrArea: '4F',
    roster: [
      { id: 'kaijian_nurse01', name: '何丽', avatar: '👩‍⚕️', roleTitle: '4F责任护士', bedRange: '401-410', onDuty: true },
    ],
  })

  fsm.switchOperator('kaijian_nurse01')
  // 模拟何丽正在输入护理小结草稿
  const draftForm = { bedId: '401-B', notes: '长者午餐进食半流质，情绪良好未见异常...' }

  // 突发 402-A 跌倒报警
  fsm.triggerEmergency({
    alertId: 'ALT-999',
    patientOrElderlyId: 'P000402',
    patientName: '李建国',
    bedOrLocation: '402-A',
    level: 1,
    type: 'fall',
    title: '402-A床长者疑似离床发生跌倒告警！',
    triggeredAt: new Date().toISOString(),
  }, draftForm)

  let state = fsm.getState()
  assert.ok(state.preemptAlarm, '发生危急事件必须强行抢占')
  assert.equal(state.preemptAlarm.alertId, 'ALT-999')
  assert.deepEqual(state.stashedWorkState, draftForm, '当前作业员草稿必须安全暂存')

  // 抢险处置完毕（点击处置/解除报警）
  const restoredDraft = fsm.resolveEmergency('ALT-999')
  state = fsm.getState()
  assert.equal(state.preemptAlarm, null, '抢占应已解除')
  assert.deepEqual(restoredDraft, draftForm, '应无损恢复作业员草稿')
  assert.equal(state.activeOperator?.id, 'kaijian_nurse01', '应保持当前操作员身份不中断')
})
