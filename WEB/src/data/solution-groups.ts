import type { L } from "./locale";
import type { Solution } from "./solutions";

/**
 * 客户分层（2026-08 按用户启发重构）：以「客户是谁、谁掏钱」为骨架组织解决方案。
 * G 端 = 政府与公共事业；B 端 = 机构与产业 / 企业与园区；C 端 = 家庭与个人。
 */
export type SolutionGroup = {
  id: string;
  name: L<string>;
  /** 客户分层标识（G/B/C），用于文案表述。 */
  tier: "G" | "B" | "C";
};

export const SOLUTION_GROUPS: SolutionGroup[] = [
  {
    id: "government",
    tier: "G",
    name: {
      zh: "政府与公共事业",
      en: "Government & public services",
      fr: "Gouvernement et services publics",
      es: "Gobierno y servicios públicos",
      ja: "政府・公共事業",
      ru: "Государство и общественные службы",
    },
  },
  {
    id: "industry",
    tier: "B",
    name: {
      zh: "机构与产业",
      en: "Institutions & industries",
      fr: "Institutions et secteurs",
      es: "Instituciones y sectores",
      ja: "機関・産業",
      ru: "Учреждения и отрасли",
    },
  },
  {
    id: "enterprise",
    tier: "B",
    name: {
      zh: "企业与园区",
      en: "Enterprises & business parks",
      fr: "Entreprises et parcs d'activité",
      es: "Empresas y parques empresariales",
      ja: "企業・工業団地",
      ru: "Компании и бизнес-парки",
    },
  },
  {
    id: "family",
    tier: "C",
    name: {
      zh: "家庭与个人",
      en: "Families & individuals",
      fr: "Familles et particuliers",
      es: "Familias y particulares",
      ja: "家庭・個人",
      ru: "Семьи и частные лица",
    },
  },
];

/** anchor → 客户分层 id。 */
export const ANCHOR_GROUP: Record<string, string> = {
  // G 端 · 政府与公共事业
  insurance: "government",
  "child-health": "government",
  retrofit: "government",
  // B 端 · 机构与产业
  institution: "industry",
  community: "industry",
  medical: "industry",
  "relocation-care": "industry",
  hotel: "industry",
  housekeeping: "industry",
  "maternal-infant": "industry",
  "carrier-integration": "industry",
  tourism: "industry",
  // B 端 · 企业与园区
  "workplace-health": "enterprise",
  "health-management": "enterprise",
  wellness: "enterprise",
  "bank-wealth": "enterprise",
  "insurance-health": "enterprise",
  // C 端 · 家庭与个人
  "home-security": "family",
};

export function groupByAnchor(anchor: string): SolutionGroup | undefined {
  const gid = ANCHOR_GROUP[anchor];
  return SOLUTION_GROUPS.find((g) => g.id === gid);
}

/** 按客户分层分组（保持组内场景顺序）。 */
export function groupSolutions(
  solutions: Solution[],
): { group: SolutionGroup; items: Solution[] }[] {
  return SOLUTION_GROUPS.map((group) => ({
    group,
    items: solutions.filter(
      (s) => ANCHOR_GROUP[s.anchor] === group.id,
    ),
  })).filter((g) => g.items.length > 0);
}