// GET /api/mindmap/[moduleId] — 模块思维导图（模块 → slide → 要点）
import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getMindmap } from "@/lib/learning";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ moduleId: string }> }
) {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  }
  const { moduleId } = await ctx.params;
  const m = getMindmap(moduleId);
  if (!m) {
    return NextResponse.json({ ok: false, error: "模块不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, module: m });
}