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
            : (orgName || '受托经办机构') + ' · 统筹区全量业务受理、派单回避、物联飞检与结算初审核减'
          }}
        </div>
      </div>
      <div class="header-badges">
        <span class="badge badge-primary">🏢 受托商保资质: 甲级经办</span>
        <span class="badge badge-success">⏱️ 医保委托SLA达标率: {{ dashboardData?.kpis?.sla_compliance_rate || 99.4 }}%</span>
        <span class="badge badge-info">🛡️ 医保政务专网: 实时连通</span>
      </div>
    </div>

    <!-- 统筹区切换（一权限=一工作台，LTC-WORKBENCH-SPEC §12.4.1） -->
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
        <button type="button" class="btn btn-sm btn-outline ml-2" @click="refreshAll" :disabled="loading">
          {{ loading ? '刷新中...' : '🔄 刷新经办数据' }}
        </button>
      </div>
    </div>

    <!-- 顶部核心经办指标看板（队列计数，点击直达对应流程树节点） -->
    <div class="metric-grid">
      <div class="metric-card pointer" @click="gotoStage('today_queue', 'new_applications')">
        <div class="metric-num text-primary">{{ pendingApplications.length }}</div>
        <div class="metric-label">待受理申报 / 待派单</div>
      </div>
      <div class="metric-card pointer" @click="gotoStage('today_queue', 'dispatch_queue')">
        <div class="metric-num">{{ activeTasks.length }}</div>
        <div class="metric-label">执行中失能评估任务</div>
      </div>
      <div class="metric-card pointer" @click="gotoStage('iot_inspection', 'iot_inspections')">
        <div class="metric-num text-danger">
          <span v-if="activeInspectionsCount > 0" class="pulse-dot-red"></span>
          {{ activeInspectionsCount }} 个
        </div>
        <div class="metric-label">物联异常靶向待飞检工单</div>
      </div>
      <div class="metric-card pointer" @click="gotoStage('settlement_audit', 'pending_settlements')">
        <div class="metric-num text-warning">{{ pendingSettlements.length }} 笔</div>
        <div class="metric-label">待经办初审结算单 (第2步)</div>
      </div>
      <div class="metric-card pointer" @click="gotoStage('settlement_audit', 'pending_settlements')">
        <div class="metric-num text-danger">¥{{ ((dashboardData?.kpis?.settlement_deductions_mtd || 48600) / 10000).toFixed(2) }}万</div>
        <div class="metric-label">当月物联核减违规金额</div>
      </div>
      <div class="metric-card pointer">
        <div class="metric-num text-success">
          <span class="pulse-dot"></span>
          {{ selectedPool === 'suqian' ? '3 / 3' : '5 / 5' }} 台
        </div>
        <div class="metric-label">智能物联感知在网终端</div>
      </div>
    </div>

    <!-- SLA 履约倒计时预警（顶栏级常驻，脱离互斥 Tab） -->
    <div v-if="dashboardData?.sla_countdowns?.length" class="sla-grid">
      <div
        v-for="sla in dashboardData.sla_countdowns"
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

    <!-- §12.4 双层结构：左侧两级 SOP 流程树 + 右侧主从三栏办理工作间 -->
    <div class="sop-studio-layout">
      <SopWorkflowTree
        :tree="workflowTree"
        :active-key="activeNodeKey"
        :summary="summary"
        @select="onNodeSelect"
      />

      <div class="sop-studio-main">
        <!-- ===== 申请案卷三栏办理态（受理/派单/补正跟进） ===== -->
        <MasterDetailStudio
          v-if="viewMode === 'detail_studio' && studioKind === 'application' && selectedApp"
          :title="`${selectedApp.applicant_name || selectedApp.applicant_id} 长护险申请案卷`"
          :subtitle="`${selectedApp.application_id} · ${formatAppStatus(selectedApp.status)} · ${formatApplicantOrg(selectedApp)}`"
          @back="closeStudio"
        >
          <template #evidence>
            <div class="dossier-block">
              <div class="dossier-title">🧾 参保申请材料摘要</div>
              <div class="dossier-row"><span>申请人</span><strong>{{ selectedApp.applicant_name || selectedApp.applicant_id }}</strong></div>
              <div class="dossier-row"><span>统筹区</span><strong>{{ selectedApp.applicant_id?.startsWith('P_SQ_') ? '宿迁试点' : '某某市' }}</strong></div>
              <div class="dossier-row"><span>申报等级意向</span><strong class="text-warning">{{ selectedApp.application_level }}</strong></div>
              <div class="dossier-row"><span>ADL自评得分</span><strong>{{ selectedApp.self_assessment_grade || '自评10分' }}</strong></div>
              <div class="dossier-row"><span>送审机构</span><strong>{{ formatApplicantOrg(selectedApp) }}</strong></div>
              <div class="dossier-row"><span>申报提交时间</span><strong>{{ selectedApp.apply_date?.slice(0, 10) || '2026-09-21' }}</strong></div>
            </div>
            <div class="dossier-block">
              <div class="dossier-title">⚖️ 受托经办法定职能定位</div>
              <ul class="dossier-list">
                <li>窗口与前置受理：申请受理、基础信息与病历审查。</li>
                <li>法定回避派工：评估机构与服务机构利益回避，组织双人现场评定。</li>
                <li>最终等级行政核准由医保局作出；经办仅出具初审意见。</li>
              </ul>
            </div>
          </template>

          <template #business>
            <!-- 待派单/待受理 → 法定回避审核与任务派工（原弹窗迁入三栏） -->
            <div v-if="canDispatch(selectedApp)" class="studio-panel">
              <div class="studio-panel-title">⚖️ 失能等级评定法定回避审核与任务派工单</div>

              <div class="panel-alert">
                <strong>法定回避派单门禁准则：</strong>
                系统强制启动“三重回避核验”：① 评估机构与申请人所在服务机构利益关联回避（409强行阻断）；
                ② 评估师近亲属及主诊医生回避；③ 防垄断轮候及重度评定偏离度预警。
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

            <!-- 材料退回 → 补正跟进（只读等待提交方补正） -->
            <div v-else-if="selectedApp.status === 'materials_rejected'" class="studio-panel">
              <div class="studio-panel-title">📥 材料补正跟进（等待提交方补正重提）</div>
              <div class="notice-box">
                申请材料已被退回补正，当前责任方为<strong>提交方（家属/机构代申报）</strong>。
                新版本提交后将进入本队列核验，可查看新旧版本与退回原因。
              </div>
            </div>

            <!-- 评估中/已核准 → 办理进度只读 -->
            <div v-else class="studio-panel">
              <div class="studio-panel-title">📋 申请办理进度</div>
              <div class="notice-box">
                当前阶段: <strong>{{ formatAppStatus(selectedApp.status) }}</strong>；
                评估任务执行中由评定机构双人入户办理，提交后回到经办「待审核」队列。
              </div>
            </div>
          </template>

          <template #telemetry>
            <div class="telemetry-block">
              <div class="telemetry-title">📡 安守护物联遥测感知与工单自动化比对</div>
              <div class="telemetry-stat-row">
                <div class="telemetry-stat">
                  <div class="val">{{ dashboardData?.iot_health?.radar_online_rate || 100 }}%</div>
                  <div class="lbl">毫米波在床/在室雷达在网率</div>
                </div>
                <div class="telemetry-stat">
                  <div class="val">{{ dashboardData?.iot_health?.sensor_mat_vital_rate || 100 }}%</div>
                  <div class="lbl">智能微动体征垫平稳感知率</div>
                </div>
                <div class="telemetry-stat">
                  <div class="val text-danger">{{ dashboardData?.iot_health?.today_detected_anomalies || 2 }} 单</div>
                  <div class="lbl">智能捕获体征异常嫌疑工单</div>
                </div>
              </div>
              <div v-if="selectedApp.application_id === 'APP-MM-202609-001'" class="telemetry-alert">
                ⚠️ 雷达客观活动度与申报等级存在冲突线索，已转入「物联靶向飞检」队列。
              </div>
            </div>
          </template>

          <template #signature>
            <div v-if="canDispatch(selectedApp)" class="signature-grid">
              <div class="text-xs text-muted">
                派工单下发后任务进入评估机构「待接任务」队列，SLA 时限同步启动。
              </div>
              <div class="btn-group">
                <button class="btn btn-primary" :disabled="dispatching" @click="confirmDispatch">
                  {{ dispatching ? '派工中...' : '确认法定回避并下发派工单' }}
                </button>
              </div>
            </div>
            <div v-else class="signature-grid">
              <div class="text-xs text-muted">当前阶段无经办签署动作。</div>
            </div>
          </template>
        </MasterDetailStudio>

        <!-- ===== 结算初审三栏办理态 ===== -->
        <MasterDetailStudio
          v-else-if="viewMode === 'detail_studio' && studioKind === 'settlement' && selectedSettlement"
          :title="`${selectedSettlement.org_name || '定点服务机构'} 月度结算初审案卷（第2步）`"
          :subtitle="`${selectedSettlement.settlement_id} · 结算期 ${selectedSettlement.period} · 申报 ¥${(selectedSettlement.amount || 0).toLocaleString()}`"
          @back="closeStudio"
        >
          <template #evidence>
            <div class="dossier-block">
              <div class="dossier-title">🧾 机构月度申报账册</div>
              <div class="dossier-row"><span>定点服务机构</span><strong>{{ selectedSettlement.org_name || (selectedSettlement.pool_id === 'suqian' ? '宿迁市长护试点照护中心' : '某某市康泰居家照护中心') }}</strong></div>
              <div class="dossier-row"><span>统筹区</span><strong>{{ selectedSettlement.pool_id === 'suqian' ? '宿迁试点' : '某某市' }}</strong></div>
              <div class="dossier-row"><span>结算所属期</span><strong>{{ selectedSettlement.period }}</strong></div>
              <div class="dossier-row"><span>申报总额</span><strong class="text-primary">¥{{ (selectedSettlement.amount || 0).toLocaleString() }}</strong></div>
            </div>
            <div class="dossier-block">
              <div class="dossier-title">📑 结算四步分离规则</div>
              <ul class="dossier-list">
                <li>第1步：定点机构月度申报（declared）。</li>
                <li>第2步：<strong>受托商保经办初审（当前）</strong>：物联对撞核减后出具初审意见书。</li>
                <li>第3步：医保局终审复核。</li>
                <li>第4步：银行划拨结清。</li>
              </ul>
            </div>
          </template>

          <template #business>
            <!-- 待初审 → 物联核减与经办初审（原弹窗迁入） -->
            <div v-if="selectedSettlement.status === 'declared'" class="studio-panel">
              <div class="studio-panel-title">📑 受托商保经办月度结算初审核减签批单 (第2步)</div>

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

            <!-- 已初审 → 意见书归档预览 -->
            <div v-else class="studio-panel">
              <div class="studio-panel-title">📑 受托商保经办月度结算初审意见书（归档）</div>
              <div class="voucher-paper">
                <div class="voucher-header">
                  <div class="voucher-title">长期护理保险受托商保经办月度结算初审意见书</div>
                  <div class="voucher-subtitle">{{ orgName }}长护险经办服务中心</div>
                  <div class="voucher-no">凭证编号: {{ currentVoucher?.voucher_no || 'INSAUDIT-' + selectedSettlement.settlement_id }}</div>
                </div>
                <table class="voucher-table">
                  <tr>
                    <td class="v-label">定点服务机构</td>
                    <td class="v-val">{{ currentVoucher?.org_name || selectedSettlement.org_name }}</td>
                    <td class="v-label">结算所属期</td>
                    <td class="v-val">{{ currentVoucher?.period || selectedSettlement.period }}</td>
                  </tr>
                  <tr>
                    <td class="v-label">机构申报总额</td>
                    <td class="v-val">¥{{ (currentVoucher?.declared_amount ?? selectedSettlement.amount ?? 0).toLocaleString() }}</td>
                    <td class="v-label">经办核减金额</td>
                    <td class="v-val text-danger font-bold">¥{{ (currentVoucher?.deducted_amount || 0).toLocaleString() }}</td>
                  </tr>
                  <tr>
                    <td class="v-label">经办初审通过额</td>
                    <td colspan="3" class="v-val text-primary font-bold">¥{{ (currentVoucher?.passed_amount || 0).toLocaleString() }}</td>
                  </tr>
                  <tr>
                    <td class="v-label">核减原因与依据</td>
                    <td colspan="3" class="v-val text-xs">
                      <div v-for="(r, idx) in (currentVoucher?.deduction_reasons || [])" :key="idx">• {{ r }}</div>
                    </td>
                  </tr>
                  <tr>
                    <td class="v-label">经办初审专员</td>
                    <td class="v-val">{{ currentVoucher?.auditor || '张慧敏 (审核员)' }}</td>
                    <td class="v-label">初审时间</td>
                    <td class="v-val">{{ (currentVoucher?.audited_at || '').slice(0, 16) }}</td>
                  </tr>
                </table>
                <div class="voucher-seal-box">
                  <div class="voucher-seal">
                    <div class="seal-inner">
                      <span>{{ orgName }}</span>
                      <span class="seal-star">★</span>
                      <span>长护经办审核专用章</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template #telemetry>
            <div class="telemetry-block">
              <div class="telemetry-title">📡 物联核减客观依据</div>
              <div class="text-xs text-secondary line-relaxed">
                经办机构受理定点机构申报后，系统自动与在床雷达、体征垫工单数据对撞：
                毫米波雷达「室内空房打卡」、微动体征垫「康复无体动扰动」等客观物联报警线索构成核减依据，
                每一笔核减均可在「物联靶向飞检」交叉印证。
              </div>
              <div class="telemetry-stat-row">
                <div class="telemetry-stat">
                  <div class="val">{{ dashboardData?.iot_health?.today_cross_checked_orders || 48 }} 单</div>
                  <div class="lbl">今日物联与工单对撞核验总量</div>
                </div>
                <div class="telemetry-stat">
                  <div class="val text-danger">¥{{ ((dashboardData?.kpis?.settlement_deductions_mtd || 48600) / 10000).toFixed(2) }}万</div>
                  <div class="lbl">当月物联核减违规金额</div>
                </div>
              </div>
            </div>
          </template>

          <template #signature>
            <div v-if="selectedSettlement.status === 'declared'" class="signature-grid">
              <div class="text-xs text-muted">初审通过后加盖经办电子签章，并提请医保局结算财务科执行终审划拨。</div>
              <div class="btn-group">
                <button class="btn btn-primary" :disabled="preReviewing" @click="confirmPreReview">
                  {{ preReviewing ? '签批中...' : '加盖经办印章并推报医保局终审' }}
                </button>
              </div>
            </div>
            <div v-else class="signature-grid">
              <div class="text-xs text-muted">本结算单已完成经办初审，等待医保局第3步终审复核与第4步划拨。</div>
            </div>
          </template>
        </MasterDetailStudio>

        <!-- ===== 督办协查三栏办理态 ===== -->
        <MasterDetailStudio
          v-else-if="viewMode === 'detail_studio' && studioKind === 'clue' && selectedClue"
          :title="`医保督办函协查案卷（${selectedClue.dispatch_order?.order_no || '某医保长护督字〔2026〕第011号'}）`"
          :subtitle="`${selectedClue.clue_id} · ${selectedClue.status === 'dispatched' ? '待经办现场反馈' : '经办已反馈回执'}`"
          @back="closeStudio"
        >
          <template #evidence>
            <div class="dossier-block">
              <div class="dossier-title">🧾 督办函交办要素</div>
              <div class="dossier-row"><span>涉案对象</span><strong>{{ selectedClue.target_elder || '赵大有' }}</strong></div>
              <div class="dossier-row"><span>涉案机构</span><strong>{{ selectedClue.target_org || '某某市康泰居家照护中心' }}</strong></div>
              <div class="dossier-row"><span>交办下发人</span><strong>{{ selectedClue.dispatch_order?.dispatched_by || 'demo_audit (林志刚 科长)' }}</strong></div>
              <div class="dossier-row"><span>办结时限</span><strong>{{ selectedClue.dispatch_order?.due_hours ? selectedClue.dispatch_order.due_hours + '小时内' : '24小时内' }}</strong></div>
            </div>
            <div class="dossier-block">
              <div class="dossier-title">📌 医保交办要点</div>
              <div class="text-xs text-secondary line-relaxed">
                {{ selectedClue.dispatch_order?.inquiry_points || '核查雷达活动度冲突，入户查验老人自主活动能力，拍摄视频留证。' }}
              </div>
            </div>
          </template>

          <template #business>
            <div class="studio-panel">
              <div class="studio-panel-title">🛡️ 经办协查医保督办函反馈报告书</div>
              <div class="panel-alert">
                <strong>医保行政监督协同联动：</strong>
                经办机构专班组织现场调查取证，录入调查询问笔录与影像，在线向医保局分管领导提交回执。
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
          </template>

          <template #telemetry>
            <div class="telemetry-block">
              <div class="telemetry-title">📡 线索关联物联证据</div>
              <div class="text-xs text-secondary line-relaxed">
                医保局稽核科督办线索源于安守护毫米波雷达活动度与申报失能等级的客观冲突比对；
                协查反馈须引用现场影像与雷达原始遥测双重证据，形成一案一档。
              </div>
            </div>
          </template>

          <template #signature>
            <div class="signature-grid">
              <div class="text-xs text-muted">回执提交后进入医保局「行政终审裁决」队列。</div>
              <div v-if="selectedClue.status === 'dispatched'" class="btn-group">
                <button class="btn btn-primary" :disabled="feedbacking" @click="submitClueFeedback">
                  {{ feedbacking ? '回执中...' : '提交经办协查报告至医保局终审' }}
                </button>
              </div>
            </div>
          </template>
        </MasterDetailStudio>

        <!-- ===== 物联靶向飞检三栏办理态 ===== -->
        <MasterDetailStudio
          v-else-if="viewMode === 'detail_studio' && studioKind === 'inspection' && selectedInspection"
          :title="`物联靶向飞检处置案卷（${selectedInspection.inspection_id}）`"
          :subtitle="`${selectedInspection.title} · ${selectedInspection.status === 'pending_onsite' ? '待突击现场飞检' : '飞检已完成'}`"
          @back="closeStudio"
        >
          <template #evidence>
            <div class="dossier-block">
              <div class="dossier-title">🧾 涉案主体与线索来源</div>
              <div class="dossier-row"><span>涉案主体</span><strong>{{ selectedInspection.target_name }}</strong></div>
              <div class="dossier-row"><span>所属机构</span><strong>{{ selectedInspection.service_org }}</strong></div>
              <div class="dossier-row"><span>服务长者</span><strong>{{ selectedInspection.service_elder }}</strong></div>
              <div class="dossier-row"><span>长者地址</span><strong class="text-xs">{{ selectedInspection.elder_address }}</strong></div>
              <div class="dossier-row"><span>监测物联</span><strong class="font-mono text-xs">{{ selectedInspection.device_sn }}</strong></div>
              <div class="dossier-row"><span>线索来源</span><strong>{{ selectedInspection.source }}</strong></div>
            </div>
            <div v-if="selectedInspection.status === 'onsite_completed'" class="dossier-block">
              <div class="dossier-title">✓ 现场飞检处置结论</div>
              <div class="text-xs"><strong class="text-success">{{ selectedInspection.conclusion_label }}</strong></div>
              <div class="text-xs text-muted mt-1">查验人: {{ selectedInspection.inspector_name }}（{{ selectedInspection.inspected_at?.slice(0, 16) }}）</div>
            </div>
          </template>

          <template #business>
            <div class="studio-panel">
              <div class="studio-panel-title">🔍 经办现场突击飞检处置单</div>
              <div class="panel-alert">
                <strong>物联赋能靶向飞检：</strong>
                根据安守护毫米波雷达“室内空房打卡”、微动体征垫“康复无体动扰动”等客观物联报警线索，
                突击入户查实并固定证据。
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
          </template>

          <template #telemetry>
            <div class="telemetry-block">
              <div class="telemetry-title">📡 物联客观异常描述</div>
              <div class="telemetry-alert">{{ selectedInspection.anomaly_desc }}</div>
              <div class="text-xs text-muted mt-1">下发时间: {{ selectedInspection.created_at?.slice(0, 16) }} · 限时至: {{ selectedInspection.due_at?.slice(0, 16) }}</div>
            </div>
          </template>

          <template #signature>
            <div class="signature-grid">
              <div class="text-xs text-muted">提交后关联违规工单自动冻结核减。</div>
              <div v-if="selectedInspection.status === 'pending_onsite'" class="btn-group">
                <button class="btn btn-primary" :disabled="inspecting" @click="submitInspectionRecord">
                  {{ inspecting ? '提交中...' : '提交飞检结论并锁定违规工单' }}
                </button>
              </div>
            </div>
          </template>
        </MasterDetailStudio>

        <!-- ===== 案卷队列态（Master List View） ===== -->
        <MasterQueueList
          v-else
          :title="activeNodeTitle"
          :cards="stageQueue"
          :loading="loading"
          :empty-text="`当前队列暂无案卷（${activeNodeTitle}）`"
          @open="openStudio"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import SopWorkflowTree from '../../../features/ltc-workbench/components/SopWorkflowTree.vue'
