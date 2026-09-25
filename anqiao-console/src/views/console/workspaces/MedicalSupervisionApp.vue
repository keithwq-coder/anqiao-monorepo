<template>
  <div class="workspace-page medical-supervision">
    <!-- 顶部工作台标识与统筹管辖信息 -->
    <div class="page-header">
      <div class="page-title-group">
        <div class="page-title-row">
          <img :src="logoSymbolDark" alt="中科安樵" class="page-title-logo" />
          <div class="page-title">{{ currentPlatformTitle }}</div>
        </div>
        <div class="page-subtitle">
          {{ currentPlatformSubtitle }}
        </div>
      </div>
      <div class="header-badges">
        <span class="badge badge-primary">{{ currentSeatTitle }}</span>
        <span
          class="badge"
          :class="dashboardData?.governance_mode?.current_mode === 'direct' ? 'badge-primary' : 'badge-info'"
        >
          {{ dashboardData?.governance_mode?.current_mode === 'direct' ? '🏛️ 医保直接监管模式' : '🤝 委托经办协同模式 (受托方: 中国太保)' }}
        </span>
        <span class="badge badge-success">🛡️ 医保政务专网: 实时连通</span>
      </div>
    </div>

    <!-- 属地行政管辖与科室协同条（市级医保账号锁定属地管理，杜绝跨市切换违和感；省级指导账号开放全省巡查视界） -->
    <div v-if="isCityPool" class="jurisdiction-bar">
      <div class="jurisdiction-info">
        <span class="j-badge">📍 属地管理辖区</span>
        <span class="j-name">{{ currentCityPoolName }}</span>
        <span class="j-scope-note">（法定属地行政监管与统筹基金安全责任主体）</span>
      </div>
      <div class="department-seats-nav">
        <span class="seats-label">科室业务协同：</span>
        <button
          type="button"
          :class="['seat-btn', activeDepartmentSeat === 'all' && 'active']"
          @click="switchDepartmentSeat('all')"
        >
          🏛️ 综合统揽
        </button>
        <button
          type="button"
          :class="['seat-btn', activeDepartmentSeat === 'audit' && 'active']"
          @click="switchDepartmentSeat('audit')"
        >
          ⚖️ 基金监督稽核科
        </button>
        <button
          type="button"
          :class="['seat-btn', activeDepartmentSeat === 'finance' && 'active']"
          @click="switchDepartmentSeat('finance')"
        >
          📑 待遇结算财务科
        </button>
        <button
          type="button"
          :class="['seat-btn', activeDepartmentSeat === 'qual' && 'active']"
          @click="switchDepartmentSeat('qual')"
        >
          📝 待遇保障与资格评估科
        </button>
      </div>
      <div class="ml-auto flex-align-center gap-2">
        <button type="button" class="btn btn-sm btn-outline" @click="refreshAll" :disabled="loading">
          {{ loading ? '同步中...' : '🔄 刷新监管数据' }}
        </button>
      </div>
    </div>

    <!-- 省级或全局指导巡查视界（仅省级/指导账号呈现） -->
    <div v-else class="jurisdiction-bar provincial-bar">
      <div class="jurisdiction-info">
        <span class="j-badge">📍 省级巡查指导视界</span>
        <span class="j-name">江苏省医疗保障局 · 长期护理保险监督指导中心</span>
      </div>
      <div class="department-seats-nav">
        <button
          type="button"
          :class="['pool-strip-btn', selectedPool === 'all' && 'active']"
          @click="changePool('all')"
        >
          🌐 江苏省全域监管总盘
        </button>
        <button
          type="button"
          :class="['pool-strip-btn', selectedPool === 'suqian' && 'active']"
          @click="changePool('suqian')"
        >
          🏙️ 宿迁市统筹区 (国家深化试点区)
        </button>
        <button
          type="button"
          :class="['pool-strip-btn', selectedPool === 'moumou' && 'active']"
          @click="changePool('moumou')"
        >
          🏛️ 某某市统筹区 (全业务演示区)
        </button>
      </div>
      <div class="ml-auto flex-align-center gap-2">
        <button type="button" class="btn btn-sm btn-outline" @click="refreshAll" :disabled="loading">
          {{ loading ? '同步中...' : '🔄 刷新监管数据' }}
        </button>
      </div>
    </div>

    <!-- 核心宏观风控大盘卡片 -->
    <div class="metric-grid">
      <div class="metric-card pointer" @click="activeTab = 'dashboard'">
        <div class="metric-num text-primary">¥{{ ((dashboardData?.funds?.fund_pool_total || 42000000) / 10000).toFixed(1) }}万</div>
        <div class="metric-label">统筹基金池总额</div>
      </div>
      <div class="metric-card pointer" @click="activeTab = 'settlements'">
        <div class="metric-num text-warning">¥{{ ((dashboardData?.funds?.monthly_pending_disbursement || 342000) / 10000).toFixed(2) }}万</div>
        <div class="metric-label">当月待终审拨付资金 ({{ pendingDisbursementCount }}笔)</div>
      </div>
      <div class="metric-card pointer" @click="activeTab = 'clues_workflow'">
        <div class="metric-num text-danger">¥{{ ((dashboardData?.funds?.deducted_funds_total || 18500) / 10000).toFixed(2) }}万</div>
        <div class="metric-label">违规核减与拒付总额</div>
      </div>
      <div class="metric-card pointer" @click="activeTab = 'dashboard'">
        <div class="metric-num text-success">{{ dashboardData?.funds?.fund_balance_rate || 97.4 }}%</div>
        <div class="metric-label">统筹基金安全结余率</div>
      </div>
      <div class="metric-card pointer" @click="activeTab = 'clues_workflow'">
        <div class="metric-num" :class="activeCluesCount > 0 ? 'text-danger' : 'text-primary'">
          <span v-if="activeCluesCount > 0" class="pulse-dot-red"></span>
          {{ activeCluesCount }} 条
        </div>
        <div class="metric-label">待交办/待裁决稽核线索</div>
      </div>
      <div class="metric-card pointer" @click="activeTab = 'penetration'">
        <div class="metric-num text-success">
          <span class="pulse-dot"></span>
          {{ onlineDevicesCount }} / {{ realDeviceList.length }}
        </div>
        <div class="metric-label">智能物联在网终端</div>
      </div>
    </div>

    <!-- 8 大专业业务导航标签 -->
    <div class="tab-nav">
      <button :class="['tab-btn', activeTab === 'dashboard' && 'active']" @click="activeTab = 'dashboard'">
        📊 基金运行态势与监管大盘
      </button>
      <button :class="['tab-btn', activeTab === 'clues_workflow' && 'active']" @click="activeTab = 'clues_workflow'">
        ⚖️ 稽核调查与行政裁决 ({{ activeCluesCount }})
      </button>
      <button :class="['tab-btn', activeTab === 'penetration' && 'active']" @click="activeTab = 'penetration'">
        🔍 辖区定点机构与照护全息档案
      </button>
      <button :class="['tab-btn', activeTab === 'settlements' && 'active']" @click="activeTab = 'settlements'">
        📑 待遇月度结算终审与拨付核准 ({{ filteredSettlements.length }})
      </button>
      <button :class="['tab-btn', activeTab === 'applications' && 'active']" @click="activeTab = 'applications'">
        📝 失能等级评定申请与行政核准 ({{ filteredApplications.length }})
      </button>
      <button :class="['tab-btn', activeTab === 'dossiers' && 'active']" @click="activeTab = 'dossiers'">
        🧓 参保长者健康档案与出院小结 ({{ filteredPersons.length }})
      </button>
      <button :class="['tab-btn', activeTab === 'devices' && 'active']" @click="activeTab = 'devices'">
        📡 在网物联客观监测与体征遥测
      </button>
      <button :class="['tab-btn', activeTab === 'assessors' && 'active']" @click="activeTab = 'assessors'">
        👥 定点服务机构名录与执业评估师 ({{ assessors.length }})
      </button>
    </div>

    <!-- ==================== Tab 1: 统筹区监管驾驶舱 ==================== -->
    <div v-if="activeTab === 'dashboard'" class="content-panel">
      <!-- 长护统筹监管与经办协同体系 -->
      <div class="governance-card mb-4">
        <div class="governance-header">
          <div class="gov-title-wrap">
            <span class="gov-icon">🏛️</span>
            <div>
              <div class="gov-title">
                {{ dashboardData?.governance_mode?.mode_title || '长护险委托经办协同监管模式' }}
              </div>
              <div class="gov-subtitle">
                {{ dashboardData?.governance_mode?.mode_desc || '全面贯彻行政监督与经办服务权责法定分离原则 · 筑牢长护统筹基金安全监管底线' }}
              </div>
            </div>
          </div>
          <div class="gov-actions">
            <button
              type="button"
              class="btn btn-sm btn-outline"
              @click="toggleGovernanceMode"
              :disabled="loading"
              title="根据统筹区行政监管与经办服务协同部署平滑切换运行模式"
            >
              🔄 切换为{{ dashboardData?.governance_mode?.current_mode === 'direct' ? '【委托经办协同模式】' : '【医保直接监管模式】' }}
            </button>
          </div>
        </div>
        <div class="gov-powers-grid">
          <div class="gov-power-box">
            <div class="power-tag tag-info">受托商业保险经办服务事项 (中国太保)</div>
            <ul class="power-list">
              <li v-for="(p, i) in dashboardData?.governance_mode?.delegated_powers" :key="i">
                ✓ {{ p }}
              </li>
            </ul>
          </div>
          <div class="gov-power-box">
            <div class="power-tag tag-primary">医疗保障行政监督与法定职责</div>
            <ul class="power-list">
              <li v-for="(p, i) in dashboardData?.governance_mode?.statutory_retained_powers" :key="i">
                ★ {{ p }}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- 宏观风控大盘：基金走势 + 预警红黄牌 -->
      <div class="dashboard-two-col mb-4">
        <!-- 左侧：统筹基金安全结余率走势 -->
        <div class="chart-box">
          <div class="flex-between mb-2">
            <span class="font-bold text-sm">📈 统筹基金月度运行结余率趋势 (近6个月)</span>
            <span class="text-xs text-success font-bold">健康区间 (≥95%)</span>
          </div>
          <div class="trend-bars">
            <div
              v-for="(item, idx) in trendItems"
              :key="idx"
              class="trend-col"
            >
              <div class="trend-val">{{ item.rate }}%</div>
              <div class="trend-bar-wrap">
                <div class="trend-bar-fill" :style="{ height: `${Math.max(25, Math.min(100, (Number(item.rate) - 90) * 10))}%` }"></div>
              </div>
              <div class="trend-lbl">{{ item.month }}</div>
            </div>
          </div>
          <div class="fund-summary-strip mt-3">
            <div>统筹基金池总盘：<strong>¥{{ ((dashboardData?.funds?.fund_pool_total || 42000000) / 10000).toFixed(0) }} 万元</strong></div>
            <div>当月待划扣拨付：<strong>¥{{ ((dashboardData?.funds?.monthly_pending_disbursement || 342000) / 10000).toFixed(2) }} 万元</strong></div>
            <div>累计追回/核减：<strong class="text-danger">¥{{ ((dashboardData?.funds?.deducted_funds_total || 18500) / 10000).toFixed(2) }} 万元</strong></div>
          </div>
        </div>

        <!-- 右侧：红黄牌预警看板 -->
        <div class="warning-box">
          <div class="flex-between mb-2">
            <span class="font-bold text-sm">🚨 统筹区合规风控预警看板</span>
            <span class="text-xs text-muted">大数据实时监测</span>
          </div>
          <div class="warning-list">
            <!-- 红色预警 -->
            <div
              v-for="item in dashboardData?.warning_boards?.red"
              :key="item.id"
              class="warning-item warning-item-red"
            >
              <div class="w-head">
                <span class="badge badge-danger">重点预警</span>
                <span class="font-bold text-xs">{{ item.target_name }}</span>
                <span class="text-muted text-xs ml-auto">{{ item.category }}</span>
              </div>
              <div class="w-title">{{ item.title }}</div>
              <div class="w-detail">{{ item.detail }}</div>
              <div class="w-advice">处置建议：{{ item.action_advice }}</div>
            </div>
            <!-- 黄色预警 -->
            <div
              v-for="item in dashboardData?.warning_boards?.yellow"
              :key="item.id"
              class="warning-item warning-item-yellow"
            >
              <div class="w-head">
                <span class="badge badge-warning">异常提醒</span>
                <span class="font-bold text-xs">{{ item.target_name }}</span>
                <span class="text-muted text-xs ml-auto">{{ item.category }}</span>
              </div>
              <div class="w-title">{{ item.title }}</div>
              <div class="w-detail">{{ item.detail }}</div>
              <div class="w-advice">处置建议：{{ item.action_advice }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 下方：定点机构五星信用评级与合规履约率榜单 -->
      <div class="institution-credits-section">
        <div class="flex-between mb-3">
          <div class="flex-align-center gap-2">
            <span class="font-bold text-sm">定点机构五星信用评级与协议履约状态</span>
            <span class="text-xs text-muted">（定点准入审核与协议履约监管）</span>
          </div>
          <button type="button" class="btn btn-sm btn-outline" @click="activeTab = 'clues_workflow'">
            查看关联疑点线索 ➔
          </button>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>定点服务机构名称</th>
                <th>统筹辖区</th>
                <th>机构性质</th>
                <th>信用评级</th>
                <th>综合评分</th>
                <th>合规履约率</th>
                <th>在管长者</th>
                <th>物联感知覆盖率</th>
                <th>协议状态</th>
                <th>最近飞检时间</th>
                <th>监管操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="inst in dashboardData?.institution_credits"
                :key="inst.org_id"
                :class="{ 'row-suspended': inst.protocol_status === 'suspended', 'row-probation': inst.protocol_status === 'probation' }"
              >
                <td>
                  <strong>{{ inst.org_name }}</strong>
                  <div class="text-xs text-muted">{{ inst.org_id }}</div>
                </td>
                <td>
                  <span class="tag tag-info">{{ inst.pool_id === 'suqian' ? '宿迁试点' : '某某市演示' }}</span>
                </td>
                <td>{{ inst.kind_label }}</td>
                <td>
                  <span class="star-rating">{{ '⭐'.repeat(inst.star_level) }}</span>
                </td>
                <td>
                  <strong>{{ inst.credit_score }}</strong> 分
                </td>
                <td>
                  <span :class="inst.compliance_rate < 95 ? 'text-danger font-bold' : 'text-success font-bold'">
                    {{ inst.compliance_rate }}%
                  </span>
                </td>
                <td>{{ inst.active_elders_count }} 人</td>
                <td>{{ inst.radar_coverage_rate }}%</td>
                <td>
                  <span
                    :class="[
                      'status-pill',
                      inst.protocol_status === 'normal' && 'status-success',
                      inst.protocol_status === 'probation' && 'status-warning',
                      inst.protocol_status === 'suspended' && 'status-danger',
                    ]"
                  >
                    {{ inst.protocol_status_label }}
                  </span>
                </td>
                <td class="text-xs text-muted">{{ inst.last_supervision_at }}</td>
                <td>
                  <div class="action-buttons">
                    <button
                      type="button"
                      class="btn btn-sm btn-outline"
                      @click="drillDownToOrg(inst.org_id)"
                    >
                      穿透调阅
                    </button>
                    <button
                      v-if="inst.protocol_status !== 'suspended'"
                      type="button"
                      class="btn btn-sm btn-warning"
                      @click="openAdjudicateForOrg(inst, 'rectify')"
                    >
                      限期整改
                    </button>
                    <button
                      v-if="inst.protocol_status !== 'suspended'"
                      type="button"
                      class="btn btn-sm btn-danger"
                      @click="openAdjudicateForOrg(inst, 'terminate')"
                    >
                      熔断黑名单
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ==================== Tab 2: 稽核调查与行政裁决 ==================== -->
    <div v-if="activeTab === 'clues_workflow'" class="content-panel">
      <!-- 全网风控巡检与筛选栏 -->
      <div class="clue-control-strip mb-3">
        <div class="flex-align-center gap-2">
          <button
            type="button"
            class="btn btn-primary"
            @click="triggerClueScan"
            :disabled="scanning"
          >
            {{ scanning ? '正在全网巡检扫描中...' : '⚡ 启动全网合规风控巡检' }}
          </button>
          <span class="text-xs text-muted">
            （基于在床物联感知、工单打卡轨迹及临床病历多源核验）
          </span>
        </div>
        <div class="flex-align-center gap-2">
          <select v-model="clueFilterRisk" class="form-input-sm" @change="loadClues">
            <option value="">全部风险级别</option>
            <option value="red">红色重特大违规疑点</option>
            <option value="yellow">黄色一般异常疑点</option>
          </select>
          <select v-model="clueFilterStatus" class="form-input-sm" @change="loadClues">
            <option value="">全部处理状态</option>
            <option value="pending_dispatch">待下发督办函</option>
            <option value="dispatched">经办现场核查中</option>
            <option value="feedback_received">经办已回传待裁决</option>
            <option value="adjudicated">医保已终审裁决</option>
          </select>
        </div>
      </div>

      <!-- 疑点线索与行政处置流转列表 -->
      <div v-if="clues.length === 0" class="empty-state-card">
        <div class="empty-icon">🛡️</div>
        <div class="empty-title">当前统筹区暂无未办结的疑点线索</div>
        <div class="empty-desc">
          所有异常线索均已核查处理完毕。点击上方按钮可重新启动全网合规风控巡检。
        </div>
      </div>
      <div v-else class="clue-cards-list">
        <div
          v-for="clue in clues"
          :key="clue.clue_id"
          class="clue-card"
          :class="clue.risk_level === 'red' ? 'clue-card-red' : 'clue-card-yellow'"
        >
          <!-- 卡片顶栏 -->
          <div class="clue-card-header">
            <div class="flex-align-center gap-2">
              <span class="font-mono font-bold">{{ clue.clue_id }}</span>
              <span :class="clue.risk_level === 'red' ? 'tag tag-danger font-bold' : 'tag tag-warning font-bold'">
                {{ clue.risk_level === 'red' ? '🚨 红色警报' : '⚠️ 黄色提醒' }}
              </span>
              <span class="tag tag-info">{{ clue.source_label }}</span>
              <span class="text-xs text-muted">{{ clue.pool_id === 'suqian' ? '宿迁统筹区' : '某某市统筹区' }}</span>
            </div>
            <div class="clue-status-pill">
              <span
                :class="[
                  'status-pill',
                  clue.status === 'pending_dispatch' && 'status-warning',
                  clue.status === 'dispatched' && 'status-warning',
                  clue.status === 'feedback_received' && 'status-warning font-bold',
                  clue.status === 'adjudicated' && 'status-success',
                ]"
              >
                {{ formatClueStatus(clue.status) }}
              </span>
            </div>
          </div>

          <!-- 标题与涉案主体信息 -->
          <div class="clue-title">{{ clue.title }}</div>
          <div class="clue-subject-grid">
            <div><span class="text-muted text-xs">涉案机构：</span><strong>{{ clue.target_org_name }}</strong></div>
            <div><span class="text-muted text-xs">责任助老员：</span><strong>{{ clue.caregiver_name }}</strong></div>
            <div><span class="text-muted text-xs">服务对象：</span><strong>{{ clue.elderly_name }}</strong> ({{ clue.person_id }})</div>
            <div><span class="text-muted text-xs">监测设备：</span><span class="font-mono">{{ clue.device_id }}</span></div>
          </div>

          <!-- 异常客观事实描述 -->
          <div class="clue-desc-box">
            <div class="desc-lbl">📋 客观异常事实描述：</div>
            <div class="desc-val">{{ clue.description }}</div>
          </div>

          <!-- 阶段 1: 督办函信息展示 -->
          <div v-if="clue.dispatch_order" class="pipeline-stage-box stage-dispatched">
            <div class="stage-title text-primary">
              📜 《长期护理保险核查督办函》已下发 · 文号：{{ clue.dispatch_order.order_no }}
            </div>
            <div class="stage-content">
              <div>下发对象：<strong>{{ clue.dispatch_order.dispatched_to === 'insurer01' ? '中国太平洋财产保险股份有限公司长护经办部' : clue.dispatch_order.dispatched_to }}</strong></div>
              <div>办结时限：<strong>{{ clue.dispatch_order.due_hours }} 小时内</strong> | 下发人：{{ clue.dispatch_order.dispatched_by }} ({{ clue.dispatch_order.dispatched_at }})</div>
              <div>核查要点：{{ clue.dispatch_order.inquiry_points }}</div>
            </div>
          </div>

          <!-- 阶段 2: 经办现场反馈信息展示 -->
          <div v-if="clue.feedback" class="pipeline-stage-box stage-feedback">
            <div class="stage-title text-warning">
              📝 受托经办机构现场调查反馈与初核建议
            </div>
            <div class="stage-content">
              <div>调查人员：<strong>{{ clue.feedback.feedback_by }}</strong> | 回传时间：{{ clue.feedback.feedback_at }}</div>
              <div>上门笔录：{{ clue.feedback.interview_notes }}</div>
              <div>现场物证：{{ clue.feedback.objective_snapshot }}</div>
              <div class="pre-advisory font-bold text-danger">
                经办初核建议：{{ clue.feedback.pre_advisory_label }}
              </div>
            </div>
          </div>

          <!-- 阶段 3: 医保局行政终审裁决信息展示 -->
          <div v-if="clue.adjudication" class="pipeline-stage-box stage-adjudicated">
            <div class="stage-title text-success">
              🏛️ 医疗保障局行政处理决定书 · 文号：{{ clue.adjudication.doc_no }}
            </div>
            <div class="stage-content">
              <div>裁决主审官：<strong>{{ clue.adjudication.adjudicated_by }}</strong> | 裁决时间：{{ clue.adjudication.adjudicated_at }}</div>
              <div class="decision-line">
                终审裁决结论：
                <span class="decision-badge font-bold">{{ clue.adjudication.decision_label }}</span>
                <span v-if="clue.adjudication.penalty_amount > 0" class="penalty-tag ml-2 font-bold text-danger">
                  核减拒付资金：¥{{ clue.adjudication.penalty_amount }} 元
                </span>
              </div>
              <div>行政处理批语：{{ clue.adjudication.remarks }}</div>
            </div>
          </div>

          <!-- 卡片底部操作按钮 -->
          <div class="clue-footer-actions">
            <button
              v-if="clue.status === 'pending_dispatch'"
              type="button"
              class="btn btn-primary"
              @click="openDispatchModal(clue)"
            >
              📥 下达《核查督办函》至经办专班
            </button>
            <button
              v-if="clue.status === 'dispatched'"
              type="button"
              class="btn btn-warning"
              @click="openFeedbackModal(clue)"
            >
              ✍️ 受托经办回传现场调查反馈
            </button>
            <button
              v-if="clue.status === 'feedback_received' || clue.status === 'dispatched'"
              type="button"
              class="btn btn-danger"
              @click="openAdjudicateModal(clue)"
            >
              ⚖️ 医保局行政终审裁决
            </button>
            <button
              type="button"
              class="btn btn-outline"
              @click="drillDownToElder(clue.person_id)"
            >
              🔍 穿透调阅该长者全息证据
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== Tab 3: 辖区定点机构与照护全息档案 ==================== -->
    <div v-if="activeTab === 'penetration'" class="content-panel">
      <!-- 穿透导航面包屑 -->
      <div class="penetration-breadcrumb mb-3">
        <span class="bc-lbl">🔍 调阅层级路径：</span>
        <button
          type="button"
          :class="['bc-btn', currentPenLevel >= 1 && 'active']"
          @click="resetPenLevel(1)"
        >
          统筹辖区 ({{ penSelectedPool?.name || (selectedPool === 'suqian' ? '宿迁试点区' : (selectedPool === 'moumou' ? '某某市演示区' : '全域统筹视界')) }})
        </button>
        <span class="bc-arrow">➔</span>
        <button
          type="button"
          :class="['bc-btn', currentPenLevel >= 2 && 'active']"
          @click="resetPenLevel(2)"
          :disabled="!penSelectedOrg"
        >
          定点服务机构 ({{ penSelectedOrg?.name || '请选择定点机构' }})
        </button>
        <span class="bc-arrow">➔</span>
        <button
          type="button"
          :class="['bc-btn', currentPenLevel >= 3 && 'active']"
          @click="resetPenLevel(3)"
          :disabled="!penSelectedCaregiver"
        >
          责任助老员 ({{ penSelectedCaregiver?.name || '请选择助老员' }})
        </button>
        <span class="bc-arrow">➔</span>
        <button
          type="button"
          :class="['bc-btn', currentPenLevel >= 4 && 'active']"
          :disabled="!penSelectedElder"
        >
          参保长者与家庭终端 ({{ penSelectedElder?.name || '请选择长者' }})
        </button>
      </div>

      <!-- Level 1: 统筹辖区大盘选择 -->
      <div v-if="currentPenLevel === 1" class="pen-level-1">
        <div class="section-title">一级监管中枢：属地统筹辖区</div>
        <div class="pool-card-grid">
          <div
            v-for="p in filteredPenPools"
            :key="p.pool_id"
            class="pen-pool-card"
            @click="selectPenPool(p)"
          >
            <div class="font-bold text-lg text-primary">{{ p.name }}</div>
            <div class="text-xs text-muted mt-1">{{ p.desc }}</div>
            <div class="pen-stat-strip mt-3">
              <div>定点机构：<strong>{{ p.orgs_count }} 家</strong></div>
              <div>在网终端：<strong>{{ p.devices_count }} 台</strong></div>
              <div>监管长者：<strong>{{ p.elders_count }} 人</strong></div>
              <div>合规率：<strong class="text-success">{{ p.compliance_rate }}%</strong></div>
            </div>
            <div class="mt-3 text-right">
              <span class="btn btn-sm btn-primary">查看辖区定点机构 ➔</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Level 2: 定点机构名录 -->
      <div v-if="currentPenLevel === 2" class="pen-level-2">
        <div class="flex-between mb-3">
          <div class="section-title">二级机构名录：【{{ penSelectedPool?.name }}】定点医疗与养老照护机构</div>
          <button type="button" class="btn btn-sm btn-outline" @click="resetPenLevel(1)">
            ⬅ 返回上级统筹区
          </button>
        </div>
        <div class="pen-org-grid">
          <div
            v-for="org in filteredPenOrgs"
            :key="org.org_id"
            class="pen-org-card"
            @click="selectPenOrg(org)"
          >
            <div class="flex-between">
              <span class="font-bold text-md">{{ (org as any).name || org.org_name }}</span>
              <span class="tag tag-info">{{ org.kind_label }}</span>
            </div>
            <div class="text-xs text-muted mt-1">机构代码: {{ org.org_id }}</div>
            <div class="flex-align-center gap-2 mt-2">
              <span class="star-rating">{{ '⭐'.repeat(org.star_level) }}</span>
              <span class="text-xs">信用分: <strong>{{ org.credit_score }}</strong></span>
              <span class="text-xs">履约率: <strong class="text-success">{{ org.compliance_rate }}%</strong></span>
            </div>
            <div class="cg-list-preview mt-2 text-xs text-muted">
              在册助老员：{{ (org.caregivers || []).join('、') }}
            </div>
            <div class="mt-3 text-right">
              <span class="btn btn-sm btn-outline">查看护理人员 ➔</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Level 3: 助老员及分管长者名录 -->
      <div v-if="currentPenLevel === 3" class="pen-level-3">
        <div class="flex-between mb-3">
          <div class="section-title">三级执业人员：【{{ penSelectedOrg?.name }}】在册专职护理与助老员</div>
          <button type="button" class="btn btn-sm btn-outline" @click="resetPenLevel(2)">
            ⬅ 返回机构名录
          </button>
        </div>
        <div class="pen-caregiver-grid">
          <div
            v-for="cg in filteredPenCaregivers"
            :key="cg.name"
            class="pen-cg-card"
            @click="selectPenCaregiver(cg)"
          >
            <div class="flex-between">
              <span class="font-bold text-md">{{ cg.name }}</span>
              <span class="tag tag-primary">{{ cg.role }}</span>
            </div>
            <div class="text-xs text-muted mt-1">证书编号: {{ cg.certificate_no }} | 联系方式: {{ cg.phone }}</div>
            <div class="pen-cg-metrics mt-2">
              <div>NFC打卡准确率：<strong>{{ cg.punch_accuracy_rate }}%</strong></div>
              <div>在床雷达印证率：<strong class="text-success">{{ cg.radar_match_rate }}%</strong></div>
              <div>近期疑点线索：<strong :class="cg.recent_clues_count > 0 ? 'text-danger' : 'text-muted'">{{ cg.recent_clues_count }} 次</strong></div>
            </div>
            <div class="active-elders-strip mt-2 text-xs">
              <strong>分管长者：</strong>{{ (cg.active_elders || []).join('、') }}
            </div>
            <div class="mt-3 text-right">
              <span class="btn btn-sm btn-primary">查看物联感知与服务凭据 ➔</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Level 4: 长者家庭与物联在床雷达全息透视透镜 -->
      <div v-if="currentPenLevel === 4" class="pen-level-4">
        <div class="flex-between mb-3">
          <div class="section-title">
            四级终端台账：【{{ penSelectedElder?.name }}】家庭物联感知与服务核验证据链
          </div>
          <button type="button" class="btn btn-sm btn-outline" @click="resetPenLevel(3)">
            ⬅ 返回助老员名录
          </button>
        </div>

        <div class="elder-evidence-dossier">
          <!-- 长者概况横幅 -->
          <div class="elder-banner">
            <div>长者姓名：<strong>{{ penSelectedElder?.name }}</strong> ({{ penSelectedElder?.person_id }})</div>
            <div>失能等级：<span class="tag tag-danger font-bold">{{ penSelectedElder?.disability_level }}</span></div>
            <div>责任助老员：<strong>{{ penSelectedElder?.caregiver_name }}</strong></div>
            <div>感知设备：<span class="font-mono">{{ penSelectedElder?.device_id }} ({{ penSelectedElder?.model }})</span></div>
            <div>设备状态：<span class="pulse-dot"></span> 在线监测中</div>
            <div>最近入户打卡：{{ penSelectedElder?.last_activity_time }}</div>
          </div>

          <!-- 物联雷达核心证据指标 -->
          <div class="evidence-metrics-grid mt-3">
            <div class="ev-metric-card">
              <div class="ev-lbl">实时雷达在床状态</div>
              <div class="ev-val text-success font-bold">
                {{ penSelectedElder?.in_bed ? '🛌 在床有体征' : '🚶 离床活动中' }}
              </div>
              <div class="ev-sub">生命体征状态: 监测中</div>
            </div>
            <div class="ev-metric-card">
              <div class="ev-lbl">实时呼吸 / 心率遥测</div>
              <div class="ev-val text-primary font-bold">
                {{ penSelectedElder?.recent_vitals?.hr || 74 }} bpm / {{ penSelectedElder?.recent_vitals?.br || 19 }} 次
              </div>
              <div class="ev-sub">毫米波雷达非接触遥测</div>
            </div>
            <div class="ev-metric-card">
              <div class="ev-lbl">14天连续在床率分析</div>
              <div class="ev-val font-bold text-success">
                {{ penSelectedElder?.bed_rest_ratio_14d || '76.8%' }}
              </div>
              <div class="ev-sub">客观印证重度失能卧床状态</div>
            </div>
            <div class="ev-metric-card">
              <div class="ev-lbl">入户打卡交叉比对</div>
              <div class="ev-val font-bold text-primary">
                100% 吻合
              </div>
              <div class="ev-sub">打卡时间窗口雷达均检测到在场</div>
            </div>
          </div>

          <!-- 物联证据与合规审查框 -->
          <div class="compliance-box-alert mt-4">
            <div class="flex-align-center gap-2 font-bold mb-1 text-primary">
              <span>🛡️ 医保基金反欺诈多源证据印证核验结论</span>
            </div>
            <div class="text-xs line-height-relaxed text-muted">
              该长者居家安装的毫米波微动感知雷达连续14天数据表明：夜间在床率极高，体征曲线窦性平稳，无异常离床行为。与助老员打卡记录、经办现场走访笔录、三甲医院临床出院病历形成坚实客观证据闭环。
              <strong>【监管合规说明】：智能硬件与物联传感器数据仅作为长者生活体征与卧床状态的客观辅助佐证，严禁算法自动定级。失能等级法定结论严格遵循国家 ADL 评估量表标准，由医保专班结合经办现场调查依法行政认定。</strong>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== Tab 4: 月度结算终审与拨付凭证 ==================== -->
    <div v-if="activeTab === 'settlements'" class="content-panel">
      <!-- 结算审核推进流程栏 -->
      <div class="workflow-stepper mb-4">
        <div class="stepper-title">长期护理保险定点服务待遇月度结算审核流程</div>
        <div class="stepper-pipeline">
          <div class="pipeline-step completed">
            <div class="step-num">1</div>
            <div class="step-name">定点机构月度申报</div>
            <div class="step-sub">汇总工单、照护明细</div>
          </div>
          <div class="pipeline-arrow">➔</div>
          <div class="pipeline-step completed">
            <div class="step-num">2</div>
            <div class="step-name">商保经办初审</div>
            <div class="step-sub">工单抽查、证据比对</div>
          </div>
          <div class="pipeline-arrow">➔</div>
          <div class="pipeline-step current">
            <div class="step-num">3</div>
            <div class="step-name">医保专班行政终审</div>
            <div class="step-sub">大数据复勘、违规核减</div>
          </div>
          <div class="pipeline-arrow">➔</div>
          <div class="pipeline-step">
            <div class="step-num">4</div>
            <div class="step-name">统筹基金划扣拨付</div>
            <div class="step-sub">生成官方凭证、银行批拨</div>
          </div>
        </div>
      </div>

      <!-- 结算单列表 -->
      <div class="flex-between mb-3">
        <div class="flex-align-center gap-2">
          <span class="font-bold text-sm">长护统筹定点服务机构月度结算申拨列表</span>
          <span class="text-muted text-xs">（经办业务初审与医保行政终审双签核定）</span>
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>结算批次单号</th>
              <th>申报定点服务机构</th>
              <th>所属统筹区</th>
              <th>结算月份</th>
              <th>申报金额</th>
              <th>当前状态</th>
              <th>经办初审意见</th>
              <th>医保终审操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="set in filteredSettlements" :key="set.settlement_id">
              <td>
                <span class="font-mono font-bold">{{ set.settlement_id }}</span>
              </td>
              <td>
                <strong>{{ set.org_name || formatServiceOrg(set.org_id || '') }}</strong>
                <div class="text-xs text-muted">{{ set.org_id }}</div>
              </td>
              <td>
                <span class="tag tag-info">{{ set.pool_id === 'suqian' ? '宿迁试点' : '某某市演示' }}</span>
              </td>
              <td>{{ set.period }}</td>
              <td>
                <span class="font-bold text-primary">¥{{ (set.amount || 0).toLocaleString() }}</span>
              </td>
              <td>
                <span
                  :class="[
                    'status-pill',
                    set.status === 'declared' && 'status-warning',
                    set.status === 'pre_reviewed' && 'status-warning font-bold',
                    set.status === 're_reviewed' && 'status-success',
                    set.status === 'disbursed' && 'status-success font-bold',
                  ]"
                >
                  {{ formatSettlementStatus(set.status) }}
                </span>
              </td>
              <td class="text-xs">
                <div v-if="set.pre_reviewed_by">
                  <span class="text-success font-bold">✓ 经办已初审：</span>{{ set.pre_reviewed_by }}
                  <div class="text-muted">{{ set.pre_review_notes || '服务工单核对无误，建议医保终审拨付' }}</div>
                </div>
                <div v-else class="text-muted">
                  待经办初审核验
                </div>
              </td>
              <td>
                <div class="action-buttons">
                  <!-- 医保专员终审确认 -->
                  <button
                    v-if="set.status === 'pre_reviewed'"
                    type="button"
                    class="btn btn-sm btn-primary"
                    @click="executeFinalSettlementReview(set)"
                  >
                    🏛️ 医保行政终审
                  </button>
                  <!-- 调阅/打印官方电子支付凭证 -->
                  <button
                    v-if="set.status === 're_reviewed' || set.status === 'disbursed' || set.voucher"
                    type="button"
                    class="btn btn-sm btn-success"
                    @click="viewSettlementVoucher(set)"
                  >
                    📜 查阅统筹基金拨付凭证
                  </button>
                  <button
                    v-if="set.status === 'declared'"
                    type="button"
                    class="btn btn-sm btn-outline"
                    title="待商业保险经办机构完成业务初审后方可提交终审"
                    disabled
                  >
                    等待经办初审
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ==================== Tab 5: 失能评估申请流转 ==================== -->
    <div v-if="activeTab === 'applications'" class="content-panel">
      <div class="flex-between mb-3">
        <div class="flex-align-center gap-2">
          <span class="font-bold text-sm">失能评估申报案件池与四等级客观核验</span>
          <span class="text-muted text-xs">（展示法定申报门槛初核、入户评估分值及医保终审核定）</span>
        </div>
      </div>
      <div v-if="filteredApplications.length === 0" class="empty-state-card">
        <div class="empty-icon">📂</div>
        <div class="empty-title">当前统筹区暂无失能申请案件</div>
        <div class="empty-desc">当前暂无待处理失能申请案件，系统实时对接参保人与定点机构申报数据。</div>
      </div>
      <div v-else class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>申请单号</th>
              <th>申报人姓名</th>
              <th>统筹区</th>
              <th>评估环节客观核验 (支柱一: 病人/家属监管)</th>
              <th>申报类型</th>
              <th>初评申请等级</th>
              <th>审核状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="app in filteredApplications" :key="app.application_id">
              <td><span class="font-mono font-bold">{{ app.application_id }}</span></td>
              <td><strong>{{ app.applicant_name || app.applicant_id }}</strong></td>
              <td><span class="tag tag-info">{{ (app as any).pool_id === 'suqian' ? '宿迁试点' : '某某市演示' }}</span></td>
              <td>
                <div v-if="(app as any).objective_device_conflict" class="text-danger font-bold text-xs">
                  <span class="tag tag-danger">🚨 突击卧床/雷达冲突</span>
                  {{ (app as any).objective_conflict_desc }}
                </div>
                <div v-else class="text-success text-xs">
                  <span class="tag tag-success">✅ 雷达体征一致</span>
                  体征垫与毫米波雷达连续体征吻合失能评定等级
                </div>
              </td>
              <td>{{ app.application_type === 'first' ? '首次申请' : '期满复评' }}</td>
              <td><span class="tag tag-primary">{{ app.applied_level || '重度失能Ⅱ级' }}</span></td>
              <td><span class="status-pill status-warning">{{ formatStatus(app.status) }}</span></td>
              <td>
                <button type="button" class="btn btn-sm btn-outline" @click="viewMedicalRecord(app.applicant_id)">
                  临床病历
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ==================== Tab 6: 被监管长者健康档案 ==================== -->
    <div v-if="activeTab === 'dossiers'" class="content-panel">
      <div class="flex-between mb-3">
        <div class="flex-align-center gap-2">
          <span class="font-bold text-sm">在管长者健康档案与临床诊疗记录</span>
          <span class="text-muted text-xs">（支持在线查阅定点医疗机构诊断证明、出院小结及电子签章）</span>
        </div>
      </div>
      <div class="dossier-grid">
        <div v-for="p in filteredPersons" :key="p.person_id" class="dossier-card">
          <div class="dossier-card-head">
            <div>
              <div class="dossier-name">{{ p.name }}</div>
              <div class="text-xs text-muted">{{ p.gender === 'male' ? '男' : '女' }} · {{ p.age }} 岁 · {{ p.person_id }}</div>
            </div>
            <span class="tag tag-danger font-bold">{{ p.disability_level }}</span>
          </div>
          <div class="dossier-info-list mt-2">
            <div><span class="text-muted text-xs">定点服务机构：</span>{{ formatServiceOrg(p.org_id || p.service_org_id || '') }}</div>
            <div><span class="text-muted text-xs">定点监护设备：</span><span class="font-mono">{{ p.device_id }}</span></div>
            <div><span class="text-muted text-xs">居住详细地址：</span>{{ p.address }}</div>
          </div>
          <div class="mt-3 flex-between">
            <span class="text-xs text-muted">出院小结: 医疗机构已归档</span>
            <button type="button" class="btn btn-sm btn-primary" @click="viewMedicalRecord(p.person_id)">
              🏥 调阅临床出院病历
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== Tab 7: 智能物联终端在网监测 ==================== -->
    <div v-if="activeTab === 'devices'" class="content-panel">
      <!-- 动态心电示波卡片 -->
      <div class="ecg-telemetry-strip mb-4">
        <div class="ecg-strip-head flex-between">
          <div class="flex-align-center gap-2">
            <span class="pulse-indicator"></span>
            <span class="font-bold text-sm">毫米波雷达实时微动遥测示波器</span>
            <span class="text-xs text-muted">（实时遥测通道已建立 · 硬件数据高频上报）</span>
          </div>
          <span class="badge badge-success">采样率 50Hz · 非接触式连续监测</span>
        </div>
        <div class="ecg-canvas-wrap">
          <canvas ref="ecgCanvasRef" class="ecg-canvas"></canvas>
        </div>
        <div class="ecg-strip-foot flex-between text-xs text-muted">
          <span>当前监护长者：{{ liveTelemetry?.person_name || '许丽' }} ({{ liveTelemetry?.person_id || 'P_SQ_01' }})</span>
          <span>心率: {{ liveTelemetry?.current_heart_rate || 72 }} bpm | 呼吸: {{ liveTelemetry?.current_breath_rate || 18 }} 次/分</span>
          <span>信号质量: {{ liveTelemetry?.signal_quality || 99 }}%</span>
        </div>
      </div>

      <!-- 设备选择网格 -->
      <div class="section-title mb-2">选择在线设备快速调阅遥测情况：</div>
      <div class="device-badge-grid mb-4">
        <div
          v-for="d in realDeviceList"
          :key="d.sn"
          :class="['device-pill-card', selectedDeviceId === d.sn && 'active']"
          @click="selectDevice(d.sn)"
        >
          <div class="d-pill-head">
            <span class="pulse-indicator-sm"></span>
            <span class="font-mono font-bold">{{ d.sn }}</span>
            <span class="tag tag-info text-xs">{{ d.pool === 'suqian' ? '宿迁' : '某某' }}</span>
          </div>
          <div class="d-pill-body">
            <div class="font-bold text-xs">{{ d.name }}</div>
            <div class="text-muted text-xs">{{ d.area }}</div>
          </div>
        </div>
      </div>

      <!-- 实时遥测详情面板 -->
      <div v-if="liveTelemetry" class="telemetry-dashboard">
        <div class="telemetry-header">
          <div>
            <span class="font-bold text-md">{{ liveTelemetry.person_name }} ({{ liveTelemetry.person_id }})</span>
            <span class="text-muted text-xs ml-2">设备: {{ liveTelemetry.device_id }} ({{ liveTelemetry.model }})</span>
          </div>
          <div>
            <span :class="liveTelemetry.in_bed ? 'badge badge-success' : 'badge badge-warning'">
              {{ liveTelemetry.in_bed ? '🛌 当前在床' : '🚶 当前离床' }}
            </span>
          </div>
        </div>
        <div class="vitals-strip">
          <div class="vital-card">
            <div class="vital-lbl">实时心率</div>
            <div class="vital-val text-primary">{{ liveTelemetry.current_heart_rate }} <span class="unit">bpm</span></div>
            <div class="vital-sub">窦性平稳</div>
          </div>
          <div class="vital-card">
            <div class="vital-lbl">实时呼吸率</div>
            <div class="vital-val text-success">{{ liveTelemetry.current_breath_rate }} <span class="unit">次/分</span></div>
            <div class="vital-sub">呼吸节律规律</div>
          </div>
          <div class="vital-card">
            <div class="vital-lbl">今日连续在床时长</div>
            <div class="vital-val text-warning">{{ Math.floor(liveTelemetry.in_bed_duration_minutes / 60) }} <span class="unit">小时</span> {{ liveTelemetry.in_bed_duration_minutes % 60 }} <span class="unit">分</span></div>
            <div class="vital-sub">近24小时持续监测</div>
          </div>
          <div class="vital-card">
            <div class="vital-lbl">14天卧床时间占比</div>
            <div class="vital-val font-bold">{{ liveTelemetry.window_14d_stats?.bed_rest_ratio_14d }}</div>
            <div class="vital-sub">客观印证长期卧床失能</div>
          </div>
        </div>

        <div class="correlation-card mt-3">
          <div class="correlation-title">🔍 医保监管物联设备客观一致性印证</div>
          <div class="text-xs line-height-relaxed text-muted">
            {{ liveTelemetry.objective_consistency_evaluation?.correlation_reason }}
          </div>
          <div class="mt-2 text-xs text-danger font-bold">
            {{ liveTelemetry.objective_consistency_evaluation?.disclaimer }}
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== Tab 8: 执业评估人员与定点机构 ==================== -->
    <div v-if="activeTab === 'assessors'" class="content-panel">
      <div class="flex-between mb-3">
        <div class="flex-align-center gap-2">
          <span class="font-bold text-sm">执业评估师资质矩阵与长效追责监管（支柱三: 评估师/评估机构长效追责制）</span>
          <span class="text-muted text-xs">（长效追责机制：严密追踪评估师评定等级与后续物联遥测偏离度、重度失能虚高偏离、法定利益回避与执业准入熔断）</span>
        </div>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>评估师姓名</th>
              <th>执业证书编号</th>
              <th>所属评估机构</th>
              <th>法定回避服务机构</th>
              <th>重度评定率 (偏离预警)</th>
              <th>医保终审符合率</th>
              <th>长效追责合规处置状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="asr in assessors" :key="asr.id">
              <td>
                <strong>{{ asr.name }}</strong>
                <span v-if="(asr as any).active_status === 'suspended'" class="tag tag-danger ml-1">长效追责中</span>
                <span v-else class="tag tag-success ml-1">正常执业</span>
              </td>
              <td class="font-mono text-xs">{{ asr.certificate_no }}</td>
              <td>{{ asr.org_name }}</td>
              <td>
                <span v-for="org in asr.avoidance_org_names" :key="org" class="tag tag-danger mr-1">
                  🚫 回避: {{ org }}
                </span>
              </td>
              <td>
                <span :class="(asr as any).severe_disability_rate > 50 ? 'text-danger font-bold' : 'text-primary'">
                  {{ (asr as any).severe_disability_rate || 28.5 }}%
                  <small v-if="(asr as any).severe_disability_rate > 50"> (异常偏高)</small>
                </span>
              </td>
              <td>
                <span :class="asr.accuracy_ratification_rate < 60 ? 'text-danger font-bold' : 'text-success font-bold'">
                  {{ asr.accuracy_ratification_rate }}%
                </span>
              </td>
              <td>
                <div v-if="(asr as any).active_status === 'suspended'">
                  <span class="tag tag-danger">🛑 暂停执业 / 立案追责</span>
                  <div class="text-danger text-xs mt-1">{{ asr.ethics_record }}</div>
                </div>
                <div v-else>
                  <span class="tag tag-success">✅ 优良</span>
                  <span class="text-muted text-xs ml-1">{{ asr.ethics_record }}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ==================== 模态框 1: 下发《长护险现场核查督办函》模态框 ==================== -->
    <div v-if="showDispatchModal" class="modal-backdrop" @click="showDispatchModal = false">
      <div class="modal-dialog" @click.stop>
        <div class="modal-header">
          <div class="font-bold text-primary">🏛️ 下达《长护险现场核查督办函》</div>
          <button class="close-btn" @click="showDispatchModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="panel-alert mb-3">
            医保局向受托商保经办机构下达现场走访督办指令。经办机构须在规定时限内上门长者家庭固定证据并回传。
          </div>
          <div class="form-group mb-2">
            <label class="text-xs text-muted">案件线索单号：</label>
            <div class="font-mono font-bold">{{ activeClue?.clue_id }} - {{ activeClue?.title }}</div>
          </div>
          <div class="form-group mb-2">
            <label class="text-xs text-muted">受托经办机构：</label>
            <input type="text" v-model="dispatchForm.dispatched_to" class="form-input" disabled />
          </div>
          <div class="form-group mb-2">
            <label class="text-xs text-muted">核查办结时限 (小时)：</label>
            <select v-model="dispatchForm.due_hours" class="form-input">
              <option :value="12">12 小时内 (特急疑点)</option>
              <option :value="24">24 小时内 (常规重点疑点)</option>
              <option :value="48">48 小时内 (一般核实)</option>
            </select>
          </div>
          <div class="form-group mb-2">
            <label class="text-xs text-muted">现场核查重点指令：</label>
            <textarea
              v-model="dispatchForm.inquiry_points"
              rows="3"
              class="form-input"
              placeholder="请输入现场走访核查要点..."
            ></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline mr-2" @click="showDispatchModal = false">取消</button>
          <button class="btn btn-primary" @click="submitDispatch">确认下发督办函</button>
        </div>
      </div>
    </div>

    <!-- ==================== 模态框 2: 受托经办机构现场反馈模态框 ==================== -->
    <div v-if="showFeedbackModal" class="modal-backdrop" @click="showFeedbackModal = false">
      <div class="modal-dialog" @click.stop>
        <div class="modal-header">
          <div class="font-bold text-warning">✍️ 受托经办机构现场调查反馈录入</div>
          <button class="close-btn" @click="showFeedbackModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group mb-2">
            <label class="text-xs text-muted">督办函单号：</label>
            <div class="font-mono font-bold">{{ activeClue?.dispatch_order?.order_no || activeClue?.clue_id }}</div>
          </div>
          <div class="form-group mb-2">
            <label class="text-xs text-muted">现场走访家属笔录与事实调查：</label>
            <textarea
              v-model="feedbackForm.interview_notes"
              rows="3"
              class="form-input"
              placeholder="录入经办专员上门走访笔录与长者家属陈述..."
            ></textarea>
          </div>
          <div class="form-group mb-2">
            <label class="text-xs text-muted">经办初核建议结论：</label>
            <select v-model="feedbackForm.pre_advisory" class="form-input">
              <option value="suggest_deduct">建议扣减当月该笔工单拨付款，并约谈机构负责人</option>
              <option value="suggest_interview">建议行政约谈定点机构负责人并加强合规培训</option>
              <option value="suggest_rectify">建议下发限期整改通知书，停单整顿</option>
              <option value="suggest_terminate">情节严重，建议医保局启动暂停协议熔断程序</option>
              <option value="suggest_pass">事实澄清，建议合规放行并核销线索</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline mr-2" @click="showFeedbackModal = false">取消</button>
          <button class="btn btn-warning" @click="submitFeedback">回传经办核查反馈</button>
        </div>
      </div>
    </div>

    <!-- ==================== 模态框 3: 医保局行政终审裁决模态框 ==================== -->
    <div v-if="showAdjudicateModal" class="modal-backdrop" @click="showAdjudicateModal = false">
      <div class="modal-dialog" @click.stop>
        <div class="modal-header">
          <div class="font-bold text-danger">⚖️ 医保局行政终审裁决与文号签发</div>
          <button class="close-btn" @click="showAdjudicateModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="panel-alert mb-3">
            医疗保障局专班行使法定唯一行政执法权。裁决将自动生成行政处理文号并直接联动定点协议与资金划扣。
          </div>
          <div class="form-group mb-2">
            <label class="text-xs text-muted">处理目标对象：</label>
            <div class="font-bold">{{ activeClue?.target_org_name || targetOrgForAdjudicate?.org_name }}</div>
          </div>
          <div class="form-group mb-2">
            <label class="text-xs text-muted">法定行政裁决决策：</label>
            <select v-model="adjudicateForm.decision" class="form-input font-bold">
              <option value="deduct">扣减当月长护险拨付款 (资金核减拒付)</option>
              <option value="interview">行政约谈定点机构负责人</option>
              <option value="rectify">下发限期整改通知书 (责令停单整顿)</option>
              <option value="terminate">暂停定点协议 (立即启动熔断黑名单程序)</option>
              <option value="pass">合规放行 (线索澄清核销)</option>
            </select>
          </div>
          <div v-if="adjudicateForm.decision === 'deduct'" class="form-group mb-2">
            <label class="text-xs text-muted">核减扣除拨付金额 (元)：</label>
            <input type="number" v-model="adjudicateForm.penalty_amount" class="form-input font-bold text-danger" />
          </div>
          <div class="form-group mb-2">
            <label class="text-xs text-muted">行政裁决审批批语：</label>
            <textarea
              v-model="adjudicateForm.remarks"
              rows="3"
              class="form-input"
              placeholder="录入医保长护专班法定批复理由..."
            ></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline mr-2" @click="showAdjudicateModal = false">取消</button>
          <button class="btn btn-danger" @click="submitAdjudication">签发行政处理决定书</button>
        </div>
      </div>
    </div>

    <!-- ==================== 模态框 4: 官方电子拨付核准凭证模态框 ==================== -->
    <div v-if="showVoucherModal" class="modal-backdrop" @click="showVoucherModal = false">
      <div class="voucher-modal-dialog" @click.stop>
        <div class="voucher-header">
          <div class="voucher-title-main">长期护理保险统筹基金待遇拨付核准书</div>
          <div class="voucher-subtitle">（医疗保障局 · 官方电子核定凭证）</div>
          <button class="close-btn" @click="showVoucherModal = false">×</button>
        </div>
        <div class="voucher-body">
          <div class="voucher-meta-row">
            <div>凭证编号：<span class="font-mono font-bold">{{ currentVoucher?.voucher_no }}</span></div>
            <div>防伪核验码：<span class="font-mono text-xs">{{ currentVoucher?.auth_code }}</span></div>
          </div>
          <div class="voucher-table-box">
            <table class="voucher-table">
              <tbody>
                <tr>
                  <td class="v-lbl">拨付项目全称</td>
                  <td class="v-val" colspan="3">{{ currentVoucher?.project_name }}</td>
                </tr>
                <tr>
                  <td class="v-lbl">收款定点机构</td>
                  <td class="v-val">{{ currentVoucher?.org_name }}</td>
                  <td class="v-lbl">结算统筹月份</td>
                  <td class="v-val">{{ currentVoucher?.period }}</td>
                </tr>
                <tr>
                  <td class="v-lbl">机构申报总额</td>
                  <td class="v-val">¥{{ (currentVoucher?.declared_amount || 0).toLocaleString() }} 元</td>
                  <td class="v-lbl">稽查违规核减</td>
                  <td class="v-val text-danger">¥{{ (currentVoucher?.deducted_amount || 0).toLocaleString() }} 元</td>
                </tr>
                <tr>
                  <td class="v-lbl font-bold">实际核准拨付金额</td>
                  <td class="v-val font-bold text-primary" colspan="3">
                    ¥{{ (currentVoucher?.actual_disbursement || 0).toLocaleString() }} 元
                    <span class="amount-words">（经医保终审扣减后全额划扣）</span>
                  </td>
                </tr>
                <tr>
                  <td class="v-lbl">受托经办机构初核</td>
                  <td class="v-val">
                    <div>{{ currentVoucher?.insurer_org }}</div>
                    <div class="text-xs text-muted">初审专员：{{ currentVoucher?.insurer_reviewed_by }} ({{ currentVoucher?.insurer_reviewed_at }})</div>
                  </td>
                  <td class="v-lbl">医保统筹终审批复</td>
                  <td class="v-val">
                    <div>{{ currentVoucher?.medical_org }}</div>
                    <div class="text-xs text-muted">终审专员：{{ currentVoucher?.medical_reviewed_by }} ({{ currentVoucher?.medical_reviewed_at }})</div>
                  </td>
                </tr>
                <tr>
                  <td class="v-lbl">银行电子拨付批次</td>
                  <td class="v-val font-mono" colspan="3">{{ currentVoucher?.bank_batch_no }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <!-- 官方电子印章 -->
          <div class="voucher-seal-wrap">
            <div class="electronic-seal">
              <div class="seal-star">★</div>
              <div class="seal-name">{{ currentVoucher?.seal_name }}</div>
              <div class="seal-date">{{ currentVoucher?.medical_reviewed_at?.slice(0, 10) }}</div>
            </div>
          </div>
        </div>
        <div class="voucher-footer">
          <button class="btn btn-outline mr-2" @click="showVoucherModal = false">关闭</button>
          <button class="btn btn-primary" @click="printVoucher">🖨️ 打印核准书</button>
        </div>
      </div>
    </div>

    <!-- ==================== 模态框 5: 临床出院病历穿透模态框 ==================== -->
    <div v-if="showMedicalModal" class="modal-backdrop" @click="showMedicalModal = false">
      <div class="modal-dialog medical-dossier-modal" @click.stop>
        <div class="modal-header">
          <div class="font-bold text-primary">🏥 临床客观病历与出院小结（三甲医院直连）</div>
          <button class="close-btn" @click="showMedicalModal = false">×</button>
        </div>
        <div class="modal-body" v-if="activeMedicalRecord">
          <div class="patient-banner">
            <div>姓名：<strong>{{ activeMedicalRecord.patient_name }}</strong></div>
            <div>病案号：<span class="font-mono">{{ activeMedicalRecord.patient_id }}</span></div>
            <div>医院：<strong>{{ activeMedicalRecord.hospital_name }}</strong></div>
            <div>科室：{{ activeMedicalRecord.department }}</div>
            <div>入院日期：{{ activeMedicalRecord.admission_date }}</div>
            <div>出院日期：{{ activeMedicalRecord.discharge_date }}</div>
          </div>
          <div class="medical-section">
            <div class="sec-title">主要临床诊断</div>
            <div class="font-bold text-danger">{{ activeMedicalRecord.primary_diagnosis }}</div>
            <div class="text-xs text-muted mt-1">{{ activeMedicalRecord.hospital_course }}</div>
          </div>
          <div class="medical-section">
            <div class="sec-title">客观功能障碍与肌力评估</div>
            <div class="eval-grid">
              <div class="eval-card">
                <div class="lbl">左侧肌力</div>
                <div class="val text-danger">{{ activeMedicalRecord.functional_impairment?.muscle_strength_left }} 级</div>
                <div class="sub">重度肌力障碍</div>
              </div>
              <div class="eval-card">
                <div class="lbl">右侧肌力</div>
                <div class="val text-primary">{{ activeMedicalRecord.functional_impairment?.muscle_strength_right }} 级</div>
                <div class="sub">偏瘫失能</div>
              </div>
              <div class="eval-card">
                <div class="lbl">出院 ADL 评分</div>
                <div class="val text-warning">{{ activeMedicalRecord.functional_impairment?.adl_score_discharge }} 分</div>
                <div class="sub">重度依赖</div>
              </div>
            </div>
          </div>
          <div class="medical-section">
            <div class="sec-title">影像学确诊报告</div>
            <div v-for="(img, idx) in activeMedicalRecord.imaging_reports" :key="idx" class="imaging-item">
              <div class="font-bold text-xs">{{ img.type }} ({{ img.date }})</div>
              <div class="text-xs text-muted">{{ img.conclusion }}</div>
            </div>
          </div>
          <div class="hospital-seal-box">
            <div class="seal-text">
              <div>{{ activeMedicalRecord.hospital_name }}</div>
              <div>病案与医保管理专用章 (已核对)</div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" @click="showMedicalModal = false">关闭查阅</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { getSession, type SessionInfo } from '../../../api/http'
import logoSymbolDark from '../../../assets/logo-symbol-dark.png'
import {
  getAssessedPersons,
  getLtcApplications,
  getServiceEvidences,
  getSettlements,
  reviewSettlement,
  getSupervisionCases,
  getWorkOrders,
  actionWorkOrder,
  getMedicalRecord,
  getAssessors,
  getAssessmentOrgs,
  getDeviceTelemetry,
  getSupervisionDashboard,
  switchGovernanceMode,
  getSupervisionClues,
  scanSupervisionClues,
  dispatchSupervisionClue,
  feedbackSupervisionClue,
  adjudicateSupervisionClue,
  getSupervisionPenetration,
  getSettlementVoucher,
} from '../../../api/client'
import type {
  AssessedPerson,
  LtcApplication,
  ServiceEvidence,
  Settlement,
  SupervisionCase,
  WorkOrder,
  MedicalRecord,
  AssessorProfile,
  AssessmentOrg,
  DeviceLiveTelemetry,
  SupervisionDashboardData,
  SupervisionClue,
  SettlementVoucher,
  PenetrationData,
  InstitutionCredit,
} from '../../../api/types'

const props = defineProps<{
  session?: SessionInfo
}>()

const activeSession = computed<SessionInfo | null>(() => {
  return props.session || getSession()
})

const currentUserPool = computed<'suqian' | 'moumou' | 'global'>(() => {
  const p = activeSession.value?.principal
  const t = activeSession.value?.tenant?.tenant_id
  const u = (p?.username || activeSession.value?.staff?.name || '').toLowerCase()
  if (p?.pool_id === 'suqian' || t === 'bureau_suqian' || u.includes('suqian') || u.startsWith('sq_')) {
    return 'suqian'
  }
  if (p?.pool_id === 'moumou' || t === 'bureau_moumou' || u.includes('demo_') || u.includes('moumou')) {
    return 'moumou'
  }
  return 'global'
})

const isCityPool = computed(() => currentUserPool.value === 'suqian' || currentUserPool.value === 'moumou')
const isGlobalPool = computed(() => currentUserPool.value === 'global')

const currentPlatformTitle = computed(() => {
  if (currentUserPool.value === 'suqian') {
    return '宿迁市长期护理保险试点监督管理平台'
  }
  if (currentUserPool.value === 'moumou') {
    return '某某市长期护理保险行政监督管理平台'
  }
  return '江苏省长期护理保险监督管理信息平台'
})

const currentPlatformSubtitle = computed(() => {
  if (currentUserPool.value === 'suqian') {
    return '宿迁市医疗保障局 · 长护险试点工作组 · 国家深化试点（3台真实在网设备：许丽、何家齐、王雪金）'
  }
  if (currentUserPool.value === 'moumou') {
    return '某某市医疗保障局 · 某某市长护险管理服务中心 · 长护全域数字监管演示中心（评估环节/服务实施/评估者长效追责）'
  }
  return '江苏省医疗保障局 · 长期护理保险监督指导中心 · 全省长护险深化试点及示范区综合指导'
})

const currentCityPoolName = computed(() => {
  if (currentUserPool.value === 'suqian') {
    return '宿迁市试点辖区（国家长护险深化试点区 · 3台在网设备）'
  }
  if (currentUserPool.value === 'moumou') {
    return '某某市统筹辖区（全域数字监管演示区 · 三大监管支柱）'
  }
  return '江苏省全域统筹视界'
})

const currentSeatTitle = computed(() => {
  const staff = activeSession.value?.staff?.name || '监管专员'
  const role = activeSession.value?.principal?.role || ''
  const assigned = (activeSession.value?.principal as any)?.assigned_title || ''
  if (role === 'medical_director') {
    return `🏛️ 局领导班子 · ${staff}${assigned ? ` (${assigned})` : ''}`
  }
  if (role === 'medical_auditor') {
    return `⚖️ 基金监督稽核科 · ${staff}${assigned ? ` (${assigned})` : ''}`
  }
  if (role === 'medical_finance') {
    return `📑 待遇结算财务科 · ${staff}${assigned ? ` (${assigned})` : ''}`
  }
  if (role === 'medical_assessor_admin') {
    return `📝 待遇保障与资格评估科 · ${staff}${assigned ? ` (${assigned})` : ''}`
  }
  return `🏛️ 长护综合监管席位 · ${staff}`
})

const activeDepartmentSeat = ref<'all' | 'audit' | 'finance' | 'qual'>('all')

function switchDepartmentSeat(seat: 'all' | 'audit' | 'finance' | 'qual') {
  activeDepartmentSeat.value = seat
  if (seat === 'audit') {
    activeTab.value = 'clues_workflow'
  } else if (seat === 'finance') {
    activeTab.value = 'settlements'
  } else if (seat === 'qual') {
    activeTab.value = 'applications'
  } else {
    activeTab.value = 'dashboard'
  }
}

const activeTab = ref<
  'dashboard' | 'clues_workflow' | 'penetration' | 'settlements' | 'applications' | 'dossiers' | 'devices' | 'assessors'
>('dashboard')

const loading = ref(false)
const scanning = ref(false)

const persons = ref<AssessedPerson[]>([])
const applications = ref<LtcApplication[]>([])
const serviceEvidences = ref<ServiceEvidence[]>([])
const settlements = ref<Settlement[]>([])
const supervisions = ref<SupervisionCase[]>([])
const workOrders = ref<WorkOrder[]>([])
const assessors = ref<AssessorProfile[]>([])
const assessmentOrgs = ref<AssessmentOrg[]>([])
const liveTelemetry = ref<DeviceLiveTelemetry | null>(null)
const selectedDeviceId = ref('ASH01086')
const ecgCanvasRef = ref<HTMLCanvasElement | null>(null)
let ecgRaf = 0
let ecgOffset = 0
let telemetryTimer: any = null

// 核心监管新数据
const dashboardData = ref<SupervisionDashboardData | null>(null)
const clues = ref<SupervisionClue[]>([])
const penetrationData = ref<PenetrationData | null>(null)

// 统筹区结余率趋势格式化
const trendItems = computed(() => {
  const defaultMonths = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']
  const defaultRates = [97.4, 97.3, 97.6, 97.5, 97.3, 97.4]
  const rawList = dashboardData.value?.funds?.balance_trend
  if (!rawList || !Array.isArray(rawList) || rawList.length === 0) {
    return defaultMonths.map((m, i) => ({ month: m, rate: defaultRates[i] }))
  }
  return rawList.map((item: any, i: number) => {
    if (typeof item === 'number') {
      return { month: defaultMonths[i] || `M${i + 1}`, rate: item }
    }
    const m = item.month || defaultMonths[i] || `M${i + 1}`
    let r = item.rate
    if (r === undefined || r === null) {
      if (item.income && item.expense) {
        r = Number(((item.balance || (item.income - item.expense)) / item.income * 100).toFixed(1))
      } else {
        r = defaultRates[i] || 97.4
      }
    }
    return { month: m, rate: r }
  })
})

// 统筹区选择
const selectedPool = ref<'all' | 'suqian' | 'moumou'>('all')

const poolLabel = computed(() => {
  if (selectedPool.value === 'suqian') return '宿迁市统筹区 (国家深化试点区)'
  if (selectedPool.value === 'moumou') return '某某市统筹区 (全业务演示区)'
  return '江苏省全域统筹视界'
})

const ALL_REAL_DEVICES = [
  { sn: 'ASH01086', name: '许丽', area: '宿迁市宿城区', pool: 'suqian', role: '宿迁长护真实参保人', model: 'AI健康守护仪 (ASH-01)' },
  { sn: 'ASH01078', name: '何家齐', area: '宿迁市宿城区', pool: 'suqian', role: '宿迁长护真实参保人', model: 'AI健康守护仪 (ASH-01)' },
  { sn: 'ASH01092', name: '王雪金', area: '宿迁市宿城区', pool: 'suqian', role: '宿迁长护真实参保人', model: 'AI健康守护仪 (ASH-01)' },
  { sn: 'ASH01146', name: '赵大有', area: '某某市高新开发区', pool: 'moumou', role: '评估监管 (自评ADL10分/雷达离床16次)', model: 'AI体征雷达监测仪 (ASH-01)' },
  { sn: 'ASH01076', name: '钱秀芬', area: '某某市城北新村', pool: 'moumou', role: '冒领监管 (14天空床疑隐瞒离世)', model: '毫米波体征雷达 (ASH-01)' },
  { sn: 'ASH01016', name: '孙建国', area: '某某市夕阳红颐养中心', pool: 'moumou', role: '在院监管 (重度失能/体征连续监测在位)', model: 'AI高灵敏体征垫 (ASH-01)' },
  { sn: 'ANCE00001', name: '张宝贵', area: '某某市康泰示范公寓', pool: 'moumou', role: '服务监管 (虚假打卡/隔空打卡空房拦截)', model: 'AI健康守护仪 (ANCE-01)' },
  { sn: 'ASH01038', name: '李秀荣', area: '某某市百合家园', pool: 'moumou', role: '服务监管 (肢体康复时体征垫无受力体动)', model: 'AI多模态监测终端 (ASH-01)' },
]

const realDeviceList = computed(() => {
  if (selectedPool.value === 'all') return ALL_REAL_DEVICES
  return ALL_REAL_DEVICES.filter((d) => d.pool === selectedPool.value)
})

const onlineDevicesCount = computed(() => realDeviceList.value.length)

const filteredPersons = computed(() => {
  if (selectedPool.value === 'suqian') {
    return persons.value.filter((p) => p.pool_id === 'suqian' || p.person_id.startsWith('P_SQ_'))
  }
  if (selectedPool.value === 'moumou') {
    return persons.value.filter((p) => p.pool_id === 'moumou' || (p.pool_id === 'bureau' && !p.person_id.startsWith('P_SQ_')))
  }
  return persons.value
})

const filteredApplications = computed(() => {
  if (selectedPool.value === 'suqian') {
    return applications.value.filter(
      (a) => (a as any).pool_id === 'suqian' || a.applicant_id?.startsWith('P_SQ_') || a.application_id?.includes('SQ'),
    )
  }
  if (selectedPool.value === 'moumou') {
    return applications.value.filter(
      (a) => (a as any).pool_id === 'moumou' || (!a.applicant_id?.startsWith('P_SQ_') && !a.application_id?.includes('SQ')),
    )
  }
  return applications.value
})

const filteredSettlements = computed(() => {
  if (selectedPool.value === 'suqian') {
    return settlements.value.filter((s) => s.pool_id === 'suqian' || s.settlement_id.includes('SQ') || (s.org_id || '').includes('suqian'))
  }
  if (selectedPool.value === 'moumou') {
    return settlements.value.filter((s) => s.pool_id === 'moumou' || (!s.settlement_id.includes('SQ') && !(s.org_id || '').includes('suqian')))
  }
  return settlements.value
})

const pendingDisbursementCount = computed(() => {
  return filteredSettlements.value.filter((s) => s.status === 'pre_reviewed' || s.status === 're_reviewed').length
})

const activeCluesCount = computed(() => {
  return clues.value.filter((c) => c.status !== 'adjudicated').length
})

// 筛选状态
const clueFilterRisk = ref('')
const clueFilterStatus = ref('')

// 模态框状态
const showDispatchModal = ref(false)
const showFeedbackModal = ref(false)
const showAdjudicateModal = ref(false)
const showVoucherModal = ref(false)
const showMedicalModal = ref(false)

const activeClue = ref<SupervisionClue | null>(null)
const targetOrgForAdjudicate = ref<InstitutionCredit | null>(null)
const currentVoucher = ref<SettlementVoucher | null>(null)
const activeMedicalRecord = ref<MedicalRecord | null>(null)

const dispatchForm = ref({
  dispatched_to: 'insurer01',
  due_hours: 24,
  inquiry_points: '现场走访长者家庭，核验当日入户服务真实性，调取家属笔录及助老员随身服务打卡照片与基站坐标',
})

const feedbackForm = ref({
  interview_notes: '经办专员上门现场核实，家属签字确认当日实际未提供在床生活照护，助老员仅门外短暂停留打卡。',
  pre_advisory: 'suggest_deduct',
  objective_snapshot: '现场家属签字笔录已固定，在线毫米波雷达空置无信号快照已调阅留痕。',
})

const adjudicateForm = ref({
  decision: 'deduct',
  penalty_amount: 1500,
  remarks: '经医保专班复核，事实清楚，属于虚构照护打卡违规行为，予以核减当月拨付款并计入机构信用档案。',
})

// 四级穿透状态
const currentPenLevel = ref<1 | 2 | 3 | 4>(1)
const penSelectedPool = ref<any | null>(null)
const penSelectedOrg = ref<any | null>(null)
const penSelectedCaregiver = ref<any | null>(null)
const penSelectedElder = ref<any | null>(null)

const filteredPenPools = computed(() => {
  if (!penetrationData.value?.pools) return []
  if (selectedPool.value === 'suqian') {
    return penetrationData.value.pools.filter((p) => p.pool_id === 'suqian')
  }
  if (selectedPool.value === 'moumou') {
    return penetrationData.value.pools.filter((p) => p.pool_id === 'moumou')
  }
  return penetrationData.value.pools
})

const filteredPenOrgs = computed(() => {
  if (!penetrationData.value) return []
  if (penSelectedPool.value) {
    return penetrationData.value.institutions.filter((i) => i.pool_id === penSelectedPool.value.pool_id)
  }
  return penetrationData.value.institutions
})

const filteredPenCaregivers = computed(() => {
  if (!penetrationData.value) return []
  if (penSelectedOrg.value) {
    return penetrationData.value.caregivers.filter((c) => c.org_id === penSelectedOrg.value.org_id)
  }
  return penetrationData.value.caregivers
})

function selectPenPool(p: any) {
  penSelectedPool.value = p
  currentPenLevel.value = 2
}

function selectPenOrg(org: any) {
  penSelectedOrg.value = org
  currentPenLevel.value = 3
}

function selectPenCaregiver(cg: any) {
  penSelectedCaregiver.value = cg
  // 查找该助老员分管的代表性长者
  const elders = penetrationData.value?.elders || []
  const found = elders.find((e) => (cg.active_elders || []).some((ae: string) => ae.includes(e.name))) || elders[0]
  penSelectedElder.value = found
  currentPenLevel.value = 4
}

function resetPenLevel(level: 1 | 2 | 3 | 4) {
  currentPenLevel.value = level
  if (level < 4) penSelectedElder.value = null
  if (level < 3) penSelectedCaregiver.value = null
  if (level < 2) penSelectedOrg.value = null
}

function drillDownToOrg(orgId: string) {
  const org = penetrationData.value?.institutions.find((i) => i.org_id === orgId)
  if (org) {
    penSelectedOrg.value = org
    const pool = penetrationData.value?.pools.find((p) => p.pool_id === org.pool_id)
    penSelectedPool.value = pool || null
    currentPenLevel.value = 3
    activeTab.value = 'penetration'
  }
}

function drillDownToElder(personId: string) {
  const elder = penetrationData.value?.elders.find((e) => e.person_id === personId)
  if (elder) {
    penSelectedElder.value = elder
    const org = penetrationData.value?.institutions.find((i) => i.org_id === elder.org_id)
    penSelectedOrg.value = org || null
    currentPenLevel.value = 4
    activeTab.value = 'penetration'
  } else {
    viewMedicalRecord(personId)
  }
}

function changePool(p: 'all' | 'suqian' | 'moumou') {
  selectedPool.value = p
  const currentInList = realDeviceList.value.some((d) => d.sn === selectedDeviceId.value)
  if (!currentInList && realDeviceList.value.length > 0) {
    selectDevice(realDeviceList.value[0].sn)
  }
  loadDashboard()
  loadClues()
  loadPenetration()
}

async function selectDevice(sn: string) {
  selectedDeviceId.value = sn
  try {
    liveTelemetry.value = await getDeviceTelemetry(sn)
  } catch (err: any) {
    console.error('切换设备遥测失败:', err)
  }
}

// 数据加载
async function loadDashboard() {
  try {
    dashboardData.value = await getSupervisionDashboard({ pool_id: selectedPool.value })
  } catch (e) {
    console.error('加载监管驾驶舱大盘失败:', e)
  }
}

async function loadClues() {
  try {
    const res = await getSupervisionClues({
      pool_id: selectedPool.value,
      risk_level: clueFilterRisk.value || undefined,
      status: clueFilterStatus.value || undefined,
    })
    clues.value = res.list
  } catch (e) {
    console.error('加载稽核线索失败:', e)
  }
}

async function loadPenetration() {
  try {
    penetrationData.value = await getSupervisionPenetration({ pool_id: selectedPool.value })
    if (!penSelectedPool.value && penetrationData.value.pools.length > 0) {
      penSelectedPool.value = penetrationData.value.pools[0]
    }
  } catch (e) {
    console.error('加载四级穿透数据失败:', e)
  }
}

async function refreshAll() {
  loading.value = true
  try {
    await Promise.all([
      loadDashboard(),
      loadClues(),
      loadPenetration(),
      loadData(),
    ])
  } finally {
    loading.value = false
  }
}

async function loadData() {
  try {
    const [pRes, aRes, eRes, sRes, scRes, wRes, asRes, orgRes] = await Promise.all([
      getAssessedPersons(),
      getLtcApplications(),
      getServiceEvidences(),
      getSettlements(),
      getSupervisionCases(),
      getWorkOrders(),
      getAssessors(),
      getAssessmentOrgs(),
    ])
    persons.value = pRes.list
    applications.value = aRes.list
    serviceEvidences.value = eRes.list
    settlements.value = sRes.list
    supervisions.value = scRes.list
    workOrders.value = wRes.list
    assessors.value = asRes.list
    assessmentOrgs.value = orgRes.list
  } catch (err: any) {
    console.error('加载基础档案失败:', err)
  }
}

// 模式切换
async function toggleGovernanceMode() {
  const current = dashboardData.value?.governance_mode?.current_mode || 'delegated'
  const next = current === 'direct' ? 'delegated' : 'direct'
  const confirmMsg = next === 'direct'
    ? '确认将统筹区监管模式切换为【医保局全权直管模式】？（该模式下医保局直接负责全部入户巡查与日常行政执法）'
    : '确认将统筹区监管模式切换为【委托商保经办协同日常监管模式】？（现行主流过渡期机制，委托太平洋保险协助现场走访核验）'
  if (confirm(confirmMsg)) {
    try {
      await switchGovernanceMode(next)
      await loadDashboard()
      alert('统筹区治理监管模式切换成功！')
    } catch (e: any) {
      alert('切换治理模式失败: ' + e.message)
    }
  }
}

// AI 扫描
async function triggerClueScan() {
  scanning.value = true
  try {
    const res = await scanSupervisionClues({ pool_id: selectedPool.value })
    await loadClues()
    await loadDashboard()
    alert(`⚡ AI规则引擎全网扫描完成！已巡检 ${res.scanned_devices} 台物联在网终端，检出 ${res.mismatches_detected} 处信号冲突，新收录 ${res.new_clues_added} 条督办线索。`)
  } catch (e: any) {
    alert('AI巡检扫描失败: ' + e.message)
  } finally {
    scanning.value = false
  }
}

// 督办下发
function openDispatchModal(clue: SupervisionClue) {
  activeClue.value = clue
  dispatchForm.value = {
    dispatched_to: 'insurer01',
    due_hours: clue.risk_level === 'red' ? 12 : 24,
    inquiry_points: `现场走访长者家庭【${clue.elderly_name}】，核验打卡时段 ${clue.description}，调取家属笔录及助老员随身服务打卡照片与基站坐标`,
  }
  showDispatchModal.value = true
}

async function submitDispatch() {
  if (!activeClue.value) return
  try {
    await dispatchSupervisionClue(activeClue.value.clue_id, dispatchForm.value)
    showDispatchModal.value = false
    await loadClues()
    await loadDashboard()
    alert('《长护险现场核查督办函》已成功下达至中国太平洋财产保险股份有限公司经办部！')
  } catch (e: any) {
    alert('下发督办函失败: ' + e.message)
  }
}

// 经办反馈
function openFeedbackModal(clue: SupervisionClue) {
  activeClue.value = clue
  feedbackForm.value = {
    interview_notes: `经办专员上门现场核实长者【${clue.elderly_name}】家属，证实助老员【${clue.caregiver_name}】存在异常打卡。`,
    pre_advisory: clue.risk_level === 'red' ? 'suggest_deduct' : 'suggest_interview',
    objective_snapshot: '现场家属签字笔录已固定，在线毫米波守护仪客观数据已调阅比对。',
  }
  showFeedbackModal.value = true
}

async function submitFeedback() {
  if (!activeClue.value) return
  try {
    await feedbackSupervisionClue(activeClue.value.clue_id, feedbackForm.value)
    showFeedbackModal.value = false
    await loadClues()
    alert('受托经办机构现场调查反馈与初核意见回传成功！')
  } catch (e: any) {
    alert('回传反馈失败: ' + e.message)
  }
}

// 行政裁决
function openAdjudicateModal(clue: SupervisionClue) {
  activeClue.value = clue
  targetOrgForAdjudicate.value = null
  adjudicateForm.value = {
    decision: clue.feedback?.pre_advisory === 'suggest_terminate' ? 'terminate' : 'deduct',
    penalty_amount: clue.risk_level === 'red' ? 2000 : 800,
    remarks: `经医保长护专班复核事实，针对${clue.title}依法作出行政处理，事实清楚证据确凿。`,
  }
  showAdjudicateModal.value = true
}

function openAdjudicateForOrg(inst: InstitutionCredit, decision: 'rectify' | 'terminate') {
  targetOrgForAdjudicate.value = inst
  activeClue.value = {
    clue_id: `CLUE-ORG-${inst.org_id}`,
    pool_id: inst.pool_id,
    title: `定点机构协议合规处置: ${inst.org_name}`,
    source_type: 'radar_absence',
    source_label: '机构履约综合监管',
    risk_level: 'red',
    target_org_id: inst.org_id,
    target_org_name: inst.org_name,
    caregiver_name: '机构管理层',
    elderly_name: '定点全院长者',
    person_id: 'ALL',
    device_id: 'ORG',
    description: `针对定点机构 ${inst.org_name} 合规履约率 (${inst.compliance_rate}%) 执行医保行政监督决定。`,
    evidence_snapshot: null,
    status: 'feedback_received',
    dispatch_order: null,
    feedback: null,
    adjudication: null,
    created_at: '',
  }
  adjudicateForm.value = {
    decision,
    penalty_amount: 0,
    remarks: decision === 'terminate'
      ? `定点服务机构【${inst.org_name}】违规严重，医保局依法作出暂停定点协议、纳入熔断黑名单决定。`
      : `定点服务机构【${inst.org_name}】存在服务履约合规瑕疵，责令下发《限期整改通知书》，停单限期自查整顿。`,
  }
  showAdjudicateModal.value = true
}

async function submitAdjudication() {
  if (!activeClue.value) return
  try {
    await adjudicateSupervisionClue(activeClue.value.clue_id, adjudicateForm.value)
    showAdjudicateModal.value = false
    await loadClues()
    await loadDashboard()
    alert('医保局行政终审裁决执行成功！行政处理文号已依法签发，违规核减资金已计入统筹账目。')
  } catch (e: any) {
    alert('行政裁决失败: ' + e.message)
  }
}

// 结算终审与电子凭证
async function executeFinalSettlementReview(set: Settlement) {
  if (confirm(`确认对定点机构【${set.org_name || set.org_id}】${set.period}月度申报款（¥${set.amount}元）执行医保行政终审？核准后将自动生成具备防伪核验印章的《统筹基金拨付凭证》。`)) {
    try {
      await reviewSettlement(set.settlement_id, {
        step: 3,
        action: 'pass',
        note: '经医保专班复核大数据雷达在床证据链及经办初审意见，全额合规，予以行政终审签发。',
      })
      await loadData()
      await loadDashboard()
      // 自动调阅生成的新凭证
      await viewSettlementVoucher(set)
    } catch (e: any) {
      alert('医保终审核定失败: ' + e.message)
    }
  }
}

async function viewSettlementVoucher(set: Settlement) {
  try {
    const v = await getSettlementVoucher(set.settlement_id)
    currentVoucher.value = v
    showVoucherModal.value = true
  } catch (e: any) {
    alert('调阅官方拨付凭证失败: ' + e.message)
  }
}

function printVoucher() {
  window.print()
}

// 临床病历
async function viewMedicalRecord(personId: string) {
  try {
    const rec = await getMedicalRecord(personId)
    if (!rec || (rec as any).status === 'no_record' || !rec.record_id) {
      alert('该长者暂无外部医院出院小结或临床病历数据（所有模拟假病历已清除）。')
      return
    }
    activeMedicalRecord.value = rec
    showMedicalModal.value = true
  } catch (err: any) {
    alert('该长者暂无外部病历数据（已清除模拟病历）。')
  }
}

// 格式化辅助
function formatClueStatus(s: string) {
  const map: Record<string, string> = {
    pending_dispatch: '待下发督办函',
    dispatched: '经办现场核查中',
    feedback_received: '经办已反馈 (待终审)',
    adjudicated: '医保已终审裁决 (已结案)',
  }
  return map[s] || s
}

function formatSettlementStatus(s: string) {
  const map: Record<string, string> = {
    declared: '机构已申报 (待经办初审)',
    pre_reviewed: '经办已初审 (待医保终审)',
    re_reviewed: '医保已终审 (凭证已签发)',
    disbursed: '统筹基金已划转拨付',
  }
  return map[s] || s
}

function formatStatus(s: string) {
  const map: Record<string, string> = {
    draft: '草稿',
    submitted: '待受理核定',
    assessing: '现场评定中',
    assessed: '已评定待初审',
    under_medical_ratification: '待医保终审',
    approved: '已核定纳保',
    suspended: '已暂缓办理',
  }
  return map[s] || s
}

function formatServiceOrg(orgId: string) {
  const map: Record<string, string> = {
    bureau: '宿迁市长护试点照护中心',
    bureau_suqian: '宿迁市长护试点照护中心',
    org_mm_01: '某某市康泰居家照护中心',
    org_mm_02: '某某市颐养天年护理院',
    org_mm_03: '某某市博爱养老养护中心',
    org_mm_04: '某某市社区日间照料示范中心',
    kaijian: '上海凯健国际康养中心',
    cust_org01: '某某市康泰居家照护中心',
    gusu_assessment: '某某市定点评估中心',
    jianan_care: '某某市颐养天年护理院',
    home_care_gusu: '某某市康泰居家照护中心',
  }
  return map[orgId] || orgId
}

// 心电动画
function startEcgAnimation() {
  function draw() {
    const canvas = ecgCanvasRef.value
    if (canvas && canvas.getContext) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        const w = (canvas.width = canvas.clientWidth || 320)
        const h = (canvas.height = canvas.clientHeight || 52)
        ctx.clearRect(0, 0, w, h)
        ctx.strokeStyle = '#00f5d4'
        ctx.lineWidth = 2
        ctx.beginPath()

        ecgOffset += 2
        const period = 80
        const mid = h / 2

        for (let x = 0; x < w; x++) {
          const phase = (x + ecgOffset) % period
          let y = mid
          if (phase > 22 && phase < 28) {
            y = mid - 4 // P波
          } else if (phase >= 28 && phase < 31) {
            y = mid + 4 // Q波
          } else if (phase >= 31 && phase < 36) {
            y = mid - 18 // R波高尖
          } else if (phase >= 36 && phase < 40) {
            y = mid + 6 // S波
          } else if (phase >= 46 && phase < 56) {
            y = mid - 6 // T波
          }
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
    }
    ecgRaf = requestAnimationFrame(draw)
  }
  draw()
}

onMounted(async () => {
  const session = activeSession.value || getSession()
  const pool = currentUserPool.value
  if (pool === 'suqian') {
    selectedPool.value = 'suqian'
  } else if (pool === 'moumou') {
    selectedPool.value = 'moumou'
  } else {
    selectedPool.value = 'all'
  }

  // 根据医保局科室角色分工，自动聚焦业务 Tab
  const role = session?.principal?.role || ''
  if (role === 'medical_auditor') {
    activeDepartmentSeat.value = 'audit'
    activeTab.value = 'clues_workflow'
  } else if (role === 'medical_finance') {
    activeDepartmentSeat.value = 'finance'
    activeTab.value = 'settlements'
  } else if (role === 'medical_assessor_admin') {
    activeDepartmentSeat.value = 'qual'
    activeTab.value = 'applications'
  } else {
    activeDepartmentSeat.value = 'all'
    activeTab.value = 'dashboard'
  }

  await refreshAll()
  if (realDeviceList.value.length > 0) {
    selectDevice(realDeviceList.value[0].sn)
  }
  startEcgAnimation()
  telemetryTimer = setInterval(async () => {
    if (activeTab.value === 'devices' && selectedDeviceId.value) {
      try {
        liveTelemetry.value = await getDeviceTelemetry(selectedDeviceId.value)
      } catch (err) {
        // silent
      }
    }
  }, 4000)
})

onUnmounted(() => {
  if (ecgRaf) cancelAnimationFrame(ecgRaf)
  if (telemetryTimer) clearInterval(telemetryTimer)
})
</script>

<style scoped>
.workspace-page {
  padding: 20px;
  background: #f8fafc;
  min-height: calc(100vh - 56px);
  box-sizing: border-box;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}
.page-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.page-title-logo {
  height: 28px;
  width: auto;
  object-fit: contain;
}
.page-title {
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
}
.page-subtitle {
  font-size: 13px;
  color: #64748b;
  margin-top: 4px;
}
.header-badges {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.badge {
  padding: 4px 10px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 600;
}
.badge-primary { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
.badge-success { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
.badge-warning { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
.badge-danger { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
.badge-info { background: #f0f9ff; color: #0284c7; border: 1px solid #bae6fd; }

.jurisdiction-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 10px 16px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  flex-wrap: wrap;
}
.jurisdiction-info {
  display: flex;
  align-items: center;
  gap: 8px;
}
.j-badge {
  font-size: 12px;
  font-weight: 700;
  color: #1e40af;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  padding: 3px 8px;
  border-radius: 4px;
}
.j-name {
  font-size: 13.5px;
  font-weight: 700;
  color: #0f172a;
}
.j-scope-note {
  font-size: 12px;
  color: #64748b;
}
.department-seats-nav {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 12px;
  padding-left: 12px;
  border-left: 1px solid #e2e8f0;
  flex-wrap: wrap;
}
.seats-label {
  font-size: 12px;
  color: #475569;
  font-weight: 600;
}
.seat-btn {
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #334155;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.seat-btn:hover {
  border-color: #2563eb;
  color: #1d4ed8;
  background: #eff6ff;
}
.seat-btn.active {
  border-color: #2563eb;
  background: #2563eb;
  color: #ffffff;
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.25);
}

.pool-selector-strip {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 16px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  flex-wrap: wrap;
}
.pool-strip-lbl {
  font-size: 13px;
  font-weight: 700;
  color: #334155;
  white-space: nowrap;
}
.pool-strip-btn {
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.pool-strip-btn:hover {
  border-color: #2563eb;
  color: #1d4ed8;
  background: #eff6ff;
}
.pool-strip-btn.active {
  border-color: #2563eb;
  background: #2563eb;
  color: #ffffff;
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.25);
}

/* 核心指标卡片 */
.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.metric-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 14px 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}
.pointer { cursor: pointer; }
.metric-num {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
}
.metric-label {
  font-size: 12px;
  color: #64748b;
  margin-top: 4px;
}
.pulse-dot {
  width: 8px;
  height: 8px;
  background: #10b981;
  border-radius: 50%;
  display: inline-block;
  margin-right: 4px;
  box-shadow: 0 0 6px #10b981;
}
.pulse-dot-red {
  width: 8px;
  height: 8px;
  background: #ef4444;
  border-radius: 50%;
  display: inline-block;
  margin-right: 4px;
  box-shadow: 0 0 6px #ef4444;
}

/* 标签导航栏 */
.tab-nav {
  display: flex;
  gap: 4px;
  border-bottom: 2px solid #e2e8f0;
  margin-bottom: 16px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.tab-btn {
  padding: 10px 16px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: #64748b;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
  margin-bottom: -2px;
}
.tab-btn:hover {
  color: #2563eb;
}
.tab-btn.active {
  color: #2563eb;
  border-bottom-color: #2563eb;
}

.content-panel {
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  padding: 20px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

/* 治理模式卡片 */
.governance-card {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 16px;
}
.governance-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}
.gov-title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}
.gov-icon { font-size: 26px; }
.gov-title { font-size: 15px; font-weight: 700; color: #1e293b; }
.gov-subtitle { font-size: 12px; color: #64748b; margin-top: 2px; }
.gov-powers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
}
.gov-power-box {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 12px;
}
.power-tag {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  margin-bottom: 8px;
}
.power-list {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 12px;
  color: #475569;
  line-height: 1.7;
}

/* 大盘双栏 */
.dashboard-two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 900px) {
  .dashboard-two-col { grid-template-columns: 1fr; }
}

.chart-box, .warning-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
}
.trend-bars {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  height: 140px;
  padding-top: 20px;
  border-bottom: 1px solid #cbd5e1;
}
.trend-col {
  flex: 1;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.trend-val { font-size: 11px; font-weight: 700; color: #2563eb; margin-bottom: 4px; }
.trend-bar-wrap {
  width: 24px;
  height: 90px;
  background: #e2e8f0;
  border-radius: 4px 4px 0 0;
  display: flex;
  align-items: flex-end;
}
.trend-bar-fill {
  width: 100%;
  background: linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%);
  border-radius: 4px 4px 0 0;
  transition: height 0.3s ease;
}
.trend-lbl { font-size: 11px; color: #64748b; margin-top: 6px; }
.fund-summary-strip {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  background: #ffffff;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  flex-wrap: wrap;
  gap: 6px;
}

.warning-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 230px;
  overflow-y: auto;
}
.warning-item {
  background: #ffffff;
  border-radius: 6px;
  padding: 10px 12px;
  border-left: 4px solid;
}
.warning-item-red { border-left-color: #ef4444; border: 1px solid #fecaca; border-left-width: 4px; }
.warning-item-yellow { border-left-color: #f59e0b; border: 1px solid #fde68a; border-left-width: 4px; }
.w-head { display: flex; align-items: center; gap: 8px; }
.w-title { font-size: 13px; font-weight: 700; color: #1e293b; margin: 4px 0; }
.w-detail { font-size: 12px; color: #475569; line-height: 1.4; }
.w-advice { font-size: 11px; color: #0284c7; margin-top: 4px; font-weight: 600; }

/* 机构信用评级 */
.star-rating { color: #f59e0b; }
.row-suspended { background: #fff1f2 !important; }
.row-probation { background: #fffbeb !important; }

/* 线索卡片 */
.clue-control-strip {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.clue-cards-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.clue-card {
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
.clue-card-red { border-left: 5px solid #ef4444; }
.clue-card-yellow { border-left: 5px solid #f59e0b; }
.clue-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.clue-title {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
  margin: 8px 0;
}
.clue-subject-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 6px;
  background: #f8fafc;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  margin-bottom: 10px;
}
.clue-desc-box {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 10px;
}
.desc-lbl { font-size: 12px; font-weight: 700; color: #1e40af; }
.desc-val { font-size: 12px; color: #1e293b; line-height: 1.5; margin-top: 2px; }

.pipeline-stage-box {
  border-radius: 6px;
  padding: 10px 14px;
  margin-bottom: 8px;
  font-size: 12px;
}
.stage-dispatched { background: #f0f9ff; border: 1px solid #bae6fd; }
.stage-feedback { background: #fffbeb; border: 1px solid #fde68a; }
.stage-adjudicated { background: #f0fdf4; border: 1px solid #bbf7d0; }
.stage-title { font-weight: 700; margin-bottom: 4px; }
.stage-content { line-height: 1.6; color: #334155; }
.decision-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  background: #dcfce7;
  color: #15803d;
}
.penalty-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  background: #fee2e2;
  color: #b91c1c;
}
.clue-footer-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #f1f5f9;
}

/* 四级穿透引擎样式 */
.penetration-breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f1f5f9;
  padding: 10px 14px;
  border-radius: 8px;
  flex-wrap: wrap;
}
.bc-lbl { font-size: 13px; font-weight: 700; color: #334155; }
.bc-btn {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 12px;
  color: #475569;
  cursor: pointer;
}
.bc-btn.active {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
  font-weight: 600;
}
.bc-arrow { color: #94a3b8; font-size: 12px; }

.pool-card-grid, .pen-org-grid, .pen-caregiver-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
}
.pen-pool-card, .pen-org-card, .pen-cg-card {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  cursor: pointer;
  transition: all 0.15s ease;
}
.pen-pool-card:hover, .pen-org-card:hover, .pen-cg-card:hover {
  border-color: #2563eb;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(37,99,235,0.1);
}
.pen-stat-strip, .pen-cg-metrics {
  background: #f8fafc;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.6;
}

/* Level 4 长者全息档案 */
.elder-evidence-dossier {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 20px;
}
.elder-banner {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
  background: #f1f5f9;
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 13px;
}
.evidence-metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.ev-metric-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 14px;
  text-align: center;
}
.ev-lbl { font-size: 12px; color: #64748b; }
.ev-val { font-size: 18px; margin: 4px 0; }
.ev-sub { font-size: 11px; color: #94a3b8; }
.compliance-box-alert {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  padding: 14px 16px;
}

/* 官方电子拨付凭证 */
.voucher-modal-dialog {
  background: #ffffff;
  border-radius: 8px;
  width: min(800px, calc(100vw - 32px));
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 25px rgba(0,0,0,0.2);
}
.voucher-header {
  padding: 16px 24px;
  background: #991b1b;
  color: #ffffff;
  border-radius: 8px 8px 0 0;
  position: relative;
  text-align: center;
}
.voucher-title-main {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 1px;
}
.voucher-subtitle {
  font-size: 12px;
  color: #fecaca;
  margin-top: 2px;
}
.voucher-body {
  padding: 24px;
  overflow-y: auto;
  position: relative;
}
.voucher-meta-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #475569;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e2e8f0;
}
.voucher-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.voucher-table td {
  border: 1px solid #cbd5e1;
  padding: 10px 14px;
}
.v-lbl {
  background: #f8fafc;
  color: #475569;
  font-weight: 600;
  width: 130px;
}
.v-val {
  color: #0f172a;
}
.amount-words { font-size: 11px; color: #64748b; font-weight: normal; margin-left: 6px; }

.voucher-seal-wrap {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
  padding-right: 40px;
}
.electronic-seal {
  width: 140px;
  height: 140px;
  border: 3px solid #dc2626;
  border-radius: 50%;
  color: #dc2626;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 8px;
  box-sizing: border-box;
  transform: rotate(-8deg);
  opacity: 0.92;
  box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.15);
}
.seal-star { font-size: 20px; line-height: 1; }
.seal-name { font-size: 11px; font-weight: 700; line-height: 1.3; margin: 4px 0; }
.seal-date { font-size: 10px; font-family: monospace; }
.voucher-footer {
  padding: 12px 24px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
}

/* 6 步流转流水线卡片样式 */
.workflow-stepper {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
}
.stepper-title { font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 12px; }
.stepper-pipeline {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 8px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.pipeline-step {
  flex: 1;
  min-width: 140px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 10px 12px;
  text-align: center;
}
.pipeline-step.completed { border-color: #86efac; background: #f0fdf4; }
.pipeline-step.current { border-color: #f59e0b; background: #fffbeb; box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2); }
.step-num {
  display: inline-block;
  width: 20px;
  height: 20px;
  line-height: 20px;
  border-radius: 50%;
  background: #2563eb;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  margin-bottom: 4px;
}
.pipeline-step.completed .step-num { background: #16a34a; }
.pipeline-step.current .step-num { background: #d97706; }
.step-name { font-size: 12px; font-weight: 700; color: #1e293b; }
.step-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
.pipeline-arrow { display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 14px; }

/* 模态框基础 */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
  backdrop-filter: blur(2px);
}
.modal-dialog {
  background: #ffffff;
  border-radius: 8px;
  width: min(600px, calc(100vw - 32px));
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
}
.modal-header {
  padding: 14px 20px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.modal-body {
  padding: 20px;
  overflow-y: auto;
}
.modal-footer {
  padding: 12px 20px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  display: flex;
  justify-content: flex-end;
}
.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: #94a3b8;
  cursor: pointer;
}

/* 动态示波与设备详情 */
.ecg-telemetry-strip {
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 8px;
  padding: 12px 16px;
  color: #f8fafc;
}
.ecg-canvas-wrap {
  height: 52px;
  width: 100%;
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(0, 245, 212, 0.25);
  border-radius: 4px;
  overflow: hidden;
  margin: 6px 0;
}
.ecg-canvas { width: 100%; height: 100%; display: block; }
.pulse-indicator {
  display: inline-block;
  width: 10px;
  height: 10px;
  background: #16a34a;
  border-radius: 50%;
  box-shadow: 0 0 8px #16a34a;
}
.device-badge-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 10px;
}
.device-pill-card {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 12px;
  background: #f8fafc;
  cursor: pointer;
  transition: all 0.2s ease;
}
.device-pill-card.active {
  border-color: #0b7a75;
  background: #e6fffa;
  box-shadow: 0 0 0 2px rgba(11, 122, 117, 0.2);
}
.d-pill-head { display: flex; align-items: center; justify-content: space-between; }
.pulse-indicator-sm { width: 8px; height: 8px; background: #10b981; border-radius: 50%; box-shadow: 0 0 6px #10b981; }

.telemetry-dashboard {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 20px;
}
.telemetry-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 14px;
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 16px;
}
.vitals-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}
.vital-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 14px;
  text-align: center;
}
.vital-lbl { font-size: 12px; color: #64748b; font-weight: 600; }
.vital-val { font-size: 24px; font-weight: 700; margin: 6px 0; }
.vital-val .unit { font-size: 12px; font-weight: 400; color: #64748b; }
.vital-sub { font-size: 11px; color: #94a3b8; }
.correlation-card {
  background: #ffffff;
  border: 1px solid #bbf7d0;
  border-radius: 6px;
  padding: 16px;
}
.correlation-title { font-size: 14px; font-weight: 700; color: #166534; margin-bottom: 8px; }

/* 病历穿透弹窗 */
.medical-dossier-modal { width: min(840px, calc(100vw - 32px)); }
.patient-banner {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
  background: #f1f5f9;
  padding: 12px 14px;
  border-radius: 6px;
  font-size: 13px;
  margin-bottom: 16px;
}
.medical-section {
  margin-bottom: 16px;
  padding-bottom: 14px;
  border-bottom: 1px dashed #e2e8f0;
}
.sec-title { font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 8px; }
.eval-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
.eval-card { background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0; text-align: center; }
.eval-card .lbl { font-size: 12px; color: #64748b; }
.eval-card .val { font-size: 20px; font-weight: 700; margin: 4px 0; }
.eval-card .sub { font-size: 11px; color: #94a3b8; }
.imaging-item { background: #f8fafc; padding: 8px 10px; border-radius: 4px; margin-bottom: 6px; }
.hospital-seal-box { margin-top: 16px; display: flex; justify-content: flex-end; }
.seal-text {
  border: 2px solid #dc2626;
  border-radius: 6px;
  padding: 8px 14px;
  color: #dc2626;
  font-size: 12px;
  font-weight: 700;
  text-align: center;
  transform: rotate(-3deg);
}

/* 长者档案卡片 */
.dossier-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 14px;
}
.dossier-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.dossier-card-head { display: flex; justify-content: space-between; align-items: flex-start; }
.dossier-name { font-size: 16px; font-weight: 700; color: #0f172a; }
.dossier-info-list { font-size: 12px; line-height: 1.7; color: #475569; }

/* 基础通用组件 */
.table-responsive {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  margin-bottom: 16px;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  min-width: 650px;
}
.data-table th {
  background: #f8fafc;
  color: #475569;
  font-weight: 600;
  text-align: left;
  padding: 12px;
  border-bottom: 1px solid #e2e8f0;
  white-space: nowrap;
}
.data-table td {
  padding: 12px;
  border-bottom: 1px solid #f1f5f9;
  color: #1e293b;
}
.tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
}
.tag-danger { background: #fee2e2; color: #dc2626; }
.tag-warning { background: #fef3c7; color: #d97706; }
.tag-success { background: #dcfce7; color: #16a34a; }
.tag-info { background: #e0f2fe; color: #0284c7; }
.tag-primary { background: #eff6ff; color: #2563eb; }

.status-pill {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.status-success { background: #dcfce7; color: #16a34a; }
.status-danger { background: #fee2e2; color: #dc2626; }
.status-warning { background: #fef3c7; color: #d97706; }

.btn {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: background 0.2s;
  white-space: nowrap;
}
.btn-sm { padding: 4px 8px; font-size: 12px; }
.btn-primary { background: #2563eb; color: #ffffff; }
.btn-primary:hover { background: #1d4ed8; }
.btn-danger { background: #dc2626; color: #ffffff; }
.btn-danger:hover { background: #b91c1c; }
.btn-success { background: #16a34a; color: #ffffff; }
.btn-success:hover { background: #15803d; }
.btn-warning { background: #d97706; color: #ffffff; }
.btn-warning:hover { background: #b45309; }
.btn-outline { background: #ffffff; border: 1px solid #cbd5e1; color: #334155; }
.btn-outline:hover { background: #f1f5f9; }
.form-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
  box-sizing: border-box;
}
.form-input-sm {
  padding: 4px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  font-size: 12px;
  background: #ffffff;
}
.flex-between { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
.flex-align-center { display: flex; align-items: center; flex-wrap: wrap; }
.gap-2 { gap: 8px; }
.mb-1 { margin-bottom: 4px; }
.mb-2 { margin-bottom: 8px; }
.mb-3 { margin-bottom: 12px; }
.mb-4 { margin-bottom: 16px; }
.mt-1 { margin-top: 4px; }
.mt-2 { margin-top: 8px; }
.mt-3 { margin-top: 12px; }
.mt-4 { margin-top: 16px; }
.ml-1 { margin-left: 4px; }
.ml-2 { margin-left: 8px; }
.ml-auto { margin-left: auto; }
.mr-1 { margin-right: 4px; }
.mr-2 { margin-right: 8px; }
.text-warning { color: #d97706; }
.text-danger { color: #dc2626; }
.text-success { color: #16a34a; }
.text-primary { color: #2563eb; }
.text-muted { color: #94a3b8; }
.font-mono { font-family: monospace; }
.font-bold { font-weight: 600; }
.text-xs { font-size: 12px; }
.text-sm { font-size: 14px; }
.text-md { font-size: 15px; }
.text-lg { font-size: 16px; }
.section-title { font-size: 15px; font-weight: 700; color: #0f172a; }
.line-height-relaxed { line-height: 1.6; }
.action-buttons { display: flex; gap: 6px; flex-wrap: wrap; }

.empty-state-card {
  text-align: center;
  padding: 48px 24px;
  background: #ffffff;
  border: 1px dashed #cbd5e1;
  border-radius: 10px;
  margin: 16px 0;
}
.empty-icon { font-size: 36px; margin-bottom: 12px; }
.empty-title { font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 6px; }
.empty-desc { font-size: 13px; color: #64748b; max-width: 500px; margin: 0 auto; line-height: 1.6; }
</style>
