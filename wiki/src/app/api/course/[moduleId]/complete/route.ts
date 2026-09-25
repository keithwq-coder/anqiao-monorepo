// POST /api/course/[moduleId]/complete — 标记课件"已学完"（滚动到底触发，仅档案记录）
import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getModuleAccessForRole, markModuleCompleted } from "@/lib/certification";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ moduleId: string }> }
) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { moduleId } = await ctx.params;
  const access = await getModuleAccessForRole(moduleId, user.role);
  if (access === "na") {
    return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
  }

  await markModuleCompleted(user.id, moduleId);
  return NextResponse.json({ ok: true, moduleId });
}