import MasterQueueList from '../../../features/ltc-workbench/components/MasterQueueList.vue'
import MasterDetailStudio from '../../../features/ltc-workbench/components/MasterDetailStudio.vue'
import { useOrgIdentity } from '../../../features/ltc-workbench/org-identity'
import { getWorkbenchWorkflowTree, getWorkbenchSummary, type WorkbenchWorkflowTree, type WorkbenchSummary } from '../../../api/ltc-workbench'
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
} from '../../../api/client'
import type {
  LtcApplication,
  AssessmentTask,
  Settlement,
  SupervisionClue,
} from '../../../api/types'
import type { MasterQueueCard } from '../../../types/workbench-ia'
import { getSession } from '../../../api/http'

const { orgName } = useOrgIdentity()
const session = getSession()
const currentUserPool = ref<'all' | 'suqian' | 'moumou'>(
  session?.principal?.pool_id === 'suqian' ? 'suqian' : 'moumou'
)
const selectedPool = ref<'moumou' | 'suqian'>(
  currentUserPool.value === 'suqian' ? 'suqian' : 'moumou'
)

const loading = ref(false)

const dashboardData = ref<InsurerDashboardData | null>(null)
const applications = ref<LtcApplication[]>([])
const tasks = ref<AssessmentTask[]>([])
const settlements = ref<Settlement[]>([])
const inspections = ref<InsurerInspectionTask[]>([])
const supervisionClues = ref<SupervisionClue[]>([])

