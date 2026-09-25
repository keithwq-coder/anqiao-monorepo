import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { validPassword } from "@/lib/validation";
import { crmChangePassword } from "@/lib/crm";
import { recordAudit } from "@/lib/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  let body: { currentPassword?: unknown; newPassword?: unknown } | null = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const { currentPassword, newPassword } = body ?? {};

  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }
  if (!validPassword(newPassword)) {
    return NextResponse.json({ error: "新密码至少 8 位" }, { status: 400 });
  }

  // 统一认证：密码存于 CRM，改密必须同步到 CRM（SPEC §5.3）
  let ok = false;
  try {
    ok = await crmChangePassword(user.username, newPassword, currentPassword);
  } catch {
    return NextResponse.json({ error: "修改失败，请稍后再试" }, { status: 503 });
  }
  if (!ok) {
    return NextResponse.json({ error: "当前密码错误" }, { status: 400 });
  }

  // 本地只更新改密标记，password_hash 不再参与验证（哨兵占位）
  await pool.query("update users set must_change_password = false where id = $1", [user.id]);
  // T-F：用户自助改密留痕（不记录密码本身）
  await recordAudit(null, "self_change", user.username, "");
  return NextResponse.json({ ok: true });
}