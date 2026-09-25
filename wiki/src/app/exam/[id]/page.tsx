"use client";

// /exam/[id] — 新人培训考试页：客观题（题库抽取，服务端判分）+ 2 道客户挑战主观题（不计入总分，AI/人工评分参考）
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface ExamQuestion {
  id: number;
  ordinal: number;
  question: string;
  options: string[];
}

interface ExamScenario {
  id: number;
  scenario: string;
}

interface ExamData {
  examId: number;
  title: string;
  durationMinutes: number;
  passingScore: number;
  questions: ExamQuestion[];
  scenarios: ExamScenario[];
}

interface ExamResult {
  score: number;
  passed: boolean;
  correctCount: number;
  total: number;
  wrongOrdinals: number[];
}

const LETTERS = ["A", "B", "C", "D"];

export default function ExamPage() {
  const { id } = useParams<{ id: string }>();
  const [exam, setExam] = useState<ExamData | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [scenarioAnswers, setScenarioAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ExamResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/exams/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) {
          setError(d.error || "加载失败");
        } else {
          setExam(d);
          setSecondsLeft(d.durationMinutes * 60);
        }
      })
      .catch(() => setError("网络错误"))
      .finally(() => setLoading(false));
  }, [id]);

  // 倒计时：到 0 自动提交已作答
  useEffect(() => {
    if (secondsLeft === null || result) return;
    if (secondsLeft <= 0) {
      void submit();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, result]);

  function choose(qid: number, letter: string) {
    setAnswers((a) => ({ ...a, [qid]: letter }));
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!exam || submitting) return;
    if (Object.keys(answers).length === 0) {
      setError("请至少作答一题");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/exams/${exam.examId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, v.toUpperCase()])),
          scenarioAnswers,
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setError(d.error || "提交失败");
      } else {
        setResult({ score: d.score, passed: d.passed, correctCount: d.correctCount, total: d.total, wrongOrdinals: d.wrongOrdinals });
      }
    } catch {
      setError("网络错误");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto", padding: 48, textAlign: "center", color: "#6b7b79" }}>
        加载中…
      </main>
    );
  }

  if (error && !exam) {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto", padding: 48, textAlign: "center" }}>
        <p style={{ color: "#c0492f" }}>{error}</p>
        <Link href="/" style={{ color: "#1c7c74" }}>返回仪表盘</Link>
      </main>
    );
  }

  if (!exam) return null;

  const answered = Object.keys(answers).length;
  const mm = secondsLeft === null ? "--" : `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px 60px" }}>
      <div style={{ fontSize: 13, color: "#6b7b79", marginBottom: 6 }}>
        <Link href="/" style={{ color: "#1c7c74", textDecoration: "none" }}>仪表盘</Link> / 考试
      </div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ fontSize: 22, color: "#0e3b43", margin: "0 0 4px" }}>{exam.title}</h1>
        {!result && (
          <span style={{ fontSize: 13, fontWeight: 700, color: secondsLeft !== null && secondsLeft <= 60 ? "#c0492f" : "#1c7c74" }}>
            剩余时间：{mm}
          </span>
        )}
      </div>
      <p style={{ fontSize: 13, color: "#6b7b79", marginBottom: 20 }}>
        客观题 {exam.questions.length} 题（满分 100，通过线 {exam.passingScore} 分）
        {exam.scenarios?.length ? ` · 另有 ${exam.scenarios.length} 道客户挑战问答（模拟题，不计入总分，由管理者评分）` : ""}
      </p>

      {result ? (
        <div
          style={{
            background: result.passed ? "#e1f5ee" : "#fcebeb",
            border: `1px solid ${result.passed ? "#9adfc9" : "#f0c4c4"}`,
            borderRadius: 12,
            padding: "24px 28px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 40, fontWeight: 800, color: result.passed ? "#085041" : "#a32d2d" }}>
            {result.score}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: result.passed ? "#085041" : "#a32d2d", marginTop: 4 }}>
            {result.passed ? "✅ 通过" : `未通过（< ${exam.passingScore} 分）`}
          </div>
          <div style={{ fontSize: 13, color: "#6b7b79", marginTop: 8 }}>
            答对 {result.correctCount}/{result.total} 题
            {result.wrongOrdinals.length > 0 && `　·　错题位置：第 ${result.wrongOrdinals.join("、")} 题`}
          </div>
          {exam.scenarios?.length > 0 && (
            <div style={{ fontSize: 12, color: "#6b7b79", marginTop: 6 }}>
              客户挑战问答已提交，将由管理者评分（不计入本次总分）。
            </div>
          )}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
            <Link href="/" style={{ background: "#1c7c74", color: "#fff", padding: "10px 22px", borderRadius: 20, textDecoration: "none", fontSize: 14 }}>
              返回首页
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {exam.questions.map((q) => (
              <div key={q.id} style={{ background: "#fff", border: "1px solid #e4ded2", borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#243b3a", marginBottom: 10 }}>
                  {q.ordinal}. {q.question}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {q.options.map((opt, oi) => {
                    const letter = LETTERS[oi] ?? String.fromCharCode(65 + oi);
                    const chosen = answers[q.id] === letter;
                    return (
                      <label
                        key={oi}
                        style={{
                          display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 8,
                          border: `1px solid ${chosen ? "#1c7c74" : "#e4ded2"}`,
                          background: chosen ? "#e1f5ee" : "#fff", cursor: "pointer", fontSize: 14,
                        }}
                      >
                        <input type="radio" name={`q${q.id}`} checked={chosen}
                          onChange={() => choose(q.id, letter)} style={{ accentColor: "#1c7c74" }} />
                        <b style={{ width: 20 }}>{letter}</b>
                        {opt}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            {exam.scenarios?.map((s, si) => (
              <div key={s.id} style={{ background: "#fdf4da", border: "1px solid #e8d9a0", borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, background: "#e8a33d", color: "#7c4d00", borderRadius: 8, padding: "2px 8px" }}>
                    客户挑战问答 {si + 1}
                  </span>
                  <span style={{ fontSize: 11, color: "#8a5a00" }}>模拟题 · 不计入总分 · 由管理者评分</span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#243b3a", margin: "10px 0 8px" }}>
                  {s.scenario}
                </div>
                <textarea
                  value={scenarioAnswers[String(s.id)] ?? ""}
                  onChange={(e) => setScenarioAnswers((a) => ({ ...a, [String(s.id)]: e.target.value }))}
                  rows={4}
                  placeholder="请写下你的应对回应（例如：先认可顾虑，再讲价值锚定……）"
                  style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d7dde0", borderRadius: 8, padding: "10px 12px", fontSize: 14, fontFamily: "inherit" }}
                />
              </div>
            ))}
          </div>

          {error && <div style={{ color: "#c0492f", fontSize: 13, marginTop: 12 }}>{error}</div>}

          <div style={{ marginTop: 20 }}>
            <button
              type="submit"
              disabled={submitting || answered === 0}
              style={{
                background: "#1c7c74", color: "#fff", border: "none", padding: "12px 32px", borderRadius: 22,
                fontSize: 15, fontWeight: 600,
                cursor: submitting || answered === 0 ? "default" : "pointer",
                opacity: submitting || answered === 0 ? 0.5 : 1,
              }}
            >
              {submitting ? "提交中…" : `交卷（客观题已答 ${answered}/${exam.questions.length}）`}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}