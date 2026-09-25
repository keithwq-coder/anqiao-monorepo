import type { L } from "./locale";

/**
 * 产品「适用场景」标签 → 解决方案页锚点映射（REBUILD 阶段 7+ 补充）。
 * 产品 scenes 展示文本与解决方案 name 不完全一致（如「医疗卫生」vs「医疗卫生机构」），
 * 故单独维护产品视角的场景标签，标签文本与 src/data/products/* 的 scenes 值保持一致。
 */
export type SceneAnchor = {
  anchor: string;
  label: L<string>;
  /** 场景图片生图提示词（中文，文生图 ChatGPT 用；仅应用场景需要）。 */
  imagePrompt?: string;
};

export const SCENE_ANCHORS: SceneAnchor[] = [
  {
    anchor: "institution",
    label: {
      zh: "养老机构",
      en: "Elderly-care institutions",
      fr: "Institutions pour personnes âgées",
      es: "Residencias de ancianos",
      ja: "介護施設",
      ru: "Учреждения для пожилых",
    },
    imagePrompt: "现代中高端养老机构（CCRC 康养社区）明亮的活动大厅，几位精神矍铄的长者午后围坐聊天，室内绿植与暖光，角落一台壁挂无感监测设备自然融入。写实商业摄影风格，自然暖光，伪纪录片质感，画面中有一台小巧的白色无感监测设备（壁挂雷达或吸顶雷达）自然融入环境，无任何恐惧感，传达安心与科技温暖，画面干净无文字无水印，高清细节。",
  },
  {
    anchor: "community",
    label: {
      zh: "社区居家养老",
      en: "Community home care",
      fr: "Soins à domicile",
      es: "Cuidados en el hogar",
      ja: "在宅介護",
      ru: "Домашний уход",
    },
    imagePrompt: "温馨的居家客厅，老人在沙发上看报，窗外阳光洒入，电视柜上方一台小巧壁挂雷达无感守护，客厅整洁温暖。写实商业摄影风格，自然暖光，伪纪录片质感，画面中有一台小巧的白色无感监测设备（壁挂雷达或吸顶雷达）自然融入环境，无任何恐惧感，传达安心与科技温暖，画面干净无文字无水印，高清细节。",
  },
  {
    anchor: "medical",
    label: {
      zh: "医疗卫生",
      en: "Medical & health",
      fr: "Médical et santé",
      es: "Médico y salud",
      ja: "医療衛生",
      ru: "Медицина и здоровье",
    },
    imagePrompt: "社区卫生服务中心的医护工作台，护士拿着平板记录，诊疗床旁一台白色无感监测设备，整体洁净明亮、信任感强。写实商业摄影风格，自然暖光，伪纪录片质感，画面中有一台小巧的白色无感监测设备（壁挂雷达或吸顶雷达）自然融入环境，无任何恐惧感，传达安心与科技温暖，画面干净无文字无水印，高清细节。",
  },
  {
    anchor: "wellness",
    label: {
      zh: "大健康·美业",
      en: "Wellness & beauty",
      fr: "Bien-être et beauté",
      es: "Bienestar y estética",
      ja: "ウェルネス・美容",
      ru: "Велнес и красота",
    },
    imagePrompt: "高端美业门店的休息区，客人在美容椅上放松品茶，台面一台白色健康筛查设备，氛围精致舒适。写实商业摄影风格，自然暖光，伪纪录片质感，画面中有一台小巧的白色无感监测设备（壁挂雷达或吸顶雷达）自然融入环境，无任何恐惧感，传达安心与科技温暖，画面干净无文字无水印，高清细节。",
  },
  {
    anchor: "retrofit",
    label: {
      zh: "装修·适老化改造",
      en: "Aging-friendly retrofit",
      fr: "Rénovation adaptée au vieillissement",
      es: "Reforma adaptada al envejecimiento",
      ja: "バリアフリー改修",
      ru: "Адаптация жилья для пожилых",
    },
    imagePrompt: "完成适老化改造的居家空间，卫生间装了安全扶手，卧室床头有白色无感守护设备，改造后明亮安全。写实商业摄影风格，自然暖光，伪纪录片质感，画面中有一台小巧的白色无感监测设备（壁挂雷达或吸顶雷达）自然融入环境，无任何恐惧感，传达安心与科技温暖，画面干净无文字无水印，高清细节。",
  },
  {
    anchor: "insurance",
    label: {
      zh: "长护险监管",
      en: "Long-term care insurance supervision",
      fr: "Supervision de l'assurance dépendance",
      es: "Supervisión del seguro de larga duración",
      ja: "介護保険監督",
      ru: "Надзор за страхованием долгосрочного ухода",
    },
    imagePrompt: "长护险数据监管中心，工作人员面对大屏查看无感监测数据报表，严谨专业的政务空间氛围。写实商业摄影风格，自然暖光，伪纪录片质感，画面中有一台小巧的白色无感监测设备（壁挂雷达或吸顶雷达）自然融入环境，无任何恐惧感，传达安心与科技温暖，画面干净无文字无水印，高清细节。",
  },
  {
    anchor: "home-security",
    label: {
      zh: "居家安防",
      en: "Home safety & security",
      fr: "Sécurité à domicile",
      es: "Seguridad en el hogar",
      ja: "在宅セキュリティ",
      ru: "Безопасность дома",
    },
    imagePrompt: "普通家庭客厅深夜，家人在卧室安睡，客厅角落一台白色无感守护设备亮着微弱的指示灯，静谧安心。写实商业摄影风格，自然暖光，伪纪录片质感，画面中有一台小巧的白色无感监测设备（壁挂雷达或吸顶雷达）自然融入环境，无任何恐惧感，传达安心与科技温暖，画面干净无文字无水印，高清细节。",
  },
  {
    anchor: "hotel",
    label: {
      zh: "智慧酒店",
      en: "Smart hospitality",
      fr: "Hôtellerie intelligente",
      es: "Hotelería inteligente",
      ja: "スマートホテル",
      ru: "Умные отели",
    },
    imagePrompt: "高端酒店客房夜景，落地窗半开透出城市灯火，室内暖调灯光，天花板上吸顶雷达设备低调融入，静谧高级感。写实商业摄影风格，自然暖光，伪纪录片质感，画面中有一台小巧的白色无感监测设备（壁挂雷达或吸顶雷达）自然融入环境，无任何恐惧感，传达安心与科技温暖，画面干净无文字无水印，高清细节。",
  },
  {
    anchor: "maternal-infant",
    label: {
      zh: "母婴照护",
      en: "Maternal & infant care",
      fr: "Soins mère-enfant",
      es: "Cuidados materno-infantiles",
      ja: "母子ケア",
      ru: "Уход за матерью и ребёнком",
    },
    imagePrompt: "月子中心温馨婴儿房，护士轻轻照看婴儿床，暖色柔光，床头一台小巧无感监测设备，画面柔和充满安全感。写实商业摄影风格，自然暖光，伪纪录片质感，画面中有一台小巧的白色无感监测设备（壁挂雷达或吸顶雷达）自然融入环境，无任何恐惧感，传达安心与科技温暖，画面干净无文字无水印，高清细节。",
  },
  {
    anchor: "housekeeping",
    label: {
      zh: "居家服务",
      en: "Home services",
      fr: "Services à domicile",
      es: "Servicios en el hogar",
      ja: "在宅サービス",
      ru: "Домашние услуги",
    },
    imagePrompt: "家政服务人员到独居老人家中，老人含笑迎接，客厅一角白色无感守护设备，画面传递信任与安心。写实商业摄影风格，自然暖光，伪纪录片质感，画面中有一台小巧的白色无感监测设备（壁挂雷达或吸顶雷达）自然融入环境，无任何恐惧感，传达安心与科技温暖，画面干净无文字无水印，高清细节。",
  },
  {
    anchor: "relocation-care",
    label: {
      zh: "旅居康养",
      en: "Relocation & vacation care",
      fr: "Séjours de santé",
      es: "Cuidados en estancias",
      ja: "旅居康養",
      ru: "Оздоровительные поездки",
    },
    imagePrompt: "康养基地的湖景大床房，神采奕奕的长者站在落地窗前眺望湖景，床头墙面一台白色壁挂设备，窗外水天一色。写实商业摄影风格，自然暖光，伪纪录片质感，画面中有一台小巧的白色无感监测设备（壁挂雷达或吸顶雷达）自然融入环境，无任何恐惧感，传达安心与科技温暖，画面干净无文字无水印，高清细节。",
  },
  {
    anchor: "workplace-health",
    label: {
      zh: "职场健康",
      en: "Workplace health",
      fr: "Santé au travail",
      es: "Salud laboral",
      ja: "職場の健康",
      ru: "Здоровье на рабочем месте",
    },
    imagePrompt: "现代企业健康休息区，白领靠在沙发椅上闭目休息，墙面健康数据屏与一台白色壁挂设备，简洁明亮有科技感。写实商业摄影风格，自然暖光，伪纪录片质感，画面中有一台小巧的白色无感监测设备（壁挂雷达或吸顶雷达）自然融入环境，无任何恐惧感，传达安心与科技温暖，画面干净无文字无水印，高清细节。",
  },

  {
    anchor: "insurance-health",
    label: {
      zh: "保险健康权益",
      en: "Insurance health benefits",
      fr: "Avantages santé pour assureurs",
      es: "Beneficios de salud para aseguradoras",
      ja: "保険健康特典",
      ru: "Страховые медицинские бонусы",
    },
    imagePrompt: "保险公司健康小站，客户在工作人员的引导下体验无感健康监测，空间明亮亲和，背景有品牌柔光。写实商业摄影风格，自然暖光，伪纪录片质感，画面中有一台小巧的白色无感监测设备（壁挂雷达或吸顶雷达）自然融入环境，无任何恐惧感，传达安心与科技温暖，画面干净无文字无水印，高清细节。",
  },
  {
    anchor: "bank-wealth",
    label: {
      zh: "银行养老金融",
      en: "Banking & wealth management",
      fr: "Banque et gestion de patrimoine",
      es: "Banca y gestión patrimonial",
      ja: "銀行・ウェルスマネジメント",
      ru: "Банки и управление капиталом",
    },
    imagePrompt: "私人银行贵宾洽谈室，理财顾问向年长客户展示平板上的健康数据，室内有健康监测屏，沉稳大气有质感。写实商业摄影风格，自然暖光，伪纪录片质感，画面中有一台小巧的白色无感监测设备（壁挂雷达或吸顶雷达）自然融入环境，无任何恐惧感，传达安心与科技温暖，画面干净无文字无水印，高清细节。",
  },
  {
    anchor: "health-management",
    label: {
      zh: "健康管理机构",
      en: "Health management organizations",
      fr: "Organismes de gestion de la santé",
      es: "Organizaciones de gestión de salud",
      ja: "健康管理機関",
      ru: "Организации управления здоровьем",
    },
    imagePrompt: "健康管理中心的检测体验区，一位客户在健康筛查一体机前自助检测，空间明亮现代，墙面有健康数据展示。写实商业摄影风格，自然暖光，伪纪录片质感，画面中有一台小巧的白色无感监测设备（壁挂雷达或吸顶雷达）自然融入环境，无任何恐惧感，传达安心与科技温暖，画面干净无文字无水印，高清细节。",
  },
  {
    anchor: "carrier-integration",
    label: {
      zh: "运营商与政企集成",
      en: "Carrier & digital-government integration",
      fr: "Intégration opérateurs et collectivités",
      es: "Integración con operadores y gobierno digital",
      ja: "通信事業者・政企連携",
      ru: "Интеграция с операторами и цифровым госуправлением",
    },
    imagePrompt: "智慧养老运营调度中心，一面大屏展示康养社区数据看板，工程师在操作台前值守，蓝色与暖光交织的科技感。写实商业摄影风格，自然暖光，伪纪录片质感，画面中有一台小巧的白色无感监测设备（壁挂雷达或吸顶雷达）自然融入环境，无任何恐惧感，传达安心与科技温暖，画面干净无文字无水印，高清细节。",
  },

  {
    anchor: "tourism",
    label: {
      zh: "旅游与景区",
      en: "Tourism & scenic areas",
      fr: "Tourisme et espaces naturels",
      es: "Turismo y espacios naturales",
      ja: "観光・景区",
      ru: "Туризм и курортные зоны",
    },
    imagePrompt: "精品度假区民宿客房，年轻夫妇在阳台享受清晨阳光，床头柜上方一台白色壁挂设备优雅融入，窗外山景。写实商业摄影风格，自然暖光，伪纪录片质感，画面中有一台小巧的白色无感监测设备（壁挂雷达或吸顶雷达）自然融入环境，无任何恐惧感，传达安心与科技温暖，画面干净无文字无水印，高清细节。",
  },
  {
    anchor: "child-health",
    label: {
      zh: "儿少健康监测",
      en: "Child & adolescent health monitoring",
      fr: "Suivi de la santé des enfants et adolescents",
      es: "Monitorización de la salud infantil y juvenil",
      ja: "児童・青少年の健康モニタリング",
      ru: "Мониторинг здоровья детей и подростков",
    },
    imagePrompt: "寄宿制学校宿舍清晨，阳光斜照进整齐的宿舍，床头墙上一台白色壁挂设备，画面宁静向上；或显示晨检场景。写实商业摄影风格，自然暖光，伪纪录片质感，画面中有一台小巧的白色无感监测设备（壁挂雷达或吸顶雷达）自然融入环境，无任何恐惧感，传达安心与科技温暖，画面干净无文字无水印，高清细节。",
  },
// 维度扩展（应用场景之外的采购入口/需求主题/人群，供产品 scenes 全面标注）
  {
    anchor: "gifting",
    label: {
      zh: "礼品采购",
      en: "Gifting & corporate benefits",
      fr: "Cadeaux et avantages d'entreprise",
      es: "Regalos y beneficios corporativos",
      ja: "ギフト・福利厚生",
      ru: "Подарки и корпоративные льготы",
    },
  },
  {
    anchor: "labor-protection",
    label: {
      zh: "劳保用品",
      en: "Occupational health & welfare",
      fr: "Santé au travail et protection",
      es: "Salud laboral y protección",
      ja: "労働保護用品",
      ru: "Охрана труда и благополучие",
    },
  },
  {
    anchor: "membership",
    label: {
      zh: "会员服务",
      en: "Membership & rights services",
      fr: "Services d'adhésion",
      es: "Servicios de membresía",
      ja: "会員サービス",
      ru: "Членские сервисы и права",
    },
  },
  {
    anchor: "government-procurement",
    label: {
      zh: "政府采购",
      en: "Government procurement",
      fr: "Achats publics",
      es: "Compras públicas",
      ja: "政府調達",
      ru: "Госзакупки",
    },
  },
  {
    anchor: "corporate-welfare",
    label: {
      zh: "企业福利",
      en: "Corporate benefits",
      fr: "Avantages salariés",
      es: "Beneficios corporativos",
      ja: "企業福利厚生",
      ru: "Корпоративные льготы",
    },
  },
  {
    anchor: "tender-project",
    label: {
      zh: "招投标项目",
      en: "Tender projects",
      fr: "Appels d'offres",
      es: "Licitações / concursos",
      ja: "入札プロジェクト",
      ru: "Тендерные проекты",
    },
  },
  {
    anchor: "sleep-monitoring",
    label: {
      zh: "睡眠监测",
      en: "Sleep monitoring",
      fr: "Suivi du sommeil",
      es: "Monitorización del sueño",
      ja: "睡眠モニタリング",
      ru: "Мониторинг сна",
    },
  },
  {
    anchor: "fall-safety",
    label: {
      zh: "跌倒安全",
      en: "Fall safety",
      fr: "Prévention des chutes",
      es: "Seguridad anti-caídas",
      ja: "転倒安全",
      ru: "Защита от падений",
    },
  },
  {
    anchor: "health-screening",
    label: {
      zh: "健康筛查",
      en: "Health screening",
      fr: "Dépistage santé",
      es: "Cribado de salud",
      ja: "健康スクリーニング",
      ru: "Скрининг здоровья",
    },
  },
  {
    anchor: "chronic-care",
    label: {
      zh: "慢病管理",
      en: "Chronic care",
      fr: "Soins chroniques",
      es: "Cuidados crónicos",
      ja: "慢性疾患管理",
      ru: "Управление хроническими заболеваниями",
    },
  },
  {
    anchor: "maternal-baby",
    label: {
      zh: "母婴守护",
      en: "Maternal & baby care",
      fr: "Protection mère-enfant",
      es: "Cuidados materno-infantiles",
      ja: "母子見守り",
      ru: "Забота о матери и ребёнке",
    },
  },
  {
    anchor: "rehab-management",
    label: {
      zh: "康复管理",
      en: "Rehabilitation",
      fr: "Rééducation",
      es: "Rehabilitación",
      ja: "リハビリ管理",
      ru: "Реабилитация",
    },
  },
  {
    anchor: "health-archive",
    label: {
      zh: "健康档案",
      en: "Health records",
      fr: "Dossiers de santé",
      es: "Historial de salud",
      ja: "健康カルテ",
      ru: "Медкарты",
    },
  },
  {
    anchor: "vital-signs",
    label: {
      zh: "体征监测",
      en: "Vital-sign monitoring",
      fr: "Surveillance des signes",
      es: "Monitorización de signos",
      ja: "バイタルモニタリング",
      ru: "Мониторинг показателей",
    },
  },
  {
    anchor: "seniors",
    label: {
      zh: "长者",
      en: "Seniors",
      fr: "Personnes âgées",
      es: "Mayores",
      ja: "高齢者",
      ru: "Пожилые",
    },
  },
  {
    anchor: "alone-seniors",
    label: {
      zh: "独居空巢老人",
      en: "Seniors living alone",
      fr: "Seniors vivant seuls",
      es: "Mayores que viven solos",
      ja: "独居・空巣の高齢者",
      ru: "Одинокие пожилые",
    },
  },
  {
    anchor: "children-youth",
    label: {
      zh: "儿童青少年",
      en: "Children & adolescents",
      fr: "Enfants et adolescents",
      es: "Niños y adolescentes",
      ja: "児童・青少年",
      ru: "Дети и подростки",
    },
  },
  {
    anchor: "maternal-postpartum",
    label: {
      zh: "母婴/产后人群",
      en: "Mothers & newborns",
      fr: "Mères et nouveau-nés",
      es: "Madres y recién nacidos",
      ja: "母子・産後",
      ru: "Матери и новорождённые",
    },
  },
  {
    anchor: "high-pressure",
    label: {
      zh: "高压力/亚健康人群",
      en: "High-stress & sub-health",
      fr: "Stress et sous-santé",
      es: "Estrés y subsalud",
      ja: "高ストレス・亜健康層",
      ru: "Стресс и субздоровье",
    },
  },
  {
    anchor: "post-op-rehab",
    label: {
      zh: "术后康复人群",
      en: "Post-operative patients",
      fr: "Patients en convalescence",
      es: "Pacientes postoperatorios",
      ja: "術後リハビリ層",
      ru: "Послеоперационные пациенты",
    },
  },
  {
    anchor: "chronic-patients",
    label: {
      zh: "慢病人群",
      en: "Chronic-disease patients",
      fr: "Patients chroniques",
      es: "Pacientes crónicos",
      ja: "慢性疾患患者",
      ru: "Пациенты с хроническими заболеваниями",
    },
  },
];
/** 按当前语言标签反查维度（app/purchase/topic/person；查不到返回 undefined）。 */
export function sceneDimensionByLabel(
  label: string,
): "app" | "purchase" | "topic" | "person" | undefined {
  for (const sc of SCENE_ANCHORS) {
    if (Object.values(sc.label).includes(label)) {
      return SCENE_DIMENSION[sc.anchor];
    }
  }
  return undefined;
}

/** 按当前语言标签反查 anchor（匹配不到返回 undefined，渲染为纯文本）。 */
export function sceneAnchorByLabel(
  label: string,
  locale: keyof L<unknown>,
): string | undefined {
  return SCENE_ANCHORS.find(
    (s) => s.label[locale as "zh"] === label,
  )?.anchor;
}

export const SCENE_DIMENSION: Record<string, "app" | "purchase" | "topic" | "person"> = {
  "institution": "app",
  "community": "app",
  "medical": "app",
  "wellness": "app",
  "retrofit": "app",
  "insurance": "app",
  "home-security": "app",
  "hotel": "app",
  "maternal-infant": "app",
  "housekeeping": "app",
  "relocation-care": "app",
  "workplace-health": "app",
  "insurance-health": "app",
  "bank-wealth": "app",
  "health-management": "app",
  "carrier-integration": "app",
  "tourism": "app",
  "child-health": "app",
  "gifting": "purchase",
  "labor-protection": "purchase",
  "membership": "purchase",
  "government-procurement": "purchase",
  "corporate-welfare": "purchase",
  "tender-project": "purchase",
  "sleep-monitoring": "topic",
  "fall-safety": "topic",
  "health-screening": "topic",
  "chronic-care": "topic",
  "maternal-baby": "topic",
  "rehab-management": "topic",
  "health-archive": "topic",
  "vital-signs": "topic",
  "seniors": "person",
  "alone-seniors": "person",
  "children-youth": "person",
  "maternal-postpartum": "person",
  "high-pressure": "person",
  "post-op-rehab": "person",
  "chronic-patients": "person",
};
