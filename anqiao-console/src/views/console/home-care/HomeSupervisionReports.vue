<script setup lang="ts">
import { ref, computed } from 'vue'
import { useHomeCareStore } from '../../../features/home-care/home-care-store'
import WorkOrderExecutionModal from '../../../features/home-care/components/WorkOrderExecutionModal.vue'

const store = useHomeCareStore()

const reportTab = ref<'work_order_log' | 'ltc_settlement' | 'anti_fraud' | 'qc_flight_audit'>('work_order_log')
const selectedAntiFraudCase = ref<'case1' | 'case2'>('case1')

const showCreateAuditModal = ref(false)
const newAuditElder = ref('张卫国 (沧浪新村 12 幢 302 室)')
const newAuditType = ref('入户双盲现场飞行检查')
const newAuditScore = ref('99分 (优秀)')
const newAuditDetail = ref('现场服务用具按规定消毒，服务前体温血压复测规范，长者反馈助老员手法专业。')

// 过滤已核销与所有服务记录
const workOrderLogs = computed(() => {
  return store.workOrders.value
})

const flightAuditLogs = [
  {
    audit_id: 'QC-20260925-01',
    elder_name: '赵金宝',
    elder_addr: '沧浪片区 · 沧浪新村12幢302室',
    staff_name: '林小燕 (高级助老员)',
    service_item: '床上温水擦浴与更衣照料',
    audit_type: '入户双盲现场飞行检查',
    inspector: '蒋国强 (质控主管)',
    result: '合格 (99分)',
    details: '水温实测40.5℃符合标准，服务前核验长者体温心率，毛巾一用一消毒，服务态度亲切。',
  },
  {
    audit_id: 'QC-20260925-02',
    elder_name: '钱桂珍',
    elder_addr: '双塔片区 · 双塔新村8幢101室',
    staff_name: '沈雅萍 (主管护师)',
    service_item: '留置导尿管置换与造口消毒护理',
    audit_type: '专业医疗护理质控抽检',
    inspector: '蒋国强 (质控主管)',
    result: '优秀 (100分)',
    details: '无菌技术操作严格，双人核对导尿包批号，引流袋刻度与留置深度记录详实，家属满意度满分。',
  },
  {
    audit_id: 'QC-20260924-03',
    elder_name: '孙阿祥',
    elder_addr: '双塔片区 · 滚绣坊22号202室',
    staff_name: '陈建新 (康复治疗师)',
    service_item: '脑卒中偏瘫肢体综合运动训练',
    audit_type: '康复功能训练质量稽核',
    inspector: '徐美玲 (个案管理师)',
    result: '合格 (98分)',
    details: '按康复评定处方执行，患肢主动活动度量角器记录规范，未出现牵拉不适，家属签字确认。',
  },
  {
    audit_id: 'QC-20260924-04',
    elder_name: '杨保国',
    elder_addr: '沧浪片区 · 沧浪新村35幢102室',
    staff_name: '陈秀英 (中级养老照护师)',
    service_item: '全身翻身叩背防压疮护理',
    audit_type: '12349 电话回访满意度录音',
    inspector: '苏智护呼叫中枢坐席',
    result: '极满意 (5星)',
    details: '长者女儿电话反馈助老员每次均准时到场，手法专业细致，未发生皮肤发红压疮。',
  },
  {
    audit_id: 'QC-20260923-05',
    elder_name: '张伟民 (自查)',
    elder_addr: '双塔片区网师巷20号',
    staff_name: '张伟民 (养老照护员)',
    service_item: '助洁助浴与生活照护',
    audit_type: '合规飞检整改闭环',
    inspector: '蒋国强 (质控主管)',
    result: '整改完成 (闭环)',
    details: '发现进门鞋套未按标准双层穿戴，当场指正并扣除个人履约质控分0.5分，次日复检完全合规。',
  },
]

const flightAuditList = ref([...flightAuditLogs])

