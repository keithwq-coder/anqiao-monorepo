// POST /api/admin/users/[id]/reset-password — 管理员重置密码（I-2）
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";
import { recordAudit } from "@/lib/admin";
import { crmChangePassword } from "@/lib/crm";

const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomPassword(len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return s;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = await requireApiAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const uid = Number(id);
  if (!Number.isInteger(uid)) {
    return NextResponse.json({ ok: false, error: "参数错误" }, { status: 400 });
  }

  const { rows } = await pool.query("select id, username from users where id=$1", [uid]);
  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: "用户不存在" }, { status: 404 });
  }
  const target = rows[0];

  const password = randomPassword(10);
  // 统一认证：改密落在 CRM（无当前密码 = 管理员重置），成功后置本地强制改密
  let ok = false;
  try {
    ok = await crmChangePassword(target.username, password);
  } catch {
    return NextResponse.json({ ok: false, error: "重置失败，请稍后再试" }, { status: 503 });
  }
  if (!ok) {
    return NextResponse.json({ ok: false, error: "CRM 重置失败，账号可能不存在" }, { status: 500 });
  }

  await pool.query("update users set must_change_password=true where id=$1", [uid]);
  await pool.query("delete from sessions where user_id=$1", [uid]);

  // T-F：重置密码留痕
  await recordAudit(admin.id, "reset_password", target.username, "");

  return NextResponse.json({
    ok: true,
    user: { username: target.username },
    initialPassword: password, // 仅此一次展示
  });
}
