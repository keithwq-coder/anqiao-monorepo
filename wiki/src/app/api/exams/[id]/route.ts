// GET /api/exams/[id] — 学员取题（客观题无 answer；另附 2 道客户挑战主观题场景，不含评分要点）
import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getExamQuestionsForUser } from "@/lib/exam";

export async function GET(
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

  const exam = await getExamQuestionsForUser(examId);
  if (!exam) {
    return NextResponse.json({ ok: false, error: "考试不存在" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    examId: exam.examId,
    title: exam.title,
    durationMinutes: exam.durationMinutes,
    passingScore: exam.passingScore,
    questions: exam.questions, // id/ordinal/question/options —— 无 answer
    scenarios: exam.scenarios, // [{id, scenario}] 客户挑战主观题（不计入总分）
  });
}