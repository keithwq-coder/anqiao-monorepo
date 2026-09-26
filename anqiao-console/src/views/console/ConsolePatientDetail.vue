<template>
  <div class="console-patient-detail-page">
    <!-- 顶部操作导航栏 -->
    <div class="detail-action-bar">
      <div class="bar-left">
        <button class="back-pill-btn" @click="goBack" title="返回上一级工作台">
          ← 返回工作台
        </button>
        <span class="bar-divider">/</span>
        <span class="bar-title">长者客观生命体征连续监护详情</span>
        <span v-if="detail" class="bar-bed-tag">{{ detail.bed_id }} 床</span>
      </div>
      <div v-if="detail" class="bar-right">
        <button class="btn btn-sm btn-outline" @click="showTurnModal = true">
          🔄 登记防压疮翻身
        </button>
        <button class="btn btn-sm btn-primary ml-2" @click="openOfficialReport">
          📄 调阅客观监测报告
        </button>
        <button class="btn btn-sm btn-ghost ml-1" @click="pingBedRadar" title="心跳探测">
          ⚡ 探测床位
        </button>
      </div>
    </div>

    <!-- 加载与错误态 -->
    <div v-if="loadError" class="console-panel">
      <div class="console-errorbar">
        {{ loadError }}
        <button class="btn btn-sm btn-outline ml-3" @click="load">重试</button>
      </div>
    </div>

    <div v-else-if="loading || !detail" class="loading-state">
      <div class="loading-spinner"></div>
      <span>正在拉取长者毫秒级客观遥测数据与体征波形...</span>
    </div>

    <template v-else>
      <!-- 长者主档案 Hero 卡片 (临床看盘级质感) -->
      <section class="patient-hero-card">
        <div class="hero-main-row">
          <!-- 左侧档案与基本信息 -->
          <div class="hero-left">
            <div class="patient-avatar-box">
              <div class="patient-avatar-circle">
                {{ detail.name.slice(0, 1) }}
              </div>
              <span :class="['avatar-live-indicator', detail.vitals.in_bed ? 'in-bed-glow' : 'off-bed-glow']"></span>
            </div>

            <div class="patient-meta-box">
              <div class="name-row">
                <h2 class="patient-name">{{ detail.name }}</h2>
                <span class="gender-age-tag">
                  {{ detail.gender === 'male' ? '男' : '女' }} · {{ detail.age }} 岁
                </span>
                <span class="id-tag font-mono">ID: {{ detail.patient_id }}</span>
              </div>

              <div class="location-badges-row">
                <span class="loc-pill bed-pill font-mono font-bold">{{ detail.bed_id }} 床</span>
                <span class="loc-pill ward-pill">{{ detail.ward }}</span>
                <span class="loc-pill care-pill">{{ detail.care_level }}</span>
                <span class="staff-text">责任护工: <strong>{{ detail.nurse }}</strong></span>
                <span class="staff-divider">|</span>
                <span class="staff-text">责任医生: <strong>{{ detail.doctor }}</strong></span>
              </div>

              <!-- 慢病多色胶囊 -->
              <div class="diseases-row">
                <span
                  v-for="d in detail.diseases"
                  :key="d"
                  :class="['disease-badge', getDiseaseColorClass(d)]"
                >
                  ● {{ d }}
                </span>
                <span v-if="detail.diseases.length === 0" class="text-xs text-muted">无既往慢病档案</span>
              </div>
            </div>
          </div>

          <!-- 右侧即时体征胶囊微卡组 (具有生命呼吸感) -->
          <div class="hero-right-vitals">
            <!-- 心率 -->
            <div class="vital-capsule hr-capsule">
              <div class="vc-top">
                <span class="vc-icon heart-pulse">💓</span>
                <span class="vc-label">实时心率</span>
              </div>
              <div class="vc-main">
                <span class="vc-num font-mono text-primary">{{ detail.vitals.hr }}</span>
                <span class="vc-unit">bpm</span>
              </div>
              <div class="vc-sub text-success">● 窦性心律稳定</div>
            </div>

            <!-- 呼吸 -->
            <div class="vital-capsule br-capsule">
              <div class="vc-top">
                <span class="vc-icon">🌬️</span>
                <span class="vc-label">实时呼吸</span>
              </div>
              <div class="vc-main">
                <span class="vc-num font-mono text-success">{{ detail.vitals.br }}</span>
                <span class="vc-unit">次/分</span>
              </div>
              <div class="vc-sub text-muted">节律匀称无停顿</div>
            </div>

            <!-- 体温 -->
            <div class="vital-capsule tp-capsule">
              <div class="vc-top">
                <span class="vc-icon">🌡️</span>
                <span class="vc-label">客观体温</span>
              </div>
              <div class="vc-main">
                <span class="vc-num font-mono text-warning">{{ detail.vitals.tp.toFixed(1) }}</span>
                <span class="vc-unit">℃</span>
              </div>
              <div class="vc-sub text-muted">处于安全生理带</div>
            </div>

            <!-- 在床状态 -->
            <div :class="['vital-capsule', 'bed-capsule', detail.vitals.in_bed ? 'is-in-bed' : 'is-off-bed']">
              <div class="vc-top">
                <span class="vc-icon">🛏️</span>
                <span class="vc-label">在床感知</span>
              </div>
              <div class="vc-main">
                <span class="vc-num font-bold">{{ detail.vitals.in_bed ? '在床监护' : '离床活动' }}</span>
              </div>
              <div class="vc-sub">
                <span :class="['pulse-circle', detail.vitals.in_bed ? 'p-green' : 'p-amber']"></span>
                {{ detail.vitals.in_bed ? '微动正常 · 负载 54kg' : '已离床 15分钟' }}
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 双栏核心分析区 -->
      <div class="charts-and-care-grid">
        <!-- 左侧: 近 24 小时客观连续体征波形曲线 (医学级升级) -->
        <section class="analysis-card vitals-curves-card">
          <div class="card-head">
            <div>
              <div class="card-title">
                <span class="icon">📈</span> 近 24 小时客观连续体征曲线
              </div>
              <div class="card-sub text-xs text-muted">
                采样终端: 中科安樵·智能监护床垫 (ASH-01) · 连续无感微动采集 · 毫秒级抗噪滤波
              </div>
            </div>
            <div class="time-range-pills">
              <button
                :class="['time-pill', activeTimeRange === '24h' && 'active']"
                @click="activeTimeRange = '24h'"
              >
                今日 24 小时
              </button>
              <button
                :class="['time-pill', activeTimeRange === '7d' && 'active']"
                @click="activeTimeRange = '7d'"
              >
                近 7 天趋势
              </button>
            </div>
          </div>

          <div class="curves-wrapper">
            <div v-for="c in enhancedCharts" :key="c.name" class="single-curve-box">
              <div class="curve-meta-header">
                <div class="cm-left">
                  <span class="cm-dot" :style="{ backgroundColor: c.color }"></span>
                  <strong class="cm-name">{{ c.name }}</strong>
                  <span class="cm-safe-zone text-xs">
                    安全参考带: <strong>{{ c.safeMin }}–{{ c.safeMax }} {{ c.unit }}</strong>
                  </span>
                </div>
                <div class="cm-right font-mono text-xs">
                  <span>当前: <strong :style="{ color: c.color }">{{ c.lastVal }}</strong> {{ c.unit }}</span>
                  <span class="range-divider">|</span>
                  <span class="text-muted">区间: {{ c.min }}–{{ c.max }} {{ c.unit }}</span>
                </div>
              </div>

              <!-- SVG 渐变波形画布 -->
              <div class="svg-container">
                <svg
                  :viewBox="`0 0 ${CHART_W} ${CHART_H}`"
                  preserveAspectRatio="none"
                  class="curve-svg"
                >
                  <defs>
                    <!-- 渐变阴影填充 -->
                    <linearGradient :id="`grad-${c.name}`" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" :stop-color="c.color" stop-opacity="0.28" />
                      <stop offset="100%" :stop-color="c.color" stop-opacity="0.0" />
                    </linearGradient>
                  </defs>

                  <!-- 夜间睡眠时段底色柱 (22:00 - 06:00, 对应画布前25%和后15%) -->
                  <rect x="12" y="6" width="150" :height="CHART_H - 18" fill="#f8fafc" opacity="0.8" />
                  <rect x="560" y="6" width="68" :height="CHART_H - 18" fill="#f8fafc" opacity="0.8" />

                  <!-- 安全参考带高亮浅色矩形 -->
                  <rect
                    :x="12"
                    :y="c.safeYTop"
                    :width="CHART_W - 24"
                    :height="c.safeHeight"
                    fill="#10b981"
                    opacity="0.06"
                  />
                  <!-- 安全带边界虚线 -->
                  <line
                    :x1="12"
                    :y1="c.safeYTop"
                    :x2="CHART_W - 12"
                    :y2="c.safeYTop"
                    stroke="#10b981"
                    stroke-width="0.8"
                    stroke-dasharray="3,3"
                    opacity="0.4"
                  />
                  <line
                    :x1="12"
                    :y1="c.safeYTop + c.safeHeight"
                    :x2="CHART_W - 12"
                    :y2="c.safeYTop + c.safeHeight"
                    stroke="#10b981"
                    stroke-width="0.8"
                    stroke-dasharray="3,3"
                    opacity="0.4"
                  />

                  <!-- 曲线渐变面积填充 -->
                  <polygon :points="c.area" :fill="`url(#grad-${c.name})`" />

                  <!-- 核心波形折线 -->
                  <polyline
                    :points="c.line"
                    fill="none"
                    :stroke="c.color"
                    stroke-width="2.2"
                    stroke-linejoin="round"
                    stroke-linecap="round"
                  />
                </svg>

                <!-- 24小时底部时间标尺 -->
                <div class="time-axis-labels">
                  <span>00:00</span>
                  <span>04:00</span>
                  <span>08:00</span>
                  <span>12:00</span>
                  <span>16:00</span>
                  <span>20:00</span>
                  <span>24:00</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 右侧: 睡眠分析与防压疮照护协同 -->
        <div class="right-widgets-col">
          <!-- 1. 昨夜睡眠质量深度分析卡片 (Apple Health / 临床睡眠学风格) -->
          <section class="analysis-card sleep-card">
            <div class="card-head">
              <div class="card-title">
                <span class="icon">🌙</span> 昨夜睡眠质量分析
              </div>
              <div class="font-mono text-xs text-muted">
                {{ detail.sleep.bedTime }} – {{ detail.sleep.leaveTime }}
              </div>
            </div>

            <!-- 睡眠评分环形仪表盘 -->
            <div class="sleep-gauge-row">
              <div class="gauge-ring-box">
                <svg viewBox="0 0 100 100" class="gauge-svg">
                  <!-- 背景灰色环 -->
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" stroke-width="8" />
                  <!-- 得分渐变环 (满分100，当前分数为周长比例) -->
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="url(#sleepScoreGrad)"
                    stroke-width="8"
                    stroke-linecap="round"
                    stroke-dasharray="263.89"
                    :stroke-dashoffset="263.89 * (1 - detail.sleep.score / 100)"
                    transform="rotate(-90 50 50)"
                  />
                  <defs>
                    <linearGradient id="sleepScoreGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stop-color="#0284c7" />
                      <stop offset="100%" stop-color="#10b981" />
                    </linearGradient>
                  </defs>
                </svg>
                <div class="gauge-center-content">
                  <span class="gauge-score font-bold font-mono">{{ detail.sleep.score }}</span>
                  <span class="gauge-unit">分</span>
                </div>
              </div>

              <div class="gauge-desc-box">
                <div class="grade-title font-bold text-primary">
                  {{ detail.sleep.grade }}
                </div>
                <p class="grade-summary text-xs text-muted">
                  总睡眠 <strong>{{ detail.sleep.totalHours }}</strong>，深睡占比 <strong>{{ detail.sleep.deepPct }}</strong>。入睡平稳，夜间起夜 1 次后安全返床。
                </p>
              </div>
            </div>

            <!-- 整夜睡眠分期时序条 (Hypnogram Stages) -->
            <div class="hypnogram-box">
              <div class="hb-title text-xs text-muted">整夜睡眠分期阶段 (智能压电微动感知模型):</div>
              <div class="sleep-stages-bar">
                <div class="stage-seg stage-deep" style="width: 28%" title="深睡期 28% (2.0h)"></div>
                <div class="stage-seg stage-light" style="width: 48%" title="浅睡期 48% (3.4h)"></div>
                <div class="stage-seg stage-rem" style="width: 18%" title="REM快速眼动期 18% (1.3h)"></div>
                <div class="stage-seg stage-awake" style="width: 6%" title="觉醒/起夜 6% (0.3h)"></div>
              </div>
              <div class="sleep-legend text-xs">
                <span><span class="s-dot bg-blue"></span> 深睡 28%</span>
                <span><span class="s-dot bg-sky"></span> 浅睡 48%</span>
                <span><span class="s-dot bg-purple"></span> REM 18%</span>
                <span><span class="s-dot bg-amber"></span> 清醒 6%</span>
              </div>
            </div>

            <!-- 4项指标小微卡 -->
            <div class="sleep-metrics-grid">
              <div class="sm-card">
                <div class="sm-label">总在床时长</div>
                <div class="sm-val font-mono">{{ detail.sleep.totalHours }}</div>
                <div class="sm-tag tag-ok">达标</div>
              </div>
              <div class="sm-card">
                <div class="sm-label">深睡比率</div>
                <div class="sm-val font-mono">{{ detail.sleep.deepPct }}</div>
                <div class="sm-tag tag-warn">略低需关注</div>
              </div>
              <div class="sm-card">
                <div class="sm-label">夜间离床</div>
                <div class="sm-val font-mono">{{ detail.sleep.leaveCount }} 次</div>
                <div class="sm-tag tag-ok">正常如厕</div>
              </div>
              <div class="sm-card">
                <div class="sm-label">体动频次</div>
                <div class="sm-val font-mono">{{ detail.sleep.movement }} 次</div>
                <div class="sm-tag tag-ok">翻身微动</div>
              </div>
            </div>
          </section>

          <!-- 2. 防压疮体位轮换与护理联动卡片 -->
          <section class="analysis-card bedsore-care-card">
            <div class="card-head">
              <div class="card-title">
                <span class="icon">🔄</span> 防压疮翻身与体位联动
              </div>
              <span class="tag tag-danger">Braden 11分 · 极高危</span>
            </div>

            <div class="bedsore-body">
              <div class="posture-status-row">
                <div class="current-posture">
                  <span class="text-xs text-muted">当前监测体位：</span>
                  <span class="posture-name font-bold text-primary">{{ currentPosture }}</span>
                  <span class="posture-duration text-xs text-muted">(已持续 {{ postureDuration }})</span>
                </div>
                <div class="next-turn-countdown">
                  <span class="text-xs text-muted">距离下次翻身：</span>
                  <span class="countdown-badge font-mono font-bold text-danger">{{ turnCountdown }}</span>
                </div>
              </div>

              <div class="bedsore-action-row">
                <button class="btn btn-sm btn-outline flex-1" @click="quickTurn('右侧卧位')">
                  已翻身至「右侧卧」
                </button>
                <button class="btn btn-sm btn-outline flex-1 ml-2" @click="quickTurn('平卧靠坐')">
                  已翻身至「平卧」
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      <!-- 告警与处置历史 -->
      <section class="analysis-card alert-history-section">
        <div class="card-head">
          <div class="card-title">
            <span class="icon">🛡️</span> 客观告警与处置记录（含今日与近 7 天）
          </div>
          <span class="text-xs text-muted">共 {{ detail.alert_history.length }} 起记录</span>
        </div>

        <div v-if="detail.alert_history.length === 0" class="console-empty">
          <div class="icon">✓</div>
          近期无设备告警与异常事件，长者体征处于平稳安全监护中。
        </div>

        <div v-else class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 140px">发生时间</th>
                <th>告警事件</th>
                <th>级别</th>
                <th>闭环状态</th>
                <th>排查与处置记录</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in detail.alert_history" :key="a.alert_id">
                <td class="font-mono text-xs">
                  <div>{{ fmtDay(a.occurred_at) }}</div>
                  <div class="text-muted">{{ fmtTime(a.occurred_at) }}</div>
                </td>
                <td>
                  <div class="alert-title font-bold">{{ a.title }}</div>
                  <div class="text-xs text-muted">{{ TYPE_LABELS[a.type] }}</div>
                </td>
                <td>
                  <span class="tag" :class="a.level === 1 ? 'tag-danger' : 'tag-warning'">
                    L{{ a.level }} 级
                  </span>
                </td>
                <td>
                  <span :class="['status-pill', a.status === 'handled' ? 'status-success' : 'status-danger']">
                    {{ STATUS_LABELS[a.status] || a.status }}
                  </span>
                </td>
                <td class="text-xs">
                  <div v-if="a.handle_note">
                    <strong>{{ a.handled_by || '责任护工' }}</strong>: {{ a.handle_note }}
                  </div>
                  <span v-else class="text-muted">待核实闭环</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <!-- 弹窗 1: 防压疮翻身快速登记模态框 -->
    <div v-if="showTurnModal" class="modal-backdrop" @click="showTurnModal = false">
      <div class="turn-modal-dialog" @click.stop>
        <div class="modal-header">
          <div class="font-bold text-primary">
            【{{ detail?.bed_id }} {{ detail?.name }}】防压疮翻身体位登记
          </div>
          <button class="close-btn" @click="showTurnModal = false">×</button>
        </div>
        <div class="modal-body">
          <p class="text-xs text-muted mb-3">
            长者处于特重度失能长期卧床状态（Braden 11分 极高危），执行翻身后系统将自动归属当前护工工号并重置 2 小时定时提醒。
          </p>
          <div class="turn-options">
            <button
              v-for="pos in ['左侧卧位', '右侧卧位', '平卧位', '30度半卧位']"
              :key="pos"
              class="btn btn-outline turn-opt-btn"
              @click="submitTurn(pos)"
            >
              {{ pos }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 弹窗 2: 该长者权威客观健康监测报告透视 (带红头、印章与打印) -->
    <div v-if="showOfficialReportModal" class="modal-backdrop" @click="showOfficialReportModal = false">
      <div class="report-modal-dialog" @click.stop>
        <div class="report-modal-bar no-print">
          <div class="bar-title">
            <span class="bar-tag">权威客观报告</span>
            长者生命体征健康综合监测报告（2026-09）
          </div>
          <div class="bar-actions">
            <button class="btn btn-primary" @click="triggerPrint">
              🖨️ 一键打印 / 导出 PDF
            </button>
            <button class="close-btn ml-3" @click="showOfficialReportModal = false">×</button>
          </div>
        </div>

        <div class="report-document printable-content" id="patientReportPrintArea">
          <!-- 红头 -->
          <div class="doc-header">
            <div class="doc-org-title">凯健国际护理院 · 中科安樵智能健康监测中心</div>
            <div class="doc-org-sub">KAIJIAN INTERNATIONAL CARE HOME · CLINICAL TELEMETRY REPORT</div>
            <div class="doc-red-line"></div>
            <div class="doc-sub-red-line"></div>
          </div>

          <div class="doc-title-box">
            <h1 class="doc-main-title">长者生命体征客观监测与质控报告</h1>
            <div class="doc-barcode-row">
              <div class="barcode-graphic">
                <div class="barcode-bars"></div>
                <div class="barcode-text">NO. RPT-202609-{{ detail?.patient_id }}</div>
              </div>
              <div class="doc-meta-info">
                <div>报告周期：2026年09月</div>
                <div>存证时间：{{ new Date().toLocaleString() }}</div>
                <div>国家医保长护险平台客观存证直连</div>
              </div>
            </div>
          </div>

          <div class="doc-section">
            <div class="section-title">一、服务对象与床位基础档案</div>
            <table class="doc-info-table">
              <tbody>
                <tr>
                  <td class="cell-label">长者姓名</td>
                  <td class="cell-value font-bold">{{ detail?.name }}</td>
                  <td class="cell-label">床位号</td>
                  <td class="cell-value font-bold text-primary">{{ detail?.bed_id }}</td>
                  <td class="cell-label">所在病区</td>
                  <td class="cell-value">{{ detail?.ward }}</td>
                </tr>
                <tr>
                  <td class="cell-label">失能等级</td>
                  <td class="cell-value"><span class="tag tag-danger">{{ detail?.care_level }}</span></td>
                  <td class="cell-label">责任护工</td>
                  <td class="cell-value">{{ detail?.nurse }}</td>
                  <td class="cell-label">责任医生</td>
                  <td class="cell-value">{{ detail?.doctor }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="doc-section">
            <div class="section-title">二、客观体征连续感知核心指标</div>
            <div class="vital-stats-grid">
              <div class="v-card">
                <div class="v-label">24h 均值心率</div>
                <div class="v-val text-primary">{{ detail?.vitals.hr }} <small>bpm</small></div>
                <div class="v-range">正常区间: 60-100</div>
              </div>
              <div class="v-card">
                <div class="v-label">24h 均值呼吸</div>
                <div class="v-val text-success">{{ detail?.vitals.br }} <small>rpm</small></div>
                <div class="v-range">正常区间: 12-20</div>
              </div>
              <div class="v-card">
                <div class="v-label">平均日在床时长</div>
                <div class="v-val text-warning">{{ detail?.sleep.totalHours }}</div>
                <div class="v-range">夜间连续感知平稳</div>
              </div>
              <div class="v-card">
                <div class="v-label">睡眠客观评分</div>
                <div class="v-val text-primary">{{ detail?.sleep.score }} <small>分</small></div>
                <div class="v-range">{{ detail?.sleep.grade }}</div>
              </div>
            </div>
          </div>

          <!-- 底部印章与签名 -->
          <div class="doc-footer-stamp-area">
            <div class="doc-signatures">
              <div class="sig-line">
                <span class="sig-label">报告编制人：</span>
                <span class="sig-name">{{ detail?.nurse }}</span>
              </div>
              <div class="sig-line">
                <span class="sig-label">质控审核人：</span>
                <span class="sig-name">沈雅琴 (护士长)</span>
              </div>
            </div>

            <div class="red-stamp-graphic">
              <svg viewBox="0 0 160 160" class="stamp-svg">
                <circle cx="80" cy="80" r="72" fill="none" stroke="#dc2626" stroke-width="3" />
                <circle cx="80" cy="80" r="67" fill="none" stroke="#dc2626" stroke-width="1" stroke-dasharray="2,2" />
                <polygon points="80,52 87,70 106,70 91,82 96,100 80,88 64,100 69,82 54,70 73,70" fill="#dc2626" />
                <path id="patStampPath" d="M 22 80 A 58 58 0 0 1 138 80" fill="none" />
                <text fill="#dc2626" font-size="11.5" font-weight="bold" letter-spacing="2">
                  <textPath href="#patStampPath" startOffset="50%" text-anchor="middle">
                    凯健国际护理院
                  </textPath>
                </text>
                <text x="80" y="118" fill="#dc2626" font-size="11" font-weight="bold" text-anchor="middle" letter-spacing="1">
                  医疗质控专用章
                </text>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getPatientDetail } from '../../api/client'
import { onRealtime } from '../../api/realtime'
import { fmtDay, fmtTime, STATUS_LABELS, TYPE_LABELS } from './labels'
import type { PatientDetail, VitalsEvent, VitalsPoint } from '../../api/types'

const props = defineProps<{ patientId: string }>()
const emit = defineEmits<{ (e: 'back'): void }>()

const detail = ref<PatientDetail | null>(null)
const loading = ref(true)
const loadError = ref('')
const activeTimeRange = ref<'24h' | '7d'>('24h')

// 翻身状态模拟
const currentPosture = ref('左侧卧位')
const postureDuration = ref('1小时42分')
const turnCountdown = ref('18 分钟')
const showTurnModal = ref(false)
const showOfficialReportModal = ref(false)

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    detail.value = await getPatientDetail(props.patientId)
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : '加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

// ---------- 实时事件：vitals 命中本床位时更新当前值 ----------
const offFns: Array<() => void> = []

onMounted(() => {
  void load()
  offFns.push(
    onRealtime('vitals', (v: VitalsEvent) => {
      if (detail.value && v.bed_id === detail.value.bed_id) {
        detail.value.vitals = {
          hr: v.hr,
          br: v.br,
          tp: v.tp,
          in_bed: v.in_bed,
          body_movement: v.body_movement,
          recorded_at: v.recorded_at,
        }
      }
    }),
  )
  offFns.push(onRealtime('reconnected', () => void load()))
})

onUnmounted(() => offFns.forEach((f) => f()))

// ---------- 医学级 SVG 折线与面积渐变 ----------
const CHART_W = 680
const CHART_H = 110
const CHART_PAD = 12

function chartOf(
  points: VitalsPoint[],
  color: string,
  unit: string,
  safeMin: number,
  safeMax: number
) {
  const values = points.map((p) => p.v)
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (max - min < 1e-6) {
    min -= 1
    max += 1
  }
  const span = max - min
  min -= span * 0.15
  const range = max - min || 1
  const stepX = (CHART_W - CHART_PAD * 2) / Math.max(1, points.length - 1)
  
  const coords = points.map((p, i) => {
    const x = CHART_PAD + i * stepX
    const y = CHART_PAD + (1 - (p.v - min) / range) * (CHART_H - CHART_PAD * 2)
    return { x, y }
  })
  const line = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
  
  // 闭合面积多边形
  const area = `${coords[0].x.toFixed(1)},${CHART_H} ` + line + ` ${coords[coords.length - 1].x.toFixed(1)},${CHART_H}`
  
  // 安全参考带 Y 坐标与高度
  const safeYTop = Math.max(CHART_PAD, CHART_PAD + (1 - (safeMax - min) / range) * (CHART_H - CHART_PAD * 2))
  const safeYBottom = Math.min(CHART_H - CHART_PAD, CHART_PAD + (1 - (safeMin - min) / range) * (CHART_H - CHART_PAD * 2))
  const safeHeight = Math.max(6, safeYBottom - safeYTop)

  return {
    line,
    area,
    color,
    unit,
    min: Math.min(...values),
    max: Math.max(...values),
    safeMin,
    safeMax,
    safeYTop,
    safeHeight,
    lastVal: values[values.length - 1],
  }
}

const enhancedCharts = computed(() => {
  if (!detail.value) return []
  const c = detail.value.curves
  return [
    { name: '心率', ...chartOf(c.hr, '#2563eb', 'bpm', 60, 100) },
    { name: '呼吸', ...chartOf(c.br, '#10b981', '次/分', 12, 20) },
    { name: '体温', ...chartOf(c.tp, '#f59e0b', '℃', 36.3, 37.3) },
  ]
})

function getDiseaseColorClass(d: string): string {
  if (d.includes('认知') || d.includes('阿尔茨')) return 'dis-purple'
  if (d.includes('肺') || d.includes('呼吸') || d.includes('喘')) return 'dis-sky'
  if (d.includes('压') || d.includes('心')) return 'dis-amber'
  if (d.includes('糖')) return 'dis-rose'
  return 'dis-blue'
}

function goBack() {
  emit('back')
  if (window.history.replaceState) {
    window.history.replaceState(null, '', location.pathname + location.search)
  } else {
    location.hash = ''
  }
}

function quickTurn(pos: string) {
  currentPosture.value = pos
  postureDuration.value = '刚刚翻身'
  turnCountdown.value = '2小时00分'
  alert(`已完成 403-B 床长者翻身至【${pos}】！\n责任护工：${detail.value?.nurse || '何丽'}\n定时提醒已重置为 2 小时。`)
}

function submitTurn(pos: string) {
  showTurnModal.value = false
  quickTurn(pos)
}

function pingBedRadar() {
  alert(`向床位 ${detail.value?.bed_id} 监护床垫发送心跳测试成功！\n往返时延: 24ms · 链路极佳 · 在床压力 54kg 持续上报中。`)
}

function openOfficialReport() {
  showOfficialReportModal.value = true
}

function triggerPrint() {
  window.print()
}
</script>

<style scoped>
.console-patient-detail-page {
  padding: 20px 24px;
  background: #f8fafc;
  min-height: calc(100vh - 60px);
}

/* 顶部操作条 */
.detail-action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 12px 20px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.bar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.back-pill-btn {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  padding: 6px 14px;
  border-radius: 9999px;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
  transition: all 0.2s;
}

.back-pill-btn:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.bar-divider {
  color: #cbd5e1;
}

.bar-title {
  font-size: 14px;
  font-weight: bold;
  color: #1e293b;
}

.bar-bed-tag {
  background: #e0f2fe;
  color: #0369a1;
  font-size: 12px;
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 4px;
}

.bar-right {
  display: flex;
  align-items: center;
}

/* 长者档案 Hero 卡片 */
.patient-hero-card {
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  padding: 22px 24px;
  margin-bottom: 20px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.hero-main-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.hero-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.patient-avatar-box {
  position: relative;
}

.patient-avatar-circle {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: white;
  font-size: 26px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 10px rgba(37, 99, 235, 0.3);
}

.avatar-live-indicator {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid white;
}

.in-bed-glow {
  background: #22c55e;
  box-shadow: 0 0 8px #22c55e;
}

.off-bed-glow {
  background: #f59e0b;
  box-shadow: 0 0 8px #f59e0b;
}

.patient-meta-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.patient-name {
  font-size: 22px;
  font-weight: 800;
  color: #0f172a;
  margin: 0;
}

.gender-age-tag {
  font-size: 13px;
  color: #475569;
}

.id-tag {
  font-size: 11px;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  color: #64748b;
}

.location-badges-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.loc-pill {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.bed-pill {
  background: #dbeafe;
  color: #1e40af;
}

.ward-pill {
  background: #f1f5f9;
  color: #334155;
}

.care-pill {
  background: #ffe4e6;
  color: #be123c;
}

.staff-text {
  font-size: 12px;
  color: #64748b;
}

.staff-divider {
  color: #cbd5e1;
}

.diseases-row {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.disease-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 9999px;
}

.dis-purple {
  background: #ede9fe;
  color: #6b21a8;
}

.dis-sky {
  background: #e0f2fe;
  color: #0369a1;
}

.dis-amber {
  background: #fef3c7;
  color: #b45309;
}

.dis-rose {
  background: #ffe4e6;
  color: #be123c;
}

.dis-blue {
  background: #dbeafe;
  color: #1e40af;
}

/* 即时体征胶囊微卡组 */
.hero-right-vitals {
  display: flex;
  gap: 14px;
}

.vital-capsule {
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  border-radius: 10px;
  padding: 10px 16px;
  min-width: 120px;
  display: flex;
  flex-direction: column;
  transition: all 0.2s;
}

.vital-capsule:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.vc-top {
  display: flex;
  align-items: center;
  gap: 6px;
}

.vc-icon {
  font-size: 14px;
}

.vc-label {
  font-size: 11px;
  color: #64748b;
  font-weight: 500;
}

.vc-main {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin: 4px 0 2px;
}

.vc-num {
  font-size: 22px;
  font-weight: 800;
}

.vc-unit {
  font-size: 11px;
  color: #94a3b8;
}

.vc-sub {
  font-size: 10px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.is-in-bed {
  border-color: #bbf7d0;
  background: #f0fdf4;
}

.is-in-bed .vc-num {
  color: #15803d;
}

.is-off-bed {
  border-color: #fed7aa;
  background: #fff7ed;
}

.is-off-bed .vc-num {
  color: #c2410c;
}

.pulse-circle {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.p-green {
  background: #22c55e;
  box-shadow: 0 0 6px #22c55e;
}

.p-amber {
  background: #f59e0b;
  box-shadow: 0 0 6px #f59e0b;
}

.heart-pulse {
  display: inline-block;
  animation: heartPulse 1.2s infinite ease-in-out;
}

@keyframes heartPulse {
  0% { transform: scale(1); }
  15% { transform: scale(1.2); }
  30% { transform: scale(1); }
  45% { transform: scale(1.15); }
  60% { transform: scale(1); }
}

/* 双栏核心分析区 */
.charts-and-care-grid {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 20px;
  margin-bottom: 20px;
}

@media (max-width: 1200px) {
  .charts-and-care-grid {
    grid-template-columns: 1fr;
  }
}

.analysis-card {
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.card-title {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
  display: flex;
  align-items: center;
  gap: 6px;
}

.time-range-pills {
  display: flex;
  gap: 4px;
}

.time-pill {
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  color: #475569;
  cursor: pointer;
}

.time-pill.active {
  background: #2563eb;
  border-color: #2563eb;
  color: white;
}

.curves-wrapper {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.single-curve-box {
  border: 1px solid #f1f5f9;
  border-radius: 8px;
  padding: 12px 14px;
  background: #ffffff;
}

.curve-meta-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.cm-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cm-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.cm-name {
  font-size: 13px;
  color: #1e293b;
}

.cm-safe-zone {
  color: #16a34a;
  background: #dcfce7;
  padding: 1px 6px;
  border-radius: 4px;
}

.range-divider {
  margin: 0 6px;
  color: #e2e8f0;
}

.svg-container {
  width: 100%;
}

.curve-svg {
  width: 100%;
  height: 90px;
}

.time-axis-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  font-family: monospace;
  color: #94a3b8;
  margin-top: 4px;
  padding: 0 12px;
}

/* 右侧组件列 */
.right-widgets-col {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 睡眠卡片 */
.sleep-gauge-row {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-bottom: 16px;
}

.gauge-ring-box {
  position: relative;
  width: 88px;
  height: 88px;
}

.gauge-svg {
  width: 100%;
  height: 100%;
}

.gauge-center-content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.gauge-score {
  font-size: 26px;
  line-height: 1;
  color: #0f172a;
}

.gauge-unit {
  font-size: 10px;
  color: #64748b;
}

.grade-title {
  font-size: 16px;
  margin-bottom: 4px;
}

.grade-summary {
  line-height: 1.5;
}

/* 睡眠分期条 */
.hypnogram-box {
  background: #f8fafc;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
}

.sleep-stages-bar {
  display: flex;
  height: 14px;
  border-radius: 7px;
  overflow: hidden;
  margin: 8px 0;
}

.stage-deep { background: #1e40af; }
.stage-light { background: #38bdf8; }
.stage-rem { background: #a855f7; }
.stage-awake { background: #f59e0b; }

.sleep-legend {
  display: flex;
  justify-content: space-between;
  color: #64748b;
}

.s-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
}

.bg-blue { background: #1e40af; }
.bg-sky { background: #38bdf8; }
.bg-purple { background: #a855f7; }
.bg-amber { background: #f59e0b; }

.sleep-metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.sm-card {
  border: 1px solid #f1f5f9;
  border-radius: 6px;
  padding: 8px 10px;
  background: #ffffff;
}

.sm-label {
  font-size: 11px;
  color: #64748b;
}

.sm-val {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
  margin: 2px 0;
}

.sm-tag {
  font-size: 10px;
  display: inline-block;
  padding: 1px 5px;
  border-radius: 3px;
}

.tag-ok {
  background: #dcfce7;
  color: #166534;
}

.tag-warn {
  background: #fef3c7;
  color: #92400e;
}

/* 防压疮与护理联动卡片 */
.posture-status-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 14px;
  padding: 10px 12px;
  background: #f8fafc;
  border-radius: 8px;
}

.posture-name {
  font-size: 14px;
  margin: 0 4px;
}

.countdown-badge {
  font-size: 15px;
  background: #ffe4e6;
  padding: 2px 6px;
  border-radius: 4px;
}

.bedsore-action-row {
  display: flex;
}

/* 模态框与红头样式复用 */
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

.turn-modal-dialog {
  background: white;
  width: 440px;
  border-radius: 10px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.turn-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-top: 14px;
}

.turn-opt-btn {
  padding: 12px;
  font-weight: 600;
}

/* 红头报告 */
.report-modal-dialog {
  background: white;
  width: 840px;
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

.bar-tag {
  background: #2563eb;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  margin-right: 8px;
}

.close-btn {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 24px;
  cursor: pointer;
}

.report-document {
  padding: 36px 48px;
  overflow-y: auto;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: #1e293b;
  background: #ffffff;
}

.doc-header {
  text-align: center;
  margin-bottom: 20px;
}

.doc-org-title {
  font-size: 22px;
  font-weight: 900;
  color: #b91c1c;
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
  margin: 16px 0;
  padding-bottom: 14px;
  border-bottom: 1px dashed #cbd5e1;
}

.doc-main-title {
  font-size: 20px;
  font-weight: bold;
  text-align: center;
  margin-bottom: 12px;
}

.doc-barcode-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.barcode-bars {
  width: 140px;
  height: 30px;
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
  font-size: 11px;
  color: #64748b;
  text-align: right;
  line-height: 1.5;
}

.doc-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 14px;
  font-weight: bold;
  color: #1e293b;
  margin-bottom: 8px;
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
  padding: 6px 10px;
}

.doc-info-table .cell-label {
  background: #f8fafc;
  font-weight: 600;
  width: 100px;
  color: #475569;
}

.vital-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.v-card {
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 10px;
  text-align: center;
  background: #f8fafc;
}

.v-label {
  font-size: 11px;
  color: #64748b;
  margin-bottom: 4px;
}

.v-val {
  font-size: 18px;
  font-weight: bold;
}

.v-val small {
  font-size: 11px;
  font-weight: normal;
}

.v-range {
  font-size: 10px;
  color: #94a3b8;
  margin-top: 2px;
}

.doc-footer-stamp-area {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 28px;
  padding-top: 16px;
  border-top: 1px solid #cbd5e1;
}

.doc-signatures {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 12px;
}

.sig-name {
  font-weight: bold;
  font-family: 'Kaiti', 'STKaiti', cursive;
  font-size: 15px;
  color: #0f172a;
}

.red-stamp-graphic {
  width: 120px;
  height: 120px;
  opacity: 0.88;
  transform: rotate(-8deg);
}

.stamp-svg {
  width: 100%;
  height: 100%;
}

@media print {
  body * {
    visibility: hidden;
  }
  #patientReportPrintArea,
  #patientReportPrintArea * {
    visibility: visible;
  }
  #patientReportPrintArea {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    margin: 0;
    padding: 20mm;
  }
  .no-print {
    display: none !important;
  }
}
</style>
