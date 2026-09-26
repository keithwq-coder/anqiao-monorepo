<script setup lang="ts">
import { ref } from 'vue'
import { login } from '../../api/client'
import logoDark from '../../assets/logo-dark.png'

const emit = defineEmits<{ (e: 'success'): void }>()

const username = ref('')
const password = ref('')
const error = ref('')
const submitting = ref(false)

interface DemoRole {
  u: string
  name: string
  title: string
  desc: string
  tag: string
  demo?: boolean
  pw?: string
}

// ---------- 两级登录矩阵（多业态设计 §5）：一级=用户群（业态），二级=角色席位 ----------
// 演示席位（demo: true）一键进入（常驻演示标识）；真实席位一律不内嵌口令，点击仅预填账号
const VERTICAL_GROUPS = {
  nursing_home: {
    label: '护理院（P0 打样）',
    icon: '🏥',
    note: '',
    sections: [
      {
        label: '康宁护理院（演示 · 虚构机构，业务数据模拟/遥测真实）',
        items: [
          { u: 'kangning_station', name: '护士站公屏', title: '楼层床位全景', desc: '床位四态总览 / 告警抢占派单 / 交接班板 / 当班秒切', tag: '演示', demo: true, pw: '2026' },
          { u: 'kangning_head', name: '护士长', title: '护理质控中枢', desc: '重点监护专区 / 排班质控 / 照护计划审批 / 交接班审核', tag: '演示', demo: true, pw: '2026' },
          { u: 'kangning_nurse', name: '责任护士', title: '管床护理工作台', desc: '体征自动采集 / 给药核对 / 翻身打卡 / 护理记录', tag: '演示', demo: true, pw: '2026' },
          { u: 'kangning_caregiver', name: '管床护工', title: '照护任务执行', desc: '照护任务清单签到 / 告警响应 / 生活记录 / 拍照留痕', tag: '演示', demo: true, pw: '2026' },
          { u: 'kangning_admin', name: '院长', title: '全院经营大盘', desc: '实住率 / 长护申报归档 / 医疗督办 / 计划终审', tag: '演示', demo: true, pw: '2026' },
          { u: 'kangning_doctor', name: '医生', title: '院内医务工作台', desc: '健康档案 / 体征基线 / 查房记录 / 医嘱（挂硬件证据）', tag: '演示', demo: true, pw: '2026' },
          { u: 'kangning_hr', name: '人事', title: '人事工作台', desc: '花名册 / 排班 / 考勤（工牌打卡留痕）', tag: '演示', demo: true, pw: '2026' },
          { u: 'kangning_finance', name: '财务', title: '院侧财务工作台', desc: '床位护理费账册 / 长护申报确认 / 物联结算凭证', tag: '演示', demo: true, pw: '2026' },
          { u: 'kangning_marketing', name: '营销', title: '入住营销工作台', desc: '实住率空床态势 / 入住咨询登记 / 硬件能力演示', tag: '演示', demo: true, pw: '2026' },
          { u: 'kangning_affairs', name: '行政', title: '行政事务工作台', desc: '事务台账 / 设备报修流转（联动物联运维）', tag: '演示', demo: true, pw: '2026' },
          { u: 'kangning_it', name: 'IT', title: 'IT 支撑工作台', desc: '网络终端归因 / 设备在线率 / 平台支持请求', tag: '演示', demo: true, pw: '2026' },
          { u: 'kangning_dossier', name: '病案管理', title: '健康档案中心', desc: '楼层-房间-长者拓扑树 / 全周期档案 / 慢病谱', tag: '演示', demo: true, pw: '2026' },
          { u: 'kangning_ops', name: '物联运维', title: '感知硬件巡检', desc: '硬件拓扑树 / 离线漏斗 / 固件巡检 OTA', tag: '演示', demo: true, pw: '2026' },
          { u: 'kangning_reports', name: '结算报表', title: '报表中心', desc: '核销台账 / 账期树 / 在床凭证汇编 / 翻身合规', tag: '演示', demo: true, pw: '2026' },
          { u: 'kangning_rehab', name: '康复治疗师', title: '康复工作台', desc: '康复处方 / 训练打卡 / 雷达评效', tag: '演示', demo: true, pw: '2026' },
          { u: 'kangning_dementia', name: '认知症照护', title: '认知症专护', desc: 'MMSE 测评 / 走失围栏标定 / 非药物干预', tag: '演示', demo: true, pw: '2026' },
        ],
      },
    ],
  },
  senior_community: { label: '养老社区', icon: '🏘️', note: '养老社区业态角色栈定义中（业主补充后开通演示席位·乐融养老社区）', sections: [] },
  home_care: { label: '居家养老', icon: '🏡', note: '居家养老角色栈已定义（PRD §4），席位随 P1 期开通', sections: [] },
  health_wellness: { label: '大健康', icon: '💚', note: '大健康业态定义中（定义明确后启动 P2）', sections: [] },
  ltc: {
    label: '长护险生态（监管·经办·评估）',
    icon: '🛡️',
    note: '',
    sections: [
      {
        label: '宿迁长护险试点（真实）',
        items: [
          { u: 'suqian_medical', name: '宿迁长护试点席位', title: '宿迁市医保局试点监督组', desc: '国家长护险深化试点 · 真实在网终端3台（许丽/何家齐/王雪金）', tag: '宿迁·真实', demo: false },
          { u: 'medical_suqian', name: '宿迁试点专员', title: '宿迁市医保局监督组', desc: '国家长护险深化试点 · 真实长者在床遥测交叉印证', tag: '宿迁·真实', demo: false },
          { u: 'suqian_insurer', name: '宿迁商保经办专班', title: '太保宿迁长护经办组', desc: '国家长护深化试点 · 真实纳管在网设备3台', tag: '宿迁·真实', demo: false },
          { u: 'suqian_assessor', name: '许建强 评定师', title: '宿迁广济第三方评定中心', desc: '双人入户规范 / 真实长者在床遥测交叉印证', tag: '宿迁·真实', demo: false },
          { u: 'suqian_expert', name: '孙建国 主任医师', title: '宿迁评定专家评审委员会', desc: '双专家医学会审 / 临床证据印证 / 签发评定结论书', tag: '宿迁·真实', demo: false },
          { u: 'suqian_assessor_admin', name: '刘芳芳 质控主管', title: '宿迁广济中心质控部', desc: '评定全流程合规追溯 / 机构高斯正态偏离度监测', tag: '宿迁·真实', demo: false },
        ],
      },
      {
        label: '演示统筹区（模拟数据 · 真实遥测）',
        items: [
          { u: 'demo_director', name: '陈立新 副局长', title: '某某市医保局分管领导', desc: '某某市统筹大盘 / 机构信用熔断 / 评估机构长效追责终审', tag: '模拟', demo: true, pw: '2026' },
          { u: 'demo_audit', name: '林志刚 稽查科长', title: '某某市医保基金监督稽核科', desc: '三大监管支柱智能巡查 / 物联证据核验 / 追回多付资金', tag: '模拟', demo: true, pw: '2026' },
          { u: 'demo_finance', name: '张静 结算主管', title: '某某市医保中心长护结算科', desc: '定点机构月度结算复核 / 违规自动核减 / 电子凭证签批', tag: '模拟', demo: true, pw: '2026' },
          { u: 'demo_qual', name: '刘建军 专员', title: '某某市长护待遇资格与评估监管', desc: '初评突击卧床雷达复查 / 评估师重度率偏离长效追责', tag: '模拟', demo: true, pw: '2026' },
          { u: 'demo_medical', name: '某某长护综合监管', title: '某某市医保综合演示席位', desc: '长护全域数字监管演示中心 · 覆盖评估/服务/评估师三大支柱', tag: '模拟', demo: true, pw: '2026' },
          { u: 'demo_insurer_director', name: '赵国华 项目总监', title: '惠生人寿经办项目部', desc: '某某市经办全盘统揽 / 医保督办回执审签 / 经办质效SLA', tag: '模拟', demo: true, pw: '2026' },
          { u: 'demo_insurer_intake', name: '王雪梅 受理专员', title: '业务受理与派单调度组', desc: '失能申报材料初审 / 法定派单回避审查 / 评估任务分流', tag: '模拟', demo: true, pw: '2026' },
          { u: 'demo_insurer_inspector', name: '李勇 巡查主管', title: '现场巡查与质量飞检组', desc: '物联异常靶向突击飞检 / 现场核验笔录 / 违规工单锁定', tag: '模拟', demo: true, pw: '2026' },
          { u: 'demo_insurer_auditor', name: '张慧敏 审核员', title: '费用核销与结算初审组', desc: '机构月度申报经办初审 / 工单物联自动对撞核减 / 意见书盖印', tag: '模拟', demo: true, pw: '2026' },
          { u: 'demo_insurer_service', name: '孙丽 综合专员', title: '参保咨询与家属申诉组', desc: '长者咨询热线答疑 / 失能等级异议申诉初核 / 服务回访', tag: '模拟', demo: true, pw: '2026' },
          { u: 'demo_assessor', name: '周海峰 评定师', title: '某某市明康第三方评定中心', desc: '某某市全业务演练 · 双人现场入户 / 四维度量表测算 / 证据留痕', tag: '模拟', demo: true, pw: '2026' },
          { u: 'demo_expert', name: '钱德明 主任医师', title: '某某市医学评审专家组', desc: '某某市全业务演练 · 集中医学会审 / 筛查设备客观冲突 / 会签结论', tag: '模拟', demo: true, pw: '2026' },
          { u: 'demo_assessor_admin', name: '陈红 质控总监', title: '某某市明康评定质控部', desc: '某某市全业务演练 · 机构评定质量管理 / 重度失能比例动态监控', tag: '模拟', demo: true, pw: '2026' },
        ],
      },
    ],
  },
  corp: {
    label: '中科安樵自营（内部·硬件为纲）',
    icon: '🏢',
    note: '',
    sections: [
      {
        label: '平台与渠道席位（真实）',
        items: [
          { u: 'admin01', name: '平台自营总管', title: '硬件全生命周期中枢', desc: '全国点位穿透 / 出货入库调拨 / 固件巡检（真实 7 台在售设备）', tag: '内部·真实', demo: false },
          { u: 'su01', name: '超级管理员', title: '系统最高总控', desc: '全域多租户管理 / 账号矩阵 / 四层鉴权', tag: '内部·真实', demo: false },
          { u: 'user01', name: '平台硬件技术员', title: '硬件工程中枢', desc: '批量扫码入库 / 传感器标定 / 离线巡检（真实遥测）', tag: '内部·真实', demo: false },
          { u: 'partner_admin', name: '渠道合伙人总管', title: '渠道销售协同', desc: '拓客报备审批 / 硬件装机发货追踪 / 佣金返点结算', tag: '内部·真实', demo: false },
          { u: 'medical01', name: '医保协同席位', title: '医保监管协同', desc: '面向演示统筹区的监管协同（演示数据·带标识）', tag: '内部·协同', demo: false },
        ],
      },
      {
        label: '员工入口（与 CRM/wiki 同名）',
        items: [
          { u: 'admin', name: '系统管理员', title: '用户与权限管理', desc: '增加/修改用户名 / 分配权限 / 全量审计', tag: '员工', demo: false },
          { u: '赵', name: '赵 董事长', title: '全局经营总览', desc: '自营设备 + 宿迁试点 + 客户资产（真实数据）', tag: '员工', demo: false },
          { u: '武', name: '武 董事', title: '全局经营总览', desc: '自营设备 + 宿迁试点 + 客户资产（真实数据）', tag: '员工', demo: false },
          { u: '吴', name: '吴 总经理', title: '全局经营总览', desc: '自营设备 + 宿迁试点 + 客户资产（真实数据）', tag: '员工', demo: false },
          { u: '何丹', name: '何丹 销售', title: '客户资产视图', desc: '本人名下客户机构的设备脱敏情况', tag: '员工', demo: false },
          { u: '张楠', name: '张楠 销售', title: '客户资产视图', desc: '本人名下客户机构的设备脱敏情况', tag: '员工', demo: false },
          { u: 'ceshi', name: 'ceshi 测试', title: '客户资产视图', desc: '本人名下客户机构的设备脱敏情况', tag: '员工', demo: false },
          { u: '王海燕', name: '王海燕 销售', title: '客户资产视图', desc: '本人名下客户机构的设备脱敏情况', tag: '员工', demo: false },
          { u: '周晶晶', name: '周晶晶 销售', title: '客户资产视图', desc: '本人名下客户机构的设备脱敏情况', tag: '员工', demo: false },
        ],
      },
    ],
  },
  family: {
    label: '家属与设备用户（真实绑定）',
    icon: '👨‍👩‍👧',
    note: '',
    sections: [
      {
        label: '宿迁试点家属与在册用户（真实）',
        items: [
          { u: 'family_demo', name: '参保人家属', title: '亲情守护中枢', desc: '长者档案绑定 / 在线申报告知 / 体征实时感知 / 进度申诉', tag: '家属·真实', demo: false },
          { u: 'xuli', name: '许丽 设备用户', title: '宿迁试点在册', desc: '守护仪实时体征 / 睡眠报告 / 跌倒预警（真实设备）', tag: '家属·真实', demo: false },
          { u: 'hejiaqi', name: '何家齐 设备用户', title: '宿迁试点在册', desc: '守护仪实时体征 / 睡眠报告 / 跌倒预警（真实设备）', tag: '家属·真实', demo: false },
          { u: 'wangxuejin', name: '王雪金 设备用户', title: '宿迁试点在册', desc: '守护仪实时体征 / 睡眠报告 / 跌倒预警（真实设备）', tag: '家属·真实', demo: false },
          { u: 'dingzhikun', name: '丁志坤 设备用户', title: '宿迁试点在册', desc: '守护仪实时体征 / 睡眠报告 / 跌倒预警（真实设备）', tag: '家属·真实', demo: false },
        ],
      },
    ],
  },
}

