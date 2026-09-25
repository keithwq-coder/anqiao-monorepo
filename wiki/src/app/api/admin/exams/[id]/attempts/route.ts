// GET /api/admin/exams/[id]/attempts — 考试成绩单（admin）：客观分 + 主观题作答（含评分要点，供人工评分）
import { NextRequest, NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth";
import { getExamAttempts, getExamById, getExamScenarios } from "@/lib/exam";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = await requireApiAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const examId = Number(id);
  if (!Number.isInteger(examId)) {
    return NextResponse.json({ ok: false, error: "参数错误" }, { status: 400 });
  }

  const exam = await getExamById(examId);
  if (!exam) {
    return NextResponse.json({ ok: false, error: "考试不存在" }, { status: 404 });
  }

  const attempts = await getExamAttempts(examId);
  const scenarios = await getExamScenarios(examId, true); // 评分要点（人工/AI 评分参考）
  return NextResponse.json({
    ok: true,
    exam: {
      id: exam.id,
      title: exam.title,
      questionCount: exam.question_ids.length,
      durationMinutes: exam.duration_minutes,
      passingScore: exam.passing_score,
      scenarios,
    },
    attempts: attempts.map((a) => ({
      id: a.id,
      username: a.username,
      name: a.name,
      score: a.score,
      passed: a.passed,
      correctCount: a.correct_count,
      totalCount: a.total_count,
      scenarioAnswers: a.scenario_answers,
      submittedAt: a.submitted_at ? new Date(a.submitted_at).toISOString() : null,
    })),
  });
}