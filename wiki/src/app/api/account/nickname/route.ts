import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { validNickname } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let body: { nickname?: unknown } | null = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const nickname = typeof body?.nickname === "string" ? body.nickname.trim() : "";

  if (!validNickname(nickname)) {
    return NextResponse.json({ error: "昵称需 1-20 个字符（字母/数字/中文/下划线）" }, { status: 400 });
  }

  // 唯一性：不得撞任何 username，也不得撞其它 nickname
  const { rows } = await pool.query(
    "select id from users where (username = $1 or (nickname is not null and nickname = $1)) and id <> $2",
    [nickname, user.id]
  );
  if (rows.length > 0) {
    return NextResponse.json({ error: "该昵称已被使用" }, { status: 409 });
  }

  await pool.query("update users set nickname = $1 where id = $2", [nickname, user.id]);
  return NextResponse.json({ ok: true, nickname });
}
