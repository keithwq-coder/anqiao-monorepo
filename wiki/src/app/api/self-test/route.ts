// GET /api/self-test — 自测取题：模块学完后刷题/测试（按模块随机抽题；无 answer；不落库、仅本人可见）
import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  }

  const moduleId = req.nextUrl.searchParams.get("module") ?? "";
  const params: unknown[] = [];
  let where = "";
  if (/^M\d{2}$/.test(moduleId)) {
    params.push(moduleId);
    where = `where module_id = $1`;
  }
  const { rows } = await pool.query(
    `select id, module_id, ordinal, question, options from quiz_questions ${where} order by random() limit 10`,
    params
  );
  if (rows.length === 0) {
    return NextResponse.json(
      { ok: false, error: moduleId ? "该模块暂无题目" : "题库为空" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    module: moduleId || "ALL",
    total: rows.length,
    questions: rows.map((r) => ({
      id: r.id,
      moduleId: r.module_id,
      ordinal: r.ordinal,
      question: r.question,
      options: r.options,
    })),
  });
}
