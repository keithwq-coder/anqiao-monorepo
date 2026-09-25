// src/lib/certification.ts — 学习档案计算（三组差异化，docs/cert-design.md）
// 不再产出"certified/in_progress"硬性认证门槛；改为"学习进度 + 测验分数"档案。
import { pool } from "./db";
import { tierForRole, type GroupTier, type Role, type UserRow } from "./types";

export interface ModuleAccessRow {
  module_id: string;
  access: "req" | "opt" | "na";
  required: boolean;
}

/** 学习档案（替代旧的认证状态） */
export interface LearningProfile {
  username: string;
  name: string;
  role: string;
  tier: GroupTier;
  // 模块进度
  visibleModules: string[]; // 该角色可见模块（req + opt，按 ordinal）
  requiredModules: string[]; // access='req' 的模块
  viewedModules: string[]; // 在 course_views 中出现过（口径 B 的 viewed）
  completedModules: string[]; // has_completed=true（学完信号）
  participationRate: number; // viewed / visible
  completionRate: number; // completed / visible
  // 测验档案
  quizBestScores: Record<string, number>; // moduleId → 最高分
  quizAttemptCount: Record<string, number>; // moduleId → 次数
  quizPassedModules: string[]; // 存在 passed=true 的模块（仅记录，不作硬门槛）
  totalAttempts: number;
  avgScore: number; // 所有 attempt 平均分
  lastActiveAt: string | null;
}

/** 角色 × 模块 访问/需考矩阵（含模块顺序） */
export async function getRoleMatrix(role: string): Promise<ModuleAccessRow[]> {
  const { rows } = await pool.query(
    `select ma.module_id, ma.access, coalesce(mqr.required, false) as required
       from module_access ma
       left join module_quiz_required mqr
         on mqr.module_id = ma.module_id and mqr.role = ma.role
       join modules mo on mo.id = ma.module_id
      where ma.role = $1
      order by mo.ordinal`,
    [role]
  );
  return rows as ModuleAccessRow[];
}

/** 单模块对该角色的访问级别；na/未知 → 'na' */
export async function getModuleAccessForRole(
  moduleId: string,
  role: string
): Promise<"req" | "opt" | "na"> {
  const { rows } = await pool.query(
    "select access from module_access where module_id=$1 and role=$2",
    [moduleId, role]
  );
  if (rows.length === 0) return "na";
  return rows[0].access;
}

/** 计算单个用户的学习档案（三组通用；管理组调用方自行不展示/不统计） */
export async function getCertification(user: UserRow): Promise<LearningProfile> {
  const matrix = await getRoleMatrix(user.role);
  const visibleModules = matrix.filter((m) => m.access !== "na").map((m) => m.module_id);
  const requiredModules = matrix.filter((m) => m.access === "req").map((m) => m.module_id);

  const [viewsRes, attemptsRes] = await Promise.all([
    pool.query("select module_id, has_completed from course_views where user_id=$1", [user.id]),
    pool.query("select module_id, score, passed from quiz_attempts where user_id=$1", [user.id]),
  ]);

  const visibleSet = new Set(visibleModules);
  const viewed = viewsRes.rows
    .filter((r) => visibleSet.has(r.module_id))
    .map((r) => r.module_id);
  const completed = viewsRes.rows
    .filter((r) => visibleSet.has(r.module_id) && r.has_completed)
    .map((r) => r.module_id);

  const best = new Map<string, number>();
  const cnt = new Map<string, number>();
  const passedSet = new Set<string>();
  let totalScore = 0;
  for (const a of attemptsRes.rows) {
    if (!visibleSet.has(a.module_id)) continue;
    cnt.set(a.module_id, (cnt.get(a.module_id) ?? 0) + 1);
    if (a.passed) passedSet.add(a.module_id);
    const prev = best.get(a.module_id) ?? -1;
    if (a.score > prev) best.set(a.module_id, a.score);
    totalScore += a.score;
  }
  const totalAttempts = attemptsRes.rows.length;

  const quizBestScores: Record<string, number> = {};
  const quizAttemptCount: Record<string, number> = {};
  for (const m of visibleModules) {
    if (best.has(m)) quizBestScores[m] = best.get(m)!;
    if (cnt.has(m)) quizAttemptCount[m] = cnt.get(m)!;
  }

  const denom = visibleModules.length;
  return {
    username: user.username,
    name: user.name,
    role: user.role,
    tier: tierForRole(user.role),
    visibleModules,
    requiredModules,
    viewedModules: viewed,
    completedModules: completed,
    participationRate: denom === 0 ? 0 : Math.round((viewed.length / denom) * 1000) / 1000,
    completionRate: denom === 0 ? 0 : Math.round((completed.length / denom) * 1000) / 1000,
    quizBestScores,
    quizAttemptCount,
    quizPassedModules: [...passedSet],
    totalAttempts,
    avgScore: totalAttempts === 0 ? 0 : Math.round((totalScore / totalAttempts) * 10) / 10,
    lastActiveAt: user.last_active_at ? user.last_active_at.toISOString() : null,
  };
}

/** 单模块浏览记录（首访 first，之后 last） */
export async function recordModuleView(userId: number, moduleId: string): Promise<void> {
  await pool.query(
    `insert into course_views(user_id, module_id, first_viewed_at, last_viewed_at)
     values($1,$2,now(),now())
     on conflict (user_id, module_id)
     do update set last_viewed_at = now()`,
    [userId, moduleId]
  );
}

/** 标记模块"已学完"（has_completed=true，仅档案记录，不作硬门槛） */
export async function markModuleCompleted(userId: number, moduleId: string): Promise<void> {
  await pool.query(
    `insert into course_views(user_id, module_id, first_viewed_at, last_viewed_at, has_completed)
     values($1,$2,now(),now(),true)
     on conflict (user_id, module_id)
     do update set has_completed = true, last_viewed_at = now()`,
    [userId, moduleId]
  );
}

/** 供后台批量使用：角色的访问矩阵（无用户维度） */
export async function getRoleMatrixForRoles(): Promise<
  { module_id: string; role: Role; access: string }[]
> {
  const { rows } = await pool.query("select module_id, role, access from module_access");
  return rows as { module_id: string; role: Role; access: string }[];
}
