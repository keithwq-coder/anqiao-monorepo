// GET/POST /api/admin/exams — 考试管理：列表 / 创建（管理员随机组卷，从题库抽题）
import { NextRequest, NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth";
import { createExam, listExams } from "@/lib/exam";
import { recordAudit } from "@/lib/admin";

export async function GET() {
  const admin = await requireApiAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
  }
  const exams = await listExams();
  return NextResponse.json({
    ok: true,
    exams: exams.map((e) => ({
      id: e.id,
      title: e.title,
      questionCount: e.question_ids.length,
      scenarioCount: e.scenario_ids?.length ?? 0,
      durationMinutes: e.duration_minutes,
      passingScore: e.passing_score,
      attemptCount: (e as unknown as { attempt_count?: number }).attempt_count ?? 0,
      passedCount: (e as unknown as { passed_count?: number }).passed_count ?? 0,
      createdAt: e.created_at ? new Date(e.created_at).toISOString() : null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const admin = await requireApiAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
  }

  let body: { title?: unknown; count?: unknown; durationMinutes?: unknown; passingScore?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "参数格式错误" }, { status: 400 });
  }

  const count = typeof body.count === "number" ? body.count : 20;
  const durationMinutes = typeof body.durationMinutes === "number" ? body.durationMinutes : 30;
  const passingScore = typeof body.passingScore === "number" ? body.passingScore : 80;

  if (count < 1 || count > 100 || durationMinutes < 1 || durationMinutes > 180 || passingScore < 0 || passingScore > 100) {
    return NextResponse.json({ ok: false, error: "参数超出范围" }, { status: 400 });
  }

  try {
    const exam = await createExam(admin.id, {
      title: typeof body.title === "string" ? body.title : undefined,
      count,
      durationMinutes,
      passingScore,
    });
    await recordAudit(admin.id, "create_exam", exam.title, `q=${exam.question_ids.length}`);
    return NextResponse.json({
      ok: true,
      exam: {
        id: exam.id,
        title: exam.title,
        questionCount: exam.question_ids.length,
        scenarioCount: exam.scenario_ids?.length ?? 0,
        durationMinutes: exam.duration_minutes,
        passingScore: exam.passing_score,
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}
