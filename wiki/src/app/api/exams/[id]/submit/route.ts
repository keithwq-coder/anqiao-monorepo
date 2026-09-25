// POST /api/exams/[id]/submit — 学员提交考试：客观题服务端判分 + 主观题作答留存（AI/人工评分参考，不计总分）
import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { submitExamAttempt } from "@/lib/exam";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const examId = Number(id);
  if (!Number.isInteger(examId)) {
    return NextResponse.json({ ok: false, error: "参数错误" }, { status: 400 });
  }

  let body: { answers?: unknown; scenarioAnswers?: unknown } = {};
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
  if (Object.keys(answers).length === 0) {
    return NextResponse.json({ ok: false, error: "请先作答" }, { status: 400 });
  }

  // 主观题作答（客户挑战问答，不计总分）：{scenarioId: text}
  const scenarioAnswers: Record<string, string> = {};
  if (body.scenarioAnswers && typeof body.scenarioAnswers === "object" && !Array.isArray(body.scenarioAnswers)) {
    for (const [k, v] of Object.entries(body.scenarioAnswers as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) scenarioAnswers[k] = v.trim().slice(0, 2000);
    }
  }

  try {
    const result = await submitExamAttempt(user.id, examId, answers, scenarioAnswers);
    return NextResponse.json({ ok: true, examId, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}