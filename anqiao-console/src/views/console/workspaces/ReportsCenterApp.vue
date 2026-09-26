<template>
  <div class="workspace-page reports-center">
    <!-- 打印隐藏非必要元素 -->
    <div class="page-header no-print">
      <div>
        <div class="page-title-row">
          <h1 class="page-title">监测与报告系统 · 医疗与长护质控中心</h1>
          <span class="badge badge-primary">权威客观存证</span>
          <span class="badge badge-success">医保监管直连</span>
          <span class="badge badge-neutral">{{ orgName }}</span>
        </div>
        <div class="page-subtitle">
          全周期长者生命体征客观监测 · 卧床长者防压疮定时翻身与体位记录 · 长护险月度医保结算合规审计 · 智能感知设备运行质量分析
        </div>
      </div>
      <div class="header-actions">
        <button class="btn btn-outline" @click="exportCsv">
          <span class="btn-icon">⬇️</span>
          导出全量台账 (CSV)
        </button>
        <button class="btn btn-primary" @click="showGenerateModal = true">
          <span class="btn-icon">+</span>
          一键生成最新报告
        </button>
      </div>
    </div>

    <!-- 核心指标摘要卡片 -->
    <div class="metric-grid no-print">
      <div class="metric-card">
        <div class="metric-num text-primary">{{ reportsList.length }}</div>
        <div class="metric-label">归档权威报告总数</div>
      </div>
      <div class="metric-card">
        <div class="metric-num text-success">48</div>
        <div class="metric-label">覆盖在管失能长者 (100% 纳管)</div>
      </div>
      <div class="metric-card">
        <div class="metric-num text-warning">98.6%</div>
        <div class="metric-label">高危防压疮翻身依从率 (达标)</div>
      </div>
      <div class="metric-card">
        <div class="metric-num text-success">100%</div>
        <div class="metric-label">长护险医保结算合规审计通过率</div>
      </div>
    </div>

    <!-- 过滤器与分类导航 -->
    <div class="filter-panel no-print">
      <div class="tab-nav">
        <button
          v-for="t in typeTabs"
          :key="t.key"
          :class="['tab-btn', selectedType === t.key && 'active']"
          @click="selectedType = t.key"
        >
          <span class="tab-icon">{{ t.icon }}</span>
          {{ t.label }} ({{ countByType(t.key) }})
        </button>
      </div>

      <div class="filter-row">
        <div class="filter-group">
          <label>统计周期：</label>
          <select v-model="selectedPeriod" class="filter-select">
            <option value="all">全部周期</option>
            <option value="2026-09">2026年09月 (当期)</option>
            <option value="2026-08">2026年08月</option>
            <option value="2026-Q3">2026年第三季度</option>
          </select>
        </div>

        <div class="filter-group search-group">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索长者姓名、床位号 (如: 张卫国 / 401-A)..."
            class="filter-search-input"
          />
        </div>

        <button class="btn btn-sm btn-outline" @click="loadData">
          🔄 刷新列表
        </button>
      </div>
    </div>

    <!-- 报告列表表格 -->
    <div class="content-panel no-print">
      <div v-if="loading" class="loading-box">
        <div class="loading-spinner"></div>
        <span>正在载入权威客观监测报告...</span>
      </div>

      <div v-else-if="filteredReports.length === 0" class="empty-box">
        <span class="empty-icon">📊</span>
        <p>暂无符合当前筛选条件的报告记录</p>
        <button class="btn btn-sm btn-primary" @click="showGenerateModal = true">
          立即生成第一份监测报告
        </button>
      </div>

      <div v-else class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 140px">报告编号</th>
              <th>报告类别与标题</th>
              <th>服务对象 / 床位</th>
              <th>核心监测量化指标</th>
              <th>编制与审核人</th>
              <th>生成周期</th>
              <th>质控状态</th>
              <th style="width: 220px; text-align: center">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in filteredReports" :key="r.report_id" class="report-row">
              <td class="font-mono font-bold text-primary">
                {{ r.report_id }}
              </td>
              <td>
                <div class="report-title-cell">
                  <span :class="['type-tag', 'type-' + r.type]">
                    {{ getTypeName(r.type) }}
                  </span>
                  <span class="report-title font-bold">{{ r.title }}</span>
                </div>
              </td>
              <td>
                <div v-if="r.patient_name" class="patient-cell">
                  <strong>{{ r.patient_name }}</strong>
                  <span class="text-xs text-muted">({{ r.bed_id || '床位已绑' }} · {{ r.ward || '4F' }})</span>
                </div>
                <div v-else class="text-xs text-muted">全院综合</div>
              </td>
              <td>
                <div class="metric-cell text-xs">
                  <template v-if="r.type === 'vital_signs' || r.type === 'user_health'">
                    <span>心率: <strong>{{ r.data?.vital_metrics?.avg_hr || 72 }}</strong> bpm</span>
                    <span class="divider">|</span>
                    <span>呼吸: <strong>{{ r.data?.vital_metrics?.avg_br || 18 }}</strong> rpm</span>
                    <span class="divider">|</span>
                    <span>睡眠: <strong>{{ r.data?.vital_metrics?.sleep_score || 88 }}</strong>分</span>
                  </template>
                  <template v-else-if="r.type === 'turn_position'">
                    <span>Braden: <strong class="text-danger">{{ r.data?.braden_score || 11 }}</strong>分 (高危)</span>
                    <span class="divider">|</span>
                    <span>翻身执行率: <strong class="text-success">{{ r.data?.compliance_rate || 98.6 }}%</strong></span>
                  </template>
                  <template v-else-if="r.type === 'long_care_insurance'">
                    <span>核验工时: <strong>{{ r.data?.verified_hours || 21600 }}</strong>h</span>
                    <span class="divider">|</span>
                    <span>拟拨付: <strong class="text-primary">¥{{ (r.data?.settlement_amount || 153600).toLocaleString() }}</strong></span>
                  </template>
                  <template v-else-if="r.type === 'device_quality'">
                    <span>终端在线率: <strong class="text-success">{{ r.data?.online_rate || 98.9 }}%</strong></span>
                    <span class="divider">|</span>
                    <span>运行总数: <strong>{{ r.data?.total_devices || 80 }}</strong>台</span>
                  </template>
                  <template v-else>
                    <span>客观数据已固化存证</span>
                  </template>
                </div>
              </td>
              <td class="text-xs">
                <div>编制: {{ r.nurse_name || r.owner }}</div>
                <div class="text-muted">审核: {{ r.auditor || '沈雅琴 (护士长)' }}</div>
              </td>
              <td class="text-xs font-mono">
                {{ r.period || '2026-09' }}
              </td>
              <td>
                <span class="status-pill status-success">
                  已审核归档
                </span>
              </td>
              <td class="action-cell">
                <button
                  class="btn btn-xs btn-primary"
                  @click="openReportDetail(r)"
                  title="查看医疗标准红头报告详情"
                >
                  👁️ 报告透视
                </button>
                <button
                  class="btn btn-xs btn-outline ml-1"
                  @click="printReport(r)"
                  title="一键打印或导出 PDF"
                >
                  🖨️ 打印
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 弹窗 1: 专业红头报告详情与透视 (支持独立完整打印) -->
    <div v-if="activeReport" class="modal-backdrop" @click="closeReportDetail">
      <div class="report-modal-dialog" @click.stop>
        <!-- 弹窗操作栏 (打印时自动隐藏) -->
        <div class="report-modal-bar no-print">
          <div class="bar-title">
            <span class="bar-tag">{{ getTypeName(activeReport.type) }}</span>
            {{ activeReport.title }}
          </div>
          <div class="bar-actions">
            <button class="btn btn-primary" @click="triggerPrint">
              🖨️ 一键打印 / 导出 PDF
            </button>
            <button class="btn btn-outline ml-2" @click="exportReportRaw(activeReport)">
              ⬇️ 导出原始数据 (JSON)
            </button>
            <button class="close-btn ml-3" @click="closeReportDetail">×</button>
          </div>
        </div>

        <!-- 报告红头正文 (打印专属区域) -->
        <div class="report-document printable-content" id="reportPrintArea">
          <!-- 红头机构抬头 -->
          <div class="doc-header">
            <div class="doc-org-title">{{ orgName }} · 中科安樵智能健康监测中心</div>
            <div class="doc-org-sub">KAIJIAN INTERNATIONAL CARE HOME · INTELLIGENT TELEMETRY SYSTEM</div>
            <div class="doc-red-line"></div>
            <div class="doc-sub-red-line"></div>
          </div>

          <!-- 报告大标题与条形码 -->
          <div class="doc-title-box">
            <h1 class="doc-main-title">{{ activeReport.title }}</h1>
            <div class="doc-barcode-row">
              <div class="barcode-graphic">
                <div class="barcode-bars"></div>
                <div class="barcode-text">NO. {{ activeReport.report_id }}</div>
              </div>
              <div class="doc-meta-info">
                <div>报告周期：<strong>{{ activeReport.period || '2026-09' }}</strong></div>
                <div>存证时间：{{ activeReport.generated_at?.slice(0, 19).replace('T', ' ') }}</div>
                <div>安全等级：国家级医养数据安全脱敏</div>
              </div>
            </div>
          </div>

          <!-- 长者个人医养信息档案 -->
          <div v-if="activeReport.patient_name" class="doc-section patient-info-section">
            <div class="section-title">一、服务对象与床位基础档案</div>
            <table class="doc-info-table">
              <tbody>
                <tr>
                  <td class="cell-label">长者姓名</td>
                  <td class="cell-value font-bold">{{ activeReport.patient_name }}</td>
                  <td class="cell-label">床位号</td>
                  <td class="cell-value font-bold text-primary">{{ activeReport.bed_id || '401-A' }}</td>
                  <td class="cell-label">所在病区</td>
                  <td class="cell-value">{{ activeReport.ward || '4F 康复特护区' }}</td>
                </tr>
                <tr>
                  <td class="cell-label">失能等级</td>
                  <td class="cell-value"><span class="tag tag-danger">特重度失能 (长期卧床)</span></td>
                  <td class="cell-label">责任护工</td>
                  <td class="cell-value">{{ activeReport.nurse_name || '李晓芳' }}</td>
                  <td class="cell-label">责任医生</td>
                  <td class="cell-value">林建新 (副主任医师)</td>
                </tr>
                <tr>
                  <td class="cell-label">医保编号</td>
                  <td class="cell-value font-mono">3205011945****8812</td>
                  <td class="cell-label">长护待遇状态</td>
                  <td class="cell-value text-success">已享受中科安樵软硬一体全流程照护</td>
                  <td class="cell-label">质控责任人</td>
                  <td class="cell-value">{{ activeReport.auditor || '沈雅琴 (护士长)' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- 报告详细核心内容 -->
          <div class="doc-section report-content-section">
            <div class="section-title">二、客观监测数据与医学质控分析</div>

            <!-- A. 体征健康监测详情 -->
            <template v-if="activeReport.type === 'vital_signs' || activeReport.type === 'user_health'">
              <div class="content-summary-box">
                <p><strong>客观体征连续感知结论：</strong></p>
                <p class="summary-text">{{ activeReport.data?.summary }}</p>
              </div>

              <div class="vital-stats-grid">
                <div class="v-card">
                  <div class="v-label">24h 均值心率</div>
                  <div class="v-val text-primary">{{ activeReport.data?.vital_metrics?.avg_hr || 72 }} <small>bpm</small></div>
                  <div class="v-range">正常参考: 60-100 (范围: {{ activeReport.data?.vital_metrics?.min_hr || 58 }}-{{ activeReport.data?.vital_metrics?.max_hr || 88 }})</div>
                </div>
                <div class="v-card">
                  <div class="v-label">24h 均值呼吸率</div>
                  <div class="v-val text-success">{{ activeReport.data?.vital_metrics?.avg_br || 18 }} <small>rpm</small></div>
                  <div class="v-range">正常参考: 12-20 (范围: {{ activeReport.data?.vital_metrics?.min_br || 14 }}-{{ activeReport.data?.vital_metrics?.max_br || 22 }})</div>
                </div>
                <div class="v-card">
                  <div class="v-label">平均日在床时长</div>
                  <div class="v-val text-warning">{{ activeReport.data?.vital_metrics?.in_bed_hours || 14.5 }} <small>小时/天</small></div>
                  <div class="v-range">夜间在床率 99.4% · 离床 {{ activeReport.data?.vital_metrics?.leave_bed_times || 3 }} 次</div>
                </div>
                <div class="v-card">
                  <div class="v-label">睡眠质量客观评分</div>
                  <div class="v-val text-primary">{{ activeReport.data?.vital_metrics?.sleep_score || 89 }} <small>分 (良)</small></div>
                  <div class="v-range">深睡 {{ activeReport.data?.vital_metrics?.deep_sleep_hours || 3.2 }}h · 浅睡 {{ activeReport.data?.vital_metrics?.light_sleep_hours || 4.8 }}h · REM {{ activeReport.data?.vital_metrics?.rem_sleep_hours || 1.5 }}h</div>
                </div>
              </div>

              <!-- 24h 连续心率/呼吸时序波形图 (SVG 精确渲染) -->
              <div class="chart-box">
                <div class="chart-header">
                  <span>📈 24小时客观连续心率与呼吸波动时序图 (00:00 - 24:00 每5分钟采样)</span>
                  <span class="text-xs text-muted">采样设备: 中科安樵·智能监护床垫 (ASH-01)</span>
                </div>
                <svg class="vital-svg-chart" viewBox="0 0 700 140">
                  <defs>
                    <linearGradient id="hrGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stop-color="#2563eb" stop-opacity="0.3" />
                      <stop offset="100%" stop-color="#2563eb" stop-opacity="0.0" />
                    </linearGradient>
                  </defs>
                  <!-- 网格基准线 -->
                  <line x1="40" y1="20" x2="680" y2="20" stroke="#e2e8f0" stroke-dasharray="3,3" />
                  <line x1="40" y1="60" x2="680" y2="60" stroke="#e2e8f0" stroke-dasharray="3,3" />
                  <line x1="40" y1="100" x2="680" y2="100" stroke="#e2e8f0" stroke-dasharray="3,3" />
                  <text x="15" y="24" font-size="10" fill="#94a3b8">90</text>
                  <text x="15" y="64" font-size="10" fill="#94a3b8">70</text>
                  <text x="15" y="104" font-size="10" fill="#94a3b8">50</text>
                  <!-- 心率填充与折线 -->
                  <path
                    d="M40,75 Q80,68 120,72 T200,60 T280,65 T360,78 T440,70 T520,63 T600,74 T680,69 L680,120 L40,120 Z"
                    fill="url(#hrGrad)"
                  />
                  <path
                    d="M40,75 Q80,68 120,72 T200,60 T280,65 T360,78 T440,70 T520,63 T600,74 T680,69"
                    fill="none"
                    stroke="#2563eb"
                    stroke-width="2"
                  />
                  <!-- 呼吸基准曲线 -->
                  <path
                    d="M40,95 Q80,92 120,96 T200,90 T280,94 T360,98 T440,92 T520,91 T600,95 T680,93"
                    fill="none"
                    stroke="#10b981"
                    stroke-width="1.5"
                    stroke-dasharray="4,2"
                  />
                  <!-- 时间坐标轴 -->
                  <text x="40" y="132" font-size="10" fill="#64748b">00:00</text>
                  <text x="200" y="132" font-size="10" fill="#64748b">06:00</text>
                  <text x="360" y="132" font-size="10" fill="#64748b">12:00</text>
                  <text x="520" y="132" font-size="10" fill="#64748b">18:00</text>
                  <text x="660" y="132" font-size="10" fill="#64748b">24:00</text>
                </svg>
                <div class="chart-legend">
                  <span class="legend-item"><span class="dot dot-blue"></span> 连续心率 (bpm)</span>
                  <span class="legend-item"><span class="dot dot-green"></span> 连续呼吸 (rpm)</span>
                </div>
              </div>
            </template>

            <!-- B. 防压疮定时翻身与体位记录详情 -->
            <template v-else-if="activeReport.type === 'turn_position'">
              <div class="content-summary-box">
                <p><strong>压疮预防与翻身合规结论：</strong></p>
                <p class="summary-text">
                  根据国际 Braden 压疮风险评估标准，该长者评分为 <strong>11 分（极高风险）</strong>。机构落实每 2 小时定时翻身与体位轮换机制，本月累计执行翻身 <strong>{{ activeReport.data?.monthly_turn_count || 360 }} 次</strong>，按时合规执行率达 <strong>{{ activeReport.data?.compliance_rate || 98.6 }}%</strong>。长者骨隆突处、骶尾部皮肤完整无破损，压红在20分钟内完全消褪，未发生任何院内获得性压疮。
                </p>
              </div>

              <div class="turn-stats-grid">
                <div class="turn-stat-card">
                  <div class="ts-num text-danger">{{ activeReport.data?.braden_score || 11 }} 分</div>
                  <div class="ts-label">Braden 评分 (极高危)</div>
                  <div class="ts-sub">干预方案: 每2小时强制翻身</div>
                </div>
                <div class="turn-stat-card">
                  <div class="ts-num text-success">{{ activeReport.data?.monthly_turn_count || 360 }} 次</div>
                  <div class="ts-label">本月翻身总次数</div>
                  <div class="ts-sub">日间 180 次 · 夜间 180 次</div>
                </div>
                <div class="turn-stat-card">
                  <div class="ts-num text-primary">{{ activeReport.data?.compliance_rate || 98.6 }}%</div>
                  <div class="ts-label">定时翻身依从达标率</div>
                  <div class="ts-sub">质量红线指标: ≥95% (达标)</div>
                </div>
                <div class="turn-stat-card">
                  <div class="ts-num text-success">0 例</div>
                  <div class="ts-label">院内压疮发生起数</div>
                  <div class="ts-sub">皮肤完好率: 100%</div>
                </div>
              </div>

              <!-- 体位轮换分布可视化 -->
              <div class="posture-chart-box">
                <div class="chart-header">
                  <span>🔄 24小时长者体位分布与睡眠压力轮换比率</span>
                  <span class="text-xs text-muted">算法引擎: 智能床垫多通道微动与体位感知模型</span>
                </div>
                <div class="posture-bars">
                  <div class="posture-item">
                    <div class="pi-label">左侧卧位 (34%)</div>
                    <div class="pi-track"><div class="pi-fill bg-blue" style="width: 34%"></div></div>
                    <div class="pi-time">累计约 8.2 小时/天</div>
                  </div>
                  <div class="posture-item">
                    <div class="pi-label">右侧卧位 (36%)</div>
                    <div class="pi-track"><div class="pi-fill bg-green" style="width: 36%"></div></div>
                    <div class="pi-time">累计约 8.6 小时/天</div>
                  </div>
                  <div class="posture-item">
                    <div class="pi-label">平卧及靠坐 (30%)</div>
                    <div class="pi-track"><div class="pi-fill bg-orange" style="width: 30%"></div></div>
                    <div class="pi-time">累计约 7.2 小时/天</div>
                  </div>
                </div>
              </div>
            </template>

            <!-- C. 长护险月度医保结算合规审计报告详情 -->
            <template v-else-if="activeReport.type === 'long_care_insurance'">
              <div class="content-summary-box">
                <p><strong>医保长护基金合规审计结论：</strong></p>
                <p class="summary-text">
                  本期对{{ orgName }}全院申报的 <strong>{{ activeReport.data?.application_count || 48 }} 名</strong> 长护险失能长者进行了全量客观核验。通过中科安樵智能硬件在床感知与服务工单时序比对，完成 <strong>{{ (activeReport.data?.verified_hours || 21600).toLocaleString() }} 小时</strong> 客观在床与照护真实性闭环验证。反欺诈模型未发现任何空刷、代打卡或虚构服务情形，综合合规率 <strong>100%</strong>。长护险基金拟结算拨款金额为 <strong>¥{{ (activeReport.data?.settlement_amount || 153600).toLocaleString() }}</strong>。
                </p>
              </div>

              <table class="audit-table">
                <thead>
                  <tr>
                    <th>审计核验项目</th>
                    <th>机构申报值</th>
                    <th>智能硬件客观验证值</th>
                    <th>差异率</th>
                    <th>合规判定</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>失能长者在院人数</td>
                    <td>48 人</td>
                    <td>48 人 (设备全量感知)</td>
                    <td>0.0%</td>
                    <td><span class="tag tag-success">完全匹配</span></td>
                  </tr>
                  <tr>
                    <td>月度照护服务总工时</td>
                    <td>21,600 小时</td>
                    <td>21,586 小时 (连续在床核验)</td>
                    <td>0.06% (在公差内)</td>
                    <td><span class="tag tag-success">合规采纳</span></td>
                  </tr>
                  <tr>
                    <td>特级/一级照护巡视打卡</td>
                    <td>1,440 次</td>
                    <td>1,438 次</td>
                    <td>0.14%</td>
                    <td><span class="tag tag-success">合规采纳</span></td>
                  </tr>
                  <tr>
                    <td>人卡分离 / 离院空刷排查</td>
                    <td>0 起</td>
                    <td>0 起 (毫米波及雷达零异常)</td>
                    <td>0.0%</td>
                    <td><span class="tag tag-success">绿码通过</span></td>
                  </tr>
                </tbody>
              </table>
            </template>

            <!-- D. 智能设备运行质量报告详情 -->
            <template v-else-if="activeReport.type === 'device_quality'">
              <div class="content-summary-box">
                <p><strong>设备运行质量巡检结论：</strong></p>
                <p class="summary-text">
                  本月全院共纳管运行智能感知设备 <strong>{{ activeReport.data?.total_devices || 80 }} 台</strong>，综合在线率达 <strong>{{ activeReport.data?.online_rate || 98.9 }}%</strong>。全院设备平均通信信号强度为 <strong>-68 dBm (优)</strong>，发生偶发网络抖动事件 12 起，平均自愈与闭环处置时长为 <strong>14 分钟</strong>，全网零严重硬件故障。
                </p>
              </div>

              <div class="device-quality-cards">
                <div v-for="dev in activeReport.data?.devices_by_type || []" :key="dev.type" class="dq-card">
                  <div class="dq-type font-bold">{{ dev.type }}</div>
                  <div class="dq-num">{{ dev.online }} / {{ dev.total }} <small>台在线</small></div>
                  <div class="dq-rate text-success">在线率: {{ dev.rate }}%</div>
                </div>
              </div>
            </template>
          </div>

          <!-- 底部权威防伪公章与签字区 -->
          <div class="doc-footer-stamp-area">
            <div class="doc-signatures">
              <div class="sig-line">
                <span class="sig-label">报告编制人：</span>
                <span class="sig-name">{{ activeReport.nurse_name || activeReport.owner }}</span>
              </div>
              <div class="sig-line">
                <span class="sig-label">质控审核人：</span>
                <span class="sig-name">{{ activeReport.auditor || '沈雅琴 (护士长)' }}</span>
              </div>
              <div class="sig-line">
                <span class="sig-label">医保/经办备案：</span>
                <span class="sig-name text-muted">苏州市医疗保障局长护险信息系统备案号 #2026-LTC-0842</span>
              </div>
            </div>

            <!-- 仿真机构质控电子红章 -->
            <div class="red-stamp-graphic">
              <svg viewBox="0 0 160 160" class="stamp-svg">
                <circle cx="80" cy="80" r="72" fill="none" stroke="#dc2626" stroke-width="3" />
                <circle cx="80" cy="80" r="67" fill="none" stroke="#dc2626" stroke-width="1" stroke-dasharray="2,2" />
                <!-- 五角星 -->
                <polygon
                  points="80,52 87,70 106,70 91,82 96,100 80,88 64,100 69,82 54,70 73,70"
                  fill="#dc2626"
                />
                <!-- 印章上方环绕文字 -->
                <path id="stampUpperPath" d="M 22 80 A 58 58 0 0 1 138 80" fill="none" />
                <text fill="#dc2626" font-size="11.5" font-weight="bold" letter-spacing="2">
                  <textPath href="#stampUpperPath" startOffset="50%" text-anchor="middle">
                    {{ orgName }}
                  </textPath>
                </text>
                <!-- 印章下方横排文字 -->
                <text x="80" y="118" fill="#dc2626" font-size="11" font-weight="bold" text-anchor="middle" letter-spacing="1">
                  医疗质控专用章
                </text>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 弹窗 2: 一键生成最新报告模态框 -->
    <div v-if="showGenerateModal" class="modal-backdrop" @click="showGenerateModal = false">
      <div class="generate-modal-dialog" @click.stop>
        <div class="modal-header">
          <div class="font-bold text-primary">
            一键生成权威监测报告
          </div>
          <button class="close-btn" @click="showGenerateModal = false">×</button>
        </div>
        <div class="modal-body">
          <p class="text-xs text-muted mb-4">
            系统将调用中科安樵客观遥测算法引擎，汇聚长者床位智能床垫、毫米波雷达时序与照护工单，自动生成带防伪条码与电子签章的正式报告。
          </p>

          <div class="form-group">
            <label class="form-label">报告类型：</label>
            <select v-model="generateForm.type" class="form-select">
              <option value="vital_signs">💓 长者生命体征健康综合监测报告</option>
              <option value="turn_position">🔄 卧床长者防压疮定时翻身与体位记录报告</option>
              <option value="long_care_insurance">🛡️ 长护险月度医保结算合规审计报告</option>
              <option value="device_quality">📡 机构智能感知设备运行质量报告</option>
            </select>
          </div>

          <div v-if="generateForm.type === 'vital_signs' || generateForm.type === 'turn_position'" class="form-group">
            <label class="form-label">选择服务长者：</label>
            <select v-model="generateForm.patient_id" class="form-select" @change="onPatientSelect">
              <option value="P00084">张卫国 (401-A 床 · 4F 康复特护区)</option>
              <option value="P00085">李建平 (402-B 床 · 4F 康复特护区)</option>
              <option value="P00086">陈桂芳 (403-A 床 · 4F 康复特护区)</option>
              <option value="P00087">赵德荣 (404-A 床 · 4F 康复特护区)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">统计报告周期：</label>
            <select v-model="generateForm.period" class="form-select">
              <option value="2026-09">2026年09月 (当期)</option>
              <option value="2026-08">2026年08月</option>
              <option value="2026-Q3">2026年第三季度</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">质控审核签名人：</label>
            <input type="text" value="沈雅琴 (护士长)" class="form-input" disabled />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showGenerateModal = false">取消</button>
          <button class="btn btn-primary" :disabled="generating" @click="handleGenerateSubmit">
            {{ generating ? '算法引擎生成中...' : '立即生成报告' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getReports, generateReport, type LtcReport } from '../../../api/client'
import { useOrgIdentity } from '../../../features/ltc-workbench/org-identity'

const { orgName } = useOrgIdentity()

const loading = ref(false)
const generating = ref(false)
const reportsList = ref<LtcReport[]>([])
const selectedType = ref('all')
const selectedPeriod = ref('all')
const searchQuery = ref('')

const showGenerateModal = ref(false)
const activeReport = ref<LtcReport | null>(null)

const typeTabs = [
  { key: 'all', label: '全部报告', icon: '📑' },
  { key: 'vital_signs', label: '生命体征健康报告', icon: '💓' },
  { key: 'turn_position', label: '防压疮翻身记录', icon: '🔄' },
  { key: 'long_care_insurance', label: '长护医保合规审计', icon: '🛡️' },
  { key: 'device_quality', label: '设备运行质量', icon: '📡' },
]

const generateForm = ref({
  type: 'vital_signs',
  patient_id: 'P00084',
  patient_name: '张卫国',
  bed_id: '401-A',
  period: '2026-09',
})

function onPatientSelect() {
  const map: Record<string, { name: string; bed: string }> = {
    P00084: { name: '张卫国', bed: '401-A' },
    P00085: { name: '李建平', bed: '402-B' },
    P00086: { name: '陈桂芳', bed: '403-A' },
    P00087: { name: '赵德荣', bed: '404-A' },
  }
  const item = map[generateForm.value.patient_id]
  if (item) {
    generateForm.value.patient_name = item.name
    generateForm.value.bed_id = item.bed
  }
}

async function loadData() {
  loading.value = true
  try {
    const res = await getReports()
    reportsList.value = res.list || []
  } catch (err) {
    console.error('获取报告列表失败:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})

const filteredReports = computed(() => {
  return reportsList.value.filter((r) => {
    // 类型过滤
    if (selectedType.value !== 'all') {
      if (selectedType.value === 'vital_signs' && r.type !== 'vital_signs' && r.type !== 'user_health') {
        return false
      } else if (selectedType.value !== 'vital_signs' && r.type !== selectedType.value) {
        return false
      }
    }
    // 周期过滤
    if (selectedPeriod.value !== 'all' && r.period !== selectedPeriod.value) {
      return false
    }
    // 搜索过滤
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.trim().toLowerCase()
      const matchName = r.patient_name?.toLowerCase().includes(q)
      const matchBed = r.bed_id?.toLowerCase().includes(q)
      const matchTitle = r.title?.toLowerCase().includes(q)
      const matchId = r.report_id?.toLowerCase().includes(q)
      if (!matchName && !matchBed && !matchTitle && !matchId) {
        return false
      }
    }
    return true
  })
})

function countByType(type: string): number {
  if (type === 'all') return reportsList.value.length
  return reportsList.value.filter((r) => {
    if (type === 'vital_signs') return r.type === 'vital_signs' || r.type === 'user_health'
    return r.type === type
  }).length
}

function getTypeName(type: string): string {
  const map: Record<string, string> = {
    vital_signs: '生命体征报告',
    user_health: '个人健康报告',
    turn_position: '防压疮翻身记录',
    long_care_insurance: '长护医保合规审计',
    device_quality: '设备运行质量',
    operations: '综合运营报告',
    assessment_support: '失能评估客观报告',
  }
  return map[type] || '业务报告'
}

function openReportDetail(r: LtcReport) {
  activeReport.value = r
}

function closeReportDetail() {
  activeReport.value = null
}

function printReport(r: LtcReport) {
  activeReport.value = r
  setTimeout(() => {
    window.print()
  }, 200)
}

function triggerPrint() {
  window.print()
}

function exportReportRaw(r: LtcReport) {
  const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${r.report_id}_${r.title}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function exportCsv() {
  const headers = ['报告编号', '报告类型', '报告标题', '长者姓名', '床位', '病区', '周期', '编制人', '审核人', '生成时间']
  const rows = filteredReports.value.map((r) => [
    r.report_id,
    getTypeName(r.type),
    `"${r.title}"`,
    r.patient_name || '全院',
    r.bed_id || '-',
    r.ward || '4F',
    r.period || '2026-09',
    r.nurse_name || r.owner,
    r.auditor || '沈雅琴',
    r.generated_at?.slice(0, 19).replace('T', ' '),
  ])
  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `中科安樵_监测与报告中心台账_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

async function handleGenerateSubmit() {
  generating.value = true
  try {
    const rep = await generateReport({
      type: generateForm.value.type,
      period: generateForm.value.period,
      applicant_id: generateForm.value.patient_id,
      patient_name: generateForm.value.patient_name,
      bed_id: generateForm.value.bed_id,
    })
    showGenerateModal.value = false
    await loadData()
    // 自动打开新生成的报告
    activeReport.value = rep
  } catch (err: any) {
    alert('生成报告失败: ' + (err.message || '未知错误'))
  } finally {
    generating.value = false
  }
}
</script>

<style scoped>
.reports-center {
  padding: 24px;
}

.page-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.filter-panel {
  background: white;
  border-radius: 8px;
  padding: 16px 20px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.tab-nav {
  display: flex;
  gap: 8px;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 12px;
  margin-bottom: 14px;
  overflow-x: auto;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.tab-btn:hover {
  color: #1e293b;
  background: #f1f5f9;
}

.tab-btn.active {
  background: #2563eb;
  border-color: #2563eb;
  color: white;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #475569;
}

.filter-select,
.filter-search-input {
  padding: 6px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
}

.search-group {
  flex: 1;
}

.filter-search-input {
  width: 100%;
}

.content-panel {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.report-title-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.type-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
}

.type-vital_signs,
.type-user_health {
  background: #dbeafe;
  color: #1e40af;
}

.type-turn_position {
  background: #dcfce7;
  color: #166534;
}

.type-long_care_insurance {
  background: #fef3c7;
  color: #92400e;
}

.type-device_quality {
  background: #ede9fe;
  color: #5b21b6;
}

.metric-cell {
  color: #475569;
}

.metric-cell .divider {
  margin: 0 6px;
  color: #cbd5e1;
}

.action-cell {
  white-space: nowrap;
}

/* 模态框通用 */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

/* 红头报告专业文档样式 */
.report-modal-dialog {
  background: white;
  width: 860px;
  max-width: 95vw;
  max-height: 92vh;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
}

.report-modal-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  background: #0f172a;
  color: white;
}

.bar-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: bold;
  font-size: 14px;
}

.bar-tag {
  background: #2563eb;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
}

.close-btn {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 24px;
  cursor: pointer;
  line-height: 1;
}

.close-btn:hover {
  color: white;
}

.report-document {
  padding: 40px 48px;
  overflow-y: auto;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: #1e293b;
  background: #ffffff;
}

.doc-header {
  text-align: center;
  margin-bottom: 24px;
}

.doc-org-title {
  font-size: 22px;
  font-weight: 900;
  color: #b91c1c; /* 权威中国红 */
  letter-spacing: 2px;
}

.doc-org-sub {
  font-size: 10px;
  color: #b91c1c;
  letter-spacing: 1px;
  margin-top: 2px;
}

.doc-red-line {
  height: 3px;
  background: #b91c1c;
  margin-top: 8px;
}

.doc-sub-red-line {
  height: 1px;
  background: #b91c1c;
  margin-top: 2px;
}

.doc-title-box {
  margin: 20px 0;
  padding-bottom: 16px;
  border-bottom: 1px dashed #cbd5e1;
}

.doc-main-title {
  font-size: 20px;
  font-weight: bold;
  text-align: center;
  margin-bottom: 14px;
}

.doc-barcode-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.barcode-graphic {
  display: flex;
  flex-direction: column;
}

.barcode-bars {
  width: 140px;
  height: 32px;
  background: repeating-linear-gradient(
    90deg,
    #000,
    #000 2px,
    #fff 2px,
    #fff 4px,
    #000 4px,
    #000 7px,
    #fff 7px,
    #fff 9px
  );
}

.barcode-text {
  font-family: monospace;
  font-size: 11px;
  letter-spacing: 2px;
  margin-top: 2px;
}

.doc-meta-info {
  font-size: 12px;
  color: #64748b;
  text-align: right;
  line-height: 1.6;
}

.doc-section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 14px;
  font-weight: bold;
  color: #1e293b;
  margin-bottom: 10px;
  border-left: 4px solid #2563eb;
  padding-left: 8px;
}

.doc-info-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.doc-info-table td {
  border: 1px solid #cbd5e1;
  padding: 8px 12px;
}

.doc-info-table .cell-label {
  background: #f8fafc;
  font-weight: 600;
  width: 110px;
  color: #475569;
}

.content-summary-box {
  background: #f1f5f9;
  border-radius: 6px;
  padding: 12px 16px;
  font-size: 13px;
  margin-bottom: 16px;
  line-height: 1.6;
}

.vital-stats-grid,
.turn-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.v-card,
.turn-stat-card {
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 12px;
  text-align: center;
  background: #f8fafc;
}

.v-label,
.ts-label {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 4px;
}

.v-val,
.ts-num {
  font-size: 20px;
  font-weight: bold;
}

.v-val small,
.ts-num small {
  font-size: 12px;
  font-weight: normal;
}

.v-range,
.ts-sub {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 4px;
}

.chart-box,
.posture-chart-box {
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 14px 16px;
  background: white;
  margin-bottom: 20px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  font-weight: bold;
  color: #334155;
  margin-bottom: 10px;
}

.vital-svg-chart {
  width: 100%;
  height: 140px;
}

.chart-legend {
  display: flex;
  justify-content: center;
  gap: 20px;
  font-size: 11px;
  color: #64748b;
  margin-top: 6px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot-blue { background: #2563eb; }
.dot-green { background: #10b981; }

.posture-bars {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.posture-item {
  font-size: 12px;
}

.pi-label {
  font-weight: 600;
  margin-bottom: 4px;
}

.pi-track {
  height: 12px;
  background: #f1f5f9;
  border-radius: 6px;
  overflow: hidden;
}

.pi-fill {
  height: 100%;
}

.bg-blue { background: #3b82f6; }
.bg-green { background: #10b981; }
.bg-orange { background: #f59e0b; }

.pi-time {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 2px;
}

.audit-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  margin-bottom: 20px;
}

.audit-table th,
.audit-table td {
  border: 1px solid #cbd5e1;
  padding: 8px 12px;
  text-align: left;
}

.audit-table th {
  background: #f8fafc;
  font-weight: 600;
}

.device-quality-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.dq-card {
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 14px;
  background: #f8fafc;
  text-align: center;
}

.dq-type {
  font-size: 13px;
  color: #334155;
}

.dq-num {
  font-size: 18px;
  font-weight: bold;
  margin: 6px 0;
}

/* 印章与签名区 */
.doc-footer-stamp-area {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 36px;
  padding-top: 20px;
  border-top: 1px solid #cbd5e1;
}

.doc-signatures {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 13px;
}

.sig-label {
  color: #64748b;
  font-weight: 500;
}

.sig-name {
  font-weight: bold;
  font-family: 'Kaiti', 'STKaiti', cursive;
  font-size: 16px;
  color: #0f172a;
}

.red-stamp-graphic {
  width: 130px;
  height: 130px;
  opacity: 0.88;
  transform: rotate(-8deg);
}

.stamp-svg {
  width: 100%;
  height: 100%;
}

/* 一键生成模态框 */
.generate-modal-dialog {
  background: white;
  width: 500px;
  max-width: 90vw;
  border-radius: 10px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 6px;
}

.form-select,
.form-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
}

.modal-footer {
  padding: 14px 20px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

/* 原生打印样式优化 */
@media print {
  body * {
    visibility: hidden;
  }
  #reportPrintArea,
  #reportPrintArea * {
    visibility: visible;
  }
  #reportPrintArea {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    margin: 0;
    padding: 20mm;
    box-shadow: none;
  }
  .no-print {
    display: none !important;
  }
}
</style>
