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
}

const activeCategory = ref<'home' | 'institution' | 'insurer' | 'supervision' | 'admin'>('home')

const DEMO_CATEGORIES: Record<'home' | 'institution' | 'insurer' | 'supervision' | 'admin', { label: string; icon: string; items: DemoRole[] }> = {
  home: {
    label: '社区居家养老',
    icon: '🏡',
    items: [
      { u: 'station_master', name: '陆振东 站长', title: '运营主管', desc: '全盘统筹 / 派单审批 / 长护险结算', tag: '机构主管' },
      { u: 'dispatch_center', name: '顾海燕 调度主管', title: '调度中心', desc: '呼援接警 / 智能派单 / 异常改派', tag: '调度协同' },
      { u: 'cg_canglang_01', name: '王小琴 照护员', title: '姑苏片区助老员', desc: '入户打卡 / 照护工单 / 服务记录', tag: '一线入户' },
      { u: 'nurse_shenyaping', name: '沈亚萍 主管护士', title: '居家专职护士', desc: '居家医嘱 / 压疮造口换药 / 巡诊', tag: '多学科团队' },
      { u: 'pt_chenjianxin', name: '陈建新 康复师', title: '物理治疗师(PT)', desc: '偏瘫肢体康复 / 防跌倒能力评定', tag: '多学科团队' },
      { u: 'qc_jiangguoqiang', name: '蒋国强 督导长', title: '质控督导主管', desc: '工单抽检验真 / 盲抽飞检 / 真实性稽核', tag: '质控合规' },
      { u: 'biller_zhouliping', name: '周丽萍 结算专员', title: '长护结算核销', desc: '长护险月度核销 / 服务凭据稽核', tag: '长护核销' },
    ],
  },
  institution: {
    label: '养老机构院舍',
    icon: '🏥',
    items: [
      { u: 'kaijian_admin', name: '凯健养老院长', title: '养老院综合管理', desc: '全院大盘 / 运营数据 / 风险质控', tag: '全院大盘' },
      { u: 'ward_4f_station', name: '4F护士站坐席', title: '护理台大屏终端', desc: '床位网格 / 呼叫应答 / 防压疮翻身', tag: '病区大屏' },
      { u: 'headnurse_4f', name: '4F护士长', title: '病区主管护士', desc: '楼层排班 / 医嘱核查 / 护理巡视', tag: '病区管理' },
      { u: 'kaijian_nurse01', name: '4F责任组长', title: '责任护工组长', desc: '分管床位 / 生理体征监测 / 异常处置', tag: '责任管床' },
    ],
  },
  insurer: {
    label: '受托商保经办',
    icon: '💼',
    items: [
      { u: 'demo_insurer_director', name: '赵国华 项目总监', title: '太保长护险项目部总监', desc: '某某市经办全盘统揽 / 医保督办回执审签 / 经办质效SLA', tag: '经办·项目总' },
      { u: 'demo_insurer_intake', name: '王雪梅 受理专员', title: '业务受理与派单调度组', desc: '失能申报材料初审 / 法定派单回避审查 / 评估任务分流', tag: '经办·受理调度' },
      { u: 'demo_insurer_inspector', name: '李勇 巡查主管', title: '现场巡查与质量飞检组', desc: '物联异常靶向突击飞检 / 现场核验笔录 / 违规工单锁定', tag: '经办·质控飞检' },
      { u: 'demo_insurer_auditor', name: '张慧敏 审核员', title: '费用核销与结算初审组', desc: '机构月度申报经办初审 / 工单物联自动对撞核减 / 意见书盖印', tag: '经办·结算初审' },
      { u: 'demo_insurer_service', name: '孙丽 综合专员', title: '参保咨询与家属申诉组', desc: '长者咨询热线答疑 / 失能等级异议申诉初核 / 服务回访', tag: '经办·客服申诉' },
      { u: 'suqian_insurer', name: '宿迁商保经办专班', title: '太保宿迁长护经办组', desc: '国家长护深化试点 · 真实纳管在网设备3台（许丽/何家齐/王雪金）', tag: '宿迁·商保专班' },
    ],
  },
  supervision: {
    label: '医保监管与政企协同',
    icon: '🛡️',
    items: [
      { u: 'demo_director', name: '陈立新 副局长', title: '某某市医保局分管领导', desc: '某某市统筹大盘 / 机构信用熔断 / 评估机构长效追责终审', tag: '演示·局领导' },
      { u: 'demo_audit', name: '林志刚 稽查科长', title: '某某市医保基金监督稽核科', desc: '三大监管支柱智能巡查 / 物联证据核验 / 追回多付资金', tag: '演示·稽核执法' },
      { u: 'demo_finance', name: '张静 结算主管', title: '某某市医保中心长护结算科', desc: '定点机构月度结算复核 / 违规自动核减 / 电子凭证签批', tag: '演示·资金结算' },
      { u: 'demo_qual', name: '刘建军 专员', title: '某某市长护待遇资格与评估监管', desc: '初评突击卧床雷达复查 / 评估师重度率偏离长效追责', tag: '演示·评估追责' },
      { u: 'demo_medical', name: '某某长护综合监管', title: '某某市医保综合演示席位', desc: '长护全域数字监管演示中心 · 覆盖评估/服务/评估师三大支柱', tag: '演示·综合专员' },
      { u: 'suqian_medical', name: '宿迁长护试点席位', title: '宿迁市医保局试点监督组', desc: '国家长护险深化试点 · 真实在网终端3台（许丽/何家齐/王雪金）', tag: '宿迁·试点监管' },
      { u: 'province_medical', name: '省医保局长护处', title: '江苏省医保局指导组', desc: '跨统筹区监管总盘 / 试点运行指导 / 综合指标监控', tag: '省级·监督指导' },
    ],
  },
  admin: {
    label: '系统运营总控',
    icon: '⚙️',
    items: [
      { u: 'su01', name: '超级管理员', title: '系统最高总控', desc: '全域多租户管理 / 账号矩阵 / 四层鉴权', tag: '全域总控' },
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
  password.value = '2026'
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
              placeholder="请输入账号 (如 station_master, kaijian_admin...)"
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
              placeholder="请输入密码 (种子密码: 2026)"
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
