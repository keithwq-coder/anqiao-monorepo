// src/lib/admin.ts — 后台批量学习档案计算 + 建号工具
import { pool } from "./db";
import { CRM_AUTH_SENTINEL, crmCreateUser } from "./crm";
import { tierForRole, type UserRow, type Role, type GroupTier } from "./types";

export interface AdminRow extends UserRow {
  tier: GroupTier;
  participationRate: number;
  completionRate: number;
  viewedModules: string[];
  completedModules: string[];
  quizPassedModules: string[];
  quizBestScores: Record<string, number>;
  quizAttemptCount: Record<string, number>;
  totalAttempts: number;
  avgScore: number;
  lastActiveAt: string | null;
}

/** 批量计算学习档案（管理组也返回行，由调用方决定是否展示/统计） */
export async function listUsersWithProfile(includePlaceholder = false): Promise<AdminRow[]> {
  const { rows } = await pool.query("select * from users order by id");
  const users = (includePlaceholder ? rows : rows.filter((r) => !r.is_placeholder)) as UserRow[];

  const [maRes, viewsRes, attemptsRes] = await Promise.all([
    pool.query("select module_id, role, access from module_access"),
    pool.query("select user_id, module_id, has_completed from course_views"),
    pool.query("select user_id, module_id, score, passed from quiz_attempts"),
  ]);

  const matrixByRole = new Map<string, string[]>(); // role → visible module ids（req+opt）
  for (const r of maRes.rows) {
    if (r.access === "na") continue;
    const arr = matrixByRole.get(r.role) ?? [];
    arr.push(r.module_id);
    matrixByRole.set(r.role, arr);
  }

  const viewsByUser = new Map<number, { seen: Set<string>; done: Set<string> }>();
  for (const v of viewsRes.rows) {
    let m = viewsByUser.get(v.user_id);
    if (!m) {
      m = { seen: new Set(), done: new Set() };
      viewsByUser.set(v.user_id, m);
    }
    m.seen.add(v.module_id);
    if (v.has_completed) m.done.add(v.module_id);
  }

  const attemptsByUser = new Map<number, { best: Map<string, number>; cnt: Map<string, number>; passed: Set<string>; total: number; sum: number }>();
  for (const a of attemptsRes.rows) {
    let m = attemptsByUser.get(a.user_id);
    if (!m) {
      m = { best: new Map(), cnt: new Map(), passed: new Set(), total: 0, sum: 0 };
      attemptsByUser.set(a.user_id, m);
    }
    m.total++;
    m.sum += a.score;
    m.cnt.set(a.module_id, (m.cnt.get(a.module_id) ?? 0) + 1);
    const prev = m.best.get(a.module_id) ?? -1;
    if (a.score > prev) m.best.set(a.module_id, a.score);
    if (a.passed) m.passed.add(a.module_id);
  }

  return users.map((u) => {
    const visible = matrixByRole.get(u.role) ?? [];
    const visibleSet = new Set(visible);
    const views = viewsByUser.get(u.id) ?? { seen: new Set(), done: new Set() };
    const attempts = attemptsByUser.get(u.id) ?? {
      best: new Map<string, number>(),
      cnt: new Map<string, number>(),
      passed: new Set<string>(),
      total: 0,
      sum: 0,
    };
    const viewed = visible.filter((m) => views.seen.has(m));
    const completed = visible.filter((m) => views.done.has(m));
    const passedModules = visible.filter((m) => attempts.passed.has(m));

    const quizBestScores: Record<string, number> = {};
    const quizAttemptCount: Record<string, number> = {};
    for (const m of visible) {
      if (attempts.best.has(m)) quizBestScores[m] = attempts.best.get(m)!;
      if (attempts.cnt.has(m)) quizAttemptCount[m] = attempts.cnt.get(m)!;
    }

    const denom = visible.length;
    return {
      ...u,
      tier: tierForRole(u.role),
      participationRate: denom === 0 ? 0 : Math.round((viewed.length / denom) * 1000) / 1000,
      completionRate: denom === 0 ? 0 : Math.round((completed.length / denom) * 1000) / 1000,
      viewedModules: viewed,
      completedModules: completed,
      quizPassedModules: passedModules,
      quizBestScores,
      quizAttemptCount,
      totalAttempts: attempts.total,
      avgScore: attempts.total === 0 ? 0 : Math.round((attempts.sum / attempts.total) * 10) / 10,
      lastActiveAt: u.last_active_at ? u.last_active_at.toISOString() : null,
    } as AdminRow;
  });
}

export function maskIdcard(idcard: string): string {
  if (!idcard) return "";
  if (idcard.length <= 8) return "***";
  return idcard.slice(0, 4) + "********" + idcard.slice(-2);
}

const NAME_BY_ROLE: Record<string, string> = {
  dealer: "经销商",
  agent: "代理商",
  reseller: "代销商",
  internal_sales: "内部销售",
};