async function submit() {
  if (submitting.value) return
  error.value = ''
  if (!username.value.trim() || !password.value) {
    error.value = '请输入账号和密码'
    return
  }
  submitting.value = true
  try {
    await login(username.value.trim(), password.value)
    emit('success')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败，请检查账号密码'
  } finally {
    submitting.value = false
  }
}

type VerticalGroupKey = keyof typeof VERTICAL_GROUPS
const activeCategory = ref<VerticalGroupKey>('nursing_home')
const passwordInput = ref<{ focus: () => void } | null>(null)

async function quickSelectRole(role: DemoRole) {
  username.value = role.u
  error.value = ''
  if (role.demo) {
    // 演示席位：一键进入（口令仅限演示域，常驻演示标识）
    password.value = role.pw || '2026'
    await submit()
  } else {
    // 真实席位：只预填账号，口令必须手工输入（不内嵌）
    password.value = ''
    passwordInput.value?.focus?.()
  }
}
</script>

<template>
  <div class="login-page">
    <!-- 左侧平台全景展示 -->
    <aside class="login-brand" aria-hidden="true">
      <div class="brand-inner">
        <img :src="logoDark" alt="" class="brand-logo" />
        <h1 class="brand-title">中科安樵 · 智护云</h1>
        <p class="brand-tagline">长护险与大健康数字化综合业务协同平台</p>

        <ul class="brand-points">
          <li>
            <span class="point-mark">🏡</span>
            <div>
              <strong>社区居家照护中心</strong>
              <span>片区网格化管理、呼援派单协同、在管长者安居全息感知</span>
            </div>
          </li>
          <li>
            <span class="point-mark">🏥</span>
            <div>
              <strong>智慧康养机构中枢</strong>
              <span>楼层智能护理台、无感生理体征监测、防压疮翻身交接</span>
            </div>
          </li>
          <li>
            <span class="point-mark">🛡️</span>
            <div>
              <strong>长护险智能监管平台</strong>
              <span>统筹区医保实时监管态势、四等级穿透核查、防欺诈稽核</span>
            </div>
          </li>
          <li>
            <span class="point-mark">📝</span>
            <div>
              <strong>专业失能评估与经办</strong>
              <span>客观快照证据生成、入户评估量表评定、四步核销与结算</span>
            </div>
          </li>
        </ul>

        <div class="brand-badge-box">
          <span class="badge-item">⚡ 单点多角色智能分流</span>
          <span class="badge-item">🔒 RBAC四层安全鉴权</span>
          <span class="badge-item">📡 物联网实时遥测</span>
        </div>
      </div>
    </aside>

    <!-- 右侧统一登录卡片 -->
    <main class="login-main">
      <div class="login-card">
        <header class="login-header">
          <img :src="logoDark" alt="中科安樵" class="login-logo" />
          <h2>统一工作台登录</h2>
          <p>输入业务账号登录，系统将根据账号身份自动呈现所属专属工作台</p>
        </header>

        <!-- 表单区 -->
        <form class="login-form" @submit.prevent="submit" novalidate>
          <div class="field">
            <label for="login-username">工作账号</label>
            <input
              id="login-username"
              v-model="username"
              type="text"
              name="username"
              autocomplete="username"
              placeholder="请输入账号 (如 admin01 / suqian_medical / demo_director)"
              :disabled="submitting"
            />
          </div>

          <div class="field">
            <label for="login-password">密码</label>
            <input
              id="login-password"
              ref="passwordInput"
              v-model="password"
              type="password"
              name="password"
              autocomplete="current-password"
              placeholder="请输入密码（真实席位口令由管理员分配）"
              :disabled="submitting"
            />
          </div>

          <div v-if="error" class="form-alert" role="alert">{{ error }}</div>

          <button class="btn-primary" type="submit" :disabled="submitting">
            {{ submitting ? '正在进入专属工作台…' : '登录进入工作台' }}
          </button>
        </form>

        <!-- 两级登录矩阵（多业态设计 §5）：一级用户群 → 二级角色席位 -->
        <section class="quick-matrix-section">
          <div class="quick-matrix-header">
            <span class="quick-matrix-title">🧭 选择用户群 → 角色：演示席位一键进入（带演示标识）；真实席位点击后输入口令登录</span>
          </div>

          <!-- 第一级：用户群（业态） -->
          <div class="category-tabs">
            <button
              v-for="(cat, key) in VERTICAL_GROUPS"
              :key="key"
              type="button"
              :class="['cat-tab-btn', activeCategory === key && 'active']"
              @click="activeCategory = key"
            >
              <span>{{ cat.icon }}</span>
              <span>{{ cat.label }}</span>
            </button>
          </div>

          <!-- 第二级：角色席位（分栏渲染；无席位的业态显示诚实占位说明） -->
          <template v-if="VERTICAL_GROUPS[activeCategory].sections && VERTICAL_GROUPS[activeCategory].sections.length">
            <div v-for="sec in VERTICAL_GROUPS[activeCategory].sections" :key="sec.label" class="role-subgroup">
              <div class="subgroup-title">{{ sec.label }}</div>
              <div class="role-cards-grid">
                <div
                  v-for="role in sec.items"
                  :key="role.u"
                  class="role-card"
                  :class="{ selected: username === role.u, 'demo-card': role.demo }"
                  @click="quickSelectRole(role)"
                  :title="role.demo ? '演示席位：点击直接登录该角色工作台' : '真实席位：点击预填账号，请输入口令登录'"
                >
                  <div class="role-card-top">
                    <span class="role-name">{{ role.name }}</span>
                    <span class="role-tag">{{ role.tag }}</span>
                  </div>
                  <div class="role-card-desc">{{ role.desc }}</div>
                  <div class="role-card-account">账号: <code>{{ role.u }}</code></div>
                </div>
              </div>
            </div>
          </template>
          <div v-else class="group-note">{{ VERTICAL_GROUPS[activeCategory].note }}</div>
        </section>

        <footer class="login-footer">
          <span>© {{ new Date().getFullYear() }} 中科安樵 · 综合业务协同平台 (SaaS)</span>
        </footer>
      </div>
    </main>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(360px, 38%) 1fr;
  background: var(--bg, #f5f6f8);
}