// §12.4 SOP 流程树与主从工作间状态
const workflowTree = ref<WorkbenchWorkflowTree | null>(null)
const summary = ref<WorkbenchSummary | null>(null)
const activeGroupKey = ref<string>('')
const activeStageKey = ref<string>('')
const activeNodeTitle = ref<string>('今日必办')
const viewMode = ref<'master_list' | 'detail_studio'>('master_list')
const studioKind = ref<'application' | 'settlement' | 'clue' | 'inspection'>('application')

// 案卷选中对象
const selectedApp = ref<LtcApplication | null>(null)
const selectedSettlement = ref<Settlement | null>(null)
const currentVoucher = ref<any>(null)
const selectedClue = ref<SupervisionClue | null>(null)
const selectedInspection = ref<InsurerInspectionTask | null>(null)

// 表单状态
const selectedAssessorAccount = ref('zhouhaifeng')
const dispatching = ref(false)

const inspecting = ref(false)
const inspectionForm = ref({
  notes: '',
  conclusion: 'confirmed_fraud',
})

const preReviewing = ref(false)
const preReviewForm = ref({
  deduct1: true,
  deduct2: false,
  amount: 4800,
  note: '经办初审比对安守护物联数据，核减隔空虚假打卡违规工单 4,800 元，通过初审提请医保终审。',
})

