import type { L } from "./locale";
import type { Solution } from "./solutions";

/**
 * 对外只保留 SPEC §5.4 的 5 个 B 端场景，不再按 G/B/C 18 场景分层。
 */
export type SolutionGroup = {
  id: string;
  name: L<string>;
  tier: "B";
};

export const SOLUTION_GROUPS: SolutionGroup[] = [
  {
    id: "b2b",
    tier: "B",
    name: {
      zh: "机构与渠道场景",
      en: "Institution & channel scenarios",
      fr: "Scénarios institutions et canaux",
      es: "Escenarios de instituciones y canales",
      ja: "機関・チャネルのシナリオ",
      ru: "Сценарии учреждений и каналов",
    },
  },
];

export const ANCHOR_GROUP: Record<string, string> = {
  institution: "b2b",
  community: "b2b",
  medical: "b2b",
  wellness: "b2b",
  retrofit: "b2b",
};

export function groupByAnchor(anchor: string): SolutionGroup | undefined {
  const gid = ANCHOR_GROUP[anchor];
  return SOLUTION_GROUPS.find((g) => g.id === gid);
}

export function groupSolutions(
  solutions: Solution[],
): { group: SolutionGroup; items: Solution[] }[] {
  return SOLUTION_GROUPS.map((group) => ({
    group,
    items: solutions.filter((s) => ANCHOR_GROUP[s.anchor] === group.id),
  })).filter((g) => g.items.length > 0);
}