/* ---------- 左侧品牌区 ---------- */
.login-brand {
  background:
    radial-gradient(520px 360px at 20% 18%, rgba(11, 122, 117, 0.16), transparent 70%),
    radial-gradient(420px 300px at 80% 88%, rgba(200, 149, 108, 0.18), transparent 70%),
    linear-gradient(165deg, #e7f3f1 0%, #f4eee6 100%);
  border-right: 1px solid var(--border, #e2e4e8);
  display: flex;
  align-items: center;
  padding: 48px 52px;
}

.brand-inner {
  max-width: 420px;
  width: 100%;
}

.brand-logo {
  height: 42px;
  width: auto;
  margin-bottom: 24px;
  opacity: 0.95;
}

.brand-title {
  margin: 0 0 8px;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--primary-dark, #065a56);
  line-height: 1.25;
}

.brand-tagline {
  margin: 0 0 32px;
  font-size: 14px;
  color: var(--text-secondary, #5a6e68);
  line-height: 1.6;
}

.brand-points {
  list-style: none;
  margin: 0 0 36px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.brand-points li {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.point-mark {
  font-size: 18px;
  line-height: 1;
  margin-top: 2px;
  flex-shrink: 0;
}

.brand-points strong {
  display: block;
  font-size: 14px;
  font-weight: 650;
  color: var(--text, #1e293b);
  margin-bottom: 2px;
}

.brand-points span {
  font-size: 12.5px;
  color: var(--text-secondary, #64748b);
  line-height: 1.5;
}

.brand-badge-box {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 20px;
  border-top: 1px solid rgba(11, 122, 117, 0.15);
}

.badge-item {
  font-size: 11.5px;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.7);
  color: #0b7a75;
  font-weight: 550;
  border: 1px solid rgba(11, 122, 117, 0.2);
}

/* ---------- 右侧表单与快捷区 ---------- */
.login-main {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 36px 40px;
  background: #ffffff;
  overflow-y: auto;
}

.login-card {
  width: 100%;
  max-width: 540px;
}

.login-header {
  margin-bottom: 24px;
}

.login-logo {
  display: none;
  height: 34px;
  width: auto;
  margin-bottom: 16px;
}

.login-header h2 {
  margin: 0 0 6px;
  font-size: 23px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.3;
}

.login-header p {
  margin: 0;
  font-size: 13.5px;
  color: #64748b;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field label {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}

.field input {
  height: 40px;
  padding: 0 14px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  color: #0f172a;
  background: #ffffff;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  box-sizing: border-box;
}

.field input::placeholder {
  color: #94a3b8;
  font-size: 13px;
}

.field input:hover:not(:disabled) {
  border-color: #94a3b8;
}

.field input:focus {
  border-color: #0b7a75;
  box-shadow: 0 0 0 3px rgba(11, 122, 117, 0.15);
}

.field input:disabled {
  background: #f8fafc;
  color: #94a3b8;
  cursor: not-allowed;
}

.form-alert {
  margin: -2px 0 0;
  padding: 8px 12px;
  border-radius: 6px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  font-size: 13px;
  line-height: 1.4;
}

.btn-primary {
  height: 42px;
  margin-top: 4px;
  border: none;
  border-radius: 8px;
  background: #0b7a75;
  color: #ffffff;
  font-size: 15px;
  font-weight: 650;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}

.btn-primary:hover:not(:disabled) {
  background: #065a56;
}

.btn-primary:active:not(:disabled) {
  transform: translateY(1px);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ---------- 模拟体验通道卡片区 ---------- */
.quick-matrix-section {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #e2e8f0;
}

.quick-matrix-header {
  margin-bottom: 12px;
}

.quick-matrix-title {
  font-size: 13px;
  font-weight: 650;
  color: #1e293b;
}

.category-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.cat-tab-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  font-size: 12.5px;
  font-weight: 550;
  color: #475569;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.cat-tab-btn:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
}

.cat-tab-btn.active {
  background: #0b7a75;
  color: #ffffff;
  border-color: #0b7a75;
  box-shadow: 0 2px 4px rgba(11, 122, 117, 0.2);
}

.role-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 8px;
  max-height: 230px;
  overflow-y: auto;
  padding-right: 4px;
}

.role-card {
  padding: 9px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
}

.role-card:hover {
  border-color: #0b7a75;
  background: #f0fdf4;
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(11, 122, 117, 0.1);
}

.role-card.selected {
  border-color: #0b7a75;
  background: #ecfdf5;
  box-shadow: 0 0 0 2px rgba(11, 122, 117, 0.25);
}

.role-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 3px;
}

.role-name {
  font-size: 13px;
  font-weight: 650;
  color: #0f172a;
}

.role-tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(11, 122, 117, 0.1);
  color: #0b7a75;
  font-weight: 550;
}

.role-card-desc {
  font-size: 11.5px;
  color: #64748b;
  line-height: 1.35;
  margin-bottom: 4px;
}

.role-card-account {
  font-size: 11px;
  color: #94a3b8;
}

.role-card-account code {
  color: #0b7a75;
  font-weight: 600;
  background: #ffffff;
  padding: 1px 4px;
  border-radius: 3px;
  border: 1px solid #e2e8f0;
}

.login-footer {
  margin-top: 24px;
  font-size: 12px;
  color: #94a3b8;
  text-align: center;
}

/* ---------- 响应式布局 ---------- */
@media (max-width: 960px) {
  .login-page {
    grid-template-columns: 1fr;
  }

  .login-brand {
    display: none;
  }

  .login-logo {
    display: block;
  }

  .login-main {
    padding: 32px 20px;
  }

  .role-cards-grid {
    grid-template-columns: 1fr;
    max-height: 200px;
  }
}
/* ---------- 两级登录矩阵：分栏与占位 ---------- */
.role-subgroup {
  margin-bottom: 14px;
}
.subgroup-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary, #6b7280);
  letter-spacing: 0.04em;
  margin: 6px 2px 8px;
}
.group-note {
  padding: 26px 18px;
  border: 1px dashed var(--border, #d7dade);
  border-radius: 10px;
  text-align: center;
  color: var(--text-secondary, #6b7280);
  font-size: 13px;
  background: var(--bg-subtle, #fafbfc);
}
.role-card.demo-card {
  border-color: rgba(200, 149, 108, 0.55);
  background: linear-gradient(180deg, rgba(252, 248, 242, 0.9), rgba(250, 244, 236, 0.75));
}
</style>
