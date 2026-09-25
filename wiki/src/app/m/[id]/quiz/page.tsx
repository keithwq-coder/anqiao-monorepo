"use client";

// /m/[id]/quiz — 测验（取题不含答案，服务端判分）
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Question {
  id: number;
  ordinal: number;
  question: string;
  options: string[];
}

interface QuizData {
  moduleId: string;
  mode: "required" | "practice";
  questions: Question[];
}

interface QuestionDetail {
  ordinal: number;
  question: string;
  options: string[];
  chosen: string | null;
  correct: string;
}

interface Result {
  score: number;
  passed: boolean;
  correctCount: number;
  total: number;
  wrongOrdinals: number[];
  details?: QuestionDetail[];
}

const LETTERS = ["A", "B", "C", "D"];

export default function QuizPage() {
  const { id } = useParams<{ id: string }>();
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/quiz/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) {
          setError(d.error || "加载失败");
        } else {
          setQuiz(d);
        }
      })
      .catch(() => setError("网络错误"))
      .finally(() => setLoading(false));
  }, [id]);

  function choose(qid: number, opt: string) {
    setAnswers((a) => ({ ...a, [qid]: opt }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!quiz) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/quiz/${quiz.moduleId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: Object.entries(answers).map(([qid, answer]) => ({ id: Number(qid), answer })),
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setError(d.error || "提交失败");
        return;
      }
      setResult({ score: d.score, passed: d.passed, correctCount: d.correctCount, total: d.total, wrongOrdinals: d.wrongOrdinals, details: d.details });
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

  if (error && !quiz) {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto", padding: 48, textAlign: "center" }}>
        <p style={{ color: "#c0492f" }}>{error}</p>
        <Link href="/" style={{ color: "#1c7c74" }}>
          返回仪表盘
        </Link>
      </main>
    );
  }

  if (!quiz) return null;

  const answered = Object.keys(answers).length;

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px 60px" }}>
      <div style={{ fontSize: 13, color: "#6b7b79", marginBottom: 6 }}>
        <Link href="/" style={{ color: "#1c7c74", textDecoration: "none" }}>
          仪表盘
        </Link>{" "}
        / <Link href={`/m/${quiz.moduleId}`} style={{ color: "#1c7c74", textDecoration: "none" }}>
          {quiz.moduleId}
        </Link>{" "}
        / 测验
      </div>
      <h1 style={{ fontSize: 22, color: "#0e3b43", marginBottom: 4 }}>
        {quiz.moduleId} 课后测验
      </h1>
      <p style={{ fontSize: 13, color: "#6b7b79", marginBottom: 20 }}>
        {quiz.mode === "required" ? "完成测验 · 满分 100 · 80 分通过" : "选修练习 · 不计认证门槛"}
        {"　"}·　共 {quiz.questions.length} 题
      </p>

      {result ? (
        <div
          style={{
            background: result.passed ? "#e1f5ee" : "#fcebeb",
            border: `1px solid ${result.passed ? "#9adfc9" : "#f0c4c4"}`,
            borderRadius: 12,
            padding: "24px 28px",
            marginBottom: 24,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 40, fontWeight: 800, color: result.passed ? "#085041" : "#a32d2d" }}>
            {result.score}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: result.passed ? "#085041" : "#a32d2d", marginTop: 4 }}>
            {result.passed ? "✅ 通过（≥80 分）" : "未通过（<80 分），可重考"}
          </div>
          <div style={{ fontSize: 13, color: "#6b7b79", marginTop: 8 }}>
            答对 {result.correctCount}/{result.total} 题
            {result.wrongOrdinals.length > 0 && `　·　错题位置：第 ${result.wrongOrdinals.join("、")} 题`}
          </div>

          {/* T-A：错题/全题明细回显（仅本次提交结果） */}
          {result.details && result.details.length > 0 && (
            <div style={{ marginTop: 20, textAlign: "left", display: "flex", flexDirection: "column", gap: 10 }}>
              {result.details.map((d) => {
                const ok = d.chosen === d.correct;
                const optionText = (letter: string | null) => {
                  if (!letter) return "未作答";
                  const idx = LETTERS.indexOf(letter);
                  return idx >= 0 && d.options[idx] ? `${letter}. ${d.options[idx]}` : letter;
                };
                return (
                  <div
                    key={d.ordinal}
                    style={{
                      background: "#fff",
                      border: `1px solid ${ok ? "#9adfc9" : "#f0c4c4"}`,
                      borderRadius: 10,
                      padding: "12px 16px",
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#243b3a" }}>
                      {ok ? "✅" : "❌"} 第 {d.ordinal} 题：{d.question}
                    </div>
                    <div style={{ fontSize: 13, color: ok ? "#085041" : "#a32d2d", marginTop: 6 }}>
                      你的答案：{optionText(d.chosen)}
                      {ok ? "（正确）" : "（错误）"}
                    </div>
                    {!ok && (
                      <div style={{ fontSize: 13, color: "#085041", marginTop: 2 }}>
                        正确答案：{optionText(d.correct)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
            <Link
              href={`/m/${quiz.moduleId}`}
              style={{ background: "#1c7c74", color: "#fff", padding: "10px 22px", borderRadius: 20, textDecoration: "none", fontSize: 14 }}
            >
              返回课件
            </Link>
            <button
              onClick={() => {
                setResult(null);
                setAnswers({});
              }}
              style={{ background: "#fff", border: "1px solid #1c7c74", color: "#1c7c74", padding: "10px 22px", borderRadius: 20, fontSize: 14, cursor: "pointer" }}
            >
              重考一次
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {quiz.questions.map((q, qi) => (
              <div key={q.id} style={{ background: "#fff", border: "1px solid #e4ded2", borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#243b3a", marginBottom: 10 }}>
                  {qi + 1}. {q.question}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {q.options.map((opt, oi) => {
                    const letter = LETTERS[oi];
                    const chosen = answers[q.id] === letter;
                    return (
                      <label
                        key={oi}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "9px 12px",
                          borderRadius: 8,
                          border: `1px solid ${chosen ? "#1c7c74" : "#e4ded2"}`,
                          background: chosen ? "#e1f5ee" : "#fff",
                          cursor: "pointer",
                          fontSize: 14,
                        }}
                      >
                        <input
                          type="radio"
                          name={`q${q.id}`}
                          checked={chosen}
                          onChange={() => choose(q.id, letter)}
                          style={{ accentColor: "#1c7c74" }}
                        />
                        <b style={{ width: 20 }}>{letter}</b>
                        {opt}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div style={{ color: "#c0492f", fontSize: 13, marginTop: 12 }}>{error}</div>
          )}

          <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 14 }}>
            <button
              type="submit"
              disabled={submitting || answered < quiz.questions.length}
              style={{
                background: "#1c7c74",
                color: "#fff",
                border: "none",
                padding: "12px 32px",
                borderRadius: 22,
                fontSize: 15,
                fontWeight: 600,
                cursor: submitting || answered < quiz.questions.length ? "default" : "pointer",
                opacity: submitting || answered < quiz.questions.length ? 0.5 : 1,
              }}
            >
              {submitting ? "提交中…" : `提交答卷（已答 ${answered}/${quiz.questions.length}）`}
            </button>
            <Link href={`/m/${quiz.moduleId}`} style={{ color: "#6b7b79", fontSize: 14 }}>
              返回课件
            </Link>
          </div>
        </form>
      )}
    </main>
  );
}
