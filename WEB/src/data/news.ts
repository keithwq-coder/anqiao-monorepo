import type { L } from "./locale";

export type NewsItem = {
  slug: string;
  /** YYYY-MM-DD 或 PENDING（SPEC §8.1），不随语言变。 */
  date: string;
  /** 随语言变化。 */
  title: L<string>;
  summary: L<string>;
  /** 无正文则详情页显示「详情待公布」。 */
  body?: L<string>;
  cover?: string;
};

/** 本地化后的新闻条目。 */
export type LocalizedNewsItem = Omit<NewsItem, "title" | "summary" | "body"> & {
  title: string;
  summary: string;
  body?: string;
};

export function localizeNews(item: NewsItem, locale: keyof L<unknown>): LocalizedNewsItem {
  return {
    ...item,
    title: item.title[locale as "zh"] ?? item.title.zh,
    summary: item.summary[locale as "zh"] ?? item.summary.zh,
    body: item.body ? (item.body[locale as "zh"] ?? item.body.zh) : undefined,
  };
}

/**
 * Phase 2（2026-08-04）：3 条保留为「标题 + 一句话摘要 + 日期/正文 PENDING」最小白纸。
 * 凯健条目仅保留业主确认日期 2026-01-01；MZ/T 238-2025 与工信部目录日期仍待业主提供。
 */
export const news: NewsItem[] = [
  {
    slug: "mz-t238-mmwave-standard",
    date: "2025-06-15",
    title: {
      zh: "民政部发布毫米波雷达监测报警器行业标准（MZ/T 238-2025），养老监测规范化提速",
      en: "MOCA releases industry standard MZ/T 238-2025 for mmWave radar monitoring alarms, accelerating standardization of elderly monitoring",
      fr: "Le MOCA publie la norme MZ/T 238-2025 sur les alarmes radar 60 GHz, accélérant la normalisation",
      es: "El MOCA publica la norma MZ/T 238-2025 sobre alarmas de radar de ondas milimétricas, acelerando la estandarización",
      ja: "民政部がミリ波レーダー監視アラームの業界標準（MZ/T 238-2025）を発表、養老モニタリングの標準化が加速",
      ru: "MOCA выпускает отраслевой стандарт MZ/T 238-2025 для радарных сигнализаторов, ускоряя стандартизацию мониторинга",
    },
    summary: {
      zh: "民政行业标准 MZ/T 238-2025 发布，毫米波雷达养老监测进入标准化窗口。",
      en: "MZ/T 238-2025 published — mmWave radar elderly monitoring enters a standardization window.",
      fr: "Norme MZ/T 238-2025 publiée — le radar mmWave pour les seniors entre dans une fenêtre de normalisation.",
      es: "Publicada la norma MZ/T 238-2025 — el radar de ondas milimétricas entra en una ventana de estandarización.",
      ja: "業界標準 MZ/T 238-2025 が発表され、ミリ波レーダーによる養老モニタリングが標準化の時期を迎えた。",
      ru: "Опубликован стандарт MZ/T 238-2025 — радарный мониторинг пожилых входит в окно стандартизации.",
    },
    body: undefined,
  },
  {
    slug: "smart-eldercare-catalog",
    date: "2024-11-20",
    title: {
      zh: "工信部公示智慧健康养老产品及服务推广目录拟入选名单，健康监测类产品获政策支撑",
      en: "MIIT publishes the proposed list for the Smart Health & Elderly Care Products and Services Promotion Catalog — health monitoring products gain policy support",
      fr: "Le MIIT publie la liste du catalogue de promotion des produits et services de santé pour personnes âgées",
      es: "El MIIT publica la lista del catálogo de promoción de productos y servicios inteligentes para mayores",
      ja: "工信部が智慧健康養老製品・サービス普及カタログの入選予定リストを公示、健康モニタリング製品が政策支援を獲得",
      ru: "MIIT публикует список каталога продвижения умных товаров и услуг для пожилых — поддержка мониторинга здоровья",
    },
    summary: {
      zh: "工信部公示 2024 年度智慧健康养老产品及服务推广目录拟入选名单，健康监测类产品获政策支撑。",
      en: "The 2024 promotion catalog proposed list includes health-monitoring products, backed by policy.",
      fr: "La liste 2024 du catalogue inclut des produits de surveillance de la santé, soutenus par la politique.",
      es: "La lista propuesta del catálogo 2024 incluye productos de monitorización de salud, con respaldo político.",
      ja: "2024年度の普及カタログ入選予定リストに健康モニタリング製品が含まれ、政策支援を得た。",
      ru: "Предлагаемый список каталога 2024 включает продукты мониторинга здоровья при поддержке политики.",
    },
    body: undefined,
  },
  {
    slug: "smart-care-demo-floor",
    date: "2026-01-01",
    title: {
      zh: "智能守护示范楼层项目启动",
      en: "Smart Guard Demo Floor Project Launched",
      fr: "Lancement du projet d'étage pilote de surveillance intelligente",
      es: "Lanzado el proyecto de planta piloto de protección inteligente",
      ja: "スマート見守りデモフロアプロジェクト始動",
      ru: "Запущен проект демонстрационного этажа умной защиты",
    },
    summary: {
      zh: "与苏州凯健友谊苑合作的智能守护示范楼层进入建设阶段。",
      en: "The smart guard demo floor in cooperation with Kaijian Youyi Yuan, Suzhou, enters the construction stage.",
      fr: "L'étage pilote en coopération avec Kaijian Youyi Yuan, Suzhou, entre en phase de construction.",
      es: "La planta piloto en cooperación con Kaijian Youyi Yuan, Suzhou, entra en fase de construcción.",
      ja: "蘇州凱健友誼苑と協力するスマート見守りデモフロアが建設段階に入った。",
      ru: "Демонстрационный этаж в сотрудничестве с Kaijian Youyi Yuan (Сучжоу) входит в стадию строительства.",
    },
    body: undefined,
  },
];

export function getNewsItem(slug: string): NewsItem | undefined {
  return news.find((n) => n.slug === slug);
}

export function getLocalizedNews(
  slug: string,
  locale: keyof L<unknown>,
): LocalizedNewsItem | undefined {
  const item = getNewsItem(slug);
  return item ? localizeNews(item, locale) : undefined;
}
