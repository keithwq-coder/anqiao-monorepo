import type { L } from "./locale";

export type Solution = {
  /** 锚点 id，不含 #（不随语言变）。 */
  anchor: string;
  name: L<string>;
  /** 决策/买单方。 */
  buyer: L<string>;
  painPoints: L<string[]>;
  /** 推荐设备组合；无依据为 null。 */
  devices: L<string | null>;
  /** 交付价值；无依据为 null。 */
  value: L<string | null>;
  /** 如何应用：部署方式 / 典型点位 / 可结合的合作类型。 */
  application?: L<string>;
};

/** 本地化后的方案。 */
export type LocalizedSolution = Omit<
  Solution,
  "name" | "buyer" | "painPoints" | "devices" | "value" | "application"
> & {
  name: string;
  buyer: string;
  painPoints: string[];
  devices: string | null;
  value: string | null;
  application?: string;
};

export function localizeSolution(
  s: Solution,
  locale: keyof L<unknown>,
): LocalizedSolution {
  return {
    ...s,
    name: s.name[locale as "zh"] ?? s.name.zh,
    buyer: s.buyer[locale as "zh"] ?? s.buyer.zh,
    painPoints: s.painPoints[locale as "zh"] ?? s.painPoints.zh,
    devices: s.devices[locale as "zh"] ?? s.devices.zh,
    value: s.value[locale as "zh"] ?? s.value.zh,
    application: s.application
      ? (s.application[locale as "zh"] ?? s.application.zh)
      : undefined,
  };
}

/**
 * 对外只保留 SPEC §5.4 的 5 个场景。
 * devices/value 按 v5 说明书「场景化方案」页与参数总表填写。
 * 大健康·美业无设备与交付价值依据，保持 null，页面引导询价。
 */
export const solutions: Solution[] = [
  {
    anchor: "institution",
    name: {
      zh: "养老机构",
      en: "Elderly-care institutions",
      fr: "Institutions pour personnes âgées",
      es: "Residencias de ancianos",
      ja: "介護施設",
      ru: "Учреждения для пожилых",
    },
    buyer: {
      zh: "CCRC 康养社区（保险/地产背景）· 医养结合护理院 · 外资高端养老机构 · 认知症照护专区 · 社区嵌入式养老机构",
      en: "CCRC continuing-care communities (insurers/developers) · medical-eldercare nursing homes · foreign-invested premium elderly-care institutions · dementia-care units · community-embedded senior-care facilities",
      fr: "Communautés CCRC (assureurs/promoteurs) · établissements médico-gériatriques · maisons de retraite premium à capitaux étrangers · unités dédiées aux troubles cognitifs · établissements de proximité",
      es: "Comunidades CCRC (aseguradoras/promotoras) · residencias médico-geriátricas · residencias premium de capital extranjero · unidades de demencia · residencias integradas en la comunidad",
      ja: "CCRC継続ケアコミュニティ（保険・不動産系）・医養結合型介護施設・外資系高級介護施設・認知症ケアユニット・地域密着型介護施設",
      ru: "CCRC-сообщества (страховщики/девелоперы) · медико-гериатрические учреждения · премиальные учреждения с иностранным капиталом · подразделения для пациентов с деменцией · учреждения шаговой доступности",
    },
    painPoints: {
      zh: ['护理人力紧张，夜间巡房与盲区难覆盖', '空置率高、获客难，机构普遍微利', '跌倒、走失等安全风险依赖人防，发现不及时', '照护过程缺客观留痕，责任难追溯', '家属信任不足，服务价值难外显'],
      en: ['Nursing-staff shortage — night rounds and blind spots hard to cover', 'High vacancy and hard customer acquisition; most institutions run thin margins', 'Fall and wandering risks rely on human patrol; response is slow', 'Care lacks objective records; accountability is hard to trace', 'Families lack trust; service value is hard to externalize'],
      fr: ['Manque de personnel de soins, tournées de nuit et angles morts', "Taux d'occupation faible, acquisition difficile, marges minces", "Risques de chute et d'errance dépendant de la surveillance humaine", 'Soins sans enregistrement objectif, responsabilité difficile à tracer', 'Confiance des familles insuffisante, valeur du service peu visible'],
      es: ['Escasez de personal de cuidados, rondas nocturnas y ángulos muertos', 'Alta tasa de vacantes y captación difícil; márgenes reducidos', 'Riesgos de caída y deambulación dependen de la vigilancia humana', 'Cuidados sin registro objetivo, responsabilidad difícil de trazar', 'Desconfianza de las familias, valor del servicio poco visible'],
      ja: ['介護人材不足、夜間巡回と死角のカバーが困難', '稼働率が低く集客が難しい、業界全体が薄利', '転倒・徘徊などの安全リスクが人手頼みで発見が遅い', 'ケア過程に客観的な記録がなく、責任の追跡が困難', '家族の信頼不足、サービスの価値が伝わりにくい'],
      ru: ['Нехватка медперсонала — ночные обходы и слепые зоны', 'Высокая вакантность и сложность привлечения клиентов; низкая рентабельность', 'Риски падений и блужданий зависят от людей; медленное реагирование', 'Нет объективных записей ухода; ответственность трудно проследить', 'Недоверие семей; ценность услуг трудно показать'],
    },
    devices: {
      zh: "ZQ-A100 健康筛查一体机、ZQ-50 健康快速通道一体机、ZQ-SH100 AI健康守护仪、ZQ-BH100 床下健康监测仪、ZQ-D100 跌倒监测仪、ZQ-ZH100 照护采集仪、安守护平台",
      en: "ZQ-A100 Health Screening Kiosk, ZQ-50 Health Rapid Pass Kiosk, ZQ-SH100 AI Health Guardian, ZQ-BH100 Under-Bed Health Monitor, ZQ-D100 Fall Detection Monitor, ZQ-ZH100 Care Data Hub, An Shou Hu platform",
      fr: "Borne de dépistage ZQ-A100, borne de passage rapide ZQ-50, garde de santé IA ZQ-SH100, moniteur sous matelas ZQ-BH100, détecteur de chute ZQ-D100, terminal de soins ZQ-ZH100, plateforme An Shou Hu",
      es: "Kiosco de cribado ZQ-A100, kiosco de paso rápido ZQ-50, guardian de salud IA ZQ-SH100, monitor bajo cama ZQ-BH100, detector de caídas ZQ-D100, terminal de cuidados ZQ-ZH100, plataforma An Shou Hu",
      ja: "ZQ-A100健康スクリーニング一体機、ZQ-50健康高速パス一体機、ZQ-SH100 AI健康守護儀、ZQ-BH100ベッド下健康モニター、ZQ-D100転倒検知モニター、ZQ-ZH100ケアデータ採集端末、安守護プラットフォーム",
      ru: "Киоск скрининга ZQ-A100, киоск быстрого прохода ZQ-50, AI-охранник здоровья ZQ-SH100, монитор под кроватью ZQ-BH100, детектор падений ZQ-D100, терминал ухода ZQ-ZH100, платформа An Shou Hu",
    },
    value: {
      zh: '以「技防+人防」协同缓解护理人力压力：夜间与盲区无感守护、跌倒走失即时预警；照护全程客观留痕、责任可追溯；长者健康档案与照护过程数据支撑运营报表，家属远程可见服务价值；覆盖自理、半自理、失能失智长者的全周期照护。',
      en: 'Technology-plus-staff coordination eases the nursing-staff burden: contactless night and blind-spot guarding with instant fall/wandering alerts; objective full-record care with traceable accountability; resident health profiles and care data feed operations reports while families see the service value remotely — spanning full-cycle care for active, semi-dependent and cognitively impaired seniors.',
      fr: "Synergie technologie + personnel : garde sans contact nocturne, alertes de chute/errance, soins traçables, rapports d'exploitation, visibilité pour les familles — de l'autonome au très dépendant.",
      es: 'Sinergia tecnología + personal: vigilancia sin contacto nocturna, alertas de caída/deambulación, cuidados trazables, informes operativos y visibilidad para las familias — de autónomo a dependiente.',
      ja: '「テクノロジー+人防」の連携で介護人材の負担を軽減：夜間・死角の無感見守り、転倒・徘徊の即時アラート、ケア全過程の客観的記録と責任追跡、健康カルテとケアデータによる運営レポート、家族への遠隔可視化。自立・半要介護・要介護・認知症を含む全周期ケア。',
      ru: 'Координация технологий и персонала снижает нагрузку на медиков: бесконтактная охрана ночью и в слепых зонах, мгновенные сигналы падения/блуждания, прослеживаемый уход, отчёты для управления и видимость для семей — полный цикл от самостоятельных до тяжелобольных.',
    },
    application: {
      zh: '在 CCRC 与养老机构内按区域分级应用：居室壁挂式守护仪覆盖夜间睡眠与体征，卫浴安装跌倒报警仪，护理站联动照护采集形成全院闭环；可结合床垫/寝具厂商做一体化寝具方案，服务长者从入住评估到长期照护的全周期。',
      en: 'Deployed by zone inside CCRC and senior-care institutions: wall-mounted guardians cover night sleep and vitals in rooms, fall detectors cover bathrooms, and nursing stations link care terminals into a whole-institution loop; can pair with mattress/bedding makers for integrated bedding solutions serving residents from admission assessment through long-term care.',
      fr: "Déploiement par zone en CCRC et établissements : garde murale en chambre, détecteur de chute en salle de bain, postes de soins reliés ; peut s'associer aux fabricants de matelas.",
      es: 'Despliegue por zonas en CCRC y residencias: guardián de pared en dormitorio, detector de caídas en baño, enlace con enfermería; puede asociarse a fabricantes de colchones.',
      ja: 'CCRC・介護施設内でエリア別に展開：居室に壁掛け見守り、浴室に転倒検知、ナースステーションに連携。寝具メーカーとの一体型ソリューションも可能。',
      ru: 'Развёртывание по зонам в CCRC и учреждениях: настенный охраник в комнате, детектор падений в ванной, связь с медпостами; возможна интеграция с производителями матрасов.',
    },
  },
  {
    anchor: "community",
    name: {
      zh: "社区居家养老",
      en: "Community home care",
      fr: "Soins à domicile",
      es: "Cuidados en el hogar",
      ja: "在宅介護",
      ru: "Домашний уход",
    },
    buyer: {
      zh: "政府 / 社区养老服务中心",
      en: "Government / community elderly-care centers",
      fr: "Gouvernement / centres communautaires",
      es: "Gobierno / centros comunitarios",
      ja: "政府 / コミュニティ介護サービスセンター",
      ru: "Правительство / общественные центры ухода",
    },
    painPoints: {
      zh: ["独居老人无人看护", "政策目录与合规门槛"],
      en: ["Seniors living alone without care", "Policy catalog and compliance thresholds"],
      fr: ["Seniors seuls sans surveillance", "Exigences réglementaires"],
      es: ["Mayores solos sin cuidados", "Catálogos de política y cumplimiento"],
      ja: ["独居高齢者の見守り不在", "政策カタログとコンプライアンスの壁"],
      ru: ["Одинокие пожилые без присмотра", "Политические каталоги и требования"],
    },
    devices: {
      zh: "ZQ-SH100 AI健康守护仪、ZQ-BH100 床下健康监测仪、ZQ-D100 跌倒监测仪、ZQ-GJ100 人体轨迹监测仪、ZQ-A100 健康筛查一体机、ZQ-50 健康快速通道一体机、安守护平台",
      en: "ZQ-SH100 AI Health Guardian, ZQ-BH100 Under-Bed Health Monitor, ZQ-D100 Fall Detection Monitor, ZQ-GJ100 Human Trajectory Monitor, ZQ-A100 Health Screening Kiosk, ZQ-50 Health Rapid Pass Kiosk, An Shou Hu platform",
      fr: "Garde de santé IA ZQ-SH100, moniteur sous matelas ZQ-BH100, détecteur de chute ZQ-D100, moniteur de trajectoire ZQ-GJ100, borne de dépistage ZQ-A100, borne de passage rapide ZQ-50, plateforme An Shou Hu",
      es: "Guardian de salud IA ZQ-SH100, monitor bajo cama ZQ-BH100, detector de caídas ZQ-D100, monitor de trayectoria ZQ-GJ100, kiosco de cribado ZQ-A100, kiosco de paso rápido ZQ-50, plataforma An Shou Hu",
      ja: "ZQ-SH100 AI健康守護儀、ZQ-BH100ベッド下健康モニター、ZQ-D100転倒検知モニター、ZQ-GJ100人体軌跡モニター、ZQ-A100健康スクリーニング一体機、ZQ-50健康高速パス一体機、安守護プラットフォーム",
      ru: "AI-охранник здоровья ZQ-SH100, монитор под кроватью ZQ-BH100, детектор падений ZQ-D100, монитор траектории ZQ-GJ100, киоск скрининга ZQ-A100, киоск быстрого прохода ZQ-50, платформа An Shou Hu",
    },
    value: {
      zh: "卧室、卫浴、客厅无感覆盖；断网本地缓存，推送与电话双通道告警，多子女账号共享，家属实时掌握老人状态。",
      en: "Contactless coverage of bedroom, bathroom and living room; local caching when offline, dual-channel alerts (push + phone), multi-account sharing for family members, real-time status for families.",
      fr: "Couverture sans contact chambre/salle de bain/salon ; cache local hors ligne, alertes double canal, partage multi-comptes.",
      es: "Cobertura sin contacto de dormitorio, baño y salón; caché local sin conexión, alertas de doble canal, cuentas compartidas.",
      ja: "寝室・浴室・リビングを無感でカバー；オフライン時はローカルキャッシュ、プッシュと電話の二重アラート、複数家族アカウント共有、家族がリアルタイムに状態を把握。",
      ru: "Бесконтактное покрытие спальни, ванной и гостиной; локальный кэш офлайн, двухканальные предупреждения, общий доступ для семьи.",
    },
    application: {
      zh: '以家庭为单位轻量部署：卧室与客厅安装守护仪、卫浴装跌倒报警，子女端 APP 远程接收；社区养老服务站可作为集中平台，为片区独居老人提供批量安装与数据看护服务，可结合社区运营商共同运营。',
      en: 'Lightweight per-home deployment: guardians in bedrooms and living rooms, fall detectors in bathrooms, family APP for remote monitoring; community care stations can be central platforms offering bulk installation and data-driven care for seniors living alone, co-operable with community service operators.',
      fr: 'Déploiement léger par foyer : garde en chambre et salon, détecteur de chute en salle de bain, APP famille ; stations communautaires comme plateformes.',
      es: 'Despliegue ligero por hogar: guardianes en dormitorio y salón, detector de caídas en el baño, APP familiar; estaciones comunitarias como plataformas.',
      ja: '家庭単位の軽量展開：寝室・リビングに見守り、浴室に転倒検知、家族アプリで遠隔確認。コミュニティ拠点をプラットフォームに。',
      ru: 'Лёгкое развёртывание по домам: охрана в спальне и гостиной, детектор падений в ванной, приложение для семьи; общественные станции как платформы.',
    },
  },
  {
    anchor: "medical",
    name: {
      zh: "医疗卫生机构",
      en: "Medical & health institutions",
      fr: "Institutions médicales et de santé",
      es: "Instituciones médicas y sanitarias",
      ja: "医療衛生機関",
      ru: "Медицинские учреждения",
    },
    buyer: {
      zh: "基层卫生服务机构 / 医院",
      en: "Primary health institutions / hospitals",
      fr: "Structures de santé de proximité / hôpitaux",
      es: "Instituciones de salud de base / hospitales",
      ja: "基层衛生サービス機関 / 病院",
      ru: "Учреждения первичного звена / больницы",
    },
    painPoints: {
      zh: ["基层筛查效率", "健康数据常态化采集"],
      en: ["Primary screening efficiency", "Routine health data collection"],
      fr: ["Efficacité du dépistage", "Collecte régulière des données"],
      es: ["Eficiencia del cribado", "Recopilación rutinaria de datos"],
      ja: ["基层スクリーニングの効率", "健康データの常時収集"],
      ru: ["Эффективность скрининга", "Регулярный сбор данных о здоровье"],
    },
    devices: {
      zh: "ZQ-A100 健康筛查一体机、ZQ-50 健康快速通道一体机、ZQ-W100 白细胞检测仪、安守护平台",
      en: "ZQ-A100 Health Screening Kiosk, ZQ-50 Health Rapid Pass Kiosk, ZQ-W100 White Blood Cell Analyzer, An Shou Hu platform",
      fr: "Borne de dépistage ZQ-A100, borne de passage rapide ZQ-50, analyseur de globules blancs ZQ-W100, plateforme An Shou Hu",
      es: "Kiosco de cribado ZQ-A100, kiosco de paso rápido ZQ-50, analizador de glóbulos blancos ZQ-W100, plataforma An Shou Hu",
      ja: "ZQ-A100健康スクリーニング一体機、ZQ-50健康高速パス一体機、ZQ-W100白血球測定器、安守護プラットフォーム",
      ru: "Киоск скрининга ZQ-A100, киоск быстрого прохода ZQ-50, анализатор лейкоцитов ZQ-W100, платформа An Shou Hu",
    },
    value: {
      zh: "体征筛查数据自动建档上传，平台开放 API 可与机构现有管理系统对接，支撑健康数据常态化采集与趋势跟踪。",
      en: "Screening data auto-filed and uploaded; open API integrates with existing management systems, supporting routine collection and trend tracking.",
      fr: "Données de dépistage archivées automatiquement ; API ouverte pour intégration aux systèmes existants.",
      es: "Datos de cribado archivados y subidos automáticamente; API abierta para integrarse con sistemas existentes.",
      ja: "スクリーニングデータを自動でカルテ化・アップロード；オープンAPIで既存システムと連携、常時収集とトレンド追跡を支援。",
      ru: "Автоматическое архивирование данных скрининга; открытый API для интеграции с существующими системами.",
    },
    application: {
      zh: '在基层卫生机构与医养结合单元应用：入住筛查用一体机建档，病床/留观床配守护仪连续监测，数据接入机构管理系统；可结合医院-社区-家庭延续护理，为出院慢病患者提供居家监测延续服务。',
      en: 'Used in primary health institutions and medical-eldercare units: admission screening via kiosks builds records, ward/observation beds get continuous guardians, data flows into institutional systems; extends into hospital-community-home transitional care for discharged chronic patients.',
      fr: "En santé de proximité et unités médico-gériatriques : dépistage à l'admission, garde continue des lits, intégration aux systèmes ; suivi post-sortie.",
      es: 'En atención primaria y unidades médico-geriátricas: cribado de ingreso, guardia continua de camas, integración a sistemas; seguimiento post-alta.',
      ja: '基层医療・医養結合ユニットで活用：入所スクリーニングでカルテ作成、ベッドに見守り、システム連携。退院後の継続モニタリングにも対応。',
      ru: 'В первичном звене и медико-гериатрических отделениях: скрининг при поступлении, непрерывная охрана коек, интеграция в системы; мониторинг после выписки.',
    },
  },
  {
    anchor: "wellness",
    name: {
      zh: "大健康 · 美业",
      en: "Wellness & beauty industry",
      fr: "Bien-être et beauté",
      es: "Bienestar y estética",
      ja: "ウェルネス・美容業界",
      ru: "Велнес и бьюти-индустрия",
    },
    buyer: {
      zh: "大健康机构 / 美业门店",
      en: "Wellness organizations / beauty salons",
      fr: "Institutions de bien-être / salons",
      es: "Organizaciones de bienestar / salones",
      ja: "ウェルネス機関 / 美容店舗",
      ru: "Велнес-организации / салоны",
    },
    painPoints: {
      zh: ["健康数据作为服务增值与客户留存工具"],
      en: ["Health data as a value-add and customer-retention tool"],
      fr: ["Les données de santé comme outil de fidélisation"],
      es: ["Los datos de salud como herramienta de valor añadido y retención"],
      ja: ["健康データをサービス付加価値と顧客維持のツールに"],
      ru: ["Данные о здоровье как инструмент ценности и удержания клиентов"],
    },
    devices: {
      zh: null,
      en: null,
      fr: null,
      es: null,
      ja: null,
      ru: null,
    },
    value: {
      zh: null,
      en: null,
      fr: null,
      es: null,
      ja: null,
      ru: null,
    },
    application: {
      zh: '大健康美业门店把健康筛查作为到店增值：一体机快速建档，睡眠与体测数据支撑个性化服务推荐与会员复购；可结合健康管理公司与美业连锁，把「健康数据」变成服务升级与客户留存的核心抓手。',
      en: 'Wellness and beauty stores add health screening as an on-site value: kiosks build profiles fast, sleep and fitness data drive personalized recommendations and repeat visits; with health firms and beauty chains, health data becomes core to upselling and retention.',
      fr: 'En instituts : dépistage à la visite, données pour recommandations personnalisées et fidélisation.',
      es: 'En salones: cribado en visita, datos para recomendaciones y fidelización.',
      ja: '美容・ウェルネス店舗で来店付加価値に：一体機でカルテ作成、データでパーソナライズ提案とリピート促進。',
      ru: 'В салонах: скрининг при визите, данные для персонализации и удержания.',
    },
  },
  {
    anchor: "retrofit",
    name: {
      zh: "装修 · 适老化改造",
      en: "Renovation · aging-friendly retrofit",
      fr: "Rénovation adaptée au vieillissement",
      es: "Reforma adaptada al envejecimiento",
      ja: "リフォーム・バリアフリー改修",
      ru: "Ремонт и адаптация жилья для пожилых",
    },
    buyer: {
      zh: "民政/住建适老化改造项目 · 装企 / 经销商",
      en: "Civil-affairs/housing aging-friendly programs · renovation companies / dealers",
      fr: "Programmes publics d'adaptation au vieillissement · rénovateurs / revendeurs",
      es: "Programas públicos de adaptación al envejecimiento · reformistas / distribuidores",
      ja: "民政・住建のバリアフリー改修プロジェクト・リフォーム会社 / 販売代理店",
      ru: "Госпрограммы адаптации жилья · ремонтные компании / дилеры",
    },
    painPoints: {
      zh: ["改造方案缺智能守护模块", "缺可交付的硬件配套"],
      en: ["Retrofit plans lack a smart guard module", "Lack of deliverable hardware"],
      fr: ["Plans sans module de surveillance intelligent", "Manque de matériel livrable"],
      es: ["Planes sin módulo de protección inteligente", "Falta de hardware entregable"],
      ja: ["改修プランにスマート見守りモジュールがない", "納品できるハードウェアが不足"],
      ru: ["В планах ремонта нет умной защиты", "Нет готового оборудования"],
    },
    devices: {
      zh: "ZQ-SH100 AI健康守护仪、ZQ-BH100 床下健康监测仪、ZQ-D100 跌倒监测仪、ZQ-GJ100 人体轨迹监测仪",
      en: "ZQ-SH100 AI Health Guardian, ZQ-BH100 Under-Bed Health Monitor, ZQ-D100 Fall Detection Monitor, ZQ-GJ100 Human Trajectory Monitor",
      fr: "Garde de santé IA ZQ-SH100, moniteur sous matelas ZQ-BH100, détecteur de chute ZQ-D100, moniteur de trajectoire ZQ-GJ100",
      es: "Guardian de salud IA ZQ-SH100, monitor bajo cama ZQ-BH100, detector de caídas ZQ-D100, monitor de trayectoria ZQ-GJ100",
      ja: "ZQ-SH100 AI健康守護儀、ZQ-BH100ベッド下健康モニター、ZQ-D100転倒検知モニター、ZQ-GJ100人体軌跡モニター",
      ru: "AI-охранник здоровья ZQ-SH100, монитор под кроватью ZQ-BH100, детектор падений ZQ-D100, монитор траектории ZQ-GJ100",
    },
    value: {
      zh: "为适老化改造项目提供卧室、卫浴、客厅点位的无感守护模块与硬件配套，补齐改造方案的智能守护交付能力。",
      en: "Provides contactless guard modules and hardware for bedroom, bathroom and living-room points in retrofit projects, completing the smart-guard delivery capability.",
      fr: "Modules de surveillance sans contact pour chambre, salle de bain et salon, complétant l'offre de rénovation.",
      es: "Módulos de protección sin contacto para dormitorio, baño y salón, completando la capacidad de entrega.",
      ja: "バリアフリー改修プロジェクトに寝室・浴室・リビングの無感見守りモジュールとハードウェアを提供し、スマート見守りの納品能力を補完。",
      ru: "Бесконтактные модули охраны и оборудование для спальни, ванной и гостиной — завершение умной защиты в проектах ремонта.",
    },
    application: {
      zh: '在适老化改造项目里作为「智能守护模块」交付：卧室/卫浴/客厅按点位配置守护与跌倒报警，与扶手、智能床等改造项组合；民政与住建适老化项目、装企与经销商均可作为标准化模块嵌入改造方案。',
      en: 'Delivered as a smart-guard module in aging-friendly retrofit: guardians and fall detectors sized by room/bathroom/living-room points, combined with grab bars and smart beds; embeddable as a standard module in civil-affairs/housing programs and renovator-dealer plans.',
      fr: 'Module de garde intégré à la rénovation adaptée : points par pièce, combiné avec barres et lits intelligents ; pour programmes publics et rénovateurs.',
      es: 'Módulo de guardia en reformas adaptadas: puntos por estancia, con barras y camas inteligentes; para programas públicos y reformistas.',
      ja: 'バリアフリー改修の「スマート見守りモジュール」として導入：ポイント配置、手すり・スマートベッドと組み合わせ。民政・住建事業や改修業者が標準モジュールに。',
      ru: 'Модуль охраны в адаптации жилья: по точкам, с поручнями и умными кроватями; для госпрограмм и ремонтников.',
    },
  },
];

export function getSolution(anchor: string): Solution | undefined {
  return solutions.find((s) => s.anchor === anchor);
}

/** 便捷：直接返回本地化方案。 */
export function getLocalizedSolution(
  slug: string,
  locale: keyof L<unknown>,
): LocalizedSolution | undefined {
  const solution = getSolution(slug);
  return solution ? localizeSolution(solution, locale) : undefined;
}
