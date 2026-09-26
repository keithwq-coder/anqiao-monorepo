import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getEnv, SESSION_COOKIE } from "@/lib/env";
import { createSession } from "@/lib/session";
import { checkRateLimit, recordFailure, clearFailures } from "@/lib/rate-limit";
import { getClientIp, touchLastActive } from "@/lib/auth";
import { validLoginId, validPassword } from "@/lib/validation";
import { crmVerifyCredentials } from "@/lib/crm";

export const runtime = "nodejs";

/**
 * CRM 用户名 → wiki 角色 默认映射（SPEC §2/§8）。
 * - admin/赵/武/吴 → admin（业主确认：董事长/董事/CEO 均管理员权限）
 * - 其余默认 internal_sales。
 */
function defaultRoleForUsername(username: string): string {
  const ADMIN_NAMES = new Set(["admin", "赵", "武", "吴"]);
  return ADMIN_NAMES.has(username) ? "admin" : "internal_sales";
}

export async function POST(req: Request) {
  const ip = await getClientIp();
  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "尝试过于频繁，请稍后再试" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  let body: { username?: unknown; password?: unknown } | null = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const { username, password } = body ?? {};
  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    !validLoginId(username) ||
    !validPassword(password)
  ) {
    // 错误信息不区分"用户不存在/密码错"
    return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
  }

  // ---- 统一认证：由 CRM 验证密码（SPEC §3） ----
  let crmUser: { username: string; display_name: string; status: string } | null = null;
  try {
    crmUser = await crmVerifyCredentials(username, password);
  } catch {
    // fail-closed：CRM 不可达/未配置 → 不降级，提示稍后再试
    return NextResponse.json({ error: "暂时无法登录，请稍后再试" }, { status: 503 });
  }
  if (!crmUser) {
    recordFailure(ip);
    return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
  }

  // ---- 本地用户镜像：按 CRM 认证通过的用户名找/建 ----
  const crmUsername = crmUser.username;
  const { rows } = await pool.query("select * from users where username = $1", [crmUsername]);
  let user = rows[0] as
    | { id: number; username: string; nickname: string | null; role: string; name: string; is_active: boolean; must_change_password: boolean }
    | undefined;

  if (!user) {
    // CRM 有、wiki 无 → 自动建镜像（默认 internal_sales，映射见上）
    const r2 = await pool.query(
      `insert into users(username, password_hash, role, name, realname, idcard, phone, must_change_password, is_placeholder)
       values(?,?,?,?,'','','',false,false)`,
      [crmUsername, "!crm-auth", defaultRoleForUsername(crmUsername), crmUser.display_name]
    );
    const mirror = await pool.query("select * from users where id = ?", [r2.insertId]);
    user = mirror.rows[0] as typeof user;
  } else if (user.role === "admin" && defaultRoleForUsername(crmUsername) === "admin" && user.name !== crmUser.display_name) {
    // 显示名与 CRM 对齐（仅当本地为占位默认名时；不覆盖用户已填资料）
    await pool.query("update users set name=$1 where id=$2", [crmUser.display_name.slice(0, 40), user.id]).catch(() => {});
  }

  if (!user || !user.is_active) {
    recordFailure(ip);
    return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
  }

  clearFailures(ip);
  const sid = await createSession(user.id, ip);
  void touchLastActive(user.id);

  const { sessionTtlSeconds, cookieSecure } = getEnv();
  const res = NextResponse.json({
    ok: true,
    mustChangePassword: user.must_change_password,
    username: user.username,
    role: user.role,
    name: user.name,
  });
  res.cookies.set(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: "lax",
    path: "/",
    maxAge: sessionTtlSeconds,
  });
  return res;
}