function handleAddAudit() {
  flightAuditList.value.unshift({
    audit_id: `QC-20260925-0${flightAuditList.value.length + 1}`,
    elder_name: newAuditElder.value.split(' ')[0],
    elder_addr: newAuditElder.value,
    staff_name: '蒋国强 (质控主管)',
    service_item: '生活照料与慢病管理标准操作规范',
    audit_type: newAuditType.value,
    inspector: '蒋国强 (质控主管)',
    result: newAuditScore.value,
    details: newAuditDetail.value,
  })
  showCreateAuditModal.value = false
}

const settlementList = computed(() => {
  return store.elders.value.map((e) => {
    const isSevere = e.ltc_level === '重度失能'
    const totalFee = isSevere ? 1300.0 : 800.0
    const ltcFundPay = totalFee * 0.9
    const personalPay = totalFee * 0.1
    return {
      elderly_id: e.elderly_id,
      name: e.name,
      area_name: e.area_name,
      home_address: e.home_address,
      ltc_level: e.ltc_level,
      assigned_caregiver_name: e.assigned_caregiver_name,
      completed_count: e.monthly_service_completed,
      total_quota: e.monthly_service_quota,
      total_fee: totalFee,
      fund_pay: ltcFundPay,
      personal_pay: personalPay,
      settlement_status: '初审通过，待医保统筹拨付',
    }
  })
})

const totalSettlementFund = computed(() => {
  return settlementList.value.reduce((acc, curr) => acc + curr.fund_pay, 0)
})

const totalCompletedServices = computed(() => {
  return settlementList.value.reduce((acc, curr) => acc + curr.completed_count, 0)
})

const exportNotice = ref('')

function handleExport(type: string) {
  exportNotice.value = `正在生成【演示市城南示范区智护居家养老 - ${type}】合规审计导出文件 (PDF/Excel)...`
  setTimeout(() => {
    exportNotice.value = `导出成功！报告已就绪：SZ_HOME_LTC_${new Date().toISOString().slice(0, 10)}.xlsx`
  }, 1200)
}
</script>