const feedbacking = ref(false)
const feedbackForm = ref({
  notes: '经办联合调查专班入户突击走访，老人活动如常，承认家属听信中介夸大自评以谋求待遇补贴。已录制现场走访视频。',
  preAdvisory: 'suggest_deduct',
})

const activeNodeKey = computed(() => `${activeGroupKey.value}::${activeStageKey.value}`)

// 筛选后数据
const filteredApplications = computed(() => {
  if (selectedPool.value === 'suqian') {
    return applications.value.filter((a: LtcApplication) => a.applicant_id?.startsWith('P_SQ_'))
  }
  return applications.value.filter((a: LtcApplication) => !a.applicant_id?.startsWith('P_SQ_'))
})

const filteredSettlements = computed(() => {
  return settlements.value.filter((s: Settlement) => s.pool_id === selectedPool.value)
})

const filteredInspections = computed(() => {
  return inspections.value.filter((i: InsurerInspectionTask) => i.pool_id === selectedPool.value)
})

const pendingApplications = computed(() => {
  return filteredApplications.value.filter((a: LtcApplication) => ['submitted', 'materials_review'].includes(a.status))
})

const activeTasks = computed(() => {
  return tasks.value.filter((t: AssessmentTask) => ['assigned', 'assessing'].includes(t.status))
})

