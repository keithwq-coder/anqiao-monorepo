// POST /api/quiz/[moduleId]/submit — 服务端判分（答案不出服务端校验）
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { getModuleAccessForRole } from "@/lib/certification";

interface Answer {
  id: number;
  answer: string;
}

export async function POST(
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

  let body: { answers?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "参数格式错误" }, { status: 400 });
  }
  const answers: Answer[] = Array.isArray(body.answers) ? (body.answers as Answer[]) : [];
  if (answers.length === 0) {
    return NextResponse.json({ ok: false, error: "请先作答" }, { status: 400 });
  }

  const { rows } = await pool.query(
    "select id, ordinal, question, options, answer from quiz_questions where module_id=$1",
    [moduleId]
  );
  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: "该模块暂无测验题" }, { status: 404 });
  }

  const answerByQid = new Map(rows.map((r) => [r.id, r.answer]));
  const submitted = new Map<number, string>();
  let validCount = 0;
  for (const a of answers) {
    if (typeof a.id === "number" && typeof a.answer === "string" && answerByQid.has(a.id)) {
      submitted.set(a.id, a.answer.toUpperCase());
      validCount++;
    }
  }
  if (validCount === 0) {
    return NextResponse.json({ ok: false, error: "提交无效" }, { status: 400 });
  }

  let correct = 0;
  const wrongOrdinals: number[] = [];
  for (const [qid, chosen] of submitted) {
    if (answerByQid.get(qid) === chosen) {
      correct++;
    }
  }
  const total = rows.length;
  const score = Math.round((correct / total) * 100);
  const passed = score >= 80;

  const { rows: wrongRows } = await pool.query(
    "select ordinal from quiz_questions where module_id=$1 and id = any($2::int[])",
    [moduleId, [...submitted.keys()].filter((id) => answerByQid.get(id) !== submitted.get(id))]
  );
  wrongRows.forEach((r) => wrongOrdinals.push(r.ordinal));
  wrongOrdinals.sort((a, b) => a - b);

  // T-A：判分后随本次结果回显每题明细（仅 POST submit 返回一次，不进取题接口）
  const details = rows.map((r) => ({
    ordinal: r.ordinal,
    question: r.question,
    options: r.options,
    chosen: submitted.get(r.id) ?? null, // 字母 A/B/C/D
    correct: r.answer, // 字母 A/B/C/D
  }));

  await pool.query(
    "insert into quiz_attempts(user_id, module_id, score, passed, answers) values($1,$2,$3,$4,$5)",
    [user.id, moduleId, score, passed, JSON.stringify([...submitted.entries()])]
  );

  return NextResponse.json({
    ok: true,
    moduleId,
    mode: access === "req" ? "required" : "practice",
    score,
    passed,
    correctCount: correct,
    total,
    wrongOrdinals,
    details,
  });
}
