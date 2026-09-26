// GET /api/exam/practice — 模拟测试：随机 30 题 + 1 附加题（答过则不再出），每次新鲜组卷
// GET /api/exam/practice?history=true — 历史成绩列表
import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });

    // 必修完成门禁：未完成全部必修模块测验 → 拒绝
  const { rows: required } = await pool.query(
    `select ma.module_id, m.title as module_title
     from module_access ma
     join modules m on m.id = ma.module_id
     where ma.role = $1 and ma.access = 'req'`,
    [user.role]
  );
  const passed = new Set(
    (await pool.query(
      "select distinct module_id from quiz_attempts where user_id = $1 and passed = true",
      [user.id]
    )).rows.map((r: { module_id: string }) => r.module_id)
  );
  const missing = required.filter((r: { module_id: string }) => !passed.has(r.module_id));
  if (missing.length > 0) {
    return NextResponse.json({
      ok: false,
      error: "需先完成所有必修模块测验后才能参加模拟测试",
      missing: missing.map((r: { module_id: string; module_title: string }) => ({ moduleId: r.module_id, moduleTitle: r.module_title })),
    }, { status: 403 });
  }

const isHistory = req.nextUrl.searchParams.get("history") === "true";
  if (isHistory) {
    const { rows } = await pool.query(
      `select ea.id, ea.exam_id, ea.score, ea.passed, ea.correct_count, ea.total_count, ea.submitted_at,
              e.title as exam_title
       from exam_attempts ea
       join exams e on e.id = ea.exam_id
       where ea.user_id = $1 and e.created_by is null
       order by ea.submitted_at desc limit 30`,
      [user.id]
    );
    return NextResponse.json({
      ok: true,
      history: rows.map((r) => ({
        id: r.id, examId: r.exam_id, score: r.score, passed: Boolean(r.passed),
        correct: r.correct_count, total: r.total_count, title: r.exam_title,
        submittedAt: r.submitted_at,
      })),
    });
  }

  // 30 题主库
  const { rows: main } = await pool.query(
    "select id from quiz_questions where module_id not in ('SIM','BONUS') order by random() limit 30"
  );
  const allIds: number[] = main.map((r) => r.id);
  let bonusId: number | null = null;

  if (allIds.length === 0) {
    return NextResponse.json({ ok: false, error: "题库为空" }, { status: 404 });
  }

  // 附加题：检查用户是否已答过（答过不再出）
  const { rows: bonusCheck } = await pool.query(
    `select 1 from exam_attempts ea
     join exams e on e.id = ea.exam_id
     where ea.user_id = ? and e.created_by is null
       and JSON_CONTAINS(e.question_ids, CAST((select id from quiz_questions where module_id = 'BONUS' limit 1) AS CHAR))
     limit 1`,
    [user.id]
  );
  if (bonusCheck.length === 0) {
    const { rows: bonus } = await pool.query(
      "select id from quiz_questions where module_id = 'BONUS' order by random() limit 1"
    );
    if (bonus.length > 0) {
      bonusId = bonus[0].id;
      allIds.push(bonusId!);
    }
  }

  // 创建考试（限时 30 分钟）
  const erows = await pool.query(
    `insert into exams(title, question_ids, duration_minutes, passing_score, created_by)
     values('模拟测试', ?, 30, 80, null)`,
    [JSON.stringify(allIds)]
  );
  const exam = { id: erows.insertId!, title: "模拟测试" };

  const { rows: questions } = await pool.query(
    "select id, ordinal, question, options from quiz_questions where id = any($1::int[]) order by id",
    [allIds]
  );

  return NextResponse.json({
    ok: true,
    exam: {
      id: exam.id, title: exam.title, durationMinutes: 30, passingScore: 80,
      totalCount: main.length, bonusId,
    },
    questions: questions.map((q) => ({
      id: q.id, ordinal: q.ordinal, question: q.question, options: q.options,
    })),
  });
}
