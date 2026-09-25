<template>
  <div class="workspace-page insurer-operations">
    <!-- 经办平台顶栏 -->
    <div class="page-header">
      <div>
        <div class="page-title">
          {{ selectedPool === 'suqian' ? '宿迁市长期护理保险受托经办业务协同平台' : '某某市长期护理保险受托经办业务协同平台' }}
        </div>
        <div class="page-subtitle">
          {{ selectedPool === 'suqian'
            ? '中国太平洋人寿保险股份有限公司 · 宿迁长护险商保经办专班 · 国家深化试点（许丽、何家齐、王雪金 3台在网设备服务）'
            : '中国太平洋人寿保险股份有限公司 · 某某市长护险受托经办中心 · 统筹区全量业务受理、派单回避、物联飞检与结算初审核减'
          }}
        </div>
      </div>
      <div class="header-badges">
        <span class="badge badge-primary">🏢 受托商保资质: 甲级经办 (中国太保)</span>
        <span class="badge badge-success">⏱️ 医保委托SLA达标率: {{ dashboardData?.kpis?.sla_compliance_rate || 99.4 }}%</span>
        <span class="badge badge-info">🛡️ 医保政务专网: 实时连通</span>
      </div>
    </div>

    <!-- 统筹区与经办专班切换栏 -->
    <div class="pool-bar">
      <div class="pool-selector">
        <span class="text-xs font-bold text-muted mr-2">📍 经办承办辖区:</span>
        <button
          v-if="currentUserPool !== 'suqian'"
          type="button"
          :class="['pool-btn', selectedPool === 'moumou' && 'active']"
          @click="selectPool('moumou')"
        >
          🏛️ 某某市统筹区 (全业务演示区)
        </button>
        <button
          type="button"
          :class="['pool-btn', selectedPool === 'suqian' && 'active']"
          @click="selectPool('suqian')"
        >
          🏛️ 宿迁市统筹区 (国家深化试点商保专班 · 3台在网设备)
        </button>
      </div>

      <!-- 经办科室协同席位切换 -->
      <div class="department-seats">
        <span class="text-xs font-bold text-muted mr-2">💼 经办岗位协同:</span>
        <button
          type="button"
          :class="['seat-btn', currentSeat === 'director' && 'active']"
          @click="switchSeat('director')"
        >
          🏛️ 项目总监 (赵国华)
        </button>
        <button
          type="button"
          :class="['seat-btn', currentSeat === 'intake' && 'active']"
          @click="switchSeat('intake')"
        >
          📝 受理调度 (王雪梅)
        </button>
        <button
          type="button"
          :class="['seat-btn', currentSeat === 'inspector' && 'active']"
          @click="switchSeat('inspector')"
        >
          🔍 巡查飞检 (李勇)
        </button>
        <button
          type="button"
          :class="['seat-btn', currentSeat === 'auditor' && 'active']"
          @click="switchSeat('auditor')"
        >
          📑 结算初审 (张慧敏)
        </button>
        <button
          type="button"
          :class="['seat-btn', currentSeat === 'service' && 'active']"
          @click="switchSeat('service')"
        >
          📞 客服申诉 (孙丽)
        </button>
      </div>

      <div class="ml-auto flex-align-center gap-2">
        <button type="button" class="btn btn-sm btn-outline" @click="refreshAll" :disabled="loading">
          {{ loading ? '刷新中...' : '🔄 刷新经办数据' }}
        </button>
      </div>
    </div>

    <!-- 顶部核心经办指标看板 -->
    <div class="metric-grid">
      <div class="metric-card pointer" @click="activeTab = 'intake_dispatch'">
        <div class="metric-num text-primary">{{ pendingApplications.length }}</div>
        <div class="metric-label">待受理申报 / 待派单</div>
      </div>
      <div class="metric-card pointer" @click="activeTab = 'intake_dispatch'">
        <div class="metric-num">{{ activeTasks.length }}</div>
        <div class="metric-label">执行中失能评估任务</div>
      </div>
      <div class="metric-card pointer" @click="activeTab = 'inspections'">
        <div class="metric-num text-danger">
          <span v-if="activeInspectionsCount > 0" class="pulse-dot-red"></span>
          {{ activeInspectionsCount }} 个
        </div>
        <div class="metric-label">物联异常靶向待飞检工单</div>
      </div>
      <div class="metric-card pointer" @click="activeTab = 'settlement'">
        <div class="metric-num text-warning">{{ pendingSettlements.length }} 笔</div>
        <div class="metric-label">待经办初审结算单 (第2步)</div>
      </div>
      <div class="metric-card pointer" @click="activeTab = 'settlement'">
        <div class="metric-num text-danger">¥{{ ((dashboardData?.kpis?.settlement_deductions_mtd || 48600) / 10000).toFixed(2) }}万</div>
        <div class="metric-label">当月物联核减违规金额</div>
      </div>
      <div class="metric-card pointer" @click="activeTab = 'dashboard'">
        <div class="metric-num text-success">
          <span class="pulse-dot"></span>
          {{ selectedPool === 'suqian' ? '3 / 3' : '5 / 5' }} 台
        </div>
        <div class="metric-label">智能物联感知在网终端</div>
      </div>
    </div>

    <!-- 5 大专业业务导航标签 -->
    <div class="tab-nav">
      <button :class="['tab-btn', activeTab === 'dashboard' && 'active']" @click="activeTab = 'dashboard'">
        📊 经办运营态势与SLA履约大盘
      </button>
      <button :class="['tab-btn', activeTab === 'intake_dispatch' && 'active']" @click="activeTab = 'intake_dispatch'">
        📝 业务受理与智能回避派单中心 ({{ applications.length }})
      </button>
      <button :class="['tab-btn', activeTab === 'inspections' && 'active']" @click="activeTab = 'inspections'">
        🔍 物联赋能·智能巡查与飞检中心 ({{ activeInspectionsCount }})
      </button>
      <button :class="['tab-btn', activeTab === 'settlement' && 'active']" @click="activeTab = 'settlement'">
        📑 结算四步分离·经办初审核销 ({{ settlements.length }})
      </button>
      <button :class="['tab-btn', activeTab === 'supervision' && 'active']" @click="activeTab = 'supervision'">
        🛡️ 医保局督办交办协查闭环 ({{ supervisionClues.length }})
      </button>
    </div>

    <!-- Tab 1: 经办运营态势与 SLA 履约大盘 -->
    <div v-if="activeTab === 'dashboard'" class="content-panel">
      <!-- 经办业务模式说明卡片 -->
      <div class="panel-card mb-4">
        <div class="card-head">
          <div class="card-title">🤝 受托商业保险经办工作机制与法定职能定位</div>
          <span class="tag tag-success">全面履约中</span>
        </div>
        <div class="mode-grid">
          <div class="mode-box">
            <div class="font-bold text-primary mb-2">📌 受托经办机构核心职责（中国太平洋人寿）</div>
            <ul class="text-sm text-secondary space-y-1">
              <li>✓ <strong>窗口与前置受理</strong>：参保人失能等级评定申请受理、基础信息与病历审查。</li>
              <li>✓ <strong>法定回避派工</strong>：执行评估机构与服务机构的法定利益回避，组织双人现场评定。</li>
              <li>✓ <strong>日常与靶向飞检</strong>：基于安守护毫米波雷达、体征垫客观体征开展工单靶向飞检与突击稽核。</li>
              <li>✓ <strong>结算四步分离初审</strong>：月度定点服务机构费用初审，核减物联违规工单并出具初审意见书。</li>
              <li>✓ <strong>协办医保局督办</strong>：承接地方医保局行政核查督办函，开展现场笔录取证并回执报告。</li>
            </ul>
          </div>
          <div class="mode-box">
            <div class="font-bold text-success mb-2">⚖️ 医保行政监管与受托分工边界</div>
            <ul class="text-sm text-secondary space-y-1">
              <li>★ <strong>最终等级行政核准</strong>：经办初审后，失能评估结论最终由医保局行政定级确认。</li>
              <li>★ <strong>行政裁决与熔断</strong>：严重骗保欺诈、定点机构协议中止由医保局行政执法裁决。</li>
              <li>★ <strong>基金月度划拨</strong>：经办机构出具初审扣减意见后，医保局终审签批并通过国库划拨资金。</li>
              <li>★ <strong>SLA 考核与监管评价</strong>：医保局按季度对经办机构受理时效、飞检覆盖率进行考核评分。</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- SLA 履约倒计时预警卡片 -->
      <div class="panel-card mb-4">
        <div class="card-head">
          <div class="card-title">⏱️ 医保委托经办 SLA 时效履约监控倒计时</div>
          <span class="tag tag-info">SLA履约率: {{ dashboardData?.kpis?.sla_compliance_rate || 99.4 }}%</span>
        </div>
        <div class="sla-grid">
          <div
            v-for="sla in dashboardData?.sla_countdowns"
            :key="sla.id"
            :class="['sla-card', sla.status === 'danger' ? 'sla-danger' : (sla.status === 'warning' ? 'sla-warning' : 'sla-normal')]"
          >
            <div class="sla-head">
              <span class="font-bold">{{ sla.type }}</span>
              <span :class="['tag', sla.status === 'danger' ? 'tag-danger font-bold' : (sla.status === 'warning' ? 'tag-warning' : 'tag-success')]">
                倒计时: {{ sla.due_in_hours }}小时
              </span>
            </div>
            <div class="sla-body">
              <div class="font-bold text-sm text-primary mb-1">{{ sla.target }}</div>
              <div class="text-xs text-muted">{{ sla.desc }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 安守护物联感知实时图谱 -->
      <div class="panel-card">
        <div class="card-head">
          <div class="card-title">📡 安守护物联遥测感知与工单自动化比对态势</div>
          <span class="tag tag-success">高频遥测通道正常</span>
        </div>
        <div class="iot-stats-grid">
          <div class="iot-stat-box">
            <div class="text-xs text-muted mb-1">毫米波在床/在室雷达在网率</div>
            <div class="font-bold text-xl text-primary">{{ dashboardData?.iot_health?.radar_online_rate || 100 }}%</div>
            <div class="text-xs text-success">已布设点位连续心跳保活</div>
          </div>
          <div class="iot-stat-box">
            <div class="text-xs text-muted mb-1">智能微动体征垫平稳感知率</div>
            <div class="font-bold text-xl text-primary">{{ dashboardData?.iot_health?.sensor_mat_vital_rate || 100 }}%</div>
            <div class="text-xs text-success">心率/呼吸生理波形连续在线</div>
          </div>
          <div class="iot-stat-box">
            <div class="text-xs text-muted mb-1">今日物联与工单对撞核验总量</div>
            <div class="font-bold text-xl text-primary">{{ dashboardData?.iot_health?.today_cross_checked_orders || 48 }} 单</div>
            <div class="text-xs text-secondary">全量居家/机构服务工单自动核验</div>
          </div>
          <div class="iot-stat-box">
            <div class="text-xs text-muted mb-1">智能捕获体征异常嫌疑工单</div>
            <div class="font-bold text-xl text-danger">{{ dashboardData?.iot_health?.today_detected_anomalies || 2 }} 单</div>
            <div class="text-xs text-danger">已自动触发靶向飞检队列</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab 2: 业务受理与智能回避派单中心 -->
    <div v-if="activeTab === 'intake_dispatch'" class="content-panel">
      <div class="panel-alert">
        <strong>⚖️ 法定回避派单门禁准则：</strong>
        受托商保经办机构派发失能评估任务时，系统强制启动“三重回避核验”：①
        评估机构与申请人所在服务机构（如护理院）利益关联回避（409强行阻断）；② 评估师近亲属及主诊医生回避；③
        防垄断轮候及重度评定偏离度预警（如执业评估师重度率超标自动警示）。
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th>申请编号</th>
            <th>参保申请人</th>
            <th>统筹区</th>
            <th>申报等级意向</th>
            <th>ADL自评得分</th>
            <th>申报主体/送审机构</th>
            <th>申报提交时间</th>
            <th>当前办理阶段</th>
            <th>经办受理与回避派工</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="app in filteredApplications" :key="app.application_id">
            <td class="font-mono font-bold">{{ app.application_id }}</td>
            <td class="font-bold">
              {{ app.applicant_name || app.applicant_id }}
              <span v-if="app.application_id === 'APP-MM-202609-001'" class="tag tag-danger ml-1 text-xs">雷达冲突</span>
            </td>
            <td>
              <span class="tag tag-info">{{ app.applicant_id?.startsWith('P_SQ_') ? '宿迁试点' : '某某市' }}</span>
            </td>
            <td><span class="tag tag-warning">{{ app.application_level }}</span></td>
            <td class="font-mono font-bold">{{ app.self_assessment_grade || '自评10分' }}</td>
            <td>{{ formatApplicantOrg(app) }}</td>
            <td>{{ app.apply_date?.slice(0, 10) || '2026-09-21' }}</td>
            <td>
              <span :class="['status-pill', app.status === 'submitted' ? 'status-warning' : 'status-success']">
                {{ formatAppStatus(app.status) }}
              </span>
            </td>
            <td>
              <button
                v-if="['submitted', 'materials_review', 'materials_pass', 'assess_pending'].includes(app.status)"
                class="btn btn-sm btn-primary"
                @click="openDispatchModal(app)"
              >
                ⚖️ 回避核验并派工
              </button>
              <span v-else class="text-muted text-xs">已派工/评估中</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Tab 3: 物联赋能·智能巡查与现场靶向飞检中心 -->
    <div v-if="activeTab === 'inspections'" class="content-panel">
      <div class="panel-alert">
        <strong>🔍 物联赋能靶向飞检：</strong>
        经办机构不再盲目扫街巡查，而是根据安守护毫米波雷达“室内空房打卡”、微动体征垫“康复无体动扰动”等客观物联报警线索，直接向现场巡查专员下发《现场靶向飞检任务》，突击入户查实并固定证据。
      </div>

      <div class="inspection-cards-grid">
        <div
          v-for="insp in filteredInspections"
          :key="insp.inspection_id"
          :class="['insp-card', insp.risk_level === 'critical' ? 'insp-critical' : (insp.risk_level === 'high' ? 'insp-high' : 'insp-normal')]"
        >
          <div class="insp-head">
            <div class="flex-align-center gap-2">
              <span :class="['tag', insp.risk_level === 'critical' ? 'tag-danger font-bold' : (insp.risk_level === 'high' ? 'tag-warning font-bold' : 'tag-info')]">
                {{ insp.risk_level === 'critical' ? '🚨 重大疑点' : (insp.risk_level === 'high' ? '⚠️ 高风险预警' : '🟢 常规巡检') }}
              </span>
              <span class="font-bold text-sm">{{ insp.title }}</span>
            </div>
            <span :class="['status-pill', insp.status === 'pending_onsite' ? 'status-warning font-bold' : 'status-success font-bold']">
              {{ insp.status === 'pending_onsite' ? '待突击现场飞检' : '飞检已完成' }}
            </span>
          </div>

          <div class="insp-body">
            <div class="grid-2-col text-xs mb-2">
              <div><strong>涉案主体:</strong> {{ insp.target_name }} ({{ insp.service_org }})</div>
              <div><strong>服务长者:</strong> {{ insp.service_elder }} ({{ insp.elder_address }})</div>
              <div><strong>监测物联:</strong> {{ insp.device_sn }}</div>
              <div><strong>线索来源:</strong> {{ insp.source }}</div>
            </div>
            <div class="insp-anomaly-box">
              <span class="font-bold text-xs text-danger">物联客观异常描述: </span>
              <span class="text-xs text-secondary">{{ insp.anomaly_desc }}</span>
            </div>

            <!-- 飞检完成结论 -->
            <div v-if="insp.status === 'onsite_completed'" class="insp-result-box mt-2">
              <div class="flex-between text-xs mb-1">
                <span class="font-bold text-success">✓ 现场飞检处置结论: {{ insp.conclusion_label }}</span>
                <span class="text-muted">查验人: {{ insp.inspector_name }} ({{ insp.inspected_at?.slice(0, 16) }})</span>
              </div>
              <div class="text-xs text-secondary"><strong>现场调查笔录:</strong> {{ insp.onsite_notes }}</div>
            </div>
          </div>

          <div class="insp-footer">
            <span class="text-xs text-muted">下发时间: {{ insp.created_at?.slice(0, 16) }} · 限时至: {{ insp.due_at?.slice(0, 16) }}</span>
            <div class="flex-align-center gap-2">
              <button
                v-if="insp.status === 'pending_onsite'"
                type="button"
                class="btn btn-sm btn-primary"
                @click="openInspectionModal(insp)"
              >
                📝 执行突击飞检并录入笔录
              </button>
              <button
                v-else
                type="button"
                class="btn btn-sm btn-outline"
                @click="openInspectionModal(insp)"
              >
                查阅飞检档案卷宗
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab 4: 结算四步分离·经办业务初审与物联核减 -->
    <div v-if="activeTab === 'settlement'" class="content-panel">
      <div class="panel-alert">
        <strong>📑 结算四步分离之「第二步：受托商保经办初审」：</strong>
        经办机构受理定点机构申报后，系统自动与在床雷达、体征垫工单数据对撞，标出违规扣减项。经办初审员核准扣减后出具《受托经办机构月度结算初审意见书》，盖章后提请医保局执行第3步终审。
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th>结算单号</th>
            <th>定点服务机构</th>
            <th>统筹区</th>
            <th>结算所属期</th>
            <th>申报总额</th>
            <th>当前四步流转状态</th>
            <th>经办初审与核减操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in filteredSettlements" :key="s.settlement_id">
            <td class="font-mono font-bold">{{ s.settlement_id }}</td>
            <td>
              <strong>{{ s.org_name || (s.pool_id === 'suqian' ? '宿迁市长护试点照护中心' : '某某市康泰居家照护中心') }}</strong>
            </td>
            <td>
              <span class="tag tag-info">{{ s.pool_id === 'suqian' ? '宿迁试点' : '某某市' }}</span>
            </td>
            <td>{{ s.period }}</td>
            <td class="font-bold text-primary">¥{{ (s.amount || 0).toLocaleString() }}</td>
            <td>
              <span v-if="s.status === 'declared'" class="tag tag-warning font-bold">第1步机构已申报 · 待经办初审</span>
              <span v-else-if="s.status === 'pre_reviewed'" class="tag tag-info font-bold">第2步经办初审通过 · 待医保复核</span>
              <span v-else-if="s.status === 're_reviewed'" class="tag tag-success font-bold">第3步医保终审通过 · 待划拨</span>
              <span v-else class="tag tag-success font-bold">第4步银行已划拨结清</span>
            </td>
            <td>
              <div class="flex-align-center gap-2">
                <button
                  v-if="s.status === 'declared'"
                  class="btn btn-sm btn-primary"
                  @click="openPreReviewModal(s)"
                >
                  📑 物联核减并经办初审
                </button>
                <button
                  v-if="s.pre_review_voucher || s.status !== 'declared'"
                  class="btn btn-sm btn-outline"
                  @click="viewPreReviewVoucher(s)"
                >
                  查阅经办初审意见书
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Tab 5: 医保局督办交办协查闭环 -->
    <div v-if="activeTab === 'supervision'" class="content-panel">
      <div class="panel-alert">
        <strong>🛡️ 医保行政监督协同联动专区：</strong>
        此处实时汇聚医保局稽核科下发的《长期护理保险核查督办函》。受托经办机构专班组织现场调查取证，录入调查询问笔录与影像，在线向医保局分管领导提交回执。
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th>案件编号</th>
            <th>医保督办文号</th>
            <th>涉案对象 / 机构</th>
            <th>核查督办要点</th>
            <th>协办时限</th>
            <th>当前状态</th>
            <th>经办协查操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="clue in supervisionClues" :key="clue.clue_id">
            <td class="font-mono font-bold">{{ clue.clue_id }}</td>
            <td>
              <span class="font-bold text-primary">{{ clue.dispatch_order?.order_no || '某医保长护督字〔2026〕第011号' }}</span>
            </td>
            <td>
              <div><strong>{{ clue.target_elder || '赵大有' }}</strong></div>
              <div class="text-xs text-muted">{{ clue.target_org || '某某市康泰居家照护中心' }}</div>
            </td>
            <td class="text-xs">{{ clue.dispatch_order?.inquiry_points || '核查雷达活动度冲突，入户查验老人自主活动能力，拍摄视频留证。' }}</td>
            <td>{{ clue.dispatch_order?.due_hours ? clue.dispatch_order.due_hours + '小时内' : '24小时内' }}</td>
            <td>
              <span :class="['status-pill', clue.status === 'dispatched' ? 'status-warning font-bold' : 'status-success']">
                {{ clue.status === 'dispatched' ? '待经办现场反馈' : '经办已反馈回执' }}
              </span>
            </td>
            <td>
              <button
                class="btn btn-sm btn-primary"
                @click="openFeedbackModal(clue)"
              >
                {{ clue.status === 'dispatched' ? '✍️ 提交调查回执' : '查阅协查报告' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 弹窗 1: 法定回避派单模态框 -->
    <div v-if="showDispatchModal && selectedApp" class="modal-backdrop">
      <div class="modal-card">
        <div class="modal-head">
          <div class="font-bold">⚖️ 失能等级评定法定回避审核与任务派工单</div>
          <button class="close-x" @click="showDispatchModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="panel-card bg-subtle mb-3">
            <div class="grid-2-col text-xs">
              <div><strong>申请人:</strong> {{ selectedApp.applicant_name || selectedApp.applicant_id }}</div>
              <div><strong>申报等级意向:</strong> {{ selectedApp.application_level }}</div>
              <div><strong>送审机构:</strong> {{ formatApplicantOrg(selectedApp) }}</div>
              <div><strong>自评ADL得分:</strong> {{ selectedApp.self_assessment_grade || '10分 (完全失能)' }}</div>
            </div>
          </div>

          <div class="form-group mb-3">
            <label class="font-bold text-xs">指派独立第三方评估机构与主评评估师：</label>
            <select v-model="selectedAssessorAccount" class="form-select">
              <option value="zhouhaifeng">周海峰 (某某市康诺医学评估所 · 重度评定率 24.2% · 五星优良)</option>
              <option value="songhuimin">宋慧敏 (某某市康诺医学评估所 · 重度评定率 22.8% · 五星优良)</option>
              <option value="chenjianguo">陈建国 (第三方综合长护评估所 · 重度评定率 25.1% · 五星优良)</option>
              <option value="wumingxuan" disabled>吴明轩 (某某市明康第三方评估中心 · 🛑 触发长效追责立案，已停权)</option>
            </select>
          </div>

          <!-- 三重法定回避核验清单 -->
          <div class="avoidance-checklist mb-3">
            <div class="font-bold text-xs mb-2 text-primary">🛡️ 智能法定利益回避三重门禁实时校验结果：</div>
            <div class="check-item text-xs text-success">
              <span>✓ 机构利益回避校验通过：评估机构与申报机构无资本/股权关联关系（非同一集团）。</span>
            </div>
            <div class="check-item text-xs text-success">
              <span>✓ 人员亲属回避校验通过：评估人员与被评估对象无三代以内血亲或近亲属关系。</span>
            </div>
            <div class="check-item text-xs text-success">
              <span>✓ 执业偏离度预警校验通过：所选评估师评定等级分布符合高斯常模，无垄断派单嫌疑。</span>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showDispatchModal = false">取消</button>
          <button class="btn btn-primary" :disabled="dispatching" @click="confirmDispatch">
            {{ dispatching ? '派工中...' : '确认法定回避并下发派工单' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 弹窗 2: 现场突击飞检处置模态框 -->
    <div v-if="showInspectionModal && selectedInspection" class="modal-backdrop">
      <div class="modal-card modal-lg">
        <div class="modal-head">
          <div class="font-bold">🔍 物联赋能·经办现场突击飞检处置单 ({{ selectedInspection.inspection_id }})</div>
          <button class="close-x" @click="showInspectionModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="panel-card bg-subtle mb-3">
            <div class="grid-2-col text-xs">
              <div><strong>涉案对象:</strong> {{ selectedInspection.target_name }} ({{ selectedInspection.service_org }})</div>
              <div><strong>服务长者:</strong> {{ selectedInspection.service_elder }}</div>
              <div><strong>监测终端:</strong> {{ selectedInspection.device_sn }}</div>
              <div><strong>线索来源:</strong> {{ selectedInspection.source }}</div>
            </div>
            <div class="mt-2 text-xs text-danger">
              <strong>物联客观异常:</strong> {{ selectedInspection.anomaly_desc }}
            </div>
          </div>

          <div class="form-group mb-3">
            <label class="font-bold text-xs">现场突击调查询问笔录与核验事实：</label>
            <textarea
              v-model="inspectionForm.notes"
              class="form-textarea"
              rows="3"
              placeholder="请输入现场走访、长者询问、现场实物查验详情..."
            ></textarea>
          </div>

          <div class="form-group mb-3">
            <label class="font-bold text-xs">经办现场查验定性结论：</label>
            <select v-model="inspectionForm.conclusion" class="form-select">
              <option value="confirmed_fraud">违规属实 · 执行工单全额核减并上报医保立案</option>
              <option value="verified_normal">现场核验合规 · 经查老人临时外出已提供证明</option>
              <option value="further_investigation">待补充调证 · 需调阅门禁视频与走访邻里</option>
            </select>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showInspectionModal = false">关闭</button>
          <button
            v-if="selectedInspection.status === 'pending_onsite'"
            class="btn btn-primary"
            :disabled="inspecting"
            @click="submitInspectionRecord"
          >
            {{ inspecting ? '提交中...' : '提交飞检结论并锁定违规工单' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 弹窗 3: 结算初审物联核减模态框 -->
    <div v-if="showPreReviewModal && selectedSettlement" class="modal-backdrop">
      <div class="modal-card modal-lg">
        <div class="modal-head">
          <div class="font-bold">📑 受托商保经办月度结算初审核减签批单 (第2步)</div>
          <button class="close-x" @click="showPreReviewModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="panel-card bg-subtle mb-3">
            <div class="grid-2-col text-xs">
              <div><strong>定点机构:</strong> {{ selectedSettlement.org_name }}</div>
              <div><strong>结算期:</strong> {{ selectedSettlement.period }}</div>
              <div><strong>机构申报总额:</strong> <span class="font-bold text-primary">¥{{ (selectedSettlement.amount || 0).toLocaleString() }}</span></div>
              <div><strong>统筹区:</strong> {{ selectedSettlement.pool_id === 'suqian' ? '宿迁试点' : '某某市' }}</div>
            </div>
          </div>

          <!-- 物联自动化比对扣减明细 -->
          <div class="deduction-box mb-3">
            <div class="font-bold text-xs mb-2 text-danger">⚠️ 物联客观遥测自动核减清单（前置自动比对）：</div>
            <div class="check-item text-xs">
              <input type="checkbox" id="d1" v-model="preReviewForm.deduct1" />
              <label for="d1">核减项 1: 助老员王金凤入户打卡雷达空房无人工单 (40小时违规) · 建议核减 ¥4,800.00</label>
            </div>
            <div class="check-item text-xs">
              <input type="checkbox" id="d2" v-model="preReviewForm.deduct2" />
              <label for="d2">核减项 2: 护理员张德彪康复翻身时段体征垫无受力扰动工单 (35小时) · 建议核减 ¥2,400.00</label>
            </div>
          </div>

          <div class="form-group mb-3">
            <label class="font-bold text-xs">核准扣减总金额 (元)：</label>
            <input type="number" v-model="preReviewForm.amount" class="form-input" />
          </div>

          <div class="form-group mb-3">
            <label class="font-bold text-xs">经办初审审查意见书附言：</label>
            <textarea v-model="preReviewForm.note" class="form-textarea" rows="2"></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showPreReviewModal = false">取消</button>
          <button class="btn btn-primary" :disabled="preReviewing" @click="confirmPreReview">
            {{ preReviewing ? '签批中...' : '加盖经办印章并推报医保局终审' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 弹窗 4: 经办初审意见书官方电子凭证 -->
    <div v-if="showVoucherModal && currentVoucher" class="modal-backdrop">
      <div class="modal-card modal-voucher">
        <div class="voucher-paper">
          <div class="voucher-header">
            <div class="voucher-title">长期护理保险受托商保经办月度结算初审意见书</div>
            <div class="voucher-subtitle">中国太平洋人寿保险股份有限公司长护险经办服务中心</div>
            <div class="voucher-no">凭证编号: {{ currentVoucher.voucher_no }}</div>
          </div>

          <div class="voucher-table-box">
            <table class="voucher-table">
              <tr>
                <td class="v-label">定点服务机构</td>
                <td class="v-val">{{ currentVoucher.org_name }}</td>
                <td class="v-label">结算所属期</td>
                <td class="v-val">{{ currentVoucher.period }}</td>
              </tr>
              <tr>
                <td class="v-label">机构申报总额</td>
                <td class="v-val">¥{{ (currentVoucher.declared_amount || 0).toLocaleString() }}</td>
                <td class="v-label">经办核减金额</td>
                <td class="v-val text-danger font-bold">¥{{ (currentVoucher.deducted_amount || 0).toLocaleString() }}</td>
              </tr>
              <tr>
                <td class="v-label">经办初审通过额</td>
                <td colspan="3" class="v-val text-primary font-bold">
                  ¥{{ (currentVoucher.passed_amount || 0).toLocaleString() }}
                </td>
              </tr>
              <tr>
                <td class="v-label">核减原因与依据</td>
                <td colspan="3" class="v-val text-xs">
                  <div v-for="(r, idx) in currentVoucher.deduction_reasons" :key="idx">
                    • {{ r }}
                  </div>
                </td>
              </tr>
              <tr>
                <td class="v-label">经办初审专员</td>
                <td class="v-val">{{ currentVoucher.auditor || '张慧敏 (审核员)' }}</td>
                <td class="v-label">初审时间</td>
                <td class="v-val">{{ currentVoucher.audited_at?.slice(0, 16) }}</td>
              </tr>
            </table>
          </div>

          <div class="voucher-seal-box">
            <div class="voucher-seal">
              <div class="seal-inner">
                <span>中国太平洋人寿保险</span>
                <span class="seal-star">★</span>
                <span>长护经办审核专用章</span>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showVoucherModal = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 弹窗 5: 医保督办协查反馈模态框 -->
    <div v-if="showFeedbackModal && selectedClue" class="modal-backdrop">
      <div class="modal-card modal-lg">
        <div class="modal-head">
          <div class="font-bold">🛡️ 经办协查医保督办函反馈报告书 ({{ selectedClue.dispatch_order?.order_no || '某医保长护督字〔2026〕第011号' }})</div>
          <button class="close-x" @click="showFeedbackModal = false">×</button>
        </div>
        <div class="modal-body">
          <div class="panel-card bg-subtle mb-3">
            <div class="grid-2-col text-xs">
              <div><strong>涉案对象:</strong> {{ selectedClue.target_elder || '赵大有' }}</div>
              <div><strong>涉案机构:</strong> {{ selectedClue.target_org || '某某市康泰居家照护中心' }}</div>
              <div><strong>交办下发人:</strong> {{ selectedClue.dispatch_order?.dispatched_by || 'demo_audit (林志刚 科长)' }}</div>
              <div><strong>办结时限:</strong> 24小时内</div>
            </div>
            <div class="mt-2 text-xs text-primary">
              <strong>医保交办要点:</strong> {{ selectedClue.dispatch_order?.inquiry_points || '核查雷达活动度冲突，入户查验老人自主活动能力，拍摄视频留证。' }}
            </div>
          </div>

          <div class="form-group mb-3">
            <label class="font-bold text-xs">经办专班调查情况说明与现场笔录：</label>
            <textarea
              v-model="feedbackForm.notes"
              class="form-textarea"
              rows="3"
              placeholder="请输入经办专班入户走访调查情况说明..."
            ></textarea>
          </div>

          <div class="form-group mb-3">
            <label class="font-bold text-xs">经办机构初核拟处建议：</label>
            <select v-model="feedbackForm.preAdvisory" class="form-select">
              <option value="suggest_deduct">拟处建议：违规属实，建议全额核减补贴并移交医保稽核立案</option>
              <option value="suggest_interview">拟处建议：违规轻微，建议对机构责任人进行行政约谈并限期整改</option>
              <option value="suggest_pass">拟处建议：经查属误报警，建议维持原待遇</option>
            </select>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showFeedbackModal = false">关闭</button>
          <button
            class="btn btn-primary"
            :disabled="feedbacking"
            @click="submitClueFeedback"
          >
            {{ feedbacking ? '回执中...' : '提交经办协查报告至医保局终审' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import {
  getLtcApplications,
  getAssessmentTasks,
  dispatchAssessmentTask,
  getSettlements,
  reviewSettlement,
  getSupervisionClues,
  feedbackSupervisionClue,
  getInsurerDashboard,
  getInsurerInspections,
  recordInsurerInspection,
  type InsurerDashboardData,
  type InsurerInspectionTask,
  type LtcApplication,
  type AssessmentTask,
  type Settlement,
  type SupervisionClue,
} from '../../../api/client'
import { getSession } from '../../../api/http'

const session = getSession()
const currentUserRole = ref(session?.principal?.role || 'insurer_director')
const currentUserPool = ref<'all' | 'suqian' | 'moumou'>(
  session?.pool_id === 'suqian' ? 'suqian' : 'moumou'
)
const selectedPool = ref<'moumou' | 'suqian'>(
  currentUserPool.value === 'suqian' ? 'suqian' : 'moumou'
)

const currentSeat = ref<'director' | 'intake' | 'inspector' | 'auditor' | 'service'>('director')

const activeTab = ref<'dashboard' | 'intake_dispatch' | 'inspections' | 'settlement' | 'supervision'>('dashboard')
const loading = ref(false)

const dashboardData = ref<InsurerDashboardData | null>(null)
const applications = ref<LtcApplication[]>([])
const tasks = ref<AssessmentTask[]>([])
const settlements = ref<Settlement[]>([])
const inspections = ref<InsurerInspectionTask[]>([])
const supervisionClues = ref<SupervisionClue[]>([])

// 弹窗状态
const showDispatchModal = ref(false)
const selectedApp = ref<LtcApplication | null>(null)
const selectedAssessorAccount = ref('zhouhaifeng')
const dispatching = ref(false)

const showInspectionModal = ref(false)
const selectedInspection = ref<InsurerInspectionTask | null>(null)
const inspecting = ref(false)
const inspectionForm = ref({
  notes: '',
  conclusion: 'confirmed_fraud',
})

const showPreReviewModal = ref(false)
const selectedSettlement = ref<Settlement | null>(null)
const preReviewing = ref(false)
const preReviewForm = ref({
  deduct1: true,
  deduct2: false,
  amount: 4800,
  note: '经办初审比对安守护物联数据，核减隔空虚假打卡违规工单 4,800 元，通过初审提请医保终审。',
})

const showVoucherModal = ref(false)
const currentVoucher = ref<any>(null)

const showFeedbackModal = ref(false)
const selectedClue = ref<SupervisionClue | null>(null)
const feedbacking = ref(false)
const feedbackForm = ref({
  notes: '经办联合调查专班入户突击走访，老人活动如常，承认家属听信中介夸大自评以谋求待遇补贴。已录制现场走访视频。',
  preAdvisory: 'suggest_deduct',
})

// 筛选后数据
const filteredApplications = computed(() => {
  if (selectedPool.value === 'suqian') {
    return applications.value.filter((a) => a.applicant_id?.startsWith('P_SQ_'))
  }
  return applications.value.filter((a) => !a.applicant_id?.startsWith('P_SQ_'))
})

const filteredSettlements = computed(() => {
  return settlements.value.filter((s) => s.pool_id === selectedPool.value)
})

const filteredInspections = computed(() => {
  return inspections.value.filter((i) => i.pool_id === selectedPool.value)
})

const pendingApplications = computed(() => {
  return filteredApplications.value.filter((a) => ['submitted', 'materials_review'].includes(a.status))
})

const activeTasks = computed(() => {
  return tasks.value.filter((t) => ['assigned', 'assessing'].includes(t.status))
})

const pendingSettlements = computed(() => {
  return filteredSettlements.value.filter((s) => s.status === 'declared')
})

const activeInspectionsCount = computed(() => {
  return filteredInspections.value.filter((i) => i.status === 'pending_onsite').length
})

function selectPool(pool: 'moumou' | 'suqian') {
  selectedPool.value = pool
  refreshAll()
}

function switchSeat(seat: 'director' | 'intake' | 'inspector' | 'auditor' | 'service') {
  currentSeat.value = seat
  if (seat === 'intake') activeTab.value = 'intake_dispatch'
  else if (seat === 'inspector') activeTab.value = 'inspections'
  else if (seat === 'auditor') activeTab.value = 'settlement'
  else if (seat === 'director') activeTab.value = 'dashboard'
  else if (seat === 'service') activeTab.value = 'intake_dispatch'
}

function formatApplicantOrg(app: LtcApplication) {
  if (app.applicant_id?.startsWith('P_SQ_')) return '宿迁市长护试点照护中心'
  if (app.tenant_id === 'org_mm_01' || app.tenant_id === 'bureau_moumou') return '某某市康泰居家照护中心'
  if (app.tenant_id === 'org_mm_02') return '某某市颐养天年护理院'
  return '居家照护机构代理申报'
}

function formatAppStatus(status: string) {
  const map: Record<string, string> = {
    submitted: '已申报 · 待经办初核',
    materials_review: '材料审查中',
    materials_pass: '材料齐备 · 待派单',
    assess_pending: '已派单 · 评估任务执行中',
    assessing: '现场评估中',
    assessed: '已出具评估报告',
    approved: '待遇资格已核准',
  }
  return map[status] || status
}

// 打开回避派单模态框
function openDispatchModal(app: LtcApplication) {
  selectedApp.value = app
  showDispatchModal.value = true
}

async function confirmDispatch() {
  if (!selectedApp.value) return
  dispatching.value = true
  try {
    await dispatchAssessmentTask({
      application_id: selectedApp.value.application_id,
      assessor_account: selectedAssessorAccount.value,
    })
    alert('✓ 法定回避门禁核验通过！评估任务派工单已下发至评估所。')
    showDispatchModal.value = false
    await refreshAll()
  } catch (err: any) {
    alert('派单失败: ' + (err.message || '回避门禁阻断'))
  } finally {
    dispatching.value = false
  }
}

// 打开现场飞检模态框
function openInspectionModal(insp: InsurerInspectionTask) {
  selectedInspection.value = insp
  inspectionForm.value.notes = insp.onsite_notes || '经办巡查主管李勇突击上门现场调查询问，长者证实该时段助老员未入户，雷达空房属实。'
  inspectionForm.value.conclusion = insp.conclusion || 'confirmed_fraud'
  showInspectionModal.value = true
}

async function submitInspectionRecord() {
  if (!selectedInspection.value) return
  inspecting.value = true
  try {
    await recordInsurerInspection(selectedInspection.value.inspection_id, {
      status: 'onsite_completed',
      conclusion: inspectionForm.value.conclusion,
      conclusion_label: inspectionForm.value.conclusion === 'confirmed_fraud' ? '违规属实·执行工单核减' : '现场核验合规',
      onsite_notes: inspectionForm.value.notes,
      inspector_name: '李勇 (现场巡查主管)',
    })
    alert('✓ 现场飞检处置结论已录入，关联违规工单已自动冻结核减！')
    showInspectionModal.value = false
    await refreshAll()
  } catch (err: any) {
    alert('提交失败: ' + err.message)
  } finally {
    inspecting.value = false
  }
}

// 打开经办初审模态框
function openPreReviewModal(s: Settlement) {
  selectedSettlement.value = s
  preReviewForm.value.amount = 4800
  showPreReviewModal.value = true
}

async function confirmPreReview() {
  if (!selectedSettlement.value) return
  preReviewing.value = true
  try {
    const reasons: string[] = []
    if (preReviewForm.value.deduct1) reasons.push('安守护毫米波雷达空房无人隔空打卡核减 (40小时违规)')
    if (preReviewForm.value.deduct2) reasons.push('体征垫无受力扰动挂床走过场核减 (35小时)')

    await reviewSettlement(selectedSettlement.value.settlement_id, {
      step: 2,
      action: 'pre_review',
      pass: true,
      deducted_amount: Number(preReviewForm.value.amount || 0),
      deduction_reasons: reasons,
      note: preReviewForm.value.note,
    } as any)

    alert('✓ 经办初审通过！已加盖经办电子签章，并提请医保局结算财务科执行终审划拨。')
    showPreReviewModal.value = false
    await refreshAll()
  } catch (err: any) {
    alert('初审提交失败: ' + err.message)
  } finally {
    preReviewing.value = false
  }
}

function viewPreReviewVoucher(s: Settlement) {
  currentVoucher.value = s.pre_review_voucher || {
    voucher_no: `INSAUDIT-202609-${s.settlement_id.slice(-4)}`,
    period: s.period,
    org_name: s.org_name || '某某市康泰居家照护中心',
    declared_amount: s.amount,
    deducted_amount: (s as any).pre_review_deduction || 4800,
    passed_amount: (s.amount || 186400) - ((s as any).pre_review_deduction || 4800),
    deduction_reasons: (s as any).pre_review_reasons || ['安守护毫米波雷达空房无人隔空打卡核减 (40小时违规)'],
    auditor: s.pre_reviewed_by || '张慧敏 (审核员)',
    audited_at: s.pre_reviewed_at || '2026-09-24T15:00:00+08:00',
  }
  showVoucherModal.value = true
}

// 打开督办协查模态框
function openFeedbackModal(clue: SupervisionClue) {
  selectedClue.value = clue
  feedbackForm.value.notes = clue.feedback?.interview_notes || '经办联合调查专班入户突击走访，老人活动如常，承认家属听信中介夸大自评以谋求待遇补贴。已录制现场走访视频。'
  feedbackForm.value.preAdvisory = clue.feedback?.pre_advisory || 'suggest_deduct'
  showFeedbackModal.value = true
}

async function submitClueFeedback() {
  if (!selectedClue.value) return
  feedbacking.value = true
  try {
    await feedbackSupervisionClue(selectedClue.value.clue_id, {
      interview_notes: feedbackForm.value.notes,
      pre_advisory: feedbackForm.value.preAdvisory,
    })
    alert('✓ 经办协查调查报告已提交回执至医保局！')
    showFeedbackModal.value = false
    await refreshAll()
  } catch (err: any) {
    alert('反馈失败: ' + err.message)
  } finally {
    feedbacking.value = false
  }
}

async function refreshAll() {
  loading.value = true
  try {
    const [dash, appsRes, tasksRes, setsRes, inspsRes, cluesRes] = await Promise.all([
      getInsurerDashboard({ pool_id: selectedPool.value }).catch(() => null),
      getLtcApplications().catch(() => ({ list: [], total: 0 })),
      getAssessmentTasks().catch(() => ({ list: [], total: 0 })),
      getSettlements().catch(() => ({ list: [], total: 0 })),
      getInsurerInspections({ pool_id: selectedPool.value }).catch(() => ({ list: [], total: 0 })),
      getSupervisionClues({ pool_id: selectedPool.value }).catch(() => ({ list: [], total: 0 })),
    ])

    dashboardData.value = dash
    applications.value = appsRes.list || []
    tasks.value = tasksRes.list || []
    settlements.value = setsRes.list || []
    inspections.value = inspsRes.list || []
    supervisionClues.value = cluesRes.list || []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  refreshAll()
})
</script>

<style scoped>
.workspace-page {
  padding: 1.5rem;
  max-width: 1540px;
  margin: 0 auto;
  min-height: 100vh;
  box-sizing: border-box;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.25rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}

.page-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.02em;
}

.page-subtitle {
  font-size: 0.875rem;
  color: #475569;
  margin-top: 0.25rem;
}

.header-badges {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.badge {
  padding: 0.25rem 0.6rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}
.badge-primary { background: #e0f2fe; color: #0284c7; }
.badge-success { background: #dcfce7; color: #16a34a; }
.badge-info { background: #f1f5f9; color: #475569; }

/* 统筹区与席位条 */
.pool-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  background: #f8fafc;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
  margin-bottom: 1.25rem;
}

.pool-selector, .department-seats {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.pool-btn, .seat-btn {
  background: white;
  border: 1px solid #cbd5e1;
  padding: 0.3rem 0.65rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
  transition: all 0.15s ease;
}
.pool-btn:hover, .seat-btn:hover {
  background: #f1f5f9;
}
.pool-btn.active, .seat-btn.active {
  background: #0284c7;
  color: white;
  border-color: #0284c7;
  box-shadow: 0 1px 3px rgba(2, 132, 199, 0.3);
}

/* 指标卡片 */
.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.metric-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 1rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.metric-num {
  font-size: 1.6rem;
  font-weight: 800;
  line-height: 1.2;
}
.metric-label {
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 0.25rem;
}

/* 导航标签 */
.tab-nav {
  display: flex;
  gap: 0.5rem;
  border-bottom: 2px solid #e2e8f0;
  margin-bottom: 1.25rem;
  overflow-x: auto;
}

.tab-btn {
  background: transparent;
  border: none;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  position: relative;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.tab-btn:hover {
  color: #0284c7;
}
.tab-btn.active {
  color: #0284c7;
  border-bottom: 2px solid #0284c7;
  margin-bottom: -2px;
}

/* 内容面板与卡片 */
.content-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.panel-alert {
  background: #eff6ff;
  border-left: 4px solid #3b82f6;
  padding: 0.75rem 1rem;
  font-size: 0.825rem;
  color: #1e3a8a;
  border-radius: 0 0.375rem 0.375rem 0;
}

.panel-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #f1f5f9;
}
.card-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #1e293b;
}

.mode-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}
.mode-box {
  background: #f8fafc;
  padding: 1rem;
  border-radius: 0.375rem;
  border: 1px solid #e2e8f0;
}

.sla-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}
.sla-card {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 0.375rem;
  padding: 0.85rem;
}
.sla-danger { border-left: 4px solid #ef4444; background: #fff5f5; }
.sla-warning { border-left: 4px solid #f59e0b; background: #fffbeb; }
.sla-normal { border-left: 4px solid #10b981; background: #f0fdf4; }
.sla-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.iot-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}
.iot-stat-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  padding: 1rem;
  text-align: center;
}

/* 飞检卡片网格 */
.inspection-cards-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}
.insp-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 1rem 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
.insp-critical { border-left: 5px solid #dc2626; }
.insp-high { border-left: 5px solid #f97316; }
.insp-normal { border-left: 5px solid #10b981; }

.insp-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}
.insp-anomaly-box {
  background: #fef2f2;
  border: 1px dashed #fca5a5;
  border-radius: 0.375rem;
  padding: 0.5rem 0.75rem;
}
.insp-result-box {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 0.375rem;
  padding: 0.5rem 0.75rem;
}
.insp-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid #f1f5f9;
}

/* 表格通用 */
.data-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  overflow: hidden;
  font-size: 0.825rem;
}
.data-table th {
  background: #f8fafc;
  color: #475569;
  font-weight: 700;
  padding: 0.75rem 0.85rem;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}
.data-table td {
  padding: 0.75rem 0.85rem;
  border-bottom: 1px solid #f1f5f9;
  color: #1e293b;
}
.data-table tr:hover {
  background: #f8fafc;
}

/* 按钮与状态 */
.btn {
  padding: 0.45rem 0.85rem;
  border-radius: 0.375rem;
  font-size: 0.775rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.15s ease;
}
.btn-primary { background: #0284c7; color: white; }
.btn-primary:hover { background: #0369a1; }
.btn-secondary { background: #e2e8f0; color: #334155; }
.btn-secondary:hover { background: #cbd5e1; }
.btn-outline { background: white; border: 1px solid #cbd5e1; color: #334155; }
.btn-outline:hover { background: #f8fafc; }
.btn-sm { padding: 0.25rem 0.5rem; font-size: 0.725rem; }

.status-pill {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.725rem;
}
.status-warning { background: #fef3c7; color: #92400e; }
.status-success { background: #dcfce7; color: #16a34a; }

.tag {
  display: inline-block;
  padding: 0.15rem 0.4rem;
  border-radius: 0.25rem;
  font-size: 0.7rem;
}
.tag-info { background: #e0f2fe; color: #0369a1; }
.tag-success { background: #dcfce7; color: #15803d; }
.tag-warning { background: #fef3c7; color: #b45309; }
.tag-danger { background: #fee2e2; color: #b91c1c; }

.pulse-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  animation: pulse 1.8s infinite;
}
.pulse-dot-red {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  animation: pulse-red 1.8s infinite;
}

@keyframes pulse {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
}
@keyframes pulse-red {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
}

/* 弹窗通用 */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 1rem;
}
.modal-card {
  background: white;
  border-radius: 0.5rem;
  width: 100%;
  max-width: 600px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}
.modal-lg { max-width: 760px; }
.modal-voucher { max-width: 820px; }

.modal-head {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.close-x {
  background: transparent;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  color: #94a3b8;
}
.modal-body {
  padding: 1.25rem;
  overflow-y: auto;
}
.modal-footer {
  padding: 0.85rem 1.25rem;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  background: #f8fafc;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.form-select, .form-input, .form-textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.375rem;
  font-size: 0.825rem;
  box-sizing: border-box;
}

.grid-2-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

/* 官方凭证纸质质感 */
.voucher-paper {
  background: #fffdfa;
  padding: 2rem;
  border: 1px solid #e2e8f0;
  position: relative;
}
.voucher-header {
  text-align: center;
  border-bottom: 2px solid #b91c1c;
  padding-bottom: 1rem;
  margin-bottom: 1.25rem;
}
.voucher-title {
  font-size: 1.25rem;
  font-weight: 800;
  color: #991b1b;
  letter-spacing: 0.05em;
}
.voucher-subtitle {
  font-size: 0.85rem;
  color: #475569;
  margin-top: 0.25rem;
}
.voucher-no {
  font-size: 0.75rem;
  font-family: monospace;
  color: #64748b;
  margin-top: 0.25rem;
}
.voucher-table {
  width: 100%;
  border-collapse: collapse;
}
.voucher-table td {
  border: 1px solid #cbd5e1;
  padding: 0.6rem 0.8rem;
}
.v-label {
  background: #f1f5f9;
  font-weight: 700;
  width: 22%;
  color: #334155;
}
.voucher-seal-box {
  position: absolute;
  right: 3rem;
  bottom: 2rem;
  pointer-events: none;
}
.voucher-seal {
  width: 130px;
  height: 130px;
  border: 3px solid #dc2626;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  transform: rotate(-12deg);
  opacity: 0.85;
}
.seal-inner {
  text-align: center;
  color: #dc2626;
  font-size: 0.65rem;
  font-weight: 800;
  line-height: 1.2;
}
.seal-star {
  font-size: 1.2rem;
  display: block;
}

.text-primary { color: #0284c7; }
.text-success { color: #16a34a; }
.text-warning { color: #d97706; }
.text-danger { color: #dc2626; }
.text-muted { color: #94a3b8; }
.text-secondary { color: #475569; }
.font-mono { font-family: ui-monospace, monospace; }
.font-bold { font-weight: 700; }
.pointer { cursor: pointer; }
.flex-align-center { display: flex; align-items: center; }
.flex-between { display: flex; justify-content: space-between; align-items: center; }
.gap-2 { gap: 0.5rem; }
.mb-1 { margin-bottom: 0.25rem; }
.mb-2 { margin-bottom: 0.5rem; }
.mb-3 { margin-bottom: 0.75rem; }
.mb-4 { margin-bottom: 1rem; }
.mt-2 { margin-top: 0.5rem; }
.ml-auto { margin-left: auto; }
.bg-subtle { background: #f8fafc; }
</style>
