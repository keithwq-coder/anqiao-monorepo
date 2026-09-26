// src/lib/session.ts — DB 后端会话：创建 / 校验 / 销毁
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { pool } from "./db";
import { SESSION_COOKIE, getEnv } from "./env";
import type { UserRow } from "./types";

export async function createSession(userId: number, ip: string | null): Promise<string> {
  const { sessionTtlSeconds } = getEnv();
  const sid = randomUUID();
  const expiresAt = new Date(Date.now() + sessionTtlSeconds * 1000);
  await pool.query(
    "insert into sessions(id, user_id, expires_at, ip) values($1,$2,$3,$4)",
    [sid, userId, expiresAt, ip ?? null]
  );
  return sid;
}

export async function destroySession(sid: string): Promise<void> {
  await pool.query("delete from sessions where id = $1", [sid]);
}

export function sessionCookieValue(sid: string): string {
  const { cookieSecure } = getEnv();
  const attrs = ["Path=/", "HttpOnly", "SameSite=Lax"];
  if (cookieSecure) attrs.push("Secure");
  return `${SESSION_COOKIE}=${sid}; ${attrs.join("; ")}`;
}

export async function deleteSessionCookieHeader(): Promise<string> {
  const { cookieSecure } = getEnv();
  const attrs = ["Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (cookieSecure) attrs.push("Secure");
  return `${SESSION_COOKIE}=; ${attrs.join("; ")}`;
}

/** 校验当前请求会话并返回用户（DB 校验）；无有效会话返回 null */
export async function getSessionUser(): Promise<{ user: UserRow; sid: string } | null> {
  const store = await cookies();
  const sid = store.get(SESSION_COOKIE)?.value;
  if (!sid) return null;
  const { rows } = await pool.query(
    `select u.* from sessions s
       join users u on u.id = s.user_id
      where s.id = ? and s.expires_at > UTC_TIMESTAMP()`,
    [sid]
  );
  if (rows.length === 0) return null;
  return { user: rows[0] as UserRow, sid };
}
