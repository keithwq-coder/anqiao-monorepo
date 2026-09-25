// POST /api/self-test/submit — 自测判分（服务端比对；不落库，只返回错了几题）
import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  }

  let body: { answers?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "参数格式错误" }, { status: 400 });
  }
  const answersRaw = body.answers;
  if (!answersRaw || typeof answersRaw !== "object" || Array.isArray(answersRaw)) {
    return NextResponse.json({ ok: false, error: "请先作答" }, { status: 400 });
  }
  const answers: Record<string, string> = {};
  for (const [k, v] of Object.entries(answersRaw as Record<string, unknown>)) {
    if (typeof v === "string") answers[k] = v.toUpperCase();
  }
  const ids = Object.keys(answers).map(Number).filter(Number.isInteger);
  if (ids.length === 0) {
    return NextResponse.json({ ok: false, error: "请先作答" }, { status: 400 });
  }

  const { rows } = await pool.query(
    "select id, answer from quiz_questions where id = any($1::int[])",
    [ids]
  );
  const answerByQid = new Map(rows.map((r) => [r.id, r.answer]));

  let correct = 0;
  for (const [qid, chosen] of Object.entries(answers)) {
    if (answerByQid.get(Number(qid)) === chosen) correct++;
  }
  const total = ids.length;
  const wrongCount = total - correct;

  // 自测不写库：无分数、不记录，结果仅本人可见
  return NextResponse.json({
    ok: true,
    wrongCount,
    total,
    allCorrect: wrongCount === 0,
  });
}