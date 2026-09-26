// src/lib/exam.ts — 新人培训考试（管理员随机组卷 + 学员作答判分 + 成绩单）
import { pool } from "./db";

export interface ExamRow {
  id: number;
  title: string;
  question_ids: number[];
  duration_minutes: number;
  passing_score: number;
  created_by: number | null;
  created_at: Date;
  scenario_ids: number[] | null;
}

export interface ExamAttemptRow {
  id: number;
  exam_id: number;
  user_id: number;
  username: string;
  name: string;
  score: number;
  passed: boolean;
  correct_count: number;
  total_count: number;
  scenario_answers: Record<string, string> | null;
  submitted_at: Date | null;
}

/** 管理员创建考试：从题库随机抽 count 题（全题库范围） */
export async function createExam(
  adminId: number,
  opts: { title?: string; count?: number; durationMinutes?: number; passingScore?: number }
): Promise<ExamRow> {
  const count = Math.min(Math.max(opts.count && opts.count > 0 ? Math.round(opts.count) : 20, 1), 100);
  const duration = Math.min(Math.max(opts.durationMinutes && opts.durationMinutes > 0 ? Math.round(opts.durationMinutes) : 30, 1), 180);
  const passing = Math.min(Math.max(opts.passingScore && opts.passingScore > 0 ? Math.round(opts.passingScore) : 80, 0), 100);
  const title = (opts.title ?? "").trim().slice(0, 80) || "新人考试";

  const { rows: qrows } = await pool.query("select id from quiz_questions order by random() limit $1", [count]);
  if (qrows.length === 0) {
    throw new Error("题库为空，无法组卷");
  }
  const ids = qrows.map((r) => r.id);

  // 主观题：随机抽 2 道客户挑战场景（不计入客观总分，AI/人工评分参考）
  const sres = await pool.query("select id from scenario_questions order by random() limit 2");
  const scenarioIds = sres.rows.map((r) => r.id);

  const ins = await pool.query(
    `insert into exams(title, question_ids, duration_minutes, passing_score, created_by, scenario_ids)
     values(?,?,?,?,?,?)`,
    [title, JSON.stringify(ids), duration, passing, adminId, JSON.stringify(scenarioIds)]
  );
  const created = await getExamById(ins.insertId!);
  if (!created) throw new Error("考试创建失败");
  return created;
}

export async function listExams(): Promise<ExamRow[]> {
  const { rows } = await pool.query(
    `select e.*,
       (select count(*)::int from exam_attempts ea where ea.exam_id = e.id) as attempt_count,
       (select count(*)::int from exam_attempts ea2 where ea2.exam_id = e.id and ea2.passed) as passed_count
       from exams e order by e.created_at desc`
  );
  return rows.map((e) => ({
    id: e.id,
    title: e.title,
    question_ids: Array.isArray(e.question_ids) ? e.question_ids : JSON.parse(e.question_ids),
    duration_minutes: e.duration_minutes,
    passing_score: e.passing_score,
    created_by: e.created_by,
    created_at: e.created_at,
    scenario_ids: e.scenario_ids ? (Array.isArray(e.scenario_ids) ? e.scenario_ids : JSON.parse(e.scenario_ids)) : [],
    attempt_count: e.attempt_count,
    passed_count: e.passed_count,
  }));
}

export async function getExamById(examId: number): Promise<ExamRow | null> {
  const { rows } = await pool.query("select * from exams where id=$1", [examId]);
  if (rows.length === 0) return null;
  const e = rows[0];
  return {
    id: e.id,
    title: e.title,
    question_ids: Array.isArray(e.question_ids) ? e.question_ids : JSON.parse(e.question_ids),
    duration_minutes: e.duration_minutes,
    passing_score: e.passing_score,
    created_by: e.created_by,
    created_at: e.created_at,
    scenario_ids: e.scenario_ids ? (Array.isArray(e.scenario_ids) ? e.scenario_ids : JSON.parse(e.scenario_ids)) : [],
  };
}

