<template>
  <div class="workspace-page nursing-home-admin">
    <!-- 顶部标题栏与全局状态 -->
    <div class="page-header">
      <div>
        <div class="page-title-row">
          <h1 class="page-title">{{ orgName }} · 院长综合运营决策中心</h1>
          <span class="badge badge-primary">机构代码: KAIJIAN-HQ-01</span>
          <span class="badge badge-success">医保定点机构认证</span>
          <span class="badge badge-purple">安全运行 142 天零严重事故</span>
        </div>
        <div class="page-subtitle">
          机构全局统管 · 87 位在院长者、96 张医养床位 · 长护险定点代申报与月度结算监管 · 医疗照护质量与安全风控中枢
        </div>
      </div>
      <div class="header-actions">
        <button class="btn btn-outline" @click="showLtcModal = !showLtcModal">
          <span class="btn-icon">📋</span>
          {{ showLtcModal ? '收起长护险申报台' : '长护险定点申报通道' }}
        </button>
        <button class="btn btn-primary" @click="exportInstitutionalReport">
          <span class="btn-icon">📊</span>
          导出全院运营月报
        </button>
      </div>
    </div>

    <!-- 成功/操作轻提示 -->
    <div v-if="actionToast" class="toast-banner">
      <span class="toast-icon">✅</span>
      <span>{{ actionToast }}</span>
    </div>

    <!-- 嵌入式长护险申报快捷卡（可折叠） -->
    <div v-if="showLtcModal" class="collapsible-ltc-box mb-4">
      <div class="box-header">
        <div class="box-title">长护险定点机构申报与设备绑定专台</div>
        <button class="close-btn" @click="showLtcModal = false">×</button>
      </div>
      <InstitutionLtcEntry />
    </div>

    <!-- 院内八大核心运营与照护决策指标 -->
    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-label">在院长者 / 总床位</span>
          <span class="metric-tag tag-info">入住率 {{ occupancyRate }}%</span>
        </div>
        <div class="metric-num-row">
          <span class="metric-num">{{ overview?.patient_total || 87 }}</span>
          <span class="metric-sub">/ {{ overview?.bed_total || 96 }} 床</span>
        </div>
        <div class="metric-foot">当前空余 9 床，4F失能专区满员</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-label">实时在床率监护</span>
          <span class="metric-tag tag-success">体征在线率 100%</span>
        </div>
        <div class="metric-num-row">
          <span class="metric-num text-success">{{ inBedCount }}</span>
          <span class="metric-sub">人在床 ({{ inBedRate }}%)</span>
        </div>
        <div class="metric-foot">42人离床活动 / 3人超时关注中</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-label">长护险月度结算预估</span>
          <span class="metric-tag tag-primary">78人享受待遇</span>
        </div>
        <div class="metric-num-row">
          <span class="metric-num text-primary">¥284,500</span>
        </div>
        <div class="metric-foot">统筹基金拟拨付 85% / 个人自付 15%</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-label">医疗照护安全防线</span>
          <span class="metric-tag tag-success">双零指标达成</span>
        </div>
        <div class="metric-num-row">
          <span class="metric-num text-success">142</span>
          <span class="metric-sub">天连续零事故</span>
        </div>
        <div class="metric-foot">院内压疮 0 例 / 严重跌倒 0 起</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-label">责任护工在岗团队</span>
          <span class="metric-tag tag-info">护患比 1:7.25</span>
        </div>
        <div class="metric-num-row">
          <span class="metric-num text-primary">12</span>
          <span class="metric-sub">名在岗 (早班6人)</span>
        </div>
        <div class="metric-foot">4F特级专班配比 1:2.5 (重度失能专护)</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-label">今日防压疮定时翻身</span>
          <span class="metric-tag tag-warning">达成率 93.7%</span>
        </div>
        <div class="metric-num-row">
          <span class="metric-num text-warning">326</span>
          <span class="metric-sub">/ 计划 348 次</span>
        </div>
        <div class="metric-foot">22位高危卧床长者全覆盖执行</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-label">全院待处置急救/告警</span>
          <span :class="['metric-tag', openAlerts.length > 0 ? 'tag-danger' : 'tag-success']">
            {{ openAlerts.length > 0 ? '需干预' : '运行正常' }}
          </span>
        </div>
        <div class="metric-num-row">
          <span :class="['metric-num', openAlerts.length > 0 ? 'text-danger' : 'text-success']">
            {{ openAlerts.length }}
          </span>
          <span class="metric-sub">件待响应闭环</span>
        </div>
        <div class="metric-foot">平均响应时效 48 秒 (SLA达标 100%)</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-label">长者与家属满意度</span>
          <span class="metric-tag tag-success">全优评级</span>
        </div>
        <div class="metric-num-row">
          <span class="metric-num text-success">98.6</span>
          <span class="metric-sub">分 (月度综合)</span>
        </div>
        <div class="metric-foot">本月探视 216 人次 / 表扬锦旗 14 份</div>
      </div>
    </div>

    <!-- 导航标签 (五大管理中枢) -->
    <div class="tab-nav">
      <button :class="['tab-btn', activeTab === 'patients' && 'active']" @click="activeTab = 'patients'">
        🏢 全院大盘与长者全景档案 ({{ filteredPatients.length }} / {{ patients.length }})
      </button>
      <button :class="['tab-btn', activeTab === 'ltc' && 'active']" @click="activeTab = 'ltc'">
        📑 长护险 (LTC) 申报与结算审计中枢
      </button>
      <button :class="['tab-btn', activeTab === 'quality' && 'active']" @click="activeTab = 'quality'">
        🛡️ 照护质量与安全风控中枢
      </button>
      <button :class="['tab-btn', activeTab === 'alerts' && 'active']" @click="activeTab = 'alerts'">
        🚨 紧急事件督办与时效回溯 ({{ alerts.length }})
      </button>
      <button :class="['tab-btn', activeTab === 'caregivers' && 'active']" @click="activeTab = 'caregivers'">
        👥 责任护工团队效能与排班考核
      </button>
      <button :class="['tab-btn', activeTab === 'accounts' && 'active']" @click="activeTab = 'accounts'">
        🔐 账号与权限
      </button>
    </div>

    <!-- ==================== Tab 1: 全院大盘与长者全景档案 ==================== -->
    <div v-if="activeTab === 'patients'" class="content-panel">
      <!-- 楼层热度概况卡 (可联动点击筛选) -->
      <div class="floor-selector-row mb-4">
        <div
          v-for="fl in floorStats"
          :key="fl.floor"
          :class="['floor-card', filterFloor === fl.floor && 'selected']"
          @click="filterFloor = filterFloor === fl.floor ? '' : fl.floor"
        >
          <div class="floor-card-top">
            <span class="floor-tag">{{ fl.floor }}</span>
            <span class="floor-ward-name">{{ fl.ward }}</span>
            <span :class="['badge', fl.tagColor]">{{ fl.level }}</span>
          </div>
          <div class="floor-card-metrics">
            <div class="fl-metric">
              <span class="fl-label">在住/总床</span>
              <span class="fl-val font-mono">{{ fl.occupied }} / {{ fl.total }}</span>
            </div>
            <div class="fl-metric">
              <span class="fl-label">实时在床</span>
              <span class="fl-val text-success font-mono">{{ fl.inBed }} 人</span>
            </div>
            <div class="fl-metric">
              <span class="fl-label">当值护工</span>
              <span class="fl-val text-primary font-mono">{{ fl.nurseCount }} 名</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 综合筛选与搜索栏 -->
      <div class="filter-bar mb-3">
        <div class="filter-group">
          <input
            v-model="searchKeyword"
            type="text"
            placeholder="搜索长者姓名 / 床位号 / 责任护工..."
            class="search-input"
          />
        </div>
        <div class="filter-group">
          <label>专区楼层：</label>
          <select v-model="filterFloor" class="select-input">
            <option value="">全部楼层 (1F - 4F)</option>
            <option value="4F">4F 完全失能专区 (特级护理)</option>
            <option value="3F">3F 认知障碍专区 (一级护理)</option>
            <option value="2F">2F 术后康复专区 (二级护理)</option>
            <option value="1F">1F 慢病颐养专区 (二级护理)</option>
          </select>
        </div>
        <div class="filter-group">
          <label>护理等级：</label>
          <select v-model="filterCareLevel" class="select-input">
            <option value="">全部等级</option>
            <option value="特级护理">特级护理</option>
            <option value="一级护理">一级护理</option>
            <option value="二级护理">二级护理</option>
          </select>
        </div>
        <div class="filter-group">
          <label>在床状态：</label>
          <select v-model="filterBedStatus" class="select-input">
            <option value="">全部状态</option>
            <option value="in_bed">在床监护中</option>
            <option value="off_bed">活动离床</option>
          </select>
        </div>
        <div class="filter-actions ml-auto">
          <button class="btn btn-sm btn-outline" @click="resetFilters">重置筛选</button>
        </div>
      </div>

      <!-- 长者档案数据表格 -->
      <table class="data-table">
        <thead>
          <tr>
            <th>长者编号</th>
            <th>长者姓名</th>
            <th>性别/年龄</th>
            <th>楼层专区</th>
            <th>床位SN</th>
            <th>护理等级</th>
            <th>长护险定点状态</th>
            <th>责任护工</th>
            <th>实时体征</th>
            <th>在床状态</th>
            <th>重点防范标记</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in filteredPatients" :key="p.patient_id">
            <td class="font-mono text-muted">{{ p.patient_id }}</td>
            <td class="font-bold text-primary cursor-pointer" @click="openPatientDetail(p)">
              {{ p.name }}
            </td>
            <td>{{ p.gender === 'male' ? '男' : '女' }} / {{ p.age }}岁</td>
            <td>
              <span class="tag tag-info">{{ p.floor }}</span>
              <span class="text-xs text-muted ml-1">{{ p.ward }}</span>
            </td>
            <td class="font-mono text-primary font-bold">{{ p.bed_id }}</td>
            <td>
              <span :class="['tag', getCareLevelTagClass(p.care_level)]">{{ p.care_level }}</span>
            </td>
            <td>
              <span class="badge badge-purple text-xs">
                {{ getLtcTier(p) }}
              </span>
            </td>
            <td>
              <span class="caregiver-badge font-bold">
                🧑‍⚕️ {{ formatCaregiverName(p.nurse) }}
              </span>
            </td>
            <td class="text-xs font-mono">
              <span :class="p.vitals.hr > 100 || p.vitals.hr < 55 ? 'text-danger font-bold' : ''">
                HR: {{ p.vitals.hr }}
              </span>
              /
              <span :class="p.vitals.br > 24 || p.vitals.br < 10 ? 'text-danger font-bold' : ''">
                BR: {{ p.vitals.br }}
              </span>
              /
              <span :class="p.vitals.tp > 37.3 ? 'text-danger font-bold' : ''">
                {{ p.vitals.tp }}℃
              </span>
            </td>
            <td>
              <span :class="['status-pill', p.vitals.in_bed ? 'status-success' : 'status-warning']">
                {{ p.vitals.in_bed ? '在床监护' : '活动离床' }}
              </span>
            </td>
            <td>
              <span v-if="p.floor === '4F'" class="risk-pill risk-pressure">防压疮高危</span>
              <span v-else-if="p.floor === '3F'" class="risk-pill risk-wander">防走失防跌倒</span>
              <span v-else class="risk-pill risk-normal">日常防滑</span>
            </td>
            <td>
              <button class="btn btn-xs btn-outline" @click="openPatientDetail(p)">全景档案</button>
            </td>
          </tr>
          <tr v-if="filteredPatients.length === 0">
            <td colspan="12" class="text-center py-4 text-muted">未找到匹配的长者监护记录</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ==================== Tab 2: 长护险申报与结算审计中枢 ==================== -->
    <div v-if="activeTab === 'ltc'" class="content-panel">
      <!-- 长护险月度经营与资金核算看板 -->
      <div class="ltc-kpi-row mb-4">
        <div class="ltc-kpi-card">
          <div class="ltc-card-title">定点纳保人数</div>
          <div class="ltc-card-num text-primary">78 <span class="unit">人</span></div>
          <div class="ltc-card-desc">定点机构覆盖率 89.7% (全院 87 人)</div>
        </div>
        <div class="ltc-kpi-card">
          <div class="ltc-card-title">当月护理服务总时长</div>
          <div class="ltc-card-num text-success">3,744 <span class="unit">小时</span></div>
          <div class="ltc-card-desc">规范化项目打卡合规率 99.4%</div>
        </div>
        <div class="ltc-kpi-card">
          <div class="ltc-card-title">医保统筹基金支付预估</div>
          <div class="ltc-card-num text-primary">¥241,825 <span class="unit">元</span></div>
          <div class="ltc-card-desc">统筹支付占比 85.0%</div>
        </div>
        <div class="ltc-kpi-card">
          <div class="ltc-card-title">长者个人自负总额</div>
          <div class="ltc-card-num text-warning">¥42,675 <span class="unit">元</span></div>
          <div class="ltc-card-desc">人均月度自负仅 ¥547.1 元</div>
        </div>
      </div>

      <!-- 结算四步分离监管流水线 -->
      <div class="pipeline-card mb-4">
        <div class="section-title mb-2">国家长护险结算审核「四步分离」合规流水线进度</div>
        <div class="pipeline-steps">
          <div class="step-box step-done">
            <div class="step-num">Step 1</div>
            <div class="step-title">机构月度汇总申报</div>
            <div class="step-info">已申报 78 人 / 8,240 项目工单</div>
            <div class="step-status">✅ 9月20日 已完成</div>
          </div>
          <div class="step-arrow">➔</div>
          <div class="step-box step-done">
            <div class="step-num">Step 2</div>
            <div class="step-title">智能辅助核算与稽核</div>
            <div class="step-info">AI 监测比对通过率 99.8%</div>
            <div class="step-status">✅ 9月22日 审核通过</div>
          </div>
          <div class="step-arrow">➔</div>
          <div class="step-box step-active">
            <div class="step-num">Step 3</div>
            <div class="step-title">经办机构复核</div>
            <div class="step-info">重点抽查 15 份特级长者档案</div>
            <div class="step-status">⏳ 复核进行中 (当前阶段)</div>
          </div>
          <div class="step-arrow">➔</div>
          <div class="step-box">
            <div class="step-num">Step 4</div>
            <div class="step-title">医保局支付核定与划拨</div>
            <div class="step-info">拟拨付 ¥241,825 元</div>
            <div class="step-status">待经办机构复核后划账</div>
          </div>
        </div>
      </div>

      <!-- 待遇等级分布与月度结算审计 -->
      <div class="grid-2col mb-4">
        <div class="sub-panel">
          <div class="panel-header-row">
            <div class="section-title">长护险待遇评定等级分布</div>
            <span class="text-xs text-muted">国家标准失能评估结论</span>
          </div>
          <table class="data-table mt-2">
            <thead>
              <tr>
                <th>评定等级</th>
                <th>人数</th>
                <th>月度统筹限额</th>
                <th>人均服务时长</th>
                <th>主要分布专区</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span class="badge badge-danger">重度失能 Ⅲ 级</span></td>
                <td class="font-bold">22 人</td>
                <td class="font-mono text-primary font-bold">¥3,600 /人</td>
                <td>68 小时/月</td>
                <td>4F 完全失能专区</td>
              </tr>
              <tr>
                <td><span class="badge badge-warning">重度失能 Ⅱ 级</span></td>
                <td class="font-bold">31 人</td>
                <td class="font-mono text-primary font-bold">¥3,200 /人</td>
                <td>52 小时/月</td>
                <td>3F 认知障碍专区</td>
              </tr>
              <tr>
                <td><span class="badge badge-primary">重度失能 Ⅰ 级</span></td>
                <td class="font-bold">18 人</td>
                <td class="font-mono text-primary font-bold">¥2,800 /人</td>
                <td>40 小时/月</td>
                <td>2F 术后康复专区</td>
              </tr>
              <tr>
                <td><span class="badge badge-info">中度失能</span></td>
                <td class="font-bold">7 人</td>
                <td class="font-mono text-primary font-bold">¥2,200 /人</td>
                <td>28 小时/月</td>
                <td>1F 慢病颐养专区</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="sub-panel">
          <div class="panel-header-row">
            <div class="section-title">长护险补贴项目合规审计抽检</div>
            <button class="btn btn-xs btn-primary" @click="exportInstitutionalReport">导出审计报表</button>
          </div>
          <table class="data-table mt-2">
            <thead>
              <tr>
                <th>护理补贴核心项目</th>
                <th>本月完成工单</th>
                <th>智能体征核验证</th>
                <th>合规达标率</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>卧床长者防压疮翻身与体位变换</td>
                <td class="font-mono">1,320 次</td>
                <td class="text-success font-mono">1,312 份</td>
                <td><span class="tag tag-success">99.4%</span></td>
              </tr>
              <tr>
                <td>生活自理照料与晨晚间护理</td>
                <td class="font-mono">2,340 次</td>
                <td class="text-success font-mono">2,335 份</td>
                <td><span class="tag tag-success">99.8%</span></td>
              </tr>
              <tr>
                <td>鼻饲照料与经管营养支持</td>
                <td class="font-mono">420 次</td>
                <td class="text-success font-mono">420 份</td>
                <td><span class="tag tag-success">100%</span></td>
              </tr>
              <tr>
                <td>失禁照护与会阴冲洗消毒</td>
                <td class="font-mono">980 次</td>
                <td class="text-success font-mono">976 份</td>
                <td><span class="tag tag-success">99.6%</span></td>
              </tr>
              <tr>
                <td>被动肢体康复与转移训练</td>
                <td class="font-mono">680 次</td>
                <td class="text-success font-mono">674 份</td>
                <td><span class="tag tag-success">99.1%</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ==================== Tab 3: 照护质量与安全风控中枢 ==================== -->
    <div v-if="activeTab === 'quality'" class="content-panel">
      <!-- 质控红线与督办看板 -->
      <div class="safety-banner mb-4">
        <div class="safety-badge">院长质控红线</div>
        <div class="safety-text">
          全院严格执行「防压疮翻身不超过 2 小时、高危离床感应立即到场、跌倒预防 100% 闭环」的三大生命线考核。
        </div>
      </div>

      <!-- 卧床长者定时翻身监控池 (院长直视压疮防线) -->
      <div class="section-title-row mb-2">
        <div class="section-title">高危卧床长者防压疮定时翻身监控大本 (4F/3F 特级护理专区)</div>
        <span class="text-xs text-muted">基于智能床垫压力传感器与护工打卡对账</span>
      </div>
      <table class="data-table mb-4">
        <thead>
          <tr>
            <th>床位</th>
            <th>长者姓名</th>
            <th>失能等级</th>
            <th>当前体位</th>
            <th>上次翻身时间</th>
            <th>距下次应翻身</th>
            <th>今日翻身次数</th>
            <th>当值责任护工</th>
            <th>翻身状态</th>
            <th>督办操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in turnSchedule" :key="item.bed">
            <td class="font-mono text-primary font-bold">{{ item.bed }}</td>
            <td class="font-bold">{{ item.name }}</td>
            <td><span class="tag tag-danger">{{ item.level }}</span></td>
            <td><span class="tag tag-info">{{ item.posture }}</span></td>
            <td class="font-mono text-xs">{{ item.lastTime }}</td>
            <td class="font-mono font-bold" :class="item.isOverdue ? 'text-danger' : 'text-primary'">
              {{ item.nextDue }}
            </td>
            <td class="font-mono">{{ item.todayCount }} 次</td>
            <td><span class="caregiver-badge">🧑‍⚕️ {{ item.caregiver }}</span></td>
            <td>
              <span :class="['status-pill', item.isOverdue ? 'status-danger' : 'status-success']">
                {{ item.isOverdue ? '⚠️ 即将超期' : '执行合规' }}
              </span>
            </td>
            <td>
              <button
                class="btn btn-xs btn-outline"
                @click="sendTurnReminder(item.name, item.bed, item.caregiver)"
              >
                督办提醒
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 照护质量考核与日常防范体系指标 -->
      <div class="grid-3col">
        <div class="sub-panel">
          <div class="panel-header-row">
            <div class="section-title">跌倒防范与离床感应</div>
          </div>
          <div class="stat-list mt-3">
            <div class="stat-item">
              <span class="stat-name">高危离床自动预警触发</span>
              <span class="stat-val font-mono">14 起/本月</span>
            </div>
            <div class="stat-item">
              <span class="stat-name">护工到场平均核实时间</span>
              <span class="stat-val text-success font-mono">42 秒</span>
            </div>
            <div class="stat-item">
              <span class="stat-name">院内地面严重跌倒发生数</span>
              <span class="stat-val text-success font-bold font-mono">0 起 (连续142天)</span>
            </div>
            <div class="stat-item">
              <span class="stat-name">卫浴感应器设备在线率</span>
              <span class="stat-val font-mono">100%</span>
            </div>
          </div>
        </div>

        <div class="sub-panel">
          <div class="panel-header-row">
            <div class="section-title">慢病体征与用药合规</div>
          </div>
          <div class="stat-list mt-3">
            <div class="stat-item">
              <span class="stat-name">三餐饮前用药三查七对率</span>
              <span class="stat-val text-success font-mono">100%</span>
            </div>
            <div class="stat-item">
              <span class="stat-name">异常体温(>37.3℃)及时随访</span>
              <span class="stat-val font-mono">100% (驻院医师会诊)</span>
            </div>
            <div class="stat-item">
              <span class="stat-name">心率超限(>100bpm)处置闭环</span>
              <span class="stat-val text-success font-mono">100%</span>
            </div>
            <div class="stat-item">
              <span class="stat-name">医疗管路(导尿/胃管)滑脱率</span>
              <span class="stat-val text-success font-bold font-mono">0.00%</span>
            </div>
          </div>
        </div>

        <div class="sub-panel">
          <div class="panel-header-row">
            <div class="section-title">院长行政查房与交接留痕</div>
          </div>
          <div class="stat-list mt-3">
            <div class="stat-item">
              <span class="stat-name">院长日巡查覆盖率</span>
              <span class="stat-val text-primary font-mono">100% (1F-4F)</span>
            </div>
            <div class="stat-item">
              <span class="stat-name">护理交接班日志归档率</span>
              <span class="stat-val text-success font-mono">100%</span>
            </div>
            <div class="stat-item">
              <span class="stat-name">长者心理与家属沟通次数</span>
              <span class="stat-val font-mono">38 次/周</span>
            </div>
            <div class="stat-item">
              <span class="stat-name">食品安全留样与营养评定</span>
              <span class="stat-val text-success font-mono">全合格</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== Tab 4: 紧急事件督办与时效回溯 ==================== -->
    <div v-if="activeTab === 'alerts'" class="content-panel">
      <!-- 告警响应时效 SLA 大盘 -->
      <div class="sla-overview-row mb-3">
        <div class="sla-metric">
          <span class="sla-lbl">4F 完全失能区响应均值</span>
          <span class="sla-val text-success font-mono">38 秒</span>
        </div>
        <div class="sla-metric">
          <span class="sla-lbl">3F 认知障碍区响应均值</span>
          <span class="sla-val text-success font-mono">45 秒</span>
        </div>
        <div class="sla-metric">
          <span class="sla-lbl">2F 康复专区响应均值</span>
          <span class="sla-val text-success font-mono">52 秒</span>
        </div>
        <div class="sla-metric">
          <span class="sla-lbl">1F 慢病颐养区响应均值</span>
          <span class="sla-val text-success font-mono">58 秒</span>
        </div>
      </div>

      <div class="filter-bar mb-3">
        <div class="filter-group">
          <label>告警状态筛选：</label>
          <select v-model="filterAlertStatus" class="select-input">
            <option value="">全部告警 ({{ alerts.length }})</option>
            <option value="triggered">待接单/报警中</option>
            <option value="handling">处置中</option>
            <option value="handled">已处置闭环</option>
          </select>
        </div>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th>告警编号</th>
            <th>床位SN</th>
            <th>告警分类</th>
            <th>等级</th>
            <th>内容</th>
            <th>触发时间</th>
            <th>响应时效</th>
            <th>状态</th>
            <th>处置护工</th>
            <th>院长复核状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in filteredAlerts" :key="a.alert_id">
            <td class="font-mono text-muted">{{ a.alert_id }}</td>
            <td class="font-mono text-primary font-bold">{{ a.bed_id }}</td>
            <td><span class="tag tag-danger">{{ a.title }}</span></td>
            <td><span class="tag tag-warning">L{{ a.level }}</span></td>
            <td>{{ a.detail }}</td>
            <td class="font-mono text-xs">{{ a.occurred_at?.slice(11, 19) }}</td>
            <td class="font-mono text-xs text-success">
              {{ a.status === 'handled' ? '42s 到场' : '计时中...' }}
            </td>
            <td>
              <span :class="['status-pill', a.status === 'handled' ? 'status-success' : 'status-danger']">
                {{ formatAlertStatus(a.status) }}
              </span>
            </td>
            <td>
              <span class="caregiver-badge">
                🧑‍⚕️ {{ formatCaregiverName(a.handled_by || a.claimed_by || '当值护工组') }}
              </span>
            </td>
            <td>
              <span class="badge badge-success text-xs">院长已审阅</span>
            </td>
            <td>
              <button class="btn btn-xs btn-outline" @click="reviewAlert(a.alert_id)">
                复核调阅
              </button>
            </td>
          </tr>
          <tr v-if="filteredAlerts.length === 0">
            <td colspan="11" class="text-center py-4 text-muted">当前筛选下无告警记录</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ==================== Tab 5: 责任护工团队效能与排班考核 ==================== -->
    <div v-if="activeTab === 'caregivers'" class="content-panel">
      <!-- 班次与责任护工分布 -->
      <div class="shift-summary mb-3">
        <span class="font-bold">当前值守班次：早班 (06:00 - 14:00)</span>
        <span class="ml-3 text-muted">全院照护团队全员持证在岗 · 在编工作人员 25 名（管理层 3 名 / 护士长 4 名 / 责任护工 12 名 / 康复师 1 名 / 席位大屏 4 组）</span>
      </div>

      <!-- 院级管理中枢卡片 -->
      <div class="exec-team-banner mb-4">
        <div class="exec-banner-title">
          <span class="font-bold text-primary">🏛️ 院级运营指挥与质控总监组</span>
          <span class="text-xs text-muted ml-2">统筹全院长护险结算、压疮防控、护理安全与人员调度</span>
        </div>
        <div class="exec-member-grid mt-2">
          <div class="exec-member-chip">
            <span class="chip-avatar">👨‍💼</span>
            <div class="chip-info">
              <span class="chip-name font-bold">顾振华 院长</span>
              <span class="chip-role text-xs text-muted">院长 / 运营总经理 (全面统筹与决策)</span>
            </div>
            <span class="badge badge-primary ml-auto text-xs">院办</span>
          </div>
          <div class="exec-member-chip">
            <span class="chip-avatar">👩‍⚕️</span>
            <div class="chip-info">
              <span class="chip-name font-bold">陈美琳 主任</span>
              <span class="chip-role text-xs text-muted">护理部主任 (副主任护师 · 质控总督导)</span>
            </div>
            <span class="badge badge-success ml-auto text-xs">护理部</span>
          </div>
          <div class="exec-member-chip">
            <span class="chip-avatar">👨‍💻</span>
            <div class="chip-info">
              <span class="chip-name font-bold">周立平 主管</span>
              <span class="chip-role text-xs text-muted">长护险与医保结算专员 (待遇核销申报)</span>
            </div>
            <span class="badge badge-purple ml-auto text-xs">医保办</span>
          </div>
          <div class="exec-member-chip">
            <span class="chip-avatar">🧑‍⚕️</span>
            <div class="chip-info">
              <span class="chip-name font-bold">黄俊杰 理疗师</span>
              <span class="chip-role text-xs text-muted">康复理疗师 (主管技师 · 肢体康复)</span>
            </div>
            <span class="badge badge-info ml-auto text-xs">康复部</span>
          </div>
        </div>
      </div>

      <!-- 各病区责任班组卡片 -->
      <div class="floor-nurse-grid mb-4">
        <div class="nurse-group-card">
          <div class="floor-card-head">
            <div class="floor-title font-bold text-primary">4F 完全失能专区 (特级护理专班)</div>
            <span class="badge badge-danger">配比 1:2.5</span>
          </div>
          <div class="headnurse-row mb-1 text-xs">
            <span class="text-muted">病区护士长: </span>
            <strong class="text-primary font-bold">沈雅琴 (主管护师)</strong>
            <span class="badge badge-success ml-2">在班</span>
          </div>
          <div class="nurse-names text-sm">
            <span class="tag-on-duty">李晓芳 (责任组长 · 401-406床)</span>
            <span class="tag-on-duty">王芳 (护工主管 · 407-411床)</span>
            <span class="tag-on-duty">刘建国 (机动巡房)</span>
            <span class="tag-off-duty">孙秀英 (轮休)</span>
          </div>
          <div class="bed-summary text-xs text-muted mt-2">
            在住 22 人 / 床位 24 张 · 重点负责高危卧床压疮定时翻身与管路维护
          </div>
        </div>

        <div class="nurse-group-card">
          <div class="floor-card-head">
            <div class="floor-title font-bold text-primary">3F 认知障碍专区 (失智关爱专班)</div>
            <span class="badge badge-warning">配比 1:3.0</span>
          </div>
          <div class="headnurse-row mb-1 text-xs">
            <span class="text-muted">病区护士长: </span>
            <strong class="text-primary font-bold">林素梅 (主管护师)</strong>
            <span class="badge badge-success ml-2">在班</span>
          </div>
          <div class="nurse-names text-sm">
            <span class="tag-on-duty">张晓敏 (责任组长 · 301-306床)</span>
            <span class="tag-on-duty">陈宇 (责任护工 · 307-311床)</span>
            <span class="tag-off-duty">周平 (轮休)</span>
          </div>
          <div class="bed-summary text-xs text-muted mt-2">
            在住 21 人 / 床位 24 张 · 重点负责防走失、防跌倒与认知激活互动照料
          </div>
        </div>

        <div class="nurse-group-card">
          <div class="floor-card-head">
            <div class="floor-title font-bold text-primary">2F 术后康复专区 (介护康复专班)</div>
            <span class="badge badge-info">配比 1:4.0</span>
          </div>
          <div class="headnurse-row mb-1 text-xs">
            <span class="text-muted">病区护士长: </span>
            <strong class="text-primary font-bold">朱秀华 (主管护师)</strong>
            <span class="badge badge-success ml-2">在班</span>
          </div>
          <div class="nurse-names text-sm">
            <span class="tag-on-duty">赵燕 (责任组长 · 201-206床)</span>
            <span class="tag-on-duty">吴强 (责任护工 · 207-211床)</span>
            <span class="tag-off-duty">郑华 (轮休)</span>
          </div>
          <div class="bed-summary text-xs text-muted mt-2">
            在住 22 人 / 床位 24 张 · 重点负责被动关节运动、安全起居转移与生活协助
          </div>
        </div>

        <div class="nurse-group-card">
          <div class="floor-card-head">
            <div class="floor-title font-bold text-primary">1F 慢病颐养专区 (活力颐养专班)</div>
            <span class="badge badge-success">配比 1:5.5</span>
          </div>
          <div class="headnurse-row mb-1 text-xs">
            <span class="text-muted">病区护士长: </span>
            <strong class="text-primary font-bold">严冬梅 (主管护师)</strong>
            <span class="badge badge-success ml-2">在班</span>
          </div>
          <div class="nurse-names text-sm">
            <span class="tag-on-duty">何丽 (责任组长 · 101-106床)</span>
            <span class="tag-on-duty">宋敏 (责任护工 · 107-111床)</span>
            <span class="tag-off-duty">马桂英 (轮休)</span>
          </div>
          <div class="bed-summary text-xs text-muted mt-2">
            在住 22 人 / 床位 24 张 · 重点负责慢病生命体征监测、用药提醒与精神慰藉
          </div>
        </div>
      </div>

      <!-- 责任护工服务效能与绩效积分排行榜 -->
      <div class="section-title-row mb-2">
        <div class="section-title">责任护工月度效能与质控绩效排行榜</div>
        <span class="text-xs text-muted">考评依据：打卡达标率、呼叫响应时效、翻身规范、家属好评率</span>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>排名</th>
            <th>护工姓名</th>
            <th>职称资质</th>
            <th>主责楼层</th>
            <th>分管长者数</th>
            <th>今日巡查打卡</th>
            <th>防压疮翻身次数</th>
            <th>呼叫响应均值</th>
            <th>长护险规范分</th>
            <th>家属好评率</th>
            <th>综合绩效等级</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(cg, idx) in caregiverPerformance" :key="cg.name">
            <td class="font-bold font-mono">
              <span v-if="idx === 0" class="rank-badge rank-1">🥇 1</span>
              <span v-else-if="idx === 1" class="rank-badge rank-2">🥈 2</span>
              <span v-else-if="idx === 2" class="rank-badge rank-3">🥉 3</span>
              <span v-else class="font-mono text-muted pl-2">{{ idx + 1 }}</span>
            </td>
            <td class="font-bold text-primary">🧑‍⚕️ {{ cg.name }}</td>
            <td><span class="badge badge-purple text-xs">{{ cg.title }}</span></td>
            <td><span class="tag tag-info">{{ cg.floor }}</span></td>
            <td class="font-mono">{{ cg.patientsCount }} 人</td>
            <td class="font-mono text-success">{{ cg.patrolCount }} 次</td>
            <td class="font-mono">{{ cg.turnCount }} 次</td>
            <td class="font-mono text-success font-bold">{{ cg.avgResponse }} 秒</td>
            <td class="font-mono font-bold">{{ cg.ltcScore }} 分</td>
            <td class="font-mono text-success font-bold">{{ cg.satisfaction }}%</td>
            <td>
              <span :class="['status-pill', cg.grade === 'A+' ? 'status-success' : 'status-primary']">
                {{ cg.grade }} 优秀
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ==================== Tab: 账号与权限（N28 三层模型：用户-组-颗粒） ==================== -->
    <div v-if="activeTab === 'accounts'" class="content-panel">
      <div v-if="permLoading" class="text-muted mb-3">账号权限数据加载中…</div>
      <template v-else>
        <div class="shift-summary mb-3">
          <span class="font-bold">🔐 账号与权限管理</span>
          <span class="ml-3 text-xs text-muted">本组织账号均挂权限组（组即角色默认颗粒套餐），可对单个账号逐颗加开/关闭；改动保存后，目标账号重新登录或刷新会话生效。平台不提供伙伴自建账号。</span>
        </div>
        <div class="group-bar mb-3">
          <button class="btn btn-primary btn-sm" @click="openGroupCreate">＋ 新建权限组</button>
          <span class="text-xs text-muted ml-2">自定义组：从 91 颗权限中勾选组合（如「值班组长」）；内置 51 组只读可挂不可改。</span>
        </div>
        <div v-if="customGroups.length" class="group-chip-row mb-3">
          <span v-for="g in customGroups" :key="g.group_id" class="group-chip">
            {{ g.name }} · {{ g.codes.length }}颗
            <button class="chip-act" @click="openGroupEdit(g)">改</button>
            <button class="chip-act chip-danger" @click="removeGroup(g)">删</button>
          </span>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>账号</th>
              <th>姓名/席位</th>
              <th>所属组（可切换）</th>
              <th>工作台</th>
              <th>颗粒微调</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in orgUsers" :key="u.username">
              <td class="font-mono text-primary font-bold">{{ u.username }}</td>
              <td>{{ u.display_name }}</td>
              <td>
                <select class="group-select" :value="u.role" @change="assignGroup(u.username, ($event.target as HTMLSelectElement).value)">
                  <option v-for="opt in groupOptions()" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                  <option v-if="!groupOptions().some((o) => o.value === u.role)" :value="u.role">{{ u.role }}（当前）</option>
                </select>
              </td>
              <td class="text-xs text-muted font-mono">{{ u.workspace }}</td>
              <td>
                <span v-if="u.granted_perms.length || u.revoked_perms.length" class="badge badge-info text-xs">
                  +{{ u.granted_perms.length }} / -{{ u.revoked_perms.length }}
                </span>
                <span v-else class="text-xs text-muted">组默认</span>
              </td>
              <td>
                <button class="btn btn-sm" @click="toggleExpand(u)">
                  {{ expandedUser === u.username ? '收起' : '颗粒开关' }}
                </button>
              </td>
            </tr>
            <tr v-if="expandedUser">
              <td colspan="6" class="perm-matrix-cell">
                <div class="perm-matrix">
                  <button
                    v-for="code in permCatalog"
                    :key="code"
                    :class="['perm-chip', permStateOf(orgUsers.find((x) => x.username === expandedUser)!, code)]"
                    @click="cyclePerm(orgUsers.find((x) => x.username === expandedUser)!, code)"
                  >
                    {{ code }}
                  </button>
                </div>
                <div class="mt-3">
                  <button class="btn btn-primary btn-sm" @click="savePermTweaks(expandedUser)">保存微调</button>
                  <button class="btn btn-sm ml-2" @click="resetUserPerms(expandedUser)">恢复组默认</button>
                  <span class="text-xs text-muted ml-2">绿=加开 · 红=关闭 · 灰=组默认（点击循环切换）</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </template>

      <!-- 组编辑器 -->
      <div v-if="showGroupEditor" class="modal-backdrop" @click="showGroupEditor = false">
        <div class="modal-dialog" @click.stop>
          <div class="modal-title font-bold">{{ editingGroupId ? '编辑权限组' : '新建权限组' }}</div>
          <div class="mb-3">
            <input v-model="groupDraftName" class="input" placeholder="组名（如：值班组长）" maxlength="40" />
          </div>
          <div class="perm-matrix">
            <button
              v-for="code in permCatalog"
              :key="code"
              :class="['perm-chip', groupDraftCodes.includes(code) && 'granted']"
              @click="toggleGroupCode(code)"
            >
              {{ code }}
            </button>
          </div>
          <div class="mt-3 text-right">
            <button class="btn btn-sm" @click="showGroupEditor = false">取消</button>
            <button class="btn btn-primary btn-sm ml-2" @click="saveGroupDraft">保存</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== 长者全景健康档案弹窗 ==================== -->
    <div v-if="selectedPatientModal" class="modal-backdrop" @click="selectedPatientModal = null">
      <div class="modal-dialog" @click.stop>
        <div class="modal-header">
          <div>
            <div class="modal-title font-bold text-primary">
              {{ selectedPatientModal.name }} · 院长级全景监护档案
            </div>
            <div class="modal-subtitle text-xs text-muted">
              编号: {{ selectedPatientModal.patient_id }} | {{ selectedPatientModal.floor }} {{ selectedPatientModal.ward }} | 床位 {{ selectedPatientModal.bed_id }}
            </div>
          </div>
          <button class="close-btn" @click="selectedPatientModal = null">×</button>
        </div>

        <div class="modal-body">
          <div class="grid-2col mb-3">
            <div class="info-card">
              <div class="info-title">长者基本医养信息</div>
              <div class="info-row">
                <span class="lbl">年龄 / 性别：</span>
                <span class="val">{{ selectedPatientModal.age }} 岁 / {{ selectedPatientModal.gender === 'male' ? '男' : '女' }}</span>
              </div>
              <div class="info-row">
                <span class="lbl">护理等级：</span>
                <span class="val"><span class="tag tag-danger">{{ selectedPatientModal.care_level }}</span></span>
              </div>
              <div class="info-row">
                <span class="lbl">责任护工：</span>
                <span class="val font-bold">🧑‍⚕️ {{ formatCaregiverName(selectedPatientModal.nurse) }}</span>
              </div>
              <div class="info-row">
                <span class="lbl">主治医师：</span>
                <span class="val">{{ selectedPatientModal.doctor }}</span>
              </div>
            </div>

            <div class="info-card">
              <div class="info-title">长护险待遇核定档案</div>
              <div class="info-row">
                <span class="lbl">评定失能等级：</span>
                <span class="val font-bold text-primary">{{ getLtcTier(selectedPatientModal) }}</span>
              </div>
              <div class="info-row">
                <span class="lbl">月度补贴限额：</span>
                <span class="val font-mono">¥3,200 元/月 (基金支付 85%)</span>
              </div>
              <div class="info-row">
                <span class="lbl">代申报状态：</span>
                <span class="val text-success">已通过复核·按月结算</span>
              </div>
              <div class="info-row">
                <span class="lbl">紧急联系人：</span>
                <span class="val">长女 (138****6688 · 已绑定)</span>
              </div>
            </div>
          </div>

          <div class="vitals-realtime-box mb-3">
            <div class="info-title mb-2">实时生命体征监测</div>
            <div class="vitals-row">
              <div class="vital-item">
                <span class="v-name">实时心率</span>
                <span class="v-val text-primary">{{ selectedPatientModal.vitals.hr }} <small>bpm</small></span>
              </div>
              <div class="vital-item">
                <span class="v-name">呼吸频率</span>
                <span class="v-val text-primary">{{ selectedPatientModal.vitals.br }} <small>次/分</small></span>
              </div>
              <div class="vital-item">
                <span class="v-name">额温/体温</span>
                <span class="v-val text-success">{{ selectedPatientModal.vitals.tp }} <small>℃</small></span>
              </div>
              <div class="vital-item">
                <span class="v-name">床位在床</span>
                <span :class="['v-val', selectedPatientModal.vitals.in_bed ? 'text-success' : 'text-warning']">
                  {{ selectedPatientModal.vitals.in_bed ? '在床' : '离床' }}
                </span>
              </div>
            </div>
          </div>

          <div class="doctor-notes-box">
            <div class="info-title">院长医养质量评注</div>
            <p class="text-xs text-muted mt-1 leading-relaxed">
              该长者处于规范照护周期内，重点防范卧床压疮与起居安全。责任护工已按时执行翻身与生命体征巡检打卡，体征指标平稳，长护险服务核验完全符合医保定点合规标准。
            </p>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-outline" @click="sendTurnReminder(selectedPatientModal.name, selectedPatientModal.bed_id, selectedPatientModal.nurse)">
            下达关爱巡查督办
          </button>
          <button class="btn btn-primary" @click="selectedPatientModal = null">关闭档案</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import InstitutionLtcEntry from '../../../features/ltc-workbench/pages/InstitutionLtcEntry.vue'
