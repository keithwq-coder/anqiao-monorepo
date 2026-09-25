const fs = require('fs');

let ltcCode = fs.readFileSync('server/ltc.js', 'utf8');

// 1. Add Suqian persons to SEED_ASSESSED_PERSONS
const suqianPersonsSnippet = `  {
    person_id: 'P_SQ_01',
    name: '许丽',
    gender: 'female',
    age: 78,
    id_card: '3213021948********',
    pool_id: 'bureau',
    address: '宿迁市宿城区项里街道长护险试点照护点01号',
    guardian_name: '许建新',
    guardian_phone: '139****2233',
    disability_status: '重度失能（生活自理能力缺失）',
    service_org_id: 'bureau',
    bed_id: 'SQ-01',
    device_id: 'ASH01086',
    device_model: 'AI健康守护仪 (ASH-01)',
    assessment_batch: '2026-Q3-宿迁长护险试点首批',
  },
  {
    person_id: 'P_SQ_02',
    name: '何家齐',
    gender: 'male',
    age: 82,
    id_card: '3213021944********',
    pool_id: 'bureau',
    address: '宿迁市宿城区双庄街道长护险试点照护点02号',
    guardian_name: '何国栋',
    guardian_phone: '138****6677',
    disability_status: '重度失能（生活部分重度障碍）',
    service_org_id: 'bureau',
    bed_id: 'SQ-02',
    device_id: 'ASH01078',
    device_model: 'AI健康守护仪 (ASH-01)',
    assessment_batch: '2026-Q3-宿迁长护险试点首批',
  },
  {
    person_id: 'P_SQ_03',
    name: '丁志坤',
    gender: 'male',
    age: 85,
    id_card: '3213021941********',
    pool_id: 'bureau',
    address: '宿迁市宿城区支口街道长护险试点照护点03号',
    guardian_name: '丁俊华',
    guardian_phone: '137****8899',
    disability_status: '重度失能（高龄失能认知照护）',
    service_org_id: 'bureau',
    bed_id: 'SQ-03',
    device_id: 'ASH01092',
    device_model: 'AI健康守护仪 (ASH-01)',
    assessment_batch: '2026-Q3-宿迁长护险试点首批',
  },`;

if (!ltcCode.includes('P_SQ_01')) {
  const insertPos = ltcCode.indexOf('const SEED_ASSESSED_PERSONS = [\n');
  const insertPosCRLF = ltcCode.indexOf('const SEED_ASSESSED_PERSONS = [\r\n');
  if (insertPosCRLF !== -1) {
    const idx = insertPosCRLF + 'const SEED_ASSESSED_PERSONS = [\r\n'.length;
    ltcCode = ltcCode.slice(0, idx) + suqianPersonsSnippet + '\r\n' + ltcCode.slice(idx);
  } else if (insertPos !== -1) {
    const idx = insertPos + 'const SEED_ASSESSED_PERSONS = [\n'.length;
    ltcCode = ltcCode.slice(0, idx) + suqianPersonsSnippet + '\n' + ltcCode.slice(idx);
  }
}

// 2. Add bureau to ORG_NAMES
if (!ltcCode.includes("bureau: '宿迁市医疗保障局")) {
  ltcCode = ltcCode.replace(
    "kaijian: '凯健国际护理院',",
    "bureau: '宿迁市医疗保障局 / 长护险统筹监管中心',\n  kaijian: '凯健国际护理院',"
  );
}

// 3. Add medical records for Suqian persons
const suqianMedicalSnippet = `  {
    record_id: 'MR-SQ-01086',
    person_id: 'P_SQ_01',
    patient_name: '许丽',
    age: 78,
    gender: '女',
    hospital_name: '宿迁市第一人民医院',
    department: '神经内科 / 老年医学科',
    admission_no: 'SQ202601086',
    admission_date: '2026-01-10',
    discharge_date: '2026-02-15',
    illness_duration_months: 8,
    statutory_gate_passed: true,
    attending_doctor: '陈建国 主任医师',
    primary_diagnosis: '脑梗死后遗症伴双下肢活动受限',
    secondary_diagnoses: [
      '高血压病3级（很高危）',
      '重度骨质疏松伴退行性骨关节炎',
      '老年衰弱综合征',
    ],
    chief_complaint: '肢体无力伴行动不能8月余，日常生活重度依赖。',
    admission_condition: '神清，慢性病容，轮椅推入。查体不完全合作。双下肢肌力2级，生活完全需要他人协助。',
    treatment_course: '住院期间予改善脑循环、神经营养及积极康复训练，出院后纳入长护险居家上门照护。',
    discharge_condition: '生命体征平稳，遗留重度运动功能障碍，日常起居完全依赖他人照料。',
    discharge_orders: '长期照护，卧床防压疮，持续体征物联感知监测，定点机构上门护理。',
    created_at: '2026-02-15T15:00:00+08:00',
  },
  {
    record_id: 'MR-SQ-01078',
    person_id: 'P_SQ_02',
    patient_name: '何家齐',
    age: 82,
    gender: '男',
    hospital_name: '宿迁市人民医院',
    department: '心血管内科 / 慢病管理中心',
    admission_no: 'SQ202601078',
    admission_date: '2026-02-01',
    discharge_date: '2026-03-05',
    illness_duration_months: 12,
    statutory_gate_passed: true,
    attending_doctor: '李春华 副主任医师',
    primary_diagnosis: '冠状动脉粥样硬化性心脏病（心功能Ⅳ级）',
    secondary_diagnoses: [
      '慢性充血性心力衰竭',
      '2型糖尿病合并大血管病变',
      '慢性肾功能不全（CKD 3期）',
    ],
    chief_complaint: '反复胸闷气促1年余，夜间端坐呼吸，生活活动严重受限。',
    admission_condition: '半卧位，喘息貌，口唇轻度发绀，双肺底可闻及湿啰音，双下肢重度凹陷性水肿。',
    treatment_course: '住院给予强心、利尿、扩血管及心肌代谢优化支持，病情好转后转入居家医保连续监测。',
    discharge_condition: '心衰症状好转，活动耐力严重减退，重度失能。',
    discharge_orders: '低盐清淡饮食，严格记录出入量，长期心率呼吸体征感知监护。',
    created_at: '2026-03-05T16:00:00+08:00',
  },
  {
    record_id: 'MR-SQ-01092',
    person_id: 'P_SQ_03',
    patient_name: '丁志坤',
    age: 85,
    gender: '男',
    hospital_name: '宿迁市中医院',
    department: '脑病科 / 认知康复科',
    admission_no: 'SQ202601092',
    admission_date: '2026-01-20',
    discharge_date: '2026-03-10',
    illness_duration_months: 18,
    statutory_gate_passed: true,
    attending_doctor: '王广林 主任医师',
    primary_diagnosis: '阿尔茨海默病（重度认知障碍期）',
    secondary_diagnoses: [
      '帕金森综合征',
      '老年性睡眠节律紊乱',
      '多次跌倒既往史',
    ],
    chief_complaint: '记忆力减退进行性加重3年，失认失用、夜间游荡伴步态不稳1年半。',
    admission_condition: '高龄老年男性，定向力消失，语言表达障碍，行走不稳，步态慌张，肌张力呈齿轮样增高。',
    treatment_course: '住院予胆碱酯酶抑制剂、多巴胺受体激动剂及认知干预训练，夜间加强安全看护防跌倒。',
    discharge_condition: '认知严重缺损，日常生活各项完全无法独立完成，失能评定为重度失能。',
    discharge_orders: '家属24小时防跌倒防走失看护，启用智能雷达在离床防跌倒连续监护。',
    created_at: '2026-03-10T14:30:00+08:00',
  },`;

if (!ltcCode.includes('MR-SQ-01086')) {
  const insertPos = ltcCode.indexOf('export const SEED_MEDICAL_RECORDS = [\n');
  const insertPosCRLF = ltcCode.indexOf('export const SEED_MEDICAL_RECORDS = [\r\n');
  if (insertPosCRLF !== -1) {
    const idx = insertPosCRLF + 'export const SEED_MEDICAL_RECORDS = [\r\n'.length;
    ltcCode = ltcCode.slice(0, idx) + suqianMedicalSnippet + '\r\n' + ltcCode.slice(idx);
  } else if (insertPos !== -1) {
    const idx = insertPos + 'export const SEED_MEDICAL_RECORDS = [\n'.length;
    ltcCode = ltcCode.slice(0, idx) + suqianMedicalSnippet + '\n' + ltcCode.slice(idx);
  }
}

// 4. Add work orders for Suqian
const suqianWorkOrdersSnippet = `  {
    order_id: 'WO-SQ-01086',
    person_id: 'P_SQ_01',
    person_name: '许丽',
    device_id: 'ASH01086',
    order_type: 'device_monitoring',
    title: '宿迁长护险·许丽 居家守护仪在床核验工单',
    status: 'in_progress',
    priority: 'high',
    org_id: 'bureau',
    created_at: '2026-09-23T09:00:00+08:00',
    description: '医保长护险居家试点设备在线在床连续感知佐证已接入，心率与呼吸数据流正常上报。',
  },
  {
    order_id: 'WO-SQ-01078',
    person_id: 'P_SQ_02',
    person_name: '何家齐',
    device_id: 'ASH01078',
    order_type: 'device_monitoring',
    title: '宿迁长护险·何家齐 居家守护仪在床核验工单',
    status: 'in_progress',
    priority: 'high',
    org_id: 'bureau',
    created_at: '2026-09-23T09:15:00+08:00',
    description: '慢病合并心衰失能长者体征监测已接入，夜间心率及呼吸率连续分析中。',
  },
  {
    order_id: 'WO-SQ-01092',
    person_id: 'P_SQ_03',
    person_name: '丁志坤',
    device_id: 'ASH01092',
    order_type: 'device_monitoring',
    title: '宿迁长护险·丁志坤 认知障碍夜间离床重点监护工单',
    status: 'in_progress',
    priority: 'high',
    org_id: 'bureau',
    created_at: '2026-09-23T09:30:00+08:00',
    description: '高龄重度失能认知照护长者，已配置夜间离床超时告警与跌倒主动干预联动。',
  },`;

if (!ltcCode.includes('WO-SQ-01086')) {
  const insertPos = ltcCode.indexOf('export const SEED_WORK_ORDERS = [\n');
  const insertPosCRLF = ltcCode.indexOf('export const SEED_WORK_ORDERS = [\r\n');
  if (insertPosCRLF !== -1) {
    const idx = insertPosCRLF + 'export const SEED_WORK_ORDERS = [\r\n'.length;
    ltcCode = ltcCode.slice(0, idx) + suqianWorkOrdersSnippet + '\r\n' + ltcCode.slice(idx);
  } else if (insertPos !== -1) {
    const idx = insertPos + 'export const SEED_WORK_ORDERS = [\n'.length;
    ltcCode = ltcCode.slice(0, idx) + suqianWorkOrdersSnippet + '\n' + ltcCode.slice(idx);
  }
}

fs.writeFileSync('server/ltc.js', ltcCode, 'utf8');
console.log('Successfully updated server/ltc.js with real Suqian records!');
