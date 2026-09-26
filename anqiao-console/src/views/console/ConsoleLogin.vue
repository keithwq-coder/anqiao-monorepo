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
  pw?: string
}

const activeCategory = ref<'corp' | 'staff' | 'suqian' | 'demo' | 'family'>('corp')

const DEMO_CATEGORIES: Record<'corp' | 'staff' | 'suqian' | 'demo' | 'family', { label: string; icon: string; items: DemoRole[] }> = {
  corp: {
    label: '中科安樵自营（硬件为纲·内部）',
    icon: '🏢',
    items: [
      { u: 'admin01', name: '平台自营总管', title: '硬件全生命周期中枢', desc: '全国点位穿透 / 出货入库调拨 / 固件巡检（真实 7 台在售设备）', tag: '内部·真实', pw: '2026' },
      { u: 'su01', name: '超级管理员', title: '系统最高总控', desc: '全域多租户管理 / 账号矩阵 / 四层鉴权', tag: '内部·真实', pw: '2026' },
      { u: 'user01', name: '平台硬件技术员', title: '硬件工程中枢', desc: '批量扫码入库 / 传感器标定 / 离线巡检（真实遥测）', tag: '内部·真实', pw: '2026' },
      { u: 'partner_admin', name: '渠道合伙人总管', title: '渠道销售协同', desc: '拓客报备审批 / 硬件装机发货追踪 / 佣金返点结算', tag: '内部·真实', pw: '2026' },
      { u: 'medical01', name: '医保协同席位', title: '医保监管协同', desc: '面向演示统筹区的监管协同（演示数据·带标识）', tag: '内部·协同', pw: '2026' },
    ],
  },
  staff: {
    label: '员工入口（与 CRM/wiki 同名）',
    icon: '👥',
    items: [
      { u: 'admin', name: '系统管理员', title: '用户与权限管理', desc: '增加/修改用户名 / 分配权限 / 全量审计', tag: '员工', pw: '123' },
      { u: '赵', name: '赵 董事长', title: '全局经营总览', desc: '自营设备 + 宿迁试点 + 客户资产（真实数据）', tag: '员工', pw: '123' },
      { u: '武', name: '武 董事', title: '全局经营总览', desc: '自营设备 + 宿迁试点 + 客户资产（真实数据）', tag: '员工', pw: '123' },
      { u: '吴', name: '吴 总经理', title: '全局经营总览', desc: '自营设备 + 宿迁试点 + 客户资产（真实数据）', tag: '员工', pw: '123' },
      { u: '何丹', name: '何丹 销售', title: '客户资产视图', desc: '本人名下客户机构的设备脱敏情况', tag: '员工', pw: '123' },
      { u: '张楠', name: '张楠 销售', title: '客户资产视图', desc: '本人名下客户机构的设备脱敏情况', tag: '员工', pw: '123' },
      { u: 'ceshi', name: 'ceshi 测试', title: '客户资产视图', desc: '本人名下客户机构的设备脱敏情况', tag: '员工', pw: '123' },
      { u: '王海燕', name: '王海燕 销售', title: '客户资产视图', desc: '本人名下客户机构的设备脱敏情况', tag: '员工', pw: '123' },
      { u: '周晶晶', name: '周晶晶 销售', title: '客户资产视图', desc: '本人名下客户机构的设备脱敏情况', tag: '员工', pw: '123' },
    ],
  },
  suqian: {
    label: '宿迁长护险试点（真实）',
    icon: '🌊',
    items: [
      { u: 'suqian_medical', name: '宿迁长护试点席位', title: '宿迁市医保局试点监督组', desc: '国家长护险深化试点 · 真实在网终端3台（许丽/何家齐/王雪金）', tag: '宿迁·真实', pw: '2026' },
      { u: 'medical_suqian', name: '宿迁试点专员', title: '宿迁市医保局监督组', desc: '国家长护险深化试点 · 真实长者在床遥测交叉印证', tag: '宿迁·真实', pw: '2026' },
      { u: 'suqian_insurer', name: '宿迁商保经办专班', title: '太保宿迁长护经办组', desc: '国家长护深化试点 · 真实纳管在网设备3台', tag: '宿迁·真实', pw: '2026' },
      { u: 'suqian_assessor', name: '许建强 评定师', title: '宿迁广济第三方评定中心', desc: '双人入户规范 / 真实长者在床遥测交叉印证', tag: '宿迁·真实', pw: '2026' },
      { u: 'suqian_expert', name: '孙建国 主任医师', title: '宿迁评定专家评审委员会', desc: '双专家医学会审 / 临床证据印证 / 签发评定结论书', tag: '宿迁·真实', pw: '2026' },
      { u: 'suqian_assessor_admin', name: '刘芳芳 质控主管', title: '宿迁广济中心质控部', desc: '评定全流程合规追溯 / 机构高斯正态偏离度监测', tag: '宿迁·真实', pw: '2026' },
    ],
  },
  demo: {
    label: '体验演示（模拟数据·真实遥测）',
    icon: '🎭',
    items: [
      { u: 'demo_director', name: '陈立新 副局长', title: '某某市医保局分管领导', desc: '某某市统筹大盘 / 机构信用熔断 / 评估机构长效追责终审', tag: '模拟', pw: '2026' },
      { u: 'demo_audit', name: '林志刚 稽查科长', title: '某某市医保基金监督稽核科', desc: '三大监管支柱智能巡查 / 物联证据核验 / 追回多付资金', tag: '模拟', pw: '2026' },
      { u: 'demo_finance', name: '张静 结算主管', title: '某某市医保中心长护结算科', desc: '定点机构月度结算复核 / 违规自动核减 / 电子凭证签批', tag: '模拟', pw: '2026' },
      { u: 'demo_qual', name: '刘建军 专员', title: '某某市长护待遇资格与评估监管', desc: '初评突击卧床雷达复查 / 评估师重度率偏离长效追责', tag: '模拟', pw: '2026' },
      { u: 'demo_medical', name: '某某长护综合监管', title: '某某市医保综合演示席位', desc: '长护全域数字监管演示中心 · 覆盖评估/服务/评估师三大支柱', tag: '模拟', pw: '2026' },
      { u: 'demo_insurer_director', name: '赵国华 项目总监', title: '惠生人寿经办项目部', desc: '某某市经办全盘统揽 / 医保督办回执审签 / 经办质效SLA', tag: '模拟', pw: '2026' },
      { u: 'demo_insurer_intake', name: '王雪梅 受理专员', title: '业务受理与派单调度组', desc: '失能申报材料初审 / 法定派单回避审查 / 评估任务分流', tag: '模拟', pw: '2026' },
      { u: 'demo_insurer_inspector', name: '李勇 巡查主管', title: '现场巡查与质量飞检组', desc: '物联异常靶向突击飞检 / 现场核验笔录 / 违规工单锁定', tag: '模拟', pw: '2026' },
      { u: 'demo_insurer_auditor', name: '张慧敏 审核员', title: '费用核销与结算初审组', desc: '机构月度申报经办初审 / 工单物联自动对撞核减 / 意见书盖印', tag: '模拟', pw: '2026' },
      { u: 'demo_insurer_service', name: '孙丽 综合专员', title: '参保咨询与家属申诉组', desc: '长者咨询热线答疑 / 失能等级异议申诉初核 / 服务回访', tag: '模拟', pw: '2026' },
      { u: 'demo_assessor', name: '周海峰 评定师', title: '某某市明康第三方评定中心', desc: '某某市全业务演练 · 双人现场入户 / 四维度量表测算 / 证据留痕', tag: '模拟', pw: '2026' },
      { u: 'demo_expert', name: '钱德明 主任医师', title: '某某市医学评审专家组', desc: '某某市全业务演练 · 集中医学会审 / 筛查设备客观冲突 / 会签结论', tag: '模拟', pw: '2026' },
      { u: 'demo_assessor_admin', name: '陈红 质控总监', title: '某某市明康评定质控部', desc: '某某市全业务演练 · 机构评定质量管理 / 重度失能比例动态监控', tag: '模拟', pw: '2026' },
    ],
  },
  family: {
    label: '家属视角（真实绑定）',
    icon: '👨‍👩‍👧',
    items: [
      { u: 'family_demo', name: '参保人家属', title: '亲情守护中枢', desc: '长者档案绑定 / 在线申报告知 / 体征实时感知 / 进度申诉', tag: '家属·真实', pw: '2026' },
      { u: 'xuli', name: '许丽 设备用户', title: '宿迁试点在册', desc: '守护仪实时体征 / 睡眠报告 / 跌倒预警（真实设备）', tag: '家属·真实', pw: '2026' },
      { u: 'hejiaqi', name: '何家齐 设备用户', title: '宿迁试点在册', desc: '守护仪实时体征 / 睡眠报告 / 跌倒预警（真实设备）', tag: '家属·真实', pw: '2026' },
      { u: 'wangxuejin', name: '王雪金 设备用户', title: '宿迁试点在册', desc: '守护仪实时体征 / 睡眠报告 / 跌倒预警（真实设备）', tag: '家属·真实', pw: '2026' },
      { u: 'dingzhikun', name: '丁志坤 设备用户', title: '宿迁试点在册', desc: '守护仪实时体征 / 睡眠报告 / 跌倒预警（真实设备）', tag: '家属·真实', pw: '2026' },
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

async function quickSelectRole(role: DemoRole) {
  username.value = role.u
  password.value = role.pw || '2026'
  error.value = ''
  await submit()
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
              v-model="password"
              type="password"
              name="password"
              autocomplete="current-password"
              placeholder="请输入密码 (体验/宿迁/家属: 2026 · 员工: 123)"
              :disabled="submitting"
            />
          </div>

          <div v-if="error" class="form-alert" role="alert">{{ error }}</div>

          <button class="btn-primary" type="submit" :disabled="submitting">
            {{ submitting ? '正在进入专属工作台…' : '登录进入工作台' }}
          </button>
        </form>

        <!-- 模拟角色快速体验矩阵 -->
        <section class="quick-matrix-section">
          <div class="quick-matrix-header">
            <span class="quick-matrix-title">💡 快捷体验 · 点击角色一键登录测试：</span>
          </div>

          <!-- 分类标签切换 -->
          <div class="category-tabs">
            <button
              v-for="(cat, key) in DEMO_CATEGORIES"
              :key="key"
              type="button"
              :class="['cat-tab-btn', activeCategory === key && 'active']"
              @click="activeCategory = key"
            >
              <span>{{ cat.icon }}</span>
              <span>{{ cat.label }}</span>
            </button>
          </div>

          <!-- 角色列表 -->
          <div class="role-cards-grid">
            <div
              v-for="role in DEMO_CATEGORIES[activeCategory].items"
              :key="role.u"
              class="role-card"
              :class="{ selected: username === role.u }"
              @click="quickSelectRole(role)"
              title="点击直接自动填入并登录该角色工作台"
            >
              <div class="role-card-top">
                <span class="role-name">{{ role.name }}</span>
                <span class="role-tag">{{ role.tag }}</span>
              </div>
              <div class="role-card-desc">{{ role.desc }}</div>
              <div class="role-card-account">账号: <code>{{ role.u }}</code></div>
            </div>
          </div>
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
</style>