import { ref, onMounted, computed } from 'vue'
import { getOverview, getPatients, getAlerts, getOrgUsers, getPermissionCatalog, patchOrgUser, getPermGroups, createPermGroup, patchPermGroup, deletePermGroup, type OrgUserRow, type PermGroup } from '../../../api/client'
import { useOrgIdentity } from '../../../features/ltc-workbench/org-identity'
import type { Overview, Patient, Alert } from '../../../api/types'

const { orgName } = useOrgIdentity()

const activeTab = ref<'patients' | 'ltc' | 'quality' | 'alerts' | 'caregivers' | 'accounts'>('patients')

const overview = ref<Overview | null>(null)
const patients = ref<Patient[]>([])
const alerts = ref<Alert[]>([])

// ---- N28 账号与权限（三层模型：用户-组-颗粒）----
const orgUsers = ref<import('../../../api/client').OrgUserRow[]>([])
const permCatalog = ref<string[]>([])
const permLoading = ref(false)
const expandedUser = ref<string | null>(null)
const draftGranted = ref<string[]>([])
const draftRevoked = ref<string[]>([])

async function loadOrgUsers() {
  permLoading.value = true
  try {
    const [usersRes, catalogRes] = await Promise.all([getOrgUsers(), getPermissionCatalog()])
    orgUsers.value = usersRes.list
    permCatalog.value = catalogRes.codes
  } catch (e) {
    showToast('账号权限加载失败（可能无 user:manage 颗粒）')
  } finally {
    permLoading.value = false
  }
}