<template>
  <div class="home-supervision-reports-view">
    <!-- 顶部总览报表抬头 -->
    <div class="reports-header-card">
      <div class="rep-brand">
        <span class="rep-icon">📊</span>
        <div>
          <h3>服务与监管报告系统</h3>
          <p>演示·暖阳居家养老服务中心（模拟机构） · 长护险定点服务履约核销与合规审计</p>
        </div>
      </div>

      <div class="rep-kpi-row">
        <div class="rep-kpi-box">
          <span class="lbl">本月累计履约上门</span>
          <span class="val cyan">{{ totalCompletedServices }} <small>人次</small></span>
        </div>
        <div class="rep-kpi-box">
          <span class="lbl">长护险基金核销总额</span>
          <span class="val emerald">￥{{ totalSettlementFund.toLocaleString() }}</span>
        </div>
        <div class="rep-kpi-box">
          <span class="lbl">AI雷达轨迹交叉比对率</span>
          <span class="val purple">100.0% <small>合规</small></span>
        </div>
        <button class="export-btn" @click="handleExport('月度结算清册')" type="button">
          📥 导出审计清册
        </button>
      </div>
    </div>

    <div v-if="exportNotice" class="export-banner">
      {{ exportNotice }}
    </div>

    <!-- 报表类别切换 -->
    <div class="rep-nav-tabs">
      <button
        :class="['nav-pill', reportTab === 'work_order_log' && 'active']"
        @click="reportTab = 'work_order_log'"
      >
        📑 上门服务工单履约流水日志
      </button>
      <button
        :class="['nav-pill', reportTab === 'ltc_settlement' && 'active']"
        @click="reportTab = 'ltc_settlement'"
      >
        💰 长护险月度结算核销明细账
      </button>
      <button
        :class="['nav-pill', reportTab === 'anti_fraud' && 'active']"
        @click="reportTab = 'anti_fraud'"
      >
        🛡️ 医保反虚构服务与雷达体征比对审计
      </button>
      <button
        :class="['nav-pill', reportTab === 'qc_flight_audit' && 'active']"
        @click="reportTab = 'qc_flight_audit'"
      >
        🔍 连锁服务质控飞行督导与满意度回访
      </button>
    </div>

    <!-- 视图 1：上门服务工单流水日志 -->
    <div v-if="reportTab === 'work_order_log'" class="rep-table-wrap">
      <table class="rep-table">
        <thead>
          <tr>
            <th>工单单号</th>
            <th>长者姓名</th>
            <th>服务项目</th>
            <th>责任助老员</th>
            <th>计划服务时间</th>
            <th>实际进出打卡</th>
            <th>服务时长</th>
            <th>长护险基金</th>
            <th>合规验证状态</th>
            <th>操作协同</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="wo in workOrderLogs" :key="wo.order_id">
            <td class="font-mono">{{ wo.order_id }}</td>
            <td><strong>{{ wo.elderly_name }}</strong> ({{ wo.area_name }})</td>
            <td>{{ wo.service_code }} · {{ wo.service_name }}</td>
            <td>{{ wo.caregiver_name }} ({{ wo.caregiver_role }})</td>
            <td>{{ wo.scheduled_time }}</td>
            <td>
              <span v-if="wo.checkin_time" class="checkin-badge">进门: {{ wo.checkin_time }}</span>
              <span v-if="wo.checkout_time" class="checkout-badge">离开: {{ wo.checkout_time }}</span>
              <span v-if="!wo.checkin_time && !wo.checkout_time" class="pending-badge">待打卡</span>
            </td>
            <td>{{ wo.duration_minutes }} 分钟</td>
            <td class="fee-text">￥{{ wo.ltc_fund_subsidy.toFixed(2) }}</td>
            <td>
              <span class="verify-badge" :class="wo.status === 'verified' ? 'verified' : 'auditing'">
                {{ wo.status === 'verified' ? '✓ 医保审核通过' : '待核销抽检' }}
              </span>
            </td>
            <td>
              <button class="inspect-btn-sm" @click="store.openWorkOrderDetail(wo.order_id)" type="button">
                存证核验
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 视图 2：长护险月度结算核销明细账 -->
    <div v-else-if="reportTab === 'ltc_settlement'" class="rep-table-wrap">
      <table class="rep-table">
        <thead>
          <tr>
            <th>长者编号</th>
            <th>长者真实姓名</th>
            <th>片区与门牌住址</th>
            <th>失能定级</th>
            <th>责任助老员</th>
            <th>当月核销次数</th>
            <th>总服务费用</th>
            <th>长护险基金拨付 (90%)</th>
            <th>长者自负金额 (10%)</th>
            <th>结算状态</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in settlementList" :key="s.elderly_id">
            <td class="font-mono">{{ s.elderly_id }}</td>
            <td><strong>{{ s.name }}</strong></td>
            <td>{{ s.area_name }} · {{ s.home_address }}</td>
            <td><span class="ltc-tag">{{ s.ltc_level }}</span></td>
            <td>{{ s.assigned_caregiver_name }}</td>
            <td><strong>{{ s.completed_count }}</strong> / {{ s.total_quota }} 次</td>
            <td class="fee-text">￥{{ s.total_fee.toFixed(2) }}</td>
            <td class="fund-text">￥{{ s.fund_pay.toFixed(2) }}</td>
            <td>￥{{ s.personal_pay.toFixed(2) }}</td>
            <td><span class="settle-badge">{{ s.settlement_status }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 视图 3：医保反虚构服务与雷达体征比对审计 -->
    <div v-else-if="reportTab === 'anti_fraud'" class="anti-fraud-container">
      <div class="anti-fraud-summary">
        <h4>🛡️ 国家医保局与江苏省长护险大数据反虚构服务监管规范</h4>
        <p>
          本系统通过部署于长者家中的<strong>毫米波雷达人体存在感知</strong>与<strong>助老员手机 NFC + 基站 GPS 打卡</strong>，实现全链条“双盲多源证据印证”。杜绝“人未到虚假打卡”、“挂单套取基金”、“服务时长严重缩水”等违规行为。
        </p>
      </div>

      <div class="evidence-grid">
        <div class="evidence-card">
          <div class="ev-head">
            <strong>证据源 1：助老员入户 GPS+NFC 实名定位</strong>
            <span class="ev-badge-ok">真实可追溯</span>
          </div>
          <p>
            入户打卡必须在长者居所 50 米地理围栏内，配合门牌 NFC 芯片碰一碰触发，打卡坐标与时间不可篡改。
          </p>
        </div>

        <div class="evidence-card">
          <div class="ev-head">
            <strong>证据源 2：毫米波雷达空间存在微动交叉验证</strong>
            <span class="ev-badge-ok">室内有人活动印证</span>
          </div>
          <p>
            工单执行时段内，长者居所内雷达采集到连续人体呼吸与运动信号，交叉验证助老员入户服务真实进行。
          </p>
        </div>

        <div class="evidence-card">
          <div class="ev-head">
            <strong>证据源 3：长者/家属电子签名与满意度评价</strong>
            <span class="ev-badge-ok">闭环确认</span>
          </div>
          <p>
            服务完毕由长者或其同住家属在移动终端签署知情核销回执，系统留存原笔迹与拍照合规凭证。
          </p>
        </div>
      </div>

      <!-- 穿透实案多源比对演示 -->
      <div class="anti-fraud-drilldown-card">
        <div class="drilldown-header">
          <div class="drilldown-title">
            <span class="shield-icon">🔍</span>
            <strong>长护险大数据反虚构穿透比对实例演示</strong>
          </div>
          <div class="case-tabs">
            <button
              :class="['case-tab-btn', selectedAntiFraudCase === 'case1' && 'active']"
              @click="selectedAntiFraudCase = 'case1'"
              type="button"
            >
              案例 A: 王惠芬翻身护理 (真实履约)
            </button>
            <button
              :class="['case-tab-btn', selectedAntiFraudCase === 'case2' && 'active']"
              @click="selectedAntiFraudCase = 'case2'"
              type="button"
            >
              案例 B: 沈雅萍留置导尿换管 (专科合规)
            </button>
          </div>
        </div>

        <div v-if="selectedAntiFraudCase === 'case1'" class="drilldown-content">
          <div class="drilldown-columns">
            <div class="drilldown-col">
              <span class="col-lbl">📱 助老员手机基站打卡</span>
              <div class="metric-val text-emerald">偏差 3.2米 (合规)</div>
              <p>打卡时刻 08:58，离开打卡 09:35，在场时长 37 分钟，与规定时长 35 分钟匹配。</p>
            </div>
            <div class="drilldown-col">
              <span class="col-lbl">📡 居室 60GHz 毫米波雷达</span>
              <div class="metric-val text-cyan">存在持续微动 37 分钟</div>
              <p>雷达检测到床旁持续活动与体态翻转，与翻身叩背动作频次一致，杜绝空挂虚构。</p>
            </div>
            <div class="drilldown-col">
              <span class="col-lbl">📞 12349 电话回访满意度</span>
              <div class="metric-val text-purple">⭐⭐⭐⭐⭐ 5星好评</div>
              <p>系统自动电话回访长者家属唐先生，确认助老员按时上门且未收取任何违规费用。</p>
            </div>
          </div>
          <div class="anti-fraud-decision">
            <span class="decision-badge">医保反欺诈引擎综合评估：</span>
            <strong>风险指数 0.02 (极低风险 / 真实可信) · 准予长护险统筹基金全额拨付</strong>
          </div>
        </div>

        <div v-else class="drilldown-content">
          <div class="drilldown-columns">
            <div class="drilldown-col">
              <span class="col-lbl">📱 护师资质与双人核对</span>
              <div class="metric-val text-emerald">主管护师证号已验签</div>
              <p>进门时刻 13:58，无菌导尿包条形码扫描归档，操作符合院感与临床护理标准。</p>
            </div>
            <div class="drilldown-col">
              <span class="col-lbl">📡 居室环境物联传感</span>
              <div class="metric-val text-cyan">床旁雷达微动信号吻合</div>
              <p>雷达记录床头操作时长 58 分钟，体温与心率数据已实时经蓝牙网关回传。</p>
            </div>
            <div class="drilldown-col">
              <span class="col-lbl">✍️ 长者家属原笔迹双签</span>
              <div class="metric-val text-purple">电子签名张志明(长子)</div>
              <p>家属确认造口换药敷料完好，耗材无缝对接长护险定点补贴。</p>
            </div>
          </div>
          <div class="anti-fraud-decision">
            <span class="decision-badge">医保反欺诈引擎综合评估：</span>
            <strong>风险指数 0.01 (极低风险 / 专科规范) · 准予长护险医疗护理统筹拨付</strong>
          </div>
        </div>
      </div>
    </div>

    <!-- 视图 4：连锁服务质控飞行督导与满意度回访 (居家乐/福寿康标准) -->
    <div v-if="reportTab === 'qc_flight_audit'" class="rep-table-wrap">
      <div class="audit-kpi-summary">
        <div class="kpi-mini-pill">
          <span>电话回访覆盖率：</span><strong>100.0%</strong>
        </div>
        <div class="kpi-mini-pill">
          <span>综合满意度均分：</span><strong>98.8 分</strong>
        </div>
        <div class="kpi-mini-pill">
          <span>双盲飞行检查抽检率：</span><strong>15.2%</strong>
        </div>
        <div class="kpi-mini-pill">
          <span>服务规范整改闭环率：</span><strong style="color: #34d399">100%</strong>
        </div>
        <button class="btn-new-audit" @click="showCreateAuditModal = true" type="button">
          + 发起质控飞行督导检查
        </button>
      </div>

      <table class="rep-table">
        <thead>
          <tr>
            <th>质控单号</th>
            <th>受检长者与住址</th>
            <th>受检照护人员</th>
            <th>检查服务项目</th>
            <th>质控模式</th>
            <th>督导稽核人</th>
            <th>检查结论与评分</th>
            <th>现场核查备忘</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in flightAuditList" :key="log.audit_id">
            <td class="font-mono">{{ log.audit_id }}</td>
            <td>
              <strong>{{ log.elder_name }}</strong>
              <div class="addr-sub">{{ log.elder_addr }}</div>
            </td>
            <td><strong>{{ log.staff_name }}</strong></td>
            <td>{{ log.service_item }}</td>
            <td>
              <span class="audit-tag">{{ log.audit_type }}</span>
            </td>
            <td>{{ log.inspector }}</td>
            <td>
              <span class="badge-result-ok">{{ log.result }}</span>
            </td>
            <td class="log-detail-td">{{ log.details }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 发起质控督导弹窗 -->
    <div v-if="showCreateAuditModal" class="modal-backdrop" @click="showCreateAuditModal = false">
      <div class="audit-modal-card" @click.stop>
        <div class="modal-head">
          <h3>连锁服务质控 · 发起飞行督导与抽查录入</h3>
          <button class="close-x" @click="showCreateAuditModal = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-field">
            <label>受检长者对象：</label>
            <input v-model="newAuditElder" class="modal-input" />
          </div>
          <div class="form-field">
            <label>质控抽检模式：</label>
            <select v-model="newAuditType" class="modal-select">
              <option value="入户双盲现场飞行检查">入户双盲现场飞行检查 (现场督导)</option>
              <option value="专业医疗护理质控抽检">专业医疗护理质控抽检 (护师专科)</option>
              <option value="12349 电话回访满意度录音">12349 电话回访满意度录音 (坐席抽测)</option>
              <option value="合规飞检整改闭环">合规飞检整改闭环 (差错二次复查)</option>
            </select>
          </div>
          <div class="form-field">
            <label>检查评分与结论：</label>
            <input v-model="newAuditScore" class="modal-input" />
          </div>
          <div class="form-field">
            <label>现场核查备忘与考评细节：</label>
            <textarea v-model="newAuditDetail" class="modal-textarea" rows="3"></textarea>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn-cancel" @click="showCreateAuditModal = false">取消</button>
          <button class="btn-confirm" @click="handleAddAudit">保存并生成质控督导单</button>
        </div>
      </div>
    </div>

    <!-- 工单生命周期流转与存证核验弹窗 -->
    <WorkOrderExecutionModal
      v-if="store.activeWorkOrder.value"
      :work-order="store.activeWorkOrder.value"
    />
  </div>
</template>

<style scoped>
.home-supervision-reports-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.reports-header-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.8) 100%);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 12px;
  padding: 16px 22px;
  flex-wrap: wrap;
  gap: 16px;
}

