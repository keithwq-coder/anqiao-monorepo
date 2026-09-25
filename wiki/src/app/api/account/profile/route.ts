import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { reqStr, PHONE_RE, IDCARD_RE } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let body: { realname?: unknown; idcard?: unknown; phone?: unknown } | null = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const realname = typeof body?.realname === "string" ? body.realname.trim() : "";
  const idcard = typeof body?.idcard === "string" ? body.idcard.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";

  const err =
    reqStr(realname, "realname", 40, "实名") ??
    (idcard.length > 0 && !IDCARD_RE.test(idcard) ? { field: "idcard", message: "身份证号格式不正确" } : null) ??
    (phone.length > 0 && !PHONE_RE.test(phone) ? { field: "phone", message: "手机号格式不正确" } : null);

  if (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  await pool.query("update users set realname = $1, idcard = $2, phone = $3 where id = $4", [
    realname,
    idcard,
    phone,
    user.id,
  ]);
  return NextResponse.json({ ok: true });
}
