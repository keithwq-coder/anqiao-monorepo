// /api/admin/users — GET 学员列表 / POST 新建账号（D3/D4 + 档案化）
import { NextRequest, NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth";
import { listUsersWithProfile, filterUserList, createUser, recordAudit } from "@/lib/admin";
import { type Role } from "@/lib/types";

const CREATEABLE: Role[] = ["dealer", "agent", "reseller", "internal_sales"];

// ---------- GET：学员列表（默认排除占位；placeholder=all 时包含；T-D 分页/排序） ----------
export async function GET(req: NextRequest) {
  const admin = await requireApiAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
  }
  const role = req.nextUrl.searchParams.get("role") ?? "";
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const placeholder = req.nextUrl.searchParams.get("placeholder") ?? ""; // ""|all|only
  const sort = req.nextUrl.searchParams.get("sort") ?? "";
  const order = req.nextUrl.searchParams.get("order") === "desc" ? "desc" : "asc";
  const page = Number(req.nextUrl.searchParams.get("page") ?? "1");
  const pageSize = Number(req.nextUrl.searchParams.get("pageSize") ?? "20");

  const list = await listUsersWithProfile(true); // 全量（含占位），占位/角色/关键字过滤统一在 filterUserList 做
  const { rows, total } = filterUserList(list, { role, q, placeholder, sort, order, page, pageSize });

  return NextResponse.json({
    ok: true,
    users: rows.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      tier: u.tier,
      realname: u.realname,
      phone: u.phone,
      isPlaceholder: u.is_placeholder,
      participationRate: u.participationRate,
      completionRate: u.completionRate,
      viewedModules: u.viewedModules,
      completedModules: u.completedModules,
      quizPassedModules: u.quizPassedModules,
      quizBestScores: u.quizBestScores,
      totalAttempts: u.totalAttempts,
      avgScore: u.avgScore,
      lastActiveAt: u.lastActiveAt,
      isActive: u.is_active,
    })),
    total,
    page,
    pageSize,
  });
}

// ---------- POST：新建账号（T-G：复用 createUser 单建/批量共用） ----------
export async function POST(req: NextRequest) {
  const admin = await requireApiAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
  }

  let body: { role?: unknown; name?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "参数格式错误" }, { status: 400 });
  }

  const role = body.role as Role;
  if (!CREATEABLE.includes(role)) {
    return NextResponse.json({ ok: false, error: "角色不合法" }, { status: 400 });
  }

  let u;
  try {
    u = await createUser(role, typeof body.name === "string" ? body.name : undefined);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "创建失败";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  // T-F：建号留痕
  await recordAudit(admin.id, "create_user", u.username, "");

  return NextResponse.json({
    ok: true,
    user: { username: u.username, name: u.name, role: u.role },
    initialPassword: u.initialPassword, // 仅此一次展示
  });
}
