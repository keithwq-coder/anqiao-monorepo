// POST /api/admin/users/bulk — 批量建号（JSON 数组 [{role,name?}] 或 CSV 文本；T-G）
import { NextRequest, NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth";
import { createUser, recordAudit } from "@/lib/admin";
import type { Role } from "@/lib/types";

// 角色标识支持英文值或中文显示名（即可建角色白名单：dealer/agent/reseller/internal_sales）
const ROLE_ALIAS: Record<string, Role> = {
  dealer: "dealer",
  agent: "agent",
  reseller: "reseller",
  internal_sales: "internal_sales",
  "经销商": "dealer",
  "代理商": "agent",
  "代销商": "reseller",
  "内部销售": "internal_sales",
};

const MAX_BATCH = 50; // 单次上限，防误用

function normalizeRole(v: string): Role | null {
  const key = v.trim().toLowerCase();
  return ROLE_ALIAS[key] ?? null;
}

/** 解析文本行：`role[空格|,|，|Tab]显示名`，每行一条 */
function parseLines(text: string): { role: string; name?: string }[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line): { role: string; name?: string } | null => {
      const parts = line
        .split(/[\s,，\t]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length === 0) return null;
      return { role: parts[0], name: parts[1] };
    })
    .filter((x): x is { role: string; name?: string } => x !== null);
}

export async function POST(req: NextRequest) {
  const admin = await requireApiAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
  }

  const text = await req.text();
  let lines: { role: string; name?: string }[] = [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      lines = parsed.map((r) => ({
        role: String((r as { role?: unknown })?.role ?? ""),
        name: typeof (r as { name?: unknown })?.name === "string" ? (r as { name: string }).name : undefined,
      }));
    } else if (typeof parsed === "string") {
      lines = parseLines(parsed);
    } else {
      return NextResponse.json({ ok: false, error: "参数格式错误" }, { status: 400 });
    }
  } catch {
    // 非 JSON → 按 CSV/文本行解析
    lines = parseLines(text);
  }

  if (lines.length === 0) {
    return NextResponse.json({ ok: false, error: "没有可创建的行" }, { status: 400 });
  }
  if (lines.length > MAX_BATCH) {
    return NextResponse.json({ ok: false, error: `单次最多 ${MAX_BATCH} 个账号` }, { status: 400 });
  }

  const created: { username: string; name: string; role: string; initialPassword: string }[] = [];
  const failed: { role: string; name: string; reason: string }[] = [];

  for (const line of lines) {
    const role = normalizeRole(line.role);
    if (!role) {
      failed.push({ role: line.role, name: line.name ?? "", reason: "角色不合法" });
      continue;
    }
    try {
      const u = await createUser(role, line.name);
      await recordAudit(admin.id, "create_user", u.username, "bulk"); // T-G：批量建号同样留痕
      created.push({ username: u.username, name: u.name, role: u.role, initialPassword: u.initialPassword });
    } catch (e) {
      const reason = e instanceof Error && e.message ? e.message : "创建失败";
      failed.push({ role: line.role, name: line.name ?? "", reason });
    }
  }

  return NextResponse.json({
    ok: true,
    created,
    failed,
    count: created.length,
  });
}