/** 主观题列表：includeHint=false 用于学员取题（不给评分要点）；true 用于成绩单评分参考 */
export async function getExamScenarios(
  examId: number,
  includeHint = false
): Promise<{ id: number; scenario: string; hint?: string }[]> {
  const exam = await getExamById(examId);
  const ids: number[] = exam?.scenario_ids ?? [];
  if (ids.length === 0) return [];
  const { rows } = await pool.query(
    `select id, scenario${includeHint ? ", hint" : ""} from scenario_questions where id = any($1::int[])`,
    [ids]
  );
  return rows.map((r) =>
    includeHint ? { id: r.id, scenario: r.scenario, hint: r.hint } : { id: r.id, scenario: r.scenario }
  );
}

/** 学员取题：绝不含 answer（与 GET /api/quiz/[moduleId] 同安全边界） */
export async function getExamQuestionsForUser(examId: number) {
  const exam = await getExamById(examId);
  if (!exam) return null;
  const { rows } = await pool.query(
    `select id, ordinal, question, options from quiz_questions
      where id = any($1::int[]) order by ordinal`,
    [exam.question_ids]
  );
  const scenarios = await getExamScenarios(exam.id, false); // 学员取题：无评分要点
  return {
    examId: exam.id,
    title: exam.title,
    durationMinutes: exam.duration_minutes,
    passingScore: exam.passing_score,
    questions: rows.map((r) => ({
      id: r.id,
      ordinal: r.ordinal,
      question: r.question,
      options: r.options, // ["A文本","B文本",...]
    })),
    scenarios,
  };
}

/** 服务端判分并留存 exam_attempts；返回成绩（不回显每题的正确答案，正式考试保密） */
export async function submitExamAttempt(
  userId: number,
  examId: number,
  answers: Record<string, string>,
  scenarioAnswers?: Record<string, string>
): Promise<{ score: number; passed: boolean; correctCount: number; total: number; wrongOrdinals: number[] }> {
  const exam = await getExamById(examId);
  if (!exam) throw new Error("考试不存在");

  const { rows } = await pool.query(
    `select id, ordinal, answer from quiz_questions where id = any($1::int[])`,
    [exam.question_ids]
  );
  const answerByQid = new Map(rows.map((r) => [r.id, r.answer]));

  let correct = 0;
  const wrongOrdinals: number[] = [];
  for (const q of rows) {
    const chosen = (answers[String(q.id)] ?? "").toUpperCase();
    if (answerByQid.get(q.id) === chosen) {
      correct++;
    } else {
      wrongOrdinals.push(q.ordinal);
    }
  }
  const total = rows.length;
  const score = total === 0 ? 0 : Math.round((correct / total) * 100);
  const passed = score >= exam.passing_score;
  wrongOrdinals.sort((a, b) => a - b);

  await pool.query(
    `insert into exam_attempts(exam_id, user_id, answers, correct_count, total_count, score, passed, scenario_answers, submitted_at)
     values($1,$2,$3,$4,$5,$6,$7,$8, now())`,
    [examId, userId, JSON.stringify(answers), correct, total, score, passed,
     scenarioAnswers && Object.keys(scenarioAnswers).length ? JSON.stringify(scenarioAnswers) : null]
  );

  return { score, passed, correctCount: correct, total, wrongOrdinals };
}

/** 成绩单（admin）：按提交时间倒序 */
export async function getExamAttempts(examId: number): Promise<ExamAttemptRow[]> {
  const { rows } = await pool.query(
    `select ea.id, ea.exam_id, ea.user_id, u.username, u.name, ea.score, ea.passed,
            ea.correct_count, ea.total_count, ea.scenario_answers, ea.submitted_at
       from exam_attempts ea join users u on u.id = ea.user_id
      where ea.exam_id = $1
      order by ea.submitted_at is null, ea.submitted_at desc, ea.id desc`,
    [examId]
  );
  return rows.map((r) => ({
    id: r.id,
    exam_id: r.exam_id,
    user_id: r.user_id,
    username: r.username,
    name: r.name,
    score: r.score,
    passed: Boolean(r.passed),
    correct_count: r.correct_count,
    total_count: r.total_count,
    scenario_answers: r.scenario_answers
      ? (typeof r.scenario_answers === "string" ? JSON.parse(r.scenario_answers) : r.scenario_answers)
      : null,
    submitted_at: r.submitted_at,
  }));
}