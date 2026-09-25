// src/lib/learning.ts — 学习辅助：知识库（维基式词条）+ 知识图谱 + 思维导图
import { pool } from "./db";
import { getCourseware } from "./courseware";

export interface KBQuestion {
  id: number;
  moduleId: string;
  ordinal: number;
  question: string;
  options: string[];
}

/** 知识库列表：按模块筛选 + 关键词搜索（题干/选项）；绝不含 answer（答后判分） */
export async function listKnowledgeBase(moduleId?: string, q?: string): Promise<KBQuestion[]> {
  const params: unknown[] = [];
  const conds: string[] = [];
  if (moduleId && /^M\d{2}$/.test(moduleId)) {
    params.push(moduleId);
    conds.push(`module_id = $${params.length}`);
  }
  const kw = (q ?? "").trim();
  if (kw) {
    params.push(`%${kw}%`);
    conds.push(`(question like $${params.length} or options::text like $${params.length})`);
  }
  const where = conds.length ? ` where ${conds.join(" and ")}` : "";
  const { rows } = await pool.query(
    `select id, module_id, ordinal, question, options from quiz_questions${where} order by module_id, ordinal`,
    params
  );
  return rows.map((r) => ({
    id: r.id,
    moduleId: r.module_id,
    ordinal: r.ordinal,
    question: r.question,
    options: r.options,
  }));
}


/** 知识库词条：维基百科式——每一个知识点句 = 一个词条。
 * 从课件内容逐条提取（每行/每要点/每个表格格），标题取简短知识点名，
 * 正文为完整释义；支持按模块筛选 + 关键词搜索；按字母/数字排序。 */
export interface KnowledgeEntry {
  moduleId: string;
  moduleTitle: string;
  title: string;
  content: string;
  url: string;
}

/** 从知识点句提取简短词条标题 */
function entryTitleFrom(line: string, fallback: string): string {
  const s = line.trim();
  for (const sep of ["：", ":", "——", "→"]) {
    const idx = s.indexOf(sep);
    if (idx > 0 && idx < 24) {
      const head = s.slice(0, idx).trim();
      if (head.length >= 2) return head;
    }
  }
  return s.slice(0, Math.max(6, fallback.length));
}

export function listKnowledgeEntries(moduleId?: string, q?: string): KnowledgeEntry[] {
  const kw = (q ?? "").trim().toLowerCase();
  const out: KnowledgeEntry[] = [];
  for (const m of getCourseware()) {
    if (moduleId && m.id !== moduleId) continue;
    for (const s of m.slides) {
      if (s.type === "attachment") continue;
      const push = (raw: string) => {
        const line = (raw ?? "").trim();
        if (!line) return;
        const title = entryTitleFrom(line, s.title || "知识点");
        const hit =
          !kw ||
          m.title.toLowerCase().includes(kw) ||
          m.id.toLowerCase().includes(kw) ||
          s.title.toLowerCase().includes(kw) ||
          title.toLowerCase().includes(kw) ||
          line.toLowerCase().includes(kw);
        if (!hit) return;
        out.push({
          moduleId: m.id,
          moduleTitle: m.title,
          title: title.length > 22 ? title.slice(0, 22) + "…" : title,
          content: line,
          url: `/m/${m.id}`,
        });
      };
      if (Array.isArray(s.lines)) s.lines.forEach(push);
      if (Array.isArray(s.items)) s.items.forEach(push);
      if (Array.isArray(s.rows)) s.rows.forEach((r) => push(r.join(" · ")));
      if (Array.isArray(s.left)) s.left.forEach((x) => push(`${s.left_title ? s.left_title + "： " : ""}${x}`));
      if (Array.isArray(s.right)) s.right.forEach((x) => push(`${s.right_title ? s.right_title + "： " : ""}${x}`));
      if (s.text) push(s.text);
    }
  }
  return out;
}

/** 单题判分** 单题判分（答后显示正确答案；仅知识库学习用，不落成绩） */
export async function checkKnowledgeBaseAnswer(
  questionId: number,
  userAnswer: string
): Promise<{ correct: boolean; correctAnswer: string; correctText: string } | null> {
  const { rows } = await pool.query("select answer, options from quiz_questions where id=$1", [questionId]);
  if (rows.length === 0) return null;
  const opt = rows[0].options as string[];
  const idx = "ABCD".indexOf(rows[0].answer as string);
  return {
    correct: (userAnswer || "").toUpperCase() === rows[0].answer,
    correctAnswer: rows[0].answer,
    correctText: idx >= 0 && opt[idx] ? opt[idx] : "",
  };
}

export interface GraphNode {
  id: string;
  title: string;
  layer: string;
}
export interface GraphEdge {
  from: string;
  to: string;
  label: string;
}

/** 知识图谱：模块分层（L1/L2/L3）+ 主题关系（静态映射，随课件内容校准） */
export function getKnowledgeGraph(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const cw = getCourseware();
  const nodes: GraphNode[] = cw.map((m) => ({
    id: m.id,
    title: m.title,
    layer: m.layer || "L1",
  }));
  const edges: GraphEdge[] = [
    { from: "M01", to: "M02", label: "企业文化 → 行业认知" },
    { from: "M02", to: "M03", label: "行业 → 产品概览" },
    { from: "M03", to: "M04", label: "产品主线" },
    { from: "M04", to: "M05", label: "产品深度 → 方案配置" },
    { from: "M05", to: "M12", label: "方案 → 机构场景" },
    { from: "M05", to: "M13", label: "方案 → 社区实战" },
    { from: "M03", to: "M06", label: "产品 → 销售实战" },
    { from: "M06", to: "M07", label: "销售 → 价格政策" },
    { from: "M06", to: "M10", label: "销售 → CRM 工具" },
    { from: "M07", to: "M16", label: "价格 → 渠道管理" },
    { from: "M06", to: "M16", label: "渠道体系" },
    { from: "M08", to: "M09", label: "履约 → 安装" },
    { from: "M08", to: "M11", label: "履约 → 客服" },
    { from: "M04", to: "M15", label: "产品 → 技术进阶" },
    { from: "M10", to: "M14", label: "工具 → 新人落地" },
    { from: "M06", to: "M14", label: "销售 → 新人落地" },
    { from: "M07", to: "M14", label: "价格 → 新人落地" },
  ];
  return { nodes, edges };
}

export interface MindmapBranch {
  slideTitle: string;
  points: string[];
}

/** 思维导图：模块 → 各页 slide → 要点（从课件 slides 提取） */
export function getMindmap(moduleId: string): { id: string; title: string; layer: string; branches: MindmapBranch[] } | null {
  const cw = getCourseware();
  const m = cw.find((x) => x.id === moduleId);
  if (!m) return null;
  const branches: MindmapBranch[] = m.slides
    .filter((s) => s.type !== "attachment")
    .map((s) => {
    let points: string[] = [];
    if (Array.isArray(s.lines)) points = s.lines.slice(0, 5);
    else if (Array.isArray(s.items)) points = s.items.slice(0, 8);
    else if (Array.isArray(s.rows)) points = s.rows.slice(0, 8).map((r) => r.join(" · "));
    else if (Array.isArray(s.left)) points = s.left.slice(0, 4);
    else if (Array.isArray(s.right)) points = (points.length ? points : []).concat(s.right.slice(0, 4));
    return { slideTitle: s.title, points: points.slice(0, 6) };
    });
  return { id: m.id, title: m.title, layer: m.layer || "", branches };
}