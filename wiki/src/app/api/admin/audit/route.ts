// GET /api/admin/audit — 操作审计列表（仅 admin；T-F）
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth";

export async function GET() {
  const admin = await requireApiAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
  }

  const { rows } = await pool.query(
    `select a.id, a.action, a.target, a.detail, a.created_at, u.username as admin_username
       from audit_log a
       left join users u on u.id = a.admin_id
      order by a.created_at desc
      limit 50`
  );

  return NextResponse.json({
    ok: true,
    entries: rows.map((r) => ({
      id: r.id,
      action: r.action,
      target: r.target,
      detail: r.detail,
      adminUsername: r.admin_username ?? null,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
    })),
  });
}