function toggleExpand(u: import('../../../api/client').OrgUserRow) {
  if (expandedUser.value === u.username) {
    expandedUser.value = null
    return
  }
  expandedUser.value = u.username
  draftGranted.value = [...u.granted_perms]
  draftRevoked.value = [...u.revoked_perms]
}

function permStateOf(u: import('../../../api/client').OrgUserRow, code: string): 'granted' | 'revoked' | 'default' {
  if (draftGranted.value.includes(code)) return 'granted'
  if (draftRevoked.value.includes(code)) return 'revoked'
  return 'default'
}

function cyclePerm(u: import('../../../api/client').OrgUserRow, code: string) {
  if (expandedUser.value !== u.username) return
  const g = new Set(draftGranted.value)
  const r = new Set(draftRevoked.value)
  const inGroup = u.permissions.includes(code) && !r.has(code) // 组默认已含且未显式关
  if (g.has(code)) { g.delete(code); r.add(code) }        // 加开 → 关闭
  else if (r.has(code)) { r.delete(code) }                // 关闭 → 回组默认
  else if (inGroup) { r.add(code) }                       // 组默认含 → 显式关闭
  else { g.add(code) }                                    // 组默认无 → 加开
  draftGranted.value = [...g]
  draftRevoked.value = [...r]
}

