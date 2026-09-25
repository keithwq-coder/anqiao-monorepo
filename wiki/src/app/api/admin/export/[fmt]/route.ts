// GET /api/admin/export/[fmt] — 报表导出 CSV/JSON（D6 + 档案化）
import { NextRequest, NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth";
import { listUsersWithProfile, filterUserList, maskIdcard } from "@/lib/admin";

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ fmt: string }> }
) {
  const admin = await requireApiAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
  }
  const { fmt } = await ctx.params;
  if (fmt !== "csv" && fmt !== "json") {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  // 默认排除占位账号（placeholder 参数可覆盖：all/only）
  const role = req.nextUrl.searchParams.get("role") ?? "";
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const placeholder = req.nextUrl.searchParams.get("placeholder") ?? "";
  const all = await listUsersWithProfile(true); // 全量，占位/角色/关键字过滤与列表同口径
  const { rows: list } = filterUserList(all, { role, q, placeholder }); // T-D：导出带当前筛选
  const filename = `learning-profile-export-${new Date().toISOString().slice(0, 10)}`;

  if (fmt === "csv") {
    const headers = [
      "username",
      "name",
      "role",
      "tier",
      "realname",
      "phone",
      "idcard",
      "participationRate",
      "completionRate",
      "viewedModules",
      "completedModules",
      "quizPassedModules",
      "totalAttempts",
      "avgScore",
      "lastActiveAt",
    ];
    const lines = list.map((u) =>
      [
        u.username,
        u.name,
        u.role,
        u.tier,
        u.realname,
        u.phone,
        maskIdcard(u.idcard),
        String(u.participationRate),
        String(u.completionRate),
        u.viewedModules.join("|"),
        u.completedModules.join("|"),
        u.quizPassedModules.join("|"),
        String(u.totalAttempts),
        String(u.avgScore),
        u.last_active_at ? u.last_active_at.toISOString() : "",
      ]
        .map(csvEscape)
        .join(",")
    );
    const body = "\uFEFF" + [headers.join(","), ...lines].join("\n"); // BOM 兼容 Excel
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  }

  const json = list.map((u) => ({
    username: u.username,
    name: u.name,
    role: u.role,
    tier: u.tier,
    realname: u.realname,
    phone: u.phone,
    idcard: maskIdcard(u.idcard),
    participationRate: u.participationRate,
    completionRate: u.completionRate,
    viewedModules: u.viewedModules,
    completedModules: u.completedModules,
    quizPassedModules: u.quizPassedModules,
    quizBestScores: u.quizBestScores,
    totalAttempts: u.totalAttempts,
    avgScore: u.avgScore,
    lastActiveAt: u.last_active_at ? u.last_active_at.toISOString() : null,
  }));
  return new NextResponse(JSON.stringify(json, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.json"`,
    },
  });
}