.rep-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rep-icon {
  font-size: 32px;
}

.rep-brand h3 {
  font-size: 18px;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 2px;
}

.rep-brand p {
  font-size: 12px;
  color: #94a3b8;
  margin: 0;
}

.rep-kpi-row {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.rep-kpi-box {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 8px;
  padding: 8px 16px;
  display: flex;
  flex-direction: column;
}

.rep-kpi-box .lbl {
  font-size: 11px;
  color: #94a3b8;
}

.rep-kpi-box .val {
  font-size: 18px;
  font-weight: 700;
  color: #f8fafc;
}

.rep-kpi-box .val small {
  font-size: 11px;
  font-weight: normal;
  color: #94a3b8;
}

.rep-kpi-box .val.cyan { color: #38bdf8; }
.rep-kpi-box .val.emerald { color: #34d399; }
.rep-kpi-box .val.purple { color: #c084fc; }

.export-btn {
  background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
  color: #ffffff;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.35);
  transition: all 0.2s;
}

.export-btn:hover {
  background: #38bdf8;
}

.export-banner {
  background: rgba(14, 165, 233, 0.15);
  border: 1px solid rgba(14, 165, 233, 0.35);
  color: #7dd3fc;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 13px;
}

.rep-nav-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.nav-pill {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.2);
  color: #94a3b8;
  padding: 7px 16px;
  font-size: 13px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.nav-pill:hover {
  color: #ffffff;
}

.nav-pill.active {
  background: rgba(14, 165, 233, 0.2);
  border-color: #38bdf8;
  color: #38bdf8;
  font-weight: 600;
}

.rep-table-wrap {
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 10px;
  overflow-x: auto;
}

.rep-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  text-align: left;
}

.rep-table th {
  background: rgba(30, 41, 59, 0.7);
  color: #94a3b8;
  padding: 10px 12px;
  font-weight: 600;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  white-space: nowrap;
}

.rep-table td {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  color: #cbd5e1;
}

.rep-table tr:hover td {
  background: rgba(255, 255, 255, 0.03);
}

.checkin-badge {
  display: inline-block;
  font-size: 10px;
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  padding: 1px 5px;
  border-radius: 3px;
  margin-right: 4px;
}

.checkout-badge {
  display: inline-block;
  font-size: 10px;
  background: rgba(14, 165, 233, 0.15);
  color: #38bdf8;
  padding: 1px 5px;
  border-radius: 3px;
}

.pending-badge {
  font-size: 10px;
  color: #94a3b8;
}

.fee-text {
  font-family: monospace;
  color: #cbd5e1;
}

.fund-text {
  font-family: monospace;
  font-weight: 700;
  color: #34d399;
}

.verify-badge {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 4px;
}

.verify-badge.verified {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
}

.verify-badge.auditing {
  background: rgba(234, 179, 8, 0.15);
  color: #fde047;
}

.ltc-tag {
  font-size: 11px;
  background: rgba(244, 63, 94, 0.15);
  color: #fda4af;
  padding: 2px 6px;
  border-radius: 3px;
}

.settle-badge {
  font-size: 11px;
  color: #38bdf8;
  background: rgba(14, 165, 233, 0.15);
  padding: 2px 6px;
  border-radius: 3px;
}

.anti-fraud-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.anti-fraud-summary {
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(56, 189, 248, 0.3);
  border-radius: 10px;
  padding: 16px 20px;
}

.anti-fraud-summary h4 {
  margin: 0 0 8px;
  font-size: 15px;
  color: #38bdf8;
}

.anti-fraud-summary p {
  margin: 0;
  font-size: 13px;
  color: #cbd5e1;
  line-height: 1.6;
}

.evidence-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}

.evidence-card {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ev-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: #ffffff;
}

.ev-badge-ok {
  font-size: 10px;
  color: #34d399;
  background: rgba(16, 185, 129, 0.15);
  padding: 2px 6px;
  border-radius: 3px;
}

.evidence-card p {
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.5;
  margin: 0;
}

.audit-kpi-summary {
  display: flex;
  gap: 12px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.kpi-mini-pill {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
  color: #94a3b8;
}

.kpi-mini-pill strong {
  color: #38bdf8;
}

.addr-sub {
  font-size: 10px;
  color: #64748b;
  margin-top: 2px;
}

.audit-tag {
  font-size: 11px;
  color: #c084fc;
  background: rgba(168, 85, 247, 0.15);
  padding: 2px 7px;
  border-radius: 4px;
}

.badge-result-ok {
  font-size: 11px;
  color: #34d399;
  background: rgba(16, 185, 129, 0.15);
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
}

.inspect-btn-sm {
  background: rgba(14, 165, 233, 0.15);
  border: 1px solid rgba(14, 165, 233, 0.35);
  color: #38bdf8;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.inspect-btn-sm:hover {
  background: #0ea5e9;
  color: #ffffff;
}

.anti-fraud-drilldown-card {
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid rgba(56, 189, 248, 0.3);
  border-radius: 12px;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.drilldown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);
  padding-bottom: 12px;
  flex-wrap: wrap;
  gap: 10px;
}

.drilldown-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #38bdf8;
  font-size: 14px;
}

.shield-icon {
  font-size: 18px;
}

.case-tabs {
  display: flex;
  gap: 8px;
}

.case-tab-btn {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.2);
  color: #94a3b8;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.case-tab-btn:hover {
  color: #ffffff;
}

.case-tab-btn.active {
  background: rgba(14, 165, 233, 0.25);
  border-color: #38bdf8;
  color: #38bdf8;
  font-weight: 600;
}

.drilldown-columns {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.drilldown-col {
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 8px;
  padding: 12px;
}

.col-lbl {
  font-size: 11px;
  color: #94a3b8;
  display: block;
  margin-bottom: 4px;
}

.metric-val {
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 6px;
}

.text-emerald { color: #34d399; }
.text-cyan { color: #38bdf8; }
.text-purple { color: #c084fc; }

.drilldown-col p {
  font-size: 11px;
  color: #cbd5e1;
  margin: 0;
  line-height: 1.4;
}

.anti-fraud-decision {
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.3);
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #34d399;
}

.decision-badge {
  font-weight: 600;
  color: #ffffff;
}

.btn-new-audit {
  margin-left: auto;
  background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
  border: none;
  color: #ffffff;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.3);
  transition: all 0.2s;
}

.btn-new-audit:hover {
  background: #38bdf8;
}

.audit-modal-card {
  background: #1e293b;
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 12px;
  width: 100%;
  max-width: 520px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

.modal-input, .modal-textarea {
  width: 100%;
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 6px;
  padding: 8px 12px;
  color: #ffffff;
  font-size: 13px;
  box-sizing: border-box;
}

.modal-textarea {
  resize: vertical;
}
</style>