async function savePermTweaks(username: string) {
  try {
    await patchOrgUser(username, { granted_perms: draftGranted.value, revoked_perms: draftRevoked.value })
    showToast(`${username} 权限已更新（目标账号重新登录或刷新会话后生效）`)
    await loadOrgUsers()
    expandedUser.value = null
  } catch (e: any) {
    showToast(e?.message || '保存失败')
  }
}

async function resetUserPerms(username: string) {
  try {
    await patchOrgUser(username, { reset_perms: true })
    showToast(`${username} 已恢复组默认权限`)
    await loadOrgUsers()
    expandedUser.value = null
  } catch (e: any) {
    showToast(e?.message || '重置失败')
  }
}

// ---- N28a 自定义权限组（组 CRUD + 账号换组）----
const builtinGroups = ref<PermGroup[]>([])
const customGroups = ref<PermGroup[]>([])
const groupsLoading = ref(false)
const showGroupEditor = ref(false)
const editingGroupId = ref<string | null>(null)
const groupDraftName = ref('')
const groupDraftCodes = ref<string[]>([])

async function loadPermGroupsUI() {
  groupsLoading.value = true
  try {
    const resp = await getPermGroups()
    builtinGroups.value = resp.builtin
    customGroups.value = resp.custom
  } catch {
    showToast('权限组加载失败')
  } finally {
    groupsLoading.value = false
  }
}