const pendingSettlements = computed(() => {
  return filteredSettlements.value.filter((s: Settlement) => s.status === 'declared')
})

const activeInspectionsCount = computed(() => {
  return filteredInspections.value.filter((i: InsurerInspectionTask) => i.status === 'pending_onsite').length
})

// 队列卡片：按流程树节点派生
const stageQueue = computed<MasterQueueCard[]>(() => {
  switch (activeStageKey.value) {
    case 'new_applications':
      return filteredApplications.value
        .filter((a) => a.status === 'submitted')
        .map(appCard)
    case 'dispatch_queue':
      return filteredApplications.value
        .filter((a) => ['materials_review', 'materials_pass', 'assess_pending'].includes(a.status))
        .map(appCard)
    case 'materials_follow':
      return filteredApplications.value
        .filter((a) => a.status === 'materials_rejected')
        .map(appCard)
    case 'pending_settlements':
      return filteredSettlements.value
        .filter((s) => s.status === 'declared')
        .map(settlementCard)
    case 'voucher_archive':
      return filteredSettlements.value
        .filter((s) => s.status !== 'declared' || s.pre_review_voucher)
        .map(settlementCard)
    case 'clue_feedback':
      return supervisionClues.value.map(clueCard)
    case 'iot_inspections':
      return filteredInspections.value.map(inspectionCard)
    default:
      return []
  }
})

function appCard(a: LtcApplication): MasterQueueCard {
  return {
    id: a.application_id,
    title: a.applicant_name || a.applicant_id,
    subtitle: `${a.application_id} · ${formatApplicantOrg(a)}`,
    statusLabel: formatAppStatus(a.status),
    statusTone: a.status === 'submitted' ? 'warning' : (a.status === 'materials_rejected' ? 'danger' : 'success'),
    meta: [
      a.applicant_id?.startsWith('P_SQ_') ? '宿迁试点' : '某某市',
      `申报 ${a.application_level}`,
      ...(a.application_id === 'APP-MM-202609-001' ? ['⚠️ 雷达冲突'] : []),
    ],
    dueLabel: a.apply_date ? `提交于 ${a.apply_date.slice(0, 10)}` : undefined,
  }
}

function settlementCard(s: Settlement): MasterQueueCard {
  const stepLabel = s.status === 'declared' ? '第1步·待经办初审'
    : s.status === 'pre_reviewed' ? '第2步·待医保复核'
    : s.status === 're_reviewed' ? '第3步·待划拨'
    : '第4步·已划拨结清'
  return {
    id: s.settlement_id,
    title: s.org_name || (s.pool_id === 'suqian' ? '宿迁市长护试点照护中心' : '某某市康泰居家照护中心'),
    subtitle: `${s.settlement_id} · 结算期 ${s.period}`,
    statusLabel: stepLabel,
    statusTone: s.status === 'declared' ? 'warning' : 'success',
    meta: [`申报 ¥${(s.amount || 0).toLocaleString()}`, s.pool_id === 'suqian' ? '宿迁试点' : '某某市'],
  }
}

function clueCard(c: SupervisionClue): MasterQueueCard {
  return {
    id: c.clue_id,
    title: `督办协查 · ${c.target_elder || '赵大有'}`,
    subtitle: `${c.clue_id} · ${c.dispatch_order?.order_no || '某医保长护督字〔2026〕第011号'}`,
    statusLabel: c.status === 'dispatched' ? '待经办现场反馈' : '经办已反馈回执',
    statusTone: c.status === 'dispatched' ? 'warning' : 'success',
    meta: [c.target_org || '某某市康泰居家照护中心', c.dispatch_order?.due_hours ? `${c.dispatch_order.due_hours}小时内` : '24小时内'],
  }
}

function inspectionCard(i: InsurerInspectionTask): MasterQueueCard {
  return {
    id: i.inspection_id,
    title: i.title,
    subtitle: `${i.inspection_id} · ${i.target_name}（${i.service_org}）`,
    statusLabel: i.status === 'pending_onsite' ? '待突击现场飞检' : '飞检已完成',
    statusTone: i.status === 'pending_onsite' ? (i.risk_level === 'critical' ? 'danger' : 'warning') : 'success',
    meta: [`物联 ${i.device_sn}`, i.risk_level === 'critical' ? '🚨 重大疑点' : (i.risk_level === 'high' ? '⚠️ 高风险预警' : '🟢 常规巡检')],
    dueLabel: i.due_at ? `限时至 ${i.due_at.slice(0, 16)}` : undefined,
  }
}

