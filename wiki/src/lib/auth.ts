// src/lib/auth.ts — 服务端会话用户获取 + 权限守卫
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSessionUser } from "./session";
import { pool } from "./db";
import type { UserRow } from "./types";

export async function getClientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

/** RSC/服务端组件：无有效会话 → 重定向 /login */
export async function requireUser(): Promise<UserRow> {
  const su = await getSessionUser();
  if (!su) redirect("/login");
  return su.user;
}

/** RSC：登录门（无有效会话 → 重定向 /login）。首登改密改为“提醒”方式，
 *  不再强制拦截：登录后正常进入系统，界面顶部仅提醒修改初始密码。 */
export async function requirePortalUser(): Promise<UserRow> {
  return requireUser();
}

/** API route：无有效会话返回 null（由调用方回 401） */
export async function requireApiUser(): Promise<UserRow | null> {
  const su = await getSessionUser();
  return su?.user ?? null;
}

/** API route：要求 admin */
export async function requireApiAdmin(): Promise<UserRow | null> {
  const su = await getSessionUser();
  if (!su) return null;
  if (su.user.role !== "admin") return null;
  return su.user;
}

/** 更新 last_active_at（不阻塞） */
export async function touchLastActive(userId: number): Promise<void> {
  await pool.query("update users set last_active_at = now() where id = $1", [userId]).catch(() => {});
}
