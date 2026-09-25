"use client";

// /exam/practice — 模拟测试：30 题随机 + 1 附加题，每次刷新不同，成绩保留
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface ExamInfo {
  id: number;
  title: string;
  durationMinutes: number;
  passingScore: number;
  totalCount: number;
  bonusId: number | null;
}
interface Question {
  id: number;
  ordinal: number;
  question: string;
  options: string[];
}
interface HistoryRow {
  id: number;
  examId: number;
  score: number;
  passed: boolean;
  correct: number;
  total: number;
  title: string;
  submittedAt: string;
}

const LETTERS = ["A", "B", "C", "D"];

export default function PracticeExamPage() {
  const [exam, setExam] = useState<ExamInfo | null>(null);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<{ score: number; correct: number; total: number; wrongOrdinals: number[] } | null>(null);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [errorObj, setErrorObj] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadExam = useCallback(() => {
    setLoading(true);
    setError("");
    setResult(null);
    setAnswers({});
    fetch("/api/exam/practice")
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) {
          setError(d.error || "加载失败");
          setErrorObj(d);
          setQuestions(null);
        } else {
          setExam(d.exam);
          setQuestions(d.questions);
        }
      })
      .catch(() => setError("网络错误"))
      .finally(() => setLoading(false));
  }, []);

  const loadHistory = useCallback(() => {
    fetch("/api/exam/practice?history=true")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setHistory(d.history); })
      .catch(() => {});
  }, []);

  useEffect(() => { loadExam(); loadHistory(); }, [loadExam, loadHistory]);

  async function submit() {
    if (!exam || !questions || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/exams/${exam.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, v.toUpperCase()])) }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setError(d.error || "提交失败");
      } else {
        setResult({ score: d.score, correct: d.correctCount, total: d.total, wrongOrdinals: d.wrongOrdinals || [] });
        loadHistory();
      }
    } catch {
      setError("网络错误");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <main style={{ maxWidth: 720, margin: "0 auto", padding: 48, textAlign: "center", color: "#6b7b79" }}>加载中…</main>;
  if (error && !questions) return <main style={{ maxWidth: 720, margin: "0 auto", padding: 48, textAlign: "center" }}>
        <p style={{ color: "#c0492f", fontSize: 15, fontWeight: 600 }}>{error}</p>
        {"missing" in (errorObj || {}) && (errorObj as any).missing?.length > 0 && (
          <div style={{ fontSize: 13, color: "#6b7b79", marginTop: 12 }}>
            请先完成以下必修模块测验：
            {(errorObj as any).missing.map((m: any) => (
              <Link key={m.moduleId} href={`/m/${m.moduleId}/quiz`} style={{ display: "block", color: "#1c7c74", marginTop: 4 }}>{m.moduleId} {m.moduleTitle}</Link>
            ))}
          </div>
        )}
        <button onClick={loadExam} style={{ marginTop: 16, background: "#1c7c74", color: "#fff", border: "none", padding: "10px 22px", borderRadius: 20, cursor: "pointer" }}>重新加载</button>
      </main>;

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "24px 20px 60px" }}>
      <div style={{ fontSize: 13, color: "#6b7b79", marginBottom: 6 }}>
        <Link href="/" style={{ color: "#1c7c74", textDecoration: "none" }}>仪表盘</Link> / 模拟测试
      </div>
      <h1 style={{ fontSize: 22, color: "#0e3b43", marginBottom: 4 }}>模拟测试</h1>
      <p style={{ fontSize: 13, color: "#6b7b79", marginBottom: 20 }}>
        随机抽选 {exam?.totalCount ?? 30} 题{exam?.bonusId ? " + 1 道附加题" : ""} · 30 分钟 · 满分 100 · 每次刷新题目不同 · 成绩保留
      </p>

      {error && <p style={{ color: "#c0492f", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {result ? (
        <div style={{ background: "#eef4ff", border: "1px solid #c7dcf7", borderRadius: 12, padding: "24px 28px", marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#24456b" }}>得分 {result.score} 分</div>
          <div style={{ fontSize: 14, color: "#44504e", marginTop: 8 }}>
            答对 {result.correct}/{result.total} 题{result.wrongOrdinals.length > 0 ? ` · 错题：第 ${result.wrongOrdinals.sort((a,b)=>a-b).join("、")} 题` : " · 全部正确"}
          </div>
          <div style={{ fontSize: 13, color: "#6b7b79", marginTop: 8 }}>
            {result.wrongOrdinals.length > 0 ? "建议重测，查漏补缺，直到全部答对。" : "全部答对，可通过练习巩固。"}
          </div>
          <button onClick={loadExam} style={{ marginTop: 16, background: "#1c7c74", color: "#fff", border: "none", padding: "10px 22px", borderRadius: 20, fontSize: 14, cursor: "pointer" }}>再来一次（新题）</button>
        </div>
      ) : (
        <>
          <button onClick={submit} disabled={submitting} style={{ width: "100%", background: "#1c7c74", color: "#fff", border: "none", padding: "12px 0", borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: submitting ? "wait" : "pointer", marginBottom: 24 }}>
            {submitting ? "提交中…" : "交卷"}
          </button>

          {questions && questions.map((q, i) => (
            <div key={q.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 18px", marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#0e3b43", marginBottom: 8 }}>
                {exam?.bonusId === q.id ? "⭐ 附加题 · " : ""}第 {i + 1} 题 · {q.question}
              </div>
              {q.options.map((opt, oi) => {
                const letter = LETTERS[oi] ?? String(oi);
                const chosen = answers[q.id] === letter;
                return (
                  <label key={oi} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", cursor: "pointer", fontSize: 14 }}>
                    <input type="radio" name={`q-${q.id}`} value={letter} checked={chosen} onChange={() => setAnswers((a) => ({ ...a, [q.id]: letter }))} />
                    <span style={{ color: "#243b3a" }}>{opt}</span>
                  </label>
                );
              })}
            </div>
          ))}
          <button onClick={submit} disabled={submitting} style={{ width: "100%", background: "#1c7c74", color: "#fff", border: "none", padding: "12px 0", borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: submitting ? "wait" : "pointer", marginTop: 8 }}>
            {submitting ? "提交中…" : "交卷"}
          </button>
        </>
      )}

      {history && history.length > 0 && (
        <div style={{ marginTop: 36 }}>
          <h3 style={{ fontSize: 16, color: "#0e3b43", marginBottom: 10 }}>历史成绩</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {history.map((h) => (
              <div key={h.id} style={{ fontSize: 13, color: "#44504e", background: "#f8fafb", borderRadius: 8, padding: "8px 14px", display: "flex", justifyContent: "space-between", flexWrap: "wrap" }}>
                <span>{h.title} · {h.submittedAt ? new Date(h.submittedAt).toLocaleString("zh-CN") : "—"}</span>
                <span style={{ fontWeight: 600, color: h.passed ? "#085041" : "#c0492f" }}>{h.score} 分 · {h.passed ? "通过" : "未通过"} · {h.correct}/{h.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}