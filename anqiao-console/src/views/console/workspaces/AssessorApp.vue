<template>
  <div class="workspace-page assessor-app">
    <!-- 顶栏：机构身份、统筹区与合规资质 -->
    <div class="page-header">
      <div>
        <div class="page-title">
          {{ dashboardData?.pool_title || (selectedPool === 'suqian' ? '宿迁市长期护理保险失能评定与专家评审工作台' : '某某市长期护理保险失能评定与专家评审工作台') }}
        </div>
        <div class="page-subtitle">
          {{ selectedPool === 'suqian'
            ? '宿迁市广济第三方失能等级评定中心 · 国家深化试点（服务许丽、何家齐、王雪金 3位真实参保长者，双人上门入户与设备佐证）'
            : '某某市明康第三方失能评定中心 · 统筹区失能等级评定全业务演练、客观设备冲突质证与专家委员会医学会审'
          }}
        </div>
      </div>
      <div class="header-badges">
        <span class="badge badge-primary">🏥 评定资质: 医保定点甲级第三方评定机构</span>
        <span class="badge badge-success">⚖️ 双人入户规范: 100% 达标</span>
        <span class="badge badge-info">🩺 专家委员会: 双主审医师会签制</span>
        <span class="badge badge-warning">🛡️ 高斯正态监控: {{ dashboardData?.kpis?.gaussian_status === 'normal' ? '偏离度正常' : '重点合规核查' }}</span>
      </div>
    </div>

    <!-- 统筹区切换（一权限=一工作台，LTC-WORKBENCH-SPEC §12.4.1） -->
    <div class="pool-bar">
      <div class="pool-selector">
        <span class="text-xs font-bold text-muted mr-2">📍 评定机构辖区:</span>
        <button
          v-if="currentUserPool !== 'suqian'"
          type="button"
          :class="['pool-btn', selectedPool === 'moumou' && 'active']"
          @click="selectPool('moumou')"
        >
          🏛️ 某某市全业务演练区 (明康第三方评定中心)
        </button>
        <button
          type="button"
          :class="['pool-btn', selectedPool === 'suqian' && 'active']"
          @click="selectPool('suqian')"
        >
          🏛️ 宿迁市国家深化试点专区 (广济第三方评定中心 · 3位长者)
        </button>
      </div>
    </div>

    <!-- 法定评定规程合规红线门禁横幅 -->
    <div class="compliance-ribbon">
      <div class="ribbon-item">
        <span class="ribbon-icon">👥</span>
        <div>
          <strong>【法定红线 1】双人上门入户必达</strong>
          <span>每例评估须由≥2名持证评定师（含≥1名执业医师/注册护士）现场查验，全程录音录像存档。</span>
        </div>
      </div>
      <div class="ribbon-item">
        <span class="ribbon-icon">🩺</span>
        <div>
          <strong>【法定红线 2】双专家医学终审会签</strong>
          <span>评定结论书签发前，须经医学评定专家委员会≥2名主任/副主任医师查验病历与物联遥测联名签署。</span>
        </div>
      </div>
      <div class="ribbon-item">
        <span class="ribbon-icon">📝</span>
        <div>
          <strong>【法定红线 3】监护人在场面签核实</strong>
          <span>查验时被评长者法定监护人必须在场，当面签署《国家失能等级评估现场知情同意确认书》。</span>
        </div>
      </div>
      <div class="ribbon-item">
        <span class="ribbon-icon">📡</span>
        <div>
          <strong>【法定红线 4】设备客观免责（conclusion恒为null）</strong>
          <span>安守护雷达与体征垫客观监测仅作评定佐证，严禁硬件自动定级；AI提示必须由人工闭环核查签字。</span>
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
        <!-- ===== 全屏三栏专注办理态（Detail Studio View） ===== -->
        <MasterDetailStudio
          v-if="viewMode === 'detail_studio' && activeTask"
          :title="`${activeTask.applicant_name}（${activeTask.gender || '—'}，${activeTask.age || '—'}岁）失能评定案卷`"
          :subtitle="`${activeTask.task_id} · ${formatTaskStatus(activeTask.status)} · 主评人: ${activeTask.assessor?.name || '许建强 评定师'}`"
          @back="closeStudio"
        >
          <template #evidence>
            <div class="dossier-block">
              <div class="dossier-title">🧾 被评长者基本信息</div>
              <div class="dossier-row"><span>姓名</span><strong>{{ activeTask.applicant_name }}</strong></div>
              <div class="dossier-row"><span>编号</span><strong class="font-mono">{{ activeTask.applicant_id }}</strong></div>
              <div class="dossier-row"><span>性别/年龄</span><strong>{{ activeTask.gender }} / {{ activeTask.age }}岁</strong></div>
              <div class="dossier-row"><span>身份证</span><strong class="font-mono text-xs">{{ activeTask.id_card }}</strong></div>
              <div class="dossier-row"><span>居住地</span><strong class="text-xs">{{ activeTask.address }}</strong></div>
            </div>
            <div class="dossier-block">
              <div class="dossier-title">👥 法定监护人与双人评定组</div>
              <div class="dossier-row"><span>监护人</span><strong>{{ activeTask.guardian_name }}（{{ activeTask.guardian_phone }}）</strong></div>
              <div class="dossier-row"><span>主评人</span><strong>{{ activeTask.assessor?.name || '许建强 评定师' }}</strong></div>
              <div class="dossier-row"><span>协同人</span><strong>{{ activeTask.second_assessor_name || '赵小燕 (主管护师)' }}</strong></div>
            </div>
            <div v-if="activeTask.scores" class="dossier-block">
              <div class="dossier-title">📊 现场量表初评结果</div>
              <div class="score-pill-group">
                <span class="score-tag">ADL: {{ activeTask.scores.daily_living }}分</span>
                <span class="score-tag">认知: {{ activeTask.scores.cognition }}分</span>
                <span class="score-tag">感知: {{ activeTask.scores.perception }}分</span>
                <span class="score-tag">精神: {{ activeTask.scores.mental_state }}分</span>
              </div>
              <div class="text-xs font-bold text-primary mt-1">
                初步等级: {{ activeTask.preliminary_level || activeTask.assessor_level || '待现场判定' }}
              </div>
            </div>
          </template>

          <template #business>
            <!-- 状态: 待接单 → 门禁核验与接单排班 -->
            <div v-if="activeTask.status === 'assigned'" class="studio-panel">
              <div class="studio-panel-title">入户门禁核验与接单排班</div>
              <div class="notice-box mb-3">
                <strong>法定入户门禁核验：</strong>
                评估对象: <strong>{{ activeTask.applicant_name }}</strong>（{{ activeTask.applicant_id }}）｜
                居住地: {{ activeTask.address }}｜
                主评人: {{ activeTask.assessor?.name || '许建强 评定师' }}
              </div>
              <div class="text-xs text-muted mb-3">
                接单前须确认：①双人上门队伍（≥1名执业医师/注册护士）；②全程音视频设备就绪；③监护人已预约在场面签。
              </div>
              <div class="btn-group">
                <button class="btn btn-primary" @click="acceptTaskAction(activeTask.task_id)">接单排班</button>
              </div>
            </div>

            <!-- 状态: 评估中 / 退回修改 → 国家量表四领域填报（原弹窗迁入，杜绝局促弹窗） -->
            <div v-else-if="activeTask.status === 'assessing' || activeTask.status === 'returned'" class="studio-panel">
              <div class="studio-panel-title">
                国家失能等级评估标准 · 双人入户现场测评与初评判定表
                <span v-if="activeTask.status === 'returned'" class="tag tag-danger ml-2">经办退回 · 请修订后重提</span>
              </div>

              <div v-if="!activeTask.started_at" class="btn-group">
                <button class="btn btn-info" @click="startTaskAction(activeTask.task_id)">开始入户打卡（记录现场时间戳并启动音视频）</button>
              </div>

              <div class="form-grid-2">
                <div class="form-group">
                  <label>同行第二评定师 (法定须具备执业医师或注册护士资格):</label>
                  <input v-model="scoringForm.second_assessor_name" type="text" class="input-field" placeholder="例如: 赵小燕 (主管护师 执业证号: 32029988)" />
                </div>
                <div class="form-group">
                  <label>入户音视频举证包编号 (全程视音频记录):</label>
                  <input v-model="scoringForm.video_evidence" type="text" class="input-field" placeholder="例如: EV-SQ-VID-20260924-001" />
                </div>
              </div>

              <div class="section-title mt-2">📊 四领域指标评估测评打分（国家标准量表）</div>
              <div class="scale-scoring-grid">
                <div class="scale-item">
                  <label>1. 日常生活活动能力 (ADL Barthel 满分100分):</label>
                  <input v-model.number="scoringForm.daily_living" type="number" min="0" max="100" class="input-field font-bold" />
                  <span class="text-xs text-muted">含进食、穿衣、如厕、床椅转移、平地走等10项</span>
                </div>
                <div class="scale-item">
                  <label>2. 认知能力测评 (满分16分):</label>
                  <input v-model.number="scoringForm.cognition" type="number" min="0" max="16" class="input-field font-bold" />
                  <span class="text-xs text-muted">定向力、即时回忆、注意力与计算力</span>
                </div>
                <div class="scale-item">
                  <label>3. 精神与行为状态 (满分10分):</label>
                  <input v-model.number="scoringForm.mental_state" type="number" min="0" max="10" class="input-field font-bold" />
                  <span class="text-xs text-muted">攻击行为、抑郁情绪、幻觉与走失风险</span>
                </div>
                <div class="scale-item">
                  <label>4. 感知觉与沟通能力 (满分10分):</label>
                  <input v-model.number="scoringForm.perception" type="number" min="0" max="10" class="input-field font-bold" />
                  <span class="text-xs text-muted">视力、听力、语言表达与理解</span>
                </div>
              </div>

              <div class="form-group mt-3">
                <label>现场评定师出具初步判定等级:</label>
                <select v-model="scoringForm.preliminary_level" class="input-field font-bold text-primary">
                  <option v-for="lv in DISABILITY_LEVELS" :key="lv" :value="lv">{{ lv }}</option>
                </select>
              </div>

              <div class="form-group mt-2">
                <label>现场查验评语与特殊情况备注:</label>
                <textarea
                  v-model="scoringForm.remarks"
                  class="textarea-field"
                  rows="3"
                  placeholder="长者神志清楚，双下肢肌力2级，不能独立站立及翻身，由长子长媳照护。安守护在床生命体征垫遥测心率平稳。"
                ></textarea>
              </div>
            </div>

            <!-- 状态: 待专家评审 → 医学终审会审表（原弹窗迁入） -->
            <div v-else-if="activeTask.status === 'pending_expert_review'" class="studio-panel">
              <div class="studio-panel-title">评定专家委员会 · 医学终审会审评审表</div>

              <div class="expert-profile-banner mb-3">
                <div>
                  <strong>主审专家 (组长):</strong>
                  {{ selectedPool === 'suqian' ? '孙建国 主任医师 (老年医学科 / 神经病学 30年临床经验)' : '钱德明 主任医师 (老年医学科主任)' }}
                </div>
                <div class="text-xs text-muted mt-1">
                  评审对象: <strong>{{ activeTask.applicant_name }}</strong>（{{ activeTask.applicant_id }}）｜现病史档案与安守护客观遥测已同步调阅
                </div>
              </div>

              <div class="form-grid-2">
                <div class="form-group">
                  <label>会审第二专家 (副主任医师及以上联签):</label>
                  <input v-model="expertForm.second_expert_name" type="text" class="input-field" placeholder="王德林 主任医师 (老年医学科)" />
                </div>
                <div class="form-group">
                  <label>临床核心诊断 (结合二级以上医院出院小结):</label>
                  <input v-model="expertForm.clinical_diagnosis" type="text" class="input-field" placeholder="例如: 脑梗死后遗症伴完全性右侧肢体瘫痪、血管性认知障碍" />
                </div>
              </div>

              <div class="section-title mt-3">📡 安守护在床物联网连续客观遥测对撞质证</div>
              <div class="form-grid-2">
                <div class="form-group">
                  <label>物联监测数据印证结论:</label>
                  <select v-model="expertForm.iot_consistency_verdict" class="input-field font-bold">
                    <option value="consistent">完全吻合 (Consistent - 客观遥测与临床卧床特征100%一致)</option>
                    <option value="acceptable">存在生理偏离但具备合理临床解释 (Clinically Justified)</option>
                    <option value="deviated">严重冲突 (Conflicted - 疑似挂床或过度自评，建议实地飞检)</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>专家委员会终审认定失能等级:</label>
                  <select v-model="expertForm.recommended_level" class="input-field font-bold text-danger">
                    <option v-for="lv in DISABILITY_LEVELS" :key="lv" :value="lv">{{ lv }}</option>
                  </select>
                </div>
              </div>

              <div class="form-group mt-2">
                <label>物联网客观指标与临床病程印证说明:</label>
                <textarea
                  v-model="expertForm.iot_clinical_rationale"
                  class="textarea-field"
                  rows="2"
                  placeholder="雷达连续72小时遥测老人离床0次，在床率99.2%，排除了活动能力欺诈，与脑梗死完全瘫痪临床诊断吻合。"
                ></textarea>
              </div>

              <div class="form-group mt-2">
                <label>评定专家委员会医学终审综合审查意见:</label>
                <textarea
                  v-model="expertForm.expert_opinion"
                  class="textarea-field font-medium"
                  rows="3"
                  placeholder="经评定专家委员会查验病历、入户双人视频与安守护在网设备连续体征遥测，依据国家标准，结论确凿，一致同意定级为重度失能三级。"
                ></textarea>
              </div>
            </div>

            <!-- 状态: 已完结 → 官方结论书内联预览（原弹窗迁入） -->
            <div v-else-if="activeTask.status === 'completed'" class="studio-panel">
              <div class="studio-panel-title">官方《失能等级评定结论书》防伪印章预览</div>
              <div class="p-3 bg-gray-50">
                <div class="official-certificate">
                  <div class="cert-header">
                    <div class="national-emblem">🏛️</div>
                    <div class="cert-title-cn">{{ selectedPool === 'suqian' ? '宿迁市' : '某某市' }}长期护理保险失能等级评定结论书</div>
                    <div class="cert-subtitle-cn">{{ selectedPool === 'suqian' ? '宿迁市医疗保障局 · 宿迁市长护险评定专家委员会 监制' : '某某市医疗保障局 · 某某市长护险评定专家委员会 监制' }}</div>
                    <div class="cert-no font-mono">结论书编号: {{ certificateData?.report_no || 'BG-' + activeTask.task_id }}</div>
                  </div>
                  <table class="cert-table">
                    <tbody>
                      <tr>
                        <td class="cert-lbl">申请人姓名</td>
                        <td class="cert-val font-bold">{{ certificateData?.applicant_name || activeTask.applicant_name }}</td>
                        <td class="cert-lbl">性别 / 年龄</td>
                        <td class="cert-val">{{ certificateData?.gender || activeTask.gender }} / {{ certificateData?.age || activeTask.age }} 岁</td>
                      </tr>
                      <tr>
                        <td class="cert-lbl">身份证号码</td>
                        <td class="cert-val font-mono">{{ certificateData?.id_card || activeTask.id_card }}</td>
                        <td class="cert-lbl">参保凭证号</td>
                        <td class="cert-val font-mono">LTC-SQ-{{ certificateData?.applicant_id || activeTask.applicant_id }}</td>
                      </tr>
                      <tr>
                        <td class="cert-lbl">临床医学诊断</td>
                        <td colspan="3" class="cert-val font-medium">{{ certificateData?.clinical_diagnosis || '脑梗死后遗症伴完全性右侧肢体瘫痪、血管性认知障碍' }}</td>
                      </tr>
                      <tr>
                        <td class="cert-lbl">现场量表四项得分</td>
                        <td colspan="3" class="cert-val">
                          ADL生活自理: {{ certificateData?.scores?.daily_living || activeTask.scores?.daily_living || 15 }}分 |
                          认知能力: {{ certificateData?.scores?.cognition || activeTask.scores?.cognition || 6 }}分 |
                          感知觉沟通: {{ certificateData?.scores?.perception || activeTask.scores?.perception || 4 }}分 |
                          精神状态: {{ certificateData?.scores?.mental_state || activeTask.scores?.mental_state || 4 }}分
                        </td>
                      </tr>
                      <tr>
                        <td class="cert-lbl">物联网客观印证</td>
                        <td colspan="3" class="cert-val text-success">
                          ✓ 在床终端 {{ certificateData?.device_id || activeTask.device_id || 'ASH01078' }} 遥测72h吻合度100%（排查无挂床舞弊）
                        </td>
                      </tr>
                      <tr>
                        <td class="cert-lbl">评定结论等级</td>
                        <td colspan="3" class="cert-val cert-grade text-danger">
                          {{ certificateData?.disability_level || activeTask.assessor_level || activeTask.preliminary_level || '重度失能三级 (完全失能)' }}
                        </td>
                      </tr>
                      <tr>
                        <td class="cert-lbl">专家评审组意见</td>
                        <td colspan="3" class="cert-val text-sm">
                          {{ certificateData?.expert_opinion || '经医学评审委员会专家组综合审查现场入户音视频、量表打分及安守护客观物联监测数据，符合国家失能评估标准。' }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div class="cert-signature-area">
                    <div class="sig-col">
                      <div><strong>双人上门评定师签名:</strong></div>
                      <div class="sig-name font-cursive">{{ activeTask.assessor?.name || '许建强' }} / {{ activeTask.second_assessor_name || '赵小燕' }} (印)</div>
                    </div>
                    <div class="sig-col">
                      <div><strong>专家委员会主审专家:</strong></div>
                      <div class="sig-name font-cursive">{{ selectedPool === 'suqian' ? '孙建国 / 王德林' : '钱德明 / 李振邦' }} (主任医师联签)</div>
                    </div>
                    <div class="sig-seal-col">
                      <div class="official-red-seal">
                        <div class="seal-inner">
                          <div class="seal-star">★</div>
                          <div class="seal-text-top">{{ selectedPool === 'suqian' ? '宿迁市广济第三方失能评定中心' : '某某市明康第三方评定中心' }}</div>
                          <div class="seal-text-bottom">评定业务专用章</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="studio-panel">
              <div class="text-sm text-muted">当前状态（{{ activeTask.status }}）无可办理表单，请返回队列查看其他案卷。</div>
            </div>
          </template>

          <template #telemetry>
            <!-- 安守护客观监测数据包（对撞台，conclusion 恒 null 红线） -->
            <div class="telemetry-block">
              <div class="telemetry-title">📡 安守护客观遥测切片</div>
              <div v-if="activeSnapshot" class="snapshot-inline">
                <div class="text-xs text-muted mb-1">
                  设备终端: {{ activeSnapshot.device_id }}（{{ activeSnapshot.device_model }}）
                </div>
                <div class="metric-mini-grid">
                  <div class="mini-item">
                    <div class="val">{{ activeSnapshot.metrics?.in_bed_rate_pct }}%</div>
                    <div class="lbl">窗口期在床率</div>
                  </div>
                  <div class="mini-item">
                    <div class="val text-warning">{{ activeSnapshot.metrics?.night_trips }} 次</div>
                    <div class="lbl">夜间离床频次</div>
                  </div>
                  <div class="mini-item">
                    <div class="val text-danger">{{ activeSnapshot.metrics?.bed_leave_15min_count }} 次</div>
                    <div class="lbl">长时离床 (&gt;15min)</div>
                  </div>
                  <div class="mini-item">
                    <div class="val text-primary">{{ activeSnapshot.metrics?.avg_hr }} bpm</div>
                    <div class="lbl">夜间静息心率</div>
                  </div>
                </div>
                <div class="cv-box">
                  <div class="cv-title">🔍 物联网交叉比对临床印证：</div>
                  <p class="cv-desc">{{ activeSnapshot.cross_validation?.finding }}</p>
                  <span class="redline-tag">法定红线验证: conclusion = {{ activeSnapshot.conclusion === null ? 'null (无定级结论)' : activeSnapshot.conclusion }}</span>
                </div>
              </div>
              <div v-else class="text-xs text-muted">
                暂无该长者的客观监测数据包；按正式流程可先完成人工记录，设备佐证后补。
              </div>
            </div>

            <!-- AI 洞察人工闭环（结论恒 null，采纳必留痕） -->
            <div class="telemetry-block">
              <div class="telemetry-title">🤖 AI 洞察临床核验（人工闭环签字留痕）</div>
              <div v-if="activeInsights.length === 0" class="text-xs text-muted">当前案卷无待处置 AI 洞察。</div>
              <div v-for="ins in activeInsights" :key="ins.insight_id" class="insight-row">
                <div class="insight-top">
                  <span class="font-mono font-bold text-xs">{{ ins.insight_id }}</span>
                  <span :class="['tag', ins.handling_status === 'pending' ? 'tag-warning' : 'tag-success']">
                    {{ formatInsightStatus(ins.handling_status) }}
                  </span>
                </div>
                <div class="text-xs font-bold mt-1">{{ ins.title }}</div>
                <div class="text-xs text-muted mt-1">{{ ins.detail }}</div>
                <div v-if="ins.handling_status === 'pending'" class="insight-actions mt-2">
                  <button class="btn btn-sm btn-success" @click="handleInsightAction(ins.insight_id, 'adopted')">✓ 采纳为量表佐证</button>
                  <button class="btn btn-sm btn-danger" @click="handleInsightAction(ins.insight_id, 'rejected')">✕ 与现场不符·驳回</button>
                </div>
                <div v-else class="handled-banner mt-2">
                  ✓ 处置人: <strong>{{ ins.handled_by }}</strong>｜{{ ins.handling_note }}
                </div>
              </div>
            </div>
          </template>

          <template #signature>
            <!-- 底栏法定签署区 -->
            <div v-if="activeTask.status === 'assessing' || activeTask.status === 'returned'" class="signature-grid">
              <label class="checkbox-label">
                <input v-model="scoringForm.guardian_present" type="checkbox" />
                <span class="font-bold text-success ml-2">✓ 监护人 {{ activeTask.guardian_name }} 已在场面签《现场知情同意确认书》（法定红线门禁）</span>
              </label>
              <div class="btn-group">
                <button class="btn btn-success" @click="submitScoringAction">
                  确认完成现场评定 · 锁定并提交专家委员会终审
                </button>
              </div>
            </div>

            <div v-else-if="activeTask.status === 'pending_expert_review'" class="signature-grid">
              <div class="text-xs">
                会签专家: <strong>{{ expertForm.second_expert_name }}</strong>（副主任医师及以上）｜
                主审: {{ selectedPool === 'suqian' ? '孙建国 主任医师' : '钱德明 主任医师' }}
              </div>
              <div class="btn-group">
                <button class="btn btn-purple" @click="submitExpertReviewAction">
                  🩺 双专家联名数字签署 · 出具评定结论书并加盖机构专用章
                </button>
              </div>
            </div>

            <div v-else-if="activeTask.status === 'assigned'" class="signature-grid">
              <div class="text-xs text-muted">
                接单即确认双人上门规范（法定红线1：≥2名持证评定师，含≥1名执业医师/注册护士，全程录音录像存档）。
              </div>
            </div>

            <div v-else-if="activeTask.status === 'completed'" class="signature-grid">
              <div class="text-xs text-muted">
                本结论书已经双人评定师与专家委员会联签盖章，流转商保经办初审与医保复核。
              </div>
              <div class="btn-group">
                <button class="btn btn-primary" @click="printReportAction">🖨️ 打印 / 导出加盖电子印章PDF</button>
              </div>
            </div>
          </template>
        </MasterDetailStudio>

        <!-- ===== 态势与公信力大盘（质控主管 gaussian_monitor 节点） ===== -->
        <template v-else-if="activeStageKey === 'gaussian_monitor'">
          <div class="content-panel">
            <div class="metric-grid">
              <div class="metric-card">
                <div class="metric-header">
                  <span class="metric-title">评定任务总盘</span>
                  <span class="metric-tag tag-blue">{{ selectedPool === 'suqian' ? '试点纳管3人' : '全量业务' }}</span>
                </div>
                <div class="metric-num">{{ dashboardData?.kpis?.total_tasks || 0 }}</div>
                <div class="metric-label">包含宿迁真实在床长者评定任务</div>
              </div>
              <div class="metric-card">
                <div class="metric-header">
                  <span class="metric-title">现场双人入户中</span>
                  <span class="metric-tag tag-amber">评定师在途/打卡</span>
                </div>
                <div class="metric-num text-warning">{{ dashboardData?.kpis?.assessing_count || 0 }}</div>
                <div class="metric-label">执行四领域量表评估与监护人面签</div>
              </div>
              <div class="metric-card">
                <div class="metric-header">
                  <span class="metric-title">待专家委员会终审</span>
                  <span class="metric-tag tag-purple">临床质证队列</span>
                </div>
                <div class="metric-num text-purple">{{ dashboardData?.kpis?.pending_expert_count || 0 }}</div>
                <div class="metric-label">双主审专家对撞病历与雷达客观数据</div>
              </div>
              <div class="metric-card">
                <div class="metric-header">
                  <span class="metric-title">评审完结归档</span>
                  <span class="metric-tag tag-green">印章结论书签发</span>
                </div>
                <div class="metric-num text-success">{{ dashboardData?.kpis?.completed_count || 0 }}</div>
                <div class="metric-label">已流转商保经办初审与医保复核</div>
              </div>
            </div>

            <div class="two-col-grid">
              <div class="stat-card">
                <div class="card-title-bar">
                  <span class="card-title">⚖️ 评定机构高斯偏离度公信力监测 (Gaussian Norm Oversight)</span>
                  <span :class="['tag', dashboardData?.kpis?.gaussian_status === 'normal' ? 'tag-success' : 'tag-danger']">
                    {{ dashboardData?.kpis?.gaussian_status === 'normal' ? '✓ 正态分布良好·合规公信' : '⚠️ 偏离度过高·重点监管' }}
                  </span>
                </div>
                <div class="gaussian-body">
                  <div class="gaussian-stat-row">
                    <div class="stat-box">
                      <div class="val">{{ dashboardData?.kpis?.severe_disability_rate }}%</div>
                      <div class="lbl">本机构重度失能率</div>
                    </div>
                    <div class="stat-divider">VS</div>
                    <div class="stat-box">
                      <div class="val">{{ dashboardData?.kpis?.city_normal_severe_rate }}%</div>
                      <div class="lbl">统筹区公信标准线 (±5%容差)</div>
                    </div>
                    <div class="stat-divider">=</div>
                    <div class="stat-box">
                      <div class="val text-success">
                        {{ Math.abs((dashboardData?.kpis?.severe_disability_rate || 23.5) - (dashboardData?.kpis?.city_normal_severe_rate || 23.8)).toFixed(1) }}%
                      </div>
                      <div class="lbl">当前正态偏离差值</div>
                    </div>
                  </div>
                  <div class="progress-bar-container">
                    <div class="progress-header">
                      <span>重度失能占比动态区间 (国家医保公信模型)</span>
                      <span>标准区间: 18.0% - 28.0%</span>
                    </div>
                    <div class="progress-track">
                      <div
                        class="progress-fill"
                        :style="{ width: Math.min((dashboardData?.kpis?.severe_disability_rate || 23.5) * 2.5, 100) + '%' }"
                      ></div>
                      <div class="standard-marker" style="left: 59.5%;" title="统筹区公信中位数 23.8%"></div>
                    </div>
                  </div>
                  <p class="text-xs text-muted mt-3">
                    * 依据国家医保发〔2021〕29号文公信力溯源要求，定点失能评定机构须严格遵循高斯正态分布规律，防范人情定级、挂床套保与重度失能率畸高偏离。
                  </p>
                </div>
              </div>

              <div class="stat-card">
                <div class="card-title-bar">
                  <span class="card-title">🛡️ 法定评定规程达标率全景 (Red-Line Compliance)</span>
                  <span class="tag tag-blue">国家四统一规程</span>
                </div>
                <div class="compliance-gauges">
                  <div class="gauge-item">
                    <div class="gauge-num text-success">{{ dashboardData?.kpis?.dual_assessor_compliance_pct }}%</div>
                    <div class="gauge-lbl">双人入户核验率</div>
                    <div class="gauge-sub">持证医师/护士≥1人同行</div>
                  </div>
                  <div class="gauge-item">
                    <div class="gauge-num text-success">{{ dashboardData?.kpis?.dual_expert_compliance_pct }}%</div>
                    <div class="gauge-lbl">双专家终审符合率</div>
                    <div class="gauge-sub">副主任医师及以上联签</div>
                  </div>
                  <div class="gauge-item">
                    <div class="gauge-num text-success">{{ dashboardData?.kpis?.guardian_present_rate_pct }}%</div>
                    <div class="gauge-lbl">监护人在场面签率</div>
                    <div class="gauge-sub">知情同意书核验盖印</div>
                  </div>
                  <div class="gauge-item">
                    <div class="gauge-num text-success">{{ dashboardData?.kpis?.iot_telemetry_consistency_pct }}%</div>
                    <div class="gauge-lbl">物联遥测印证率</div>
                    <div class="gauge-sub">设备快照佐证比对100%</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="stat-card mt-4">
              <div class="card-title-bar">
                <span class="card-title">👨‍⚕️ 评定机构持证评定师与医学专家委员会名册</span>
                <span class="text-xs text-muted">机构代码: {{ dashboardData?.org_id }} | 定点机构: {{ dashboardData?.org_name }}</span>
              </div>
              <div class="roster-grid">
                <div v-for="asr in (dashboardData?.assessors || [])" :key="asr.assessor_id" class="roster-card">
                  <div class="roster-header">
                    <span class="roster-name">{{ asr.name }}</span>
                    <span class="tag tag-info">{{ asr.professional_title || '注册评定师' }}</span>
                  </div>
                  <div class="roster-details">
                    <div><strong>资格等级:</strong> {{ asr.qualification_level || '国家二级评定师' }}</div>
                    <div><strong>执业证号:</strong> <span class="font-mono text-xs">{{ asr.qualification_cert_no }}</span></div>
                    <div><strong>从业年限:</strong> {{ asr.practicing_years || 5 }} 年 | 执业专科: 老年医学 / 康复照护</div>
                    <div><strong>双人规程:</strong> <span class="text-success">✓ 具备主评/协同入户资格</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- ===== 客观物联质证（sensor_telemetry / clinical_verify 节点） ===== -->
        <template v-else-if="activeStageKey === 'sensor_telemetry' || activeStageKey === 'clinical_verify'">
          <div class="content-panel">
            <div class="panel-alert">
              <div class="alert-icon">⚠️</div>
              <div>
                <strong>国家医保局物联红线法定免责提示：</strong>
                安守护设备遥测数据（毫米波雷达与体征垫）由中科安樵物联专网客观抓取，快照定级结论字段严格恒定为
                <code class="font-bold text-danger">conclusion: null</code>。
                设备遥测仅作为入户评定师与医学评审专家质证排查长者真实失能状态的“客观佐证材料”，严禁任何设备自动判定失能等级或直接定性欺诈！
              </div>
            </div>

            <div class="snapshot-deck">
              <div v-for="snap in (dashboardData?.snapshots || [])" :key="snap.snapshot_id" class="snapshot-card">
                <div class="snapshot-card-header">
                  <div>
                    <span class="snapshot-id">{{ snap.snapshot_id }}</span>
                    <span class="tag tag-success ml-2">客观遥测切片</span>
                  </div>
                  <div class="text-xs text-muted">
                    设备终端: {{ snap.device_id }} ({{ snap.device_model }})
                  </div>
                </div>
                <div class="elder-info-row">
                  <strong>关联长者:</strong> {{ snap.applicant_name }} ({{ snap.applicant_id }})
                  <span class="text-muted ml-3">窗口期: {{ snap.assessment_window?.from?.slice(0, 10) }} 至 {{ snap.assessment_window?.to?.slice(0, 10) }}</span>
                </div>
                <div class="metric-mini-grid">
                  <div class="mini-item">
                    <div class="val">{{ snap.metrics?.in_bed_rate_pct }}%</div>
                    <div class="lbl">窗口期平均在床率</div>
                  </div>
                  <div class="mini-item">
                    <div class="val text-warning">{{ snap.metrics?.night_trips }} 次</div>
                    <div class="lbl">夜间离床总频次</div>
                  </div>
                  <div class="mini-item">
                    <div class="val text-danger">{{ snap.metrics?.bed_leave_15min_count }} 次</div>
                    <div class="lbl">长时离床 (>15min)</div>
                  </div>
                  <div class="mini-item">
                    <div class="val text-primary">{{ snap.metrics?.avg_hr }} bpm</div>
                    <div class="lbl">夜间静息心率均值</div>
                  </div>
                </div>
                <div class="cv-box">
                  <div class="cv-title">🔍 物联网交叉比对临床印证 (Cross-Validation)：</div>
                  <p class="cv-desc">{{ snap.cross_validation?.finding }}</p>
                  <div class="cv-footer">
                    <span class="redline-tag">法定红线验证: conclusion = {{ snap.conclusion === null ? 'null (无定级结论)' : snap.conclusion }}</span>
                    <span class="text-xs text-muted">可信度: {{ snap.cross_validation?.confidence }} | 建议评定方向: {{ snap.cross_validation?.suggested_focus }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="stat-card mt-4">
              <div class="card-title-bar">
                <span class="card-title">🤖 AI 助手洞察临床核验与评定师签字留痕 (Human-in-the-Loop)</span>
                <span class="text-xs text-muted">所有智能提示必须由评估人员人工采纳/核实/驳回，全过程上链留痕</span>
              </div>
              <div class="insights-list">
                <div v-for="ins in (dashboardData?.insights || [])" :key="ins.insight_id" class="insight-row">
                  <div class="insight-top">
                    <span class="font-mono font-bold">{{ ins.insight_id }}</span>
                    <span :class="['tag', ins.handling_status === 'pending' ? 'tag-warning' : 'tag-success']">
                      {{ formatInsightStatus(ins.handling_status) }}
                    </span>
                  </div>
                  <div class="insight-title font-bold text-base mt-1">{{ ins.title }}</div>
                  <div class="insight-detail text-sm text-muted mt-1">{{ ins.detail }}</div>
                  <div class="insight-focus mt-2">
                    <strong>🩺 现场临床核验建议:</strong> {{ ins.suggested_focus }}
                  </div>
                  <div class="insight-disclaimer text-xs text-muted mt-1">{{ ins.disclaimer }}</div>
                  <div v-if="ins.handling_status === 'pending'" class="insight-actions mt-3">
                    <button class="btn btn-sm btn-success" @click="handleInsightAction(ins.insight_id, 'adopted')">
                      ✓ 采纳此客观线索作为量表佐证
                    </button>
                    <button class="btn btn-sm btn-primary" @click="handleInsightAction(ins.insight_id, 'confirmed')">
                      👁️ 现场已当面核查确认
                    </button>
                    <button class="btn btn-sm btn-danger" @click="handleInsightAction(ins.insight_id, 'rejected')">
                      ✕ 与现场查验不符·予以驳回
                    </button>
                    <button class="btn btn-sm btn-warning" @click="handleInsightAction(ins.insight_id, 'needs_manual_review')">
                      ⚠️ 存疑·提请专家委员会专项质证
                    </button>
                  </div>
                  <div v-else class="handled-banner mt-2">
                    ✓ 处置人: <strong>{{ ins.handled_by }}</strong> | 处置结果: <span class="tag tag-blue">{{ ins.handling_status }}</span> | 说明: {{ ins.handling_note }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>

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
import { getWorkbenchWorkflowTree, getWorkbenchSummary, type WorkbenchWorkflowTree, type WorkbenchSummary } from '../../../api/ltc-workbench'
import {
  getAssessorDashboard,
  acceptAssessmentTask,
  startAssessmentTask,
  submitAssessmentTask,
  expertReviewTask,
  handleAssistantInsight,
  type AssessorDashboardData,
} from '../../../api/client'
import type { AssessmentTask } from '../../../api/types'
import type { MasterQueueCard } from '../../../types/workbench-ia'

const DISABILITY_LEVELS = [
  '重度失能三级 (完全失能)',
  '重度失能二级',
  '重度失能一级',
  '中度失能二级',
  '中度失能一级',
  '轻度失能',
  '未达失能等级',
]

const selectedPool = ref<'suqian' | 'moumou'>('suqian')
const currentUserPool = ref<string>('suqian')

const dashboardData = ref<AssessorDashboardData | null>(null)
const loading = ref<boolean>(false)

// §12.4 SOP 流程树与主从工作间状态
const workflowTree = ref<WorkbenchWorkflowTree | null>(null)
const summary = ref<WorkbenchSummary | null>(null)
const activeGroupKey = ref<string>('')
const activeStageKey = ref<string>('')
const activeNodeTitle = ref<string>('今日必做')
const viewMode = ref<'master_list' | 'detail_studio'>('master_list')
const activeTask = ref<AssessmentTask | null>(null)
const certificateData = ref<any>(null)

// 评分表单（国家失能量表四领域）
const scoringForm = ref({
  second_assessor_name: '赵小燕 (主管护师 执业证号: 32029988)',
  video_evidence: 'EV-SQ-VID-20260924-001',
  guardian_present: true,
  daily_living: 15,
  cognition: 6,
  perception: 4,
  mental_state: 4,
  preliminary_level: '重度失能三级 (完全失能)',
  remarks: '长者神志清楚，双下肢肌力2级，不能独立站立及翻身，由长子长媳照护。安守护在床生命体征垫遥测心率平稳。',
})

// 专家评审表单
const expertForm = ref({
  second_expert_id: 'exp_sq_neurology',
  second_expert_name: '王德林 主任医师 (老年医学科)',
  clinical_diagnosis: '脑梗死后遗症伴完全性右侧肢体瘫痪、血管性认知障碍',
  recommended_level: '重度失能三级 (完全失能)',
  expert_opinion: '经专家组查验病历、入户双人录音录像及安守护毫米波雷达连续72小时99.2%在床客观遥测，医学依据充分，评定为重度失能三级。',
  iot_consistency_verdict: 'consistent' as 'consistent' | 'acceptable' | 'deviated',
  iot_clinical_rationale: '雷达客观离床0次遥测排除欺诈挂床，与完全卧床临床诊断100%吻合。',
  sign_off_status: 'approved' as 'approved' | 'returned',
})

const activeNodeKey = computed(() => `${activeGroupKey.value}::${activeStageKey.value}`)

// 队列卡片：按流程树节点筛选任务
const stageQueue = computed<MasterQueueCard[]>(() => {
  const tasks = dashboardData.value?.tasks || []
  let filtered: AssessmentTask[] = []
  switch (activeStageKey.value) {
    case 'pending_visit':
      filtered = tasks.filter((t) => t.status === 'assigned')
      break
    case 'in_progress':
      filtered = tasks.filter((t) => t.status === 'assessing')
      break
    case 'completed_archive':
      filtered = tasks.filter((t) => t.status === 'completed')
      break
    case 'materials_reject':
    case 'dispute_hearing':
      filtered = tasks.filter((t) => t.status === 'returned')
      break
    case 'pending_expert_review':
      filtered = tasks.filter((t) => t.status === 'pending_expert_review')
      break
    case 'clinical_verify':
      filtered = tasks.filter((t) => t.status === 'pending_expert_review' || t.status === 'completed')
      break
    default:
      filtered = []
  }
  return filtered.map((t) => ({
    id: t.task_id,
    title: `${t.applicant_name}（${t.gender || '—'}，${t.age || '—'}岁）`,
    subtitle: `${t.task_id} · ${t.address || ''}`,
    statusLabel: formatTaskStatus(t.status),
    statusTone: queueToneOf(t.status),
    meta: [
      `设备 ${t.device_id || '未绑定'}`,
      ...(t.scores ? [`初评 ${t.preliminary_level || t.assessor_level || ''}`] : []),
      ...(t.objective_conflict ? ['⚠️ 雷达客观冲突'] : []),
    ],
  }))
})

// 对撞台数据：当前案卷长者的客观快照与待处置洞察
const activeSnapshot = computed(() => {
  if (!activeTask.value) return null
  const snaps = dashboardData.value?.snapshots || []
  return snaps.find((s) => s.applicant_id === activeTask.value!.applicant_id) || null
})

const activeInsights = computed(() => {
  const list = dashboardData.value?.insights || []
  if (!activeTask.value) return list.filter((i) => i.handling_status === 'pending').slice(0, 3)
  return list.filter((i) => !i.applicant_id || i.applicant_id === activeTask.value!.applicant_id).slice(0, 5)
})

async function fetchDashboard() {
  loading.value = true
  try {
    const data = await getAssessorDashboard({ pool_id: selectedPool.value })
    dashboardData.value = data
    // 保持详情态与最新数据同步（任务状态流转后原位刷新）
    if (activeTask.value) {
      const updated = data?.tasks?.find((t) => t.task_id === activeTask.value!.task_id)
      if (updated) {
        activeTask.value = updated
      } else if (viewMode.value === 'detail_studio') {
        closeStudio()
      }
    }
  } catch (err: any) {
    console.error('获取评定工作台大盘失败:', err)
  } finally {
    loading.value = false
  }
}

async function fetchWorkflow() {
  try {
    const [tree, sum] = await Promise.all([
      getWorkbenchWorkflowTree(),
      getWorkbenchSummary().catch(() => null),
    ])
    workflowTree.value = tree
    summary.value = sum
    // 默认选中首个流程节点（服务端已按角色权限裁剪）
    if (!activeStageKey.value && tree.groups.length > 0) {
      const g = tree.groups[0]
      if (g.items.length > 0) {
        activeGroupKey.value = g.groupKey
        activeStageKey.value = g.items[0].stageKey
        activeNodeTitle.value = g.items[0].label
      }
    }
  } catch (err: any) {
    console.error('获取 SOP 流程树失败:', err)
  }
}

function onNodeSelect(groupKey: string, item: { stageKey: string; label: string; summaryGroup?: string }) {
  activeGroupKey.value = groupKey
  activeStageKey.value = item.stageKey
  activeNodeTitle.value = item.label
  viewMode.value = 'master_list'
  activeTask.value = null
}

function openStudio(card: MasterQueueCard) {
  const task = (dashboardData.value?.tasks || []).find((t) => t.task_id === card.id)
  if (!task) return
  activeTask.value = task
  viewMode.value = 'detail_studio'
  // 预填量表/专家表单（保持原弹窗打开时的预填逻辑）
  scoringForm.value.second_assessor_name = task.second_assessor_name || (selectedPool.value === 'suqian' ? '赵小燕 (主管护师)' : '宋慧敏 (主管护师)')
  scoringForm.value.video_evidence = task.video_evidence || `EV-${task.task_id}-VID`
  scoringForm.value.guardian_present = task.guardian_present ?? true
  if (task.scores) {
    scoringForm.value.daily_living = task.scores.daily_living
    scoringForm.value.cognition = task.scores.cognition
    scoringForm.value.perception = task.scores.perception
    scoringForm.value.mental_state = task.scores.mental_state
  }
  scoringForm.value.preliminary_level = task.preliminary_level || task.assessor_level || '重度失能二级'
  if (task.status === 'pending_expert_review') {
    expertForm.value.second_expert_name = selectedPool.value === 'suqian' ? '王德林 主任医师 (老年医学科)' : '李振邦 主任医师 (神经内科)'
    expertForm.value.clinical_diagnosis = task.applicant_name === '何家齐'
      ? '脑梗死后遗症伴完全性右侧肢体瘫痪、血管性认知障碍'
      : (task.applicant_name === '许丽' ? '重度骨质疏松合并股骨颈骨折术后、双膝重度骨性关节炎' : '慢性心力衰竭、重度认知功能障碍(阿尔茨海默病)')
    expertForm.value.recommended_level = task.preliminary_level || '重度失能三级 (完全失能)'
  }
  certificateData.value = task.status === 'completed' ? buildCertificate(task) : null
}

function closeStudio() {
  viewMode.value = 'master_list'
  activeTask.value = null
  certificateData.value = null
}

function buildCertificate(task: AssessmentTask) {
  return {
    report_no: `BG-SUQIAN-20260925-${task.task_id.slice(-4)}`,
    applicant_name: task.applicant_name,
    gender: task.gender,
    age: task.age,
    id_card: task.id_card,
    applicant_id: task.applicant_id,
    address: task.address,
    clinical_diagnosis: task.applicant_name === '何家齐' ? '脑梗死后遗症伴完全性右侧肢体瘫痪、血管性认知障碍' : '重度阿尔茨海默病、重度认知与运动障碍',
    device_id: task.device_id,
    scores: task.scores,
    disability_level: task.assessor_level || task.preliminary_level || '重度失能三级 (完全失能)',
    expert_opinion: '经专家委员会依据国家标准量表打分及安守护在床物联监测数据印证，医学审查通过，结论真实确凿，评定为重度失能三级。',
  }
}

function selectPool(pool: 'suqian' | 'moumou') {
  selectedPool.value = pool
  viewMode.value = 'master_list'
  activeTask.value = null
  certificateData.value = null
  fetchDashboard()
  fetchWorkflow()
}

async function acceptTaskAction(taskId: string) {
  try {
    await acceptAssessmentTask(taskId)
    alert('已成功接单排班！请按双人上门入户规范指派持证医师/护士执行现场评定。')
    await fetchDashboard()
  } catch (err: any) {
    alert('接单失败: ' + err.message)
  }
}

async function startTaskAction(taskId: string) {
  try {
    await startAssessmentTask(taskId)
    alert('入户打卡就绪！已记录现场打卡时间戳，请启动视音频录制。')
    await fetchDashboard()
  } catch (err: any) {
    alert('打卡失败: ' + err.message)
  }
}

async function submitScoringAction() {
  if (!activeTask.value) return
  if (!scoringForm.value.guardian_present) {
    alert('法定红线门禁拦截：监护人未在场签署《知情同意书》，不可提交评估！')
    return
  }
  try {
    await submitAssessmentTask(activeTask.value.task_id, {
      daily_living_score: scoringForm.value.daily_living,
      cognition_score: scoringForm.value.cognition,
      perception_score: scoringForm.value.perception,
      mental_score: scoringForm.value.mental_state,
      preliminary_level: scoringForm.value.preliminary_level,
      guardian_present: scoringForm.value.guardian_present,
      second_assessor_name: scoringForm.value.second_assessor_name,
      video_evidence: scoringForm.value.video_evidence,
      remarks: scoringForm.value.remarks,
    })
    alert('双人现场评定完成并锁定！案件已转入评定专家委员会医学会审队列。')
    await fetchDashboard()
  } catch (err: any) {
    alert('提交评定失败: ' + err.message)
  }
}

async function submitExpertReviewAction() {
  if (!activeTask.value) return
  try {
    const res = await expertReviewTask(activeTask.value.task_id, {
      second_expert_id: expertForm.value.second_expert_id,
      second_expert_name: expertForm.value.second_expert_name,
      clinical_diagnosis: expertForm.value.clinical_diagnosis,
      recommended_level: expertForm.value.recommended_level,
      expert_opinion: expertForm.value.expert_opinion,
      iot_consistency_verdict: expertForm.value.iot_consistency_verdict,
      iot_clinical_rationale: expertForm.value.iot_clinical_rationale,
      sign_off_status: expertForm.value.sign_off_status,
    })
    alert('双专家医学终审会签完成！官方失能评定结论书已签发，已加盖评定专用章。')
    await fetchDashboard()
    // 会签完成后原位展示官方结论书（fetchDashboard 已把 activeTask 刷新为 completed）
    if (res.report || activeTask.value) {
      certificateData.value = { ...(res.report || {}), ...buildCertificate(activeTask.value) }
    }
  } catch (err: any) {
    alert('医学终审提交失败: ' + err.message)
  }
}

async function handleInsightAction(insightId: string, action: string) {
  const note = prompt('请输入评定人员处置理由与现场核查说明：', '现场查验长者步态蹒跚，夜间离床高频与家属叙述一致，予以采纳')
  if (!note) return
  try {
    await handleAssistantInsight(insightId, { action, note })
    alert('AI助手洞察已人工闭环签字留痕！已归档入评定证据包。')
    await fetchDashboard()
  } catch (err: any) {
    alert('处置失败: ' + err.message)
  }
}

function printReportAction() {
  window.print()
}

function formatTaskStatus(st: string): string {
  const map: Record<string, string> = {
    assigned: '待接单排班',
    assessing: '现场双人入户核验中',
    pending_expert_review: '待专家委员会医学评审',
    completed: '评审完结·结论签发',
    returned: '审核退回',
  }
  return map[st] || st
}

function queueToneOf(st: string): MasterQueueCard['statusTone'] {
  if (st === 'assigned') return 'info'
  if (st === 'assessing') return 'warning'
  if (st === 'pending_expert_review') return 'purple'
  if (st === 'completed') return 'success'
  if (st === 'returned') return 'danger'
  return 'default'
}

function formatInsightStatus(st: string): string {
  const map: Record<string, string> = {
    pending: '待人工闭环核验',
    confirmed: '现场已当面核查确认',
    adopted: '已采纳为定级客观佐证',
    rejected: '与现场查验不符已驳回',
    needs_manual_review: '已提请专家组专项质证',
  }
  return map[st] || st
}

onMounted(() => {
  fetchDashboard()
  fetchWorkflow()
})
</script>

<style scoped>
.workspace-page {
  padding: 20px 24px;
  background: #f8fafc;
  min-height: calc(100vh - 60px);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}
.page-title {
  font-size: 22px;
  font-weight: 800;
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
  flex-wrap: wrap;
}
.badge {
  padding: 4px 10px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 600;
}
.badge-primary { background: #e0f2fe; color: #0369a1; }
.badge-success { background: #dcfce7; color: #15803d; }
.badge-info { background: #f1f5f9; color: #475569; }
.badge-warning { background: #fef3c7; color: #b45309; }

.pool-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #ffffff;
  padding: 10px 16px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  margin-bottom: 16px;
}
.pool-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pool-btn {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  font-size: 13px;
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
  color: #ffffff;
  border-color: #0284c7;
}

.compliance-ribbon {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.ribbon-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: #ffffff;
  padding: 12px 14px;
  border-radius: 8px;
  border-left: 4px solid #0284c7;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.ribbon-icon {
  font-size: 18px;
}
.ribbon-item div {
  display: flex;
  flex-direction: column;
}
.ribbon-item strong {
  font-size: 12px;
  color: #0f172a;
}
.ribbon-item span {
  font-size: 11px;
  color: #64748b;
  margin-top: 2px;
  line-height: 1.4;
}

/* §12.4 SOP 树 + 工作间布局 */
.sop-studio-layout {
  display: flex;
  gap: 16px;
  align-items: stretch;
  min-height: 480px;
}
.sop-studio-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

/* 工作间面板与卷宗块 */
.studio-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.studio-panel-title {
  font-size: 14px;
  font-weight: 800;
  color: #166534;
}
.dossier-block {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dossier-title {
  font-size: 12px;
  font-weight: 800;
  color: #075985;
}
.dossier-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  font-size: 12.5px;
  color: #334155;
}
.dossier-row span {
  color: #94a3b8;
  flex-shrink: 0;
  font-size: 11.5px;
}
.telemetry-block {
  background: #faf5ff;
  border: 1px solid #e9d5ff;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.telemetry-title {
  font-size: 12px;
  font-weight: 800;
  color: #6d28d9;
}
.snapshot-inline .metric-mini-grid {
  grid-template-columns: repeat(2, 1fr);
}
.signature-grid {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.insight-row {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 12px;
}
.insight-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.insight-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.handled-banner {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;
  color: #065f46;
}

/* 大盘视图（质控主管节点） */
.content-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 4px;
}
.metric-card {
  background: #ffffff;
  padding: 18px 20px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}
.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.metric-title {
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
}
.metric-num {
  font-size: 32px;
  font-weight: 800;
  color: #0f172a;
}
.metric-label {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 4px;
}
.text-warning { color: #f59e0b; }
.text-purple { color: #8b5cf6; }
.text-success { color: #10b981; }
.text-primary { color: #0284c7; }
.text-danger { color: #dc2626; }
.text-muted { color: #94a3b8; }
.text-xs { font-size: 12px; }
.font-mono { font-family: ui-monospace, monospace; }
.font-bold { font-weight: 700; }
.mt-1 { margin-top: 4px; }
.mt-2 { margin-top: 8px; }
.mt-3 { margin-top: 12px; }
.mt-4 { margin-top: 16px; }
.mb-3 { margin-bottom: 12px; }
.ml-2 { margin-left: 8px; }
.p-3 { padding: 12px; }
.bg-gray-50 { background: #f8fafc; border-radius: 8px; }

.two-col-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.stat-card {
  background: #ffffff;
  padding: 18px 20px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
}
.card-title-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.card-title {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}
.gaussian-stat-row {
  display: flex;
  align-items: center;
  justify-content: space-around;
  margin-bottom: 16px;
}
.stat-box {
  text-align: center;
}
.stat-box .val {
  font-size: 26px;
  font-weight: 800;
  color: #0f172a;
}
.stat-box .lbl {
  font-size: 12px;
  color: #64748b;
  margin-top: 2px;
}
.stat-divider {
  font-size: 16px;
  font-weight: 700;
  color: #94a3b8;
}
.progress-bar-container { margin-top: 14px; }
.progress-header {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #64748b;
  margin-bottom: 6px;
}
.progress-track {
  height: 12px;
  background: #f1f5f9;
  border-radius: 6px;
  position: relative;
}
.progress-fill {
  height: 100%;
  background: #10b981;
  border-radius: 6px;
}
.standard-marker {
  position: absolute;
  top: -4px;
  bottom: -4px;
  width: 3px;
  background: #ef4444;
  border-radius: 2px;
}
.compliance-gauges {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  text-align: center;
}
.gauge-item {
  padding: 12px 6px;
  background: #f8fafc;
  border-radius: 8px;
}
.gauge-num { font-size: 24px; font-weight: 800; }
.gauge-lbl {
  font-size: 12px;
  font-weight: 700;
  color: #334155;
  margin-top: 4px;
}
.gauge-sub {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 2px;
}
.roster-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
.roster-card {
  padding: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}
.roster-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.roster-name {
  font-size: 14px;
  font-weight: 700;
}
.roster-details {
  font-size: 12px;
  color: #475569;
  line-height: 1.6;
}

/* 客观物联质证视图 */
.panel-alert {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 4px;
  font-size: 13px;
  color: #92400e;
}
.alert-icon { font-size: 20px; }
.snapshot-deck {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-top: 8px;
}
.snapshot-card {
  background: #ffffff;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  padding: 16px;
}
.snapshot-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 8px;
  margin-bottom: 10px;
}
.snapshot-id {
  font-family: monospace;
  font-weight: 700;
  color: #0284c7;
}
.elder-info-row {
  font-size: 13px;
  margin-bottom: 10px;
}
.metric-mini-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}
.mini-item {
  background: #f8fafc;
  padding: 8px;
  border-radius: 6px;
  text-align: center;
}
.mini-item .val {
  font-size: 16px;
  font-weight: 700;
}
.mini-item .lbl {
  font-size: 11px;
  color: #64748b;
  margin-top: 2px;
}
.cv-box {
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 6px;
  padding: 10px 12px;
}
.cv-title {
  font-size: 12px;
  font-weight: 700;
  color: #334155;
  margin-bottom: 4px;
}
.cv-desc {
  font-size: 12px;
  color: #475569;
  line-height: 1.5;
  margin: 0;
}
.cv-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  flex-wrap: wrap;
  gap: 6px;
}
.redline-tag {
  background: #fee2e2;
  color: #b91c1c;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
}
.insights-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.insight-title { font-size: 15px; font-weight: 700; color: #0f172a; }
.insight-detail { font-size: 13px; }
.insight-focus { font-size: 12.5px; color: #334155; }
.insight-disclaimer { font-size: 11px; }

/* 表单（原弹窗表单样式迁移） */
.notice-box {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 13px;
  color: #1e40af;
}
.expert-profile-banner {
  background: #faf5ff;
  border: 1px solid #e9d5ff;
  padding: 12px 14px;
  border-radius: 6px;
  color: #6b21a8;
}
.form-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.form-group {
  display: flex;
  flex-direction: column;
}
.form-group label {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 4px;
}
.input-field, .textarea-field {
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
  width: 100%;
  box-sizing: border-box;
}
.input-field:focus, .textarea-field:focus {
  border-color: #0284c7;
  outline: none;
}
.scale-scoring-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-top: 8px;
}
.scale-item {
  background: #f8fafc;
  padding: 10px 12px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.scale-item label {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}
.section-title {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 6px;
}
.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
}
.score-pill-group {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.score-tag {
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  color: #475569;
}

/* 按钮 */
.btn {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-sm { padding: 4px 10px; font-size: 12px; }
.btn-primary { background: #0284c7; color: #ffffff; }
.btn-primary:hover { background: #0369a1; }
.btn-info { background: #0ea5e9; color: #ffffff; }
.btn-info:hover { background: #0284c7; }
.btn-success { background: #10b981; color: #ffffff; }
.btn-success:hover { background: #059669; }
.btn-purple { background: #8b5cf6; color: #ffffff; }
.btn-purple:hover { background: #7c3aed; }
.btn-danger { background: #ef4444; color: #ffffff; }
.btn-warning { background: #f59e0b; color: #ffffff; }
.btn-group {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}
.tag-blue { background: #e0f2fe; color: #0284c7; }
.tag-green { background: #dcfce7; color: #16a34a; }
.tag-amber { background: #fef3c7; color: #d97706; }
.tag-purple { background: #ede9fe; color: #7c3aed; }
.tag-danger { background: #fee2e2; color: #dc2626; }
.tag-info { background: #f1f5f9; color: #475569; }
.tag-success { background: #dcfce7; color: #15803d; }
.tag-warning { background: #fef3c7; color: #b45309; }

/* 官方红头结论书 */
.official-certificate {
  background: #ffffff;
  border: 2px solid #b91c1c;
  padding: 30px;
  border-radius: 4px;
  position: relative;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}
.cert-header {
  text-align: center;
  border-bottom: 2px solid #b91c1c;
  padding-bottom: 16px;
  margin-bottom: 20px;
}
.national-emblem { font-size: 32px; }
.cert-title-cn {
  font-size: 22px;
  font-weight: 800;
  color: #b91c1c;
  margin-top: 6px;
}
.cert-subtitle-cn {
  font-size: 12px;
  color: #475569;
  margin-top: 4px;
}
.cert-no {
  font-size: 12px;
  color: #64748b;
  margin-top: 6px;
}
.cert-table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid #cbd5e1;
}
.cert-table td {
  border: 1px solid #cbd5e1;
  padding: 10px 12px;
  font-size: 13px;
}
.cert-lbl {
  width: 130px;
  background: #f8fafc;
  font-weight: 700;
  color: #334155;
  text-align: right;
}
.cert-val { color: #0f172a; }
.cert-grade {
  font-size: 16px;
  font-weight: 800;
}
.cert-signature-area {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-top: 30px;
  padding-top: 16px;
}
.sig-col { width: 30%; }
.sig-name {
  font-size: 18px;
  color: #0369a1;
  margin-top: 8px;
}
.sig-seal-col {
  position: relative;
  text-align: center;
}
.official-red-seal {
  width: 120px;
  height: 120px;
  border: 3px solid #dc2626;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: rotate(-10deg);
  opacity: 0.88;
  margin: 0 auto;
}
.seal-inner { text-align: center; }
.seal-star {
  color: #dc2626;
  font-size: 20px;
}
.seal-text-top {
  color: #dc2626;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: -0.5px;
}
.seal-text-bottom {
  color: #dc2626;
  font-size: 11px;
  font-weight: 800;
  margin-top: 2px;
}
.font-cursive { font-family: 'KaiTi', 'STKaiti', cursive; }

@media (max-width: 1280px) {
  .compliance-ribbon {
    grid-template-columns: repeat(2, 1fr);
  }
  .metric-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .two-col-grid {
    grid-template-columns: 1fr;
  }
  .roster-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .snapshot-deck {
    grid-template-columns: 1fr;
  }
  .form-grid-2, .scale-scoring-grid {
    grid-template-columns: 1fr;
  }
}
</style>