/** 生成下一个用户名：dl_XXXX / sa_XXXX（D3/D4） */
export async function nextUsername(role: Role): Promise<string> {
  const prefix = role === "internal_sales" ? "sa" : "dl";
  const { rows } = await pool.query("select username from users where username ~ $1", [
    `^${prefix}_[0-9]{4}$`,
  ]);
  let max = 0;
  for (const r of rows) {
    const m = /^([a-z]+)_(\d+)$/.exec(r.username);
    if (m) max = Math.max(max, Number(m[2]));
  }
  const next = max + 1;
  const num = String(next).padStart(4, "0");
  return `${prefix}_${num}`;
}

export function defaultNameFor(role: Role, username: string): string {
  const label = NAME_BY_ROLE[role] ?? role;
  const m = /\d+$/.exec(username);
  return m ? `${label}${m[0]}` : label;
}

// ---------- T-F：操作审计（建号/重置密码/自助改密留痕） ----------

/** 写入一条审计记录；adminId 传 null 表示用户自助操作 */
export async function recordAudit(
  adminId: number | null,
  action: string,
  target: string,
  detail = ""
): Promise<void> {
  await pool.query(
    "insert into audit_log(admin_id, action, target, detail) values($1,$2,$3,$4)",
    [adminId, action, target, detail]
  );
}

// ---------- T-G：建号（单建与批量共用） ----------

export interface CreateUserResult {
  username: string;
  name: string;
  role: string;
  initialPassword: string;
}

/** 新建账号：用户名自动生成、初始口令统一 123（业主口径，首登强制改密后失效）。
 *  统一认证后：先建本地镜像（password_hash 存哨兵，不再参与验证），
 *  再同步创建 CRM 账号；CRM 失败则补偿删除本地行，保证无半截账号。 */
export async function createUser(role: Role, name?: string): Promise<CreateUserResult> {
  const username = await nextUsername(role);
  const displayName =
    name && name.trim() ? name.trim().slice(0, 40) : defaultNameFor(role, username);
  const password = "123"; // 初始口令统一 123（仅建号时展示一次；首登强制改密）
  const ins = await pool.query(
    `insert into users(username, password_hash, role, name, realname, idcard, phone, must_change_password, is_placeholder)
     values(?,?,?,?,'','','',true,false)`,
    [username, CRM_AUTH_SENTINEL, role, displayName]
  );
  const newId = ins.insertId as number;
  try {
    const created = await crmCreateUser(username, displayName, password);
    if (!created) {
      await pool.query("delete from users where id=$1", [newId]).catch(() => {});
      throw new Error(`CRM 已存在同名账号「${username}」，未创建`);
    }
  } catch (e) {
    await pool.query("delete from users where id=$1", [newId]).catch(() => {});
    throw e;
  }
  return { username, name: displayName, role, initialPassword: password };
}

// ---------- T-D：后台列表过滤/排序/分页（内存层，聚合字段由 JS 计算，SQL 无法直接 ORDER BY） ----------

export interface UserListFilter {
  role?: string;
  q?: string;
  placeholder?: string; // ""=排除占位 | all=包含 | only=仅占位
  sort?: string; // id | name | participationRate | completionRate | lastActiveAt
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export const USER_SORT_KEYS = ["id", "name", "participationRate", "completionRate", "lastActiveAt"] as const;

/**
 * 在 listUsersWithProfile 聚合结果上按后台筛选口径过滤 → 排序 → 分页。
 * 返回 { rows, total }：total 为过滤后（role/q/placeholder）但未分页的总数。
 */
export function filterUserList(list: AdminRow[], f: UserListFilter): { rows: AdminRow[]; total: number } {
  let rows = list;
  if (f.placeholder === "only") {
    rows = rows.filter((u) => u.is_placeholder);
  } else if (f.placeholder !== "all") {
    rows = rows.filter((u) => !u.is_placeholder); // 默认排除占位
  }
  if (f.role) {
    rows = rows.filter((u) => u.role === f.role);
  }
  const q = (f.q ?? "").trim().toLowerCase();
  if (q) {
    rows = rows.filter(
      (u) => u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)
    );
  }
  const total = rows.length;

  const sort = (USER_SORT_KEYS as readonly string[]).includes(f.sort ?? "") ? f.sort! : "id";
  const defaultAsc = sort === "name" || sort === "id";
  const dir = f.order === "asc" ? 1 : f.order === "desc" ? -1 : defaultAsc ? 1 : -1;
  rows = [...rows].sort((a, b) => {
    let cmp: number;
    switch (sort) {
      case "name":
        cmp = a.name.localeCompare(b.name, "zh-Hans-CN");
        break;
      case "participationRate":
        cmp = a.participationRate - b.participationRate;
        break;
      case "completionRate":
        cmp = a.completionRate - b.completionRate;
        break;
      case "lastActiveAt":
        cmp = (a.lastActiveAt ?? "").localeCompare(b.lastActiveAt ?? "");
        break;
      default:
        cmp = a.id - b.id;
    }
    return cmp * dir;
  });

  // 分页：未显式传 page/pageSize 时返回全量（导出用）；显式传时默认 20
  if (f.pageSize != null || f.page != null) {
    const pageSize = f.pageSize && f.pageSize > 0 ? Math.min(f.pageSize, 100) : 20;
    const page = f.page && f.page > 0 ? f.page : 1;
    const start = (page - 1) * pageSize;
    rows = rows.slice(start, start + pageSize);
  }
  return { rows, total };
}