async function loadAccountsTab() {
  await Promise.all([loadOrgUsers(), loadPermGroupsUI()])
}

function openGroupCreate() {
  editingGroupId.value = null
  groupDraftName.value = ''
  groupDraftCodes.value = []
  showGroupEditor.value = true
}

function openGroupEdit(g: PermGroup) {
  editingGroupId.value = g.group_id
  groupDraftName.value = g.name
  groupDraftCodes.value = [...g.codes]
  showGroupEditor.value = true
}

function toggleGroupCode(code: string) {
  const s = new Set(groupDraftCodes.value)
  if (s.has(code)) s.delete(code)
  else s.add(code)
  groupDraftCodes.value = [...s]
}

async function saveGroupDraft() {
  if (!groupDraftName.value.trim()) { showToast('组名必填'); return }
  try {
    if (editingGroupId.value) {
      await patchPermGroup(editingGroupId.value, { name: groupDraftName.value.trim(), codes: groupDraftCodes.value })
      showToast('组已更新')
    } else {
      const created = await createPermGroup({ name: groupDraftName.value.trim(), codes: groupDraftCodes.value })
      showToast(`组已创建：${created.name}`)
    }
    showGroupEditor.value = false
    await loadPermGroupsUI()
  } catch (e: any) {
    showToast(e?.message || '组保存失败')
  }
}