function selectPool(pool: 'moumou' | 'suqian') {
  selectedPool.value = pool
  closeStudio()
  refreshAll()
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

function canDispatch(app: LtcApplication) {
  return ['submitted', 'materials_review', 'materials_pass', 'assess_pending'].includes(app.status)
}

// 流程树节点选择与案卷打开
function onNodeSelect(groupKey: string, item: { stageKey: string; label: string }) {
  activeGroupKey.value = groupKey
  activeStageKey.value = item.stageKey
  activeNodeTitle.value = item.label
  viewMode.value = 'master_list'
  resetStudioSelection()
}

function gotoStage(groupKey: string, stageKey: string) {
  onNodeSelect(groupKey, { stageKey, label: stageTitleOf(stageKey) })
}

function stageTitleOf(stageKey: string): string {
  const map: Record<string, string> = {
    new_applications: '参保资格初验待办',
    dispatch_queue: '评估机构回避派单',
    materials_follow: '补正跟进队列',
    pending_settlements: '机构月度申报待初审',
    voucher_archive: '初审意见书档案',
    clue_feedback: '督办线索协查回执',
    iot_inspections: '物联异常靶向飞检工单',
  }
  return map[stageKey] || stageKey
}

function resetStudioSelection() {
  selectedApp.value = null
  selectedSettlement.value = null
  selectedClue.value = null
  selectedInspection.value = null
  currentVoucher.value = null
}

function closeStudio() {
  viewMode.value = 'master_list'
  resetStudioSelection()
}

function openStudio(card: MasterQueueCard) {
  resetStudioSelection()
  const appId = card.id
  const app = applications.value.find((a) => a.application_id === appId)
  if (app) {
    studioKind.value = 'application'
    selectedApp.value = app
    viewMode.value = 'detail_studio'
    return
  }
  const settlement = settlements.value.find((s) => s.settlement_id === appId)
  if (settlement) {
    studioKind.value = 'settlement'
    selectedSettlement.value = settlement
    if (settlement.status !== 'declared' || settlement.pre_review_voucher) {
      currentVoucher.value = settlement.pre_review_voucher || buildVoucherFallback(settlement)
    }
    viewMode.value = 'detail_studio'
    return
  }
  const clue = supervisionClues.value.find((c) => c.clue_id === appId)
  if (clue) {
    studioKind.value = 'clue'
    selectedClue.value = clue
    feedbackForm.value.notes = clue.feedback?.interview_notes || '经办联合调查专班入户突击走访，老人活动如常，承认家属听信中介夸大自评以谋求待遇补贴。已录制现场走访视频。'
    feedbackForm.value.preAdvisory = clue.feedback?.pre_advisory || 'suggest_deduct'
    viewMode.value = 'detail_studio'
    return
  }
  const insp = inspections.value.find((i) => i.inspection_id === appId)
  if (insp) {
    studioKind.value = 'inspection'
    selectedInspection.value = insp
    inspectionForm.value.notes = insp.onsite_notes || '经办巡查主管李勇突击上门现场调查询问，长者证实该时段助老员未入户，雷达空房属实。'
    inspectionForm.value.conclusion = insp.conclusion || 'confirmed_fraud'
    viewMode.value = 'detail_studio'
  }
}

function buildVoucherFallback(s: Settlement) {
  return {
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
}

// 业务动作
async function confirmDispatch() {
  if (!selectedApp.value) return
  dispatching.value = true
  try {
    await dispatchAssessmentTask({
      application_id: selectedApp.value.application_id,
      assessor_account: selectedAssessorAccount.value,
    })
    alert('✓ 法定回避门禁核验通过！评估任务派工单已下发至评估所。')
    await refreshAll()
  } catch (err: any) {
    alert('派单失败: ' + (err.message || '回避门禁阻断'))
  } finally {
    dispatching.value = false
  }
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
    await refreshAll()
  } catch (err: any) {
    alert('提交失败: ' + err.message)
  } finally {
    inspecting.value = false
  }
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
    await refreshAll()
  } catch (err: any) {
    alert('初审提交失败: ' + err.message)
  } finally {
    preReviewing.value = false
  }
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
    const [dash, appsRes, tasksRes, setsRes, inspsRes, cluesRes, tree, sum] = await Promise.all([
      getInsurerDashboard({ pool_id: selectedPool.value }).catch(() => null),
      getLtcApplications().catch(() => ({ list: [], total: 0 })),
      getAssessmentTasks().catch(() => ({ list: [], total: 0 })),
      getSettlements().catch(() => ({ list: [], total: 0 })),
      getInsurerInspections({ pool_id: selectedPool.value }).catch(() => ({ list: [], total: 0 })),
      getSupervisionClues({ pool_id: selectedPool.value }).catch(() => ({ list: [], total: 0 })),
      getWorkbenchWorkflowTree().catch(() => null),
      getWorkbenchSummary().catch(() => null),
    ])

    dashboardData.value = dash
    applications.value = appsRes.list || []
    tasks.value = tasksRes.list || []
    settlements.value = setsRes.list || []
    inspections.value = inspsRes.list || []
    supervisionClues.value = cluesRes.list || []
    workflowTree.value = tree
    summary.value = sum

    if (tree && !activeStageKey.value && tree.groups.length > 0) {
      const g = tree.groups[0]
      if (g.items.length > 0) {
        activeGroupKey.value = g.groupKey
        activeStageKey.value = g.items[0].stageKey
        activeNodeTitle.value = g.items[0].label
      }
    }

    // 详情态数据原位刷新（状态流转后保持案卷上下文）
    if (viewMode.value === 'detail_studio') {
      if (studioKind.value === 'application' && selectedApp.value) {
        const updated = applications.value.find((a) => a.application_id === selectedApp.value!.application_id)
        if (updated) selectedApp.value = updated
        else closeStudio()
      } else if (studioKind.value === 'settlement' && selectedSettlement.value) {
        const updated = settlements.value.find((s) => s.settlement_id === selectedSettlement.value!.settlement_id)
        if (updated) {
          selectedSettlement.value = updated
          if (updated.pre_review_voucher) currentVoucher.value = updated.pre_review_voucher
        } else closeStudio()
      } else if (studioKind.value === 'clue' && selectedClue.value) {
        const updated = supervisionClues.value.find((c) => c.clue_id === selectedClue.value!.clue_id)
        if (updated) selectedClue.value = updated
        else closeStudio()
      } else if (studioKind.value === 'inspection' && selectedInspection.value) {
        const updated = inspections.value.find((i) => i.inspection_id === selectedInspection.value!.inspection_id)
        if (updated) selectedInspection.value = updated
        else closeStudio()
      }
    }
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

.pool-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  background: #f8fafc;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
  margin-bottom: 1rem;
}

.pool-selector {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.pool-btn {
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
.pool-btn:hover {
  background: #f1f5f9;
}
.pool-btn.active {
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
  margin-bottom: 1rem;
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

/* SLA 常驻倒计时 */
.sla-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.sla-card {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 0.375rem;
  padding: 0.75rem 0.85rem;
}
.sla-danger { border-left: 4px solid #ef4444; background: #fff5f5; }
.sla-warning { border-left: 4px solid #f59e0b; background: #fffbeb; }
.sla-normal { border-left: 4px solid #10b981; background: #f0fdf4; }
.sla-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.35rem;
}

/* §12.4 布局 */
.sop-studio-layout {
  display: flex;
  gap: 1rem;
  align-items: stretch;
  min-height: 480px;
}
.sop-studio-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

/* 三栏内容块 */
.studio-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.studio-panel-title {
  font-size: 0.95rem;
  font-weight: 800;
  color: #166534;
}
.dossier-block {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 0.75rem 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.dossier-title {
  font-size: 0.75rem;
  font-weight: 800;
  color: #075985;
}
.dossier-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.6rem;
  font-size: 0.78rem;
  color: #334155;
}
.dossier-row span {
  color: #94a3b8;
  flex-shrink: 0;
  font-size: 0.72rem;
}
.dossier-list {
  margin: 0;
  padding-left: 1.1rem;
  font-size: 0.75rem;
  color: #475569;
  line-height: 1.7;
}
.telemetry-block {
  background: #faf5ff;
  border: 1px solid #e9d5ff;
  border-radius: 0.5rem;
  padding: 0.75rem 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.telemetry-title {
  font-size: 0.75rem;
  font-weight: 800;
  color: #6d28d9;
}
.telemetry-stat-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.4rem;
}
.telemetry-stat {
  background: #ffffff;
  border-radius: 0.375rem;
  padding: 0.5rem;
  text-align: center;
}
.telemetry-stat .val {
  font-size: 1rem;
  font-weight: 800;
  color: #0f172a;
}
.telemetry-stat .lbl {
  font-size: 0.65rem;
  color: #64748b;
  margin-top: 2px;
}
.telemetry-alert {
  background: #fef2f2;
  border: 1px dashed #fca5a5;
  border-radius: 0.375rem;
  padding: 0.5rem 0.65rem;
  font-size: 0.75rem;
  color: #991b1b;
}
.signature-grid {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}
.line-relaxed { line-height: 1.7; }

/* 提示与表单 */
.panel-alert {
  background: #eff6ff;
  border-left: 4px solid #3b82f6;
  padding: 0.75rem 1rem;
  font-size: 0.825rem;
  color: #1e3a8a;
  border-radius: 0 0.375rem 0.375rem 0;
}
.notice-box {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.825rem;
  color: #1e40af;
  line-height: 1.7;
}
.avoidance-checklist, .deduction-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  padding: 0.75rem;
}
.check-item {
  display: flex;
  gap: 0.4rem;
  margin-bottom: 0.3rem;
  line-height: 1.6;
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

/* 官方凭证纸质质感 */
.voucher-paper {
  background: #fffdfa;
  padding: 1.5rem;
  border: 1px solid #e2e8f0;
  position: relative;
}
.voucher-header {
  text-align: center;
  border-bottom: 2px solid #b91c1c;
  padding-bottom: 0.75rem;
  margin-bottom: 1rem;
}
.voucher-title {
  font-size: 1.1rem;
  font-weight: 800;
  color: #991b1b;
  letter-spacing: 0.05em;
}
.voucher-subtitle {
  font-size: 0.8rem;
  color: #475569;
  margin-top: 0.25rem;
}
.voucher-no {
  font-size: 0.7rem;
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
  padding: 0.5rem 0.7rem;
  font-size: 0.78rem;
}
.v-label {
  background: #f1f5f9;
  font-weight: 700;
  width: 22%;
  color: #334155;
}
.voucher-seal-box {
  position: absolute;
  right: 2rem;
  bottom: 1.5rem;
  pointer-events: none;
}
.voucher-seal {
  width: 120px;
  height: 120px;
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
.btn-outline { background: white; border: 1px solid #cbd5e1; color: #334155; }
.btn-outline:hover { background: #f8fafc; }
.btn-sm { padding: 0.25rem 0.5rem; font-size: 0.725rem; }
.btn-group {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.tag {
  display: inline-block;
  padding: 0.15rem 0.4rem;
  border-radius: 0.25rem;
  font-size: 0.7rem;
  font-weight: 600;
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

.text-primary { color: #0284c7; }
.text-success { color: #16a34a; }
.text-warning { color: #d97706; }
.text-danger { color: #dc2626; }
.text-muted { color: #94a3b8; }
.text-secondary { color: #475569; }
.text-xs { font-size: 0.75rem; }
.text-sm { font-size: 0.825rem; }
.font-mono { font-family: ui-monospace, monospace; }
.font-bold { font-weight: 700; }
.pointer { cursor: pointer; }
.ml-2 { margin-left: 0.5rem; }
.mt-1 { margin-top: 0.25rem; }
.mb-1 { margin-bottom: 0.25rem; }
.mb-2 { margin-bottom: 0.5rem; }
.mb-3 { margin-bottom: 0.75rem; }

@media (max-width: 1280px) {
  .telemetry-stat-row {
    grid-template-columns: 1fr;
  }
}
</style>
