// GET /api/quiz/[moduleId] — 取题（绝不含 answer；§7.3）
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { getModuleAccessForRole } from "@/lib/certification";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ moduleId: string }> }
) {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  }
  const { moduleId } = await ctx.params;
  const access = await getModuleAccessForRole(moduleId, user.role);
  if (access === "na") {
    return NextResponse.json({ ok: false, error: "无权限访问该模块" }, { status: 403 });
  }

  const { rows } = await pool.query(
    "select id, module_id, ordinal, question, options from quiz_questions where module_id=$1 order by ordinal",
    [moduleId]
  );
  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: "该模块暂无测验题" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    moduleId,
    mode: access === "req" ? "required" : "practice",
    questions: rows.map((r) => ({
      id: r.id,
      ordinal: r.ordinal,
      question: r.question,
      options: r.options,
    })),
  });
}