async function removeGroup(g: PermGroup) {
  try {
    await deletePermGroup(g.group_id)
    showToast(`组「${g.name}」已删除`)
    await loadPermGroupsUI()
  } catch (e: any) {
    showToast(e?.message || '删除失败（组仍被账号引用）')
  }
}

/** 账号换组：内置组用组键，自定义组用 custom:<id>；换组自动清空旧微调 */
async function assignGroup(username: string, groupKey: string) {
  try {
    await patchOrgUser(username, { group: groupKey })
    showToast(`${username} 已换组（旧颗粒微调已清空）`)
    await loadOrgUsers()
  } catch (e: any) {
    showToast(e?.message || '换组失败')
  }
}

function groupOptions() {
  return [
    ...builtinGroups.value.map((g) => ({ value: g.group_id, label: `${g.name}（内置）` })),
    ...customGroups.value.map((g) => ({ value: `custom:${g.group_id}`, label: `${g.name}（自定义）` })),
  ]
}

const filterFloor = ref('')
const filterCareLevel = ref('')
const filterBedStatus = ref('')
const filterAlertStatus = ref('')
const searchKeyword = ref('')

const showLtcModal = ref(false)
const selectedPatientModal = ref<Patient | null>(null)
const actionToast = ref<string | null>(null)

function showToast(msg: string) {
  actionToast.value = msg
  setTimeout(() => {
    actionToast.value = null
  }, 3500)
}

const openAlerts = computed(() => {
  return alerts.value.filter((a) => a.status === 'triggered' || a.status === 'handling')
})

const inBedCount = computed(() => {
  return patients.value.filter((p) => p.vitals?.in_bed).length || 45
})

const inBedRate = computed(() => {
  if (!patients.value.length) return 52
  return Math.round((inBedCount.value / patients.value.length) * 100)
})

const occupancyRate = computed(() => {
  const totalBeds = overview.value?.bed_total || 96
  const totalPatients = overview.value?.patient_total || patients.value.length || 87
  return ((totalPatients / totalBeds) * 100).toFixed(1)
})

const floorStats = computed(() => {
  return [
    {
      floor: '4F',
      ward: '完全失能专区',
      level: '特级护理',
      tagColor: 'badge-danger',
      occupied: 22,
      total: 24,
      inBed: 19,
      nurseCount: 3,
    },
    {
      floor: '3F',
      ward: '认知障碍专区',
      level: '一级护理',
      tagColor: 'badge-warning',
      occupied: 21,
      total: 24,
      inBed: 11,
      nurseCount: 3,
    },
    {
      floor: '2F',
      ward: '术后康复专区',
      level: '二级护理',
      tagColor: 'badge-primary',
      occupied: 22,
      total: 24,
      inBed: 8,
      nurseCount: 2,
    },
    {
      floor: '1F',
      ward: '慢病颐养专区',
      level: '二级护理',
      tagColor: 'badge-info',
      occupied: 22,
      total: 24,
      inBed: 7,
      nurseCount: 2,
    },
  ]
})

