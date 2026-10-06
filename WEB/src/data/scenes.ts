import type { L } from "./locale";

/**
 * 产品「适用场景」标签 → 解决方案页锚点映射。
 * 对外只保留 SPEC §5.4 的 5 个应用场景；需求主题 / 适用人群仅作产品筛选标签，不生成解决方案路由。
 */
export type SceneAnchor = {
  anchor: string;
  label: L<string>;
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

/** 按当前语言标签反查维度（app/topic/person；查不到返回 undefined）。 */
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

/** 产品筛选 / 详情只展示 SCENE_ANCHORS 里有定义的标签，避免已删场景冒充应用场景。 */
export function filterPublicScenes(labels: string[]): string[] {
  return labels.filter((label) =>
    SCENE_ANCHORS.some((sc) => Object.values(sc.label).includes(label)),
  );
}

/** 仅 5 个对外场景可链到 /solutions#anchor；其余标签渲染为纯文本。 */
const SOLUTION_ANCHORS = new Set([
  "institution",
  "community",
  "medical",
  "wellness",
  "retrofit",
]);

/** 按当前语言标签反查解决方案锚点（非 5 场景返回 undefined）。 */
export function sceneAnchorByLabel(
  label: string,
  locale: keyof L<unknown>,
): string | undefined {
  const found = SCENE_ANCHORS.find(
    (s) => s.label[locale as "zh"] === label,
  )?.anchor;
  if (!found || !SOLUTION_ANCHORS.has(found)) return undefined;
  return found;
}

export const SCENE_DIMENSION: Record<
  string,
  "app" | "purchase" | "topic" | "person"
> = {
  institution: "app",
  community: "app",
  medical: "app",
  wellness: "app",
  retrofit: "app",
  "sleep-monitoring": "topic",
  "fall-safety": "topic",
  "health-screening": "topic",
  "chronic-care": "topic",
  "rehab-management": "topic",
  "health-archive": "topic",
  "vital-signs": "topic",
  seniors: "person",
  "alone-seniors": "person",
  "post-op-rehab": "person",
  "chronic-patients": "person",
};