const filteredPatients = computed(() => {
  return patients.value.filter((p) => {
    if (filterFloor.value && p.floor !== filterFloor.value) return false
    if (filterCareLevel.value && p.care_level !== filterCareLevel.value) return false
    if (filterBedStatus.value === 'in_bed' && !p.vitals.in_bed) return false
    if (filterBedStatus.value === 'off_bed' && p.vitals.in_bed) return false
    if (searchKeyword.value) {
      const kw = searchKeyword.value.trim().toLowerCase()
      const matchName = p.name?.toLowerCase().includes(kw)
      const matchBed = p.bed_id?.toLowerCase().includes(kw)
      const matchNurse = p.nurse?.toLowerCase().includes(kw)
      if (!matchName && !matchBed && !matchNurse) return false
    }
    return true
  })
})

const filteredAlerts = computed(() => {
  return alerts.value.filter((a) => {
    if (filterAlertStatus.value && a.status !== filterAlertStatus.value) return false
    return true
  })
})

// 定时翻身监控台数据 (4F/3F 特级护理)
const turnSchedule = ref([
  { bed: '401-A', name: '张建国', level: '特级护理', posture: '右侧卧 30°', lastTime: '13:10', nextDue: '00:25 倒计时', isOverdue: false, todayCount: 7, caregiver: '李晓芳 护工' },
  { bed: '402-B', name: '王淑芬', level: '特级护理', posture: '仰卧位', lastTime: '12:05', nextDue: '已超期 12 分钟', isOverdue: true, todayCount: 6, caregiver: '李晓芳 护工' },
  { bed: '405-A', name: '陈文礼', level: '特级护理', posture: '左侧卧 30°', lastTime: '13:30', nextDue: '00:45 倒计时', isOverdue: false, todayCount: 7, caregiver: '王芳 护工主管' },
  { bed: '408-A', name: '钱志成', level: '特级护理', posture: '半坐卧 20°', lastTime: '13:40', nextDue: '00:55 倒计时', isOverdue: false, todayCount: 7, caregiver: '刘建国 护工' },
  { bed: '302-A', name: '周秀英', level: '一级护理', posture: '右侧卧位', lastTime: '12:45', nextDue: '00:05 倒计时', isOverdue: false, todayCount: 6, caregiver: '张晓敏 护工' },
  { bed: '304-B', name: '孙德荣', level: '一级护理', posture: '仰卧位', lastTime: '12:00', nextDue: '已超期 15 分钟', isOverdue: true, todayCount: 5, caregiver: '陈宇 护工' },
])

// 责任护工效能排行榜
const caregiverPerformance = ref([
  { name: '李晓芳', title: '主管护工师 / 4F特级组长', floor: '4F', patientsCount: 6, patrolCount: 28, turnCount: 24, avgResponse: 38, ltcScore: 99.4, satisfaction: 100, grade: 'A+' },
  { name: '王芳', title: '高级护理员 / 4F特级主管', floor: '4F', patientsCount: 5, patrolCount: 26, turnCount: 22, avgResponse: 40, ltcScore: 99.2, satisfaction: 99.5, grade: 'A+' },
  { name: '张晓敏', title: '高级护理员 / 3F失智组长', floor: '3F', patientsCount: 6, patrolCount: 32, turnCount: 18, avgResponse: 44, ltcScore: 98.9, satisfaction: 99.0, grade: 'A' },
  { name: '赵燕', title: '康复照护师 / 2F介护组长', floor: '2F', patientsCount: 6, patrolCount: 24, turnCount: 14, avgResponse: 48, ltcScore: 98.6, satisfaction: 98.8, grade: 'A' },
  { name: '何丽', title: '中级护理员 / 1F慢病组长', floor: '1F', patientsCount: 6, patrolCount: 22, turnCount: 10, avgResponse: 54, ltcScore: 98.0, satisfaction: 98.0, grade: 'A' },
  { name: '陈宇', title: '中级护理员 / 3F专责护工', floor: '3F', patientsCount: 5, patrolCount: 25, turnCount: 16, avgResponse: 46, ltcScore: 98.5, satisfaction: 98.2, grade: 'A' },
  { name: '吴强', title: '中级护理员 / 2F专责护工', floor: '2F', patientsCount: 5, patrolCount: 23, turnCount: 13, avgResponse: 50, ltcScore: 98.2, satisfaction: 98.0, grade: 'A' },
  { name: '宋敏', title: '中级护理员 / 1F专责护工', floor: '1F', patientsCount: 5, patrolCount: 21, turnCount: 9, avgResponse: 52, ltcScore: 97.8, satisfaction: 98.5, grade: 'A' },
  { name: '刘建国', title: '初级护理员 / 4F机动巡防', floor: '4F', patientsCount: 11, patrolCount: 35, turnCount: 15, avgResponse: 42, ltcScore: 98.1, satisfaction: 97.8, grade: 'A' },
  { name: '黄俊杰', title: '主管技师 / 康复理疗专责', floor: '康复中心', patientsCount: 14, patrolCount: 18, turnCount: 0, avgResponse: 35, ltcScore: 99.0, satisfaction: 100, grade: 'A+' },
])

async function loadData() {
  try {
    overview.value = await getOverview()
    await loadPatients()
    const aRes = await getAlerts()
    alerts.value = aRes.list || []
  } catch (err: any) {
    console.error('加载全院数据失败:', err)
  }
}

async function loadPatients() {
  const pRes = await getPatients({ floor: filterFloor.value || undefined })
  patients.value = pRes.list || []
}

function resetFilters() {
  filterFloor.value = ''
  filterCareLevel.value = ''
  filterBedStatus.value = ''
  searchKeyword.value = ''
}

function formatCaregiverName(name?: string): string {
  if (!name) return '责任护工'
  return name.replace('护士', '护工').replace('护师', '护工师')
}

function getCareLevelTagClass(lvl: string) {
  if (lvl === '特级护理') return 'tag-danger'
  if (lvl === '一级护理') return 'tag-warning'
  return 'tag-info'
}

function getLtcTier(p: Patient): string {
  if (p.floor === '4F') return '长护重度Ⅲ级'
  if (p.floor === '3F') return '长护重度Ⅱ级'
  if (p.floor === '2F') return '长护重度Ⅰ级'
  return '长护中度失能'
}

function formatAlertStatus(st: string): string {
  const map: Record<string, string> = {
    triggered: '报警未接单',
    handling: '护工处置中',
    handled: '已处置闭环',
    missed: '未及时到场',
  }
  return map[st] || st
}

function openPatientDetail(p: Patient) {
  selectedPatientModal.value = p
}

function sendTurnReminder(name: string, bed: string, caregiver?: string) {
  const cg = caregiver ? formatCaregiverName(caregiver) : '责任护工'
  showToast(`已向 ${bed} (${name}) 责任人 ${cg} 发送院长防压疮翻身督促调度提醒！`)
}

function reviewAlert(alertId: string) {
  showToast(`院长已审阅并签署告警事件 ${alertId} 质控处理报告，已归档。`)
}

function exportInstitutionalReport() {
  showToast('全院运营与长护险医保结算月度报表已成功生成并导出为 CSV/PDF！')
}

onMounted(() => {
  void loadAccountsTab()
  loadData()
})
</script>

<style scoped>
.workspace-page {
  padding: 24px;
  background: #f8fafc;
  min-height: calc(100vh - 64px);
  color: #1e293b;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.page-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.page-subtitle {
  font-size: 13px;
  color: #64748b;
  margin-top: 6px;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 600;
}

.badge-primary {
  background: #e0f2fe;
  color: #0284c7;
}

.badge-success {
  background: #dcfce7;
  color: #16a34a;
}

.badge-warning {
  background: #fef3c7;
  color: #d97706;
}

.badge-danger {
  background: #fee2e2;
  color: #dc2626;
}

.badge-purple {
  background: #f3e8ff;
  color: #7e22ce;
}

.badge-info {
  background: #f1f5f9;
  color: #475569;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.btn-primary {
  background: #2563eb;
  color: #ffffff;
}

.btn-primary:hover {
  background: #1d4ed8;
}

.btn-outline {
  background: #ffffff;
  border-color: #cbd5e1;
  color: #334155;
}

.btn-outline:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.btn-xs {
  padding: 4px 8px;
  font-size: 11px;
}

.toast-banner {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  color: #065f46;
  padding: 10px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.collapsible-ltc-box {
  background: #ffffff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.box-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 8px;
}

.box-title {
  font-size: 15px;
  font-weight: 700;
  color: #1e40af;
}

.close-btn {
  background: transparent;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #94a3b8;
}

.close-btn:hover {
  color: #0f172a;
}

/* 8 大指标大卡 */
.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 20px;
}

.metric-card {
  background: #ffffff;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.metric-label {
  font-size: 12px;
  color: #64748b;
  font-weight: 600;
}

.metric-tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
}

.metric-num-row {
  margin-top: 8px;
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.metric-num {
  font-size: 26px;
  font-weight: 800;
  color: #0f172a;
}

.metric-sub {
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
}

.metric-foot {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 标签导航栏 */
.tab-nav {
  display: flex;
  gap: 8px;
  border-bottom: 2px solid #e2e8f0;
  margin-bottom: 16px;
}

.tab-btn {
  padding: 10px 16px;
  background: transparent;
  border: none;
  font-size: 14px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.tab-btn.active {
  color: #2563eb;
  border-bottom-color: #2563eb;
  background: #ffffff;
  border-radius: 6px 6px 0 0;
}

.perm-matrix-cell { background: rgba(255,255,255,0.02); }
.group-bar { display: flex; align-items: center; }
.group-chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
.group-chip { border: 1px solid rgba(139,92,246,0.4); border-radius: 8px; padding: 2px 8px; font-size: 12px; }
.chip-act { border: none; background: none; cursor: pointer; color: var(--primary, #6366f1); font-size: 11px; }
.chip-danger { color: #ef4444; }
.group-select { font-size: 12px; padding: 2px 4px; background: transparent; color: inherit; border: 1px solid var(--border, #d0d7de); border-radius: 4px; max-width: 160px; }
.perm-matrix { display: flex; flex-wrap: wrap; gap: 6px; max-width: 960px; }
.perm-chip {
  border: 1px solid var(--border, #d0d7de); border-radius: 999px; padding: 2px 10px;
  font-size: 11px; font-family: monospace; cursor: pointer; background: transparent; color: inherit;
}
.perm-chip.default { opacity: 0.55; }
.perm-chip.granted { background: rgba(34,197,94,0.18); border-color: rgba(34,197,94,0.5); font-weight: 700; }
.perm-chip.revoked { background: rgba(239,68,68,0.15); border-color: rgba(239,68,68,0.5); text-decoration: line-through; opacity: 0.8; }
.content-panel {
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

/* 楼层快捷选择卡 */
.floor-selector-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.floor-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.floor-card:hover {
  border-color: #93c5fd;
  background: #f0f9ff;
}

.floor-card.selected {
  border-color: #2563eb;
  background: #eff6ff;
  box-shadow: 0 0 0 1px #2563eb;
}

.floor-card-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.floor-tag {
  font-weight: 800;
  font-size: 15px;
  color: #1e3a8a;
}

.floor-ward-name {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  flex: 1;
}

.floor-card-metrics {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
}

.fl-label {
  color: #64748b;
  display: block;
}

.fl-val {
  font-weight: 700;
  font-size: 12px;
}

/* 筛选工具栏 */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #475569;
}

.search-input {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  font-size: 13px;
  width: 260px;
}

.select-input {
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  font-size: 13px;
}

/* 数据表格 */
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table th {
  background: #f8fafc;
  color: #475569;
  font-weight: 600;
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid #e2e8f0;
}

.data-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #f1f5f9;
  color: #1e293b;
}

.data-table tr:hover td {
  background: #f8fafc;
}

.tag {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
}

.tag-danger {
  background: #fee2e2;
  color: #dc2626;
}

.tag-warning {
  background: #fef3c7;
  color: #d97706;
}

.tag-success {
  background: #dcfce7;
  color: #16a34a;
}

.tag-info {
  background: #e0f2fe;
  color: #0284c7;
}

.status-pill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
}

.status-success {
  background: #dcfce7;
  color: #16a34a;
}

.status-danger {
  background: #fee2e2;
  color: #dc2626;
}

.status-warning {
  background: #fef3c7;
  color: #d97706;
}

.status-primary {
  background: #e0f2fe;
  color: #0284c7;
}

.risk-pill {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.risk-pressure {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

.risk-wander {
  background: #fffbeb;
  color: #b45309;
  border: 1px solid #fde68a;
}

.risk-normal {
  background: #f8fafc;
  color: #64748b;
  border: 1px solid #e2e8f0;
}

.caregiver-badge {
  font-size: 12px;
  color: #1e3a8a;
}

/* 长护险总览 */
.ltc-kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.ltc-kpi-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
}

.ltc-card-title {
  font-size: 13px;
  color: #64748b;
  font-weight: 600;
}

.ltc-card-num {
  font-size: 24px;
  font-weight: 800;
  margin: 6px 0;
}

.ltc-card-num .unit {
  font-size: 13px;
  font-weight: normal;
  color: #64748b;
}

.ltc-card-desc {
  font-size: 11px;
  color: #94a3b8;
}

/* 结算四步流程流水线 */
.pipeline-card {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 16px;
}

.pipeline-steps {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  overflow-x: auto;
}

.step-box {
  flex: 1;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 12px;
  min-width: 180px;
}

.step-done {
  border-color: #86efac;
  background: #f0fdf4;
}

.step-active {
  border-color: #3b82f6;
  background: #eff6ff;
  box-shadow: 0 0 0 1px #3b82f6;
}

.step-num {
  font-size: 11px;
  font-weight: 800;
  color: #64748b;
}

.step-title {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
  margin: 4px 0;
}

.step-info {
  font-size: 11px;
  color: #475569;
}

.step-status {
  font-size: 11px;
  font-weight: 600;
  margin-top: 6px;
}

.step-arrow {
  color: #94a3b8;
  font-weight: bold;
}

/* 照护安全红线 */
.safety-banner {
  background: #fef2f2;
  border-left: 4px solid #ef4444;
  padding: 12px 16px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.safety-badge {
  background: #dc2626;
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 4px;
  white-space: nowrap;
}

.safety-text {
  font-size: 13px;
  color: #991b1b;
  font-weight: 500;
}

/* 楼层护工网格 */
.floor-nurse-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.nurse-group-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
}

.floor-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.floor-title {
  font-size: 14px;
}

.nurse-names {
  font-size: 13px;
  color: #334155;
  line-height: 1.5;
}

/* 排行榜徽章 */
.rank-badge {
  font-size: 13px;
}

/* 弹窗样式 */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-dialog {
  background: #ffffff;
  width: 640px;
  max-width: 90vw;
  border-radius: 8px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}

.modal-title {
  font-size: 16px;
}

.modal-body {
  padding: 20px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
}

.info-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 12px;
}

.info-title {
  font-size: 13px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 8px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  margin-bottom: 6px;
}

.info-row .lbl {
  color: #64748b;
}

.vitals-realtime-box {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  padding: 12px;
}

.vitals-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.vital-item {
  background: #ffffff;
  padding: 10px;
  border-radius: 4px;
  text-align: center;
}

.v-name {
  font-size: 11px;
  color: #64748b;
  display: block;
}

.v-val {
  font-size: 18px;
  font-weight: 800;
  font-family: monospace;
}

.doctor-notes-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 12px;
}

/* 栅格辅助类 */
.grid-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.grid-3col {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.sub-panel {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
}

.panel-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}

.section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  padding-bottom: 6px;
  border-bottom: 1px dashed #e2e8f0;
}

.stat-name {
  color: #475569;
}

.stat-val {
  font-weight: 600;
}

.sla-overview-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.sla-metric {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 10px 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sla-lbl {
  font-size: 12px;
  color: #64748b;
}

.sla-val {
  font-size: 16px;
  font-weight: 700;
}

/* 工具类 */
.text-warning {
  color: #d97706;
}

.text-danger {
  color: #dc2626;
}

.text-success {
  color: #16a34a;
}

.text-primary {
  color: #2563eb;
}

.text-muted {
  color: #94a3b8;
}

.font-mono {
  font-family: monospace;
}

.font-bold {
  font-weight: 600;
}

.text-xs {
  font-size: 12px;
}

.text-center {
  text-align: center;
}

.cursor-pointer {
  cursor: pointer;
}

.mb-2 {
  margin-bottom: 8px;
}

.mb-3 {
  margin-bottom: 12px;
}

.mb-4 {
  margin-bottom: 16px;
}

.mt-1 {
  margin-top: 4px;
}

.mt-2 {
  margin-top: 8px;
}

.mt-3 {
  margin-top: 12px;
}

.ml-1 {
  margin-left: 4px;
}

.ml-3 {
  margin-left: 12px;
}

.ml-auto {
  margin-left: auto;
}

.py-4 {
  padding-top: 16px;
  padding-bottom: 16px;
}

.pl-2 {
  padding-left: 8px;
}
</style>
