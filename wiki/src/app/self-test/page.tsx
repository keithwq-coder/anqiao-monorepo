"use client";

// /self-test — 自测（第 1 天等场景自查用）：随机 10 题，无分数，只看错了几题，可反复练习直到全部正确；结果仅本人可见（不落库）
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";

interface SelfTestQuestion {
  id: number;
  ordinal: number;
  question: string;
  options: string[];
}

interface SelfTestResult {
  wrongCount: number;
  total: number;
  allCorrect: boolean;
}

const LETTERS = ["A", "B", "C", "D"];

export default function SelfTestPage() {
  const [questions, setQuestions] = useState<SelfTestQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<SelfTestResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [moduleId, setModuleId] = useState(
    () =>
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("module") ?? ""
        : ""
  );
  const [modules, setModules] = useState<{ id: string; title: string }[]>([]);

  const load = useCallback((mid: string) => {
    setLoading(true);
    setError("");
    setResult(null);
    setAnswers({});
    fetch(`/api/self-test${mid ? `?module=${mid}` : ""}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) {
          setError(d.error || "加载失败");
          setQuestions(null);
        } else {
          setQuestions(d.questions);
        }
      })
      .catch(() => setError("网络错误"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(moduleId);
  }, [load, moduleId]);

  // 模块目录（保持课件顺序）
  useEffect(() => {
    fetch("/api/knowledge-base")
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) return;
        const seen = new Map<string, string>();
        for (const e of d.entries) seen.set(e.moduleId, e.moduleTitle);
        setModules([...seen.entries()].map(([id, title]) => ({ id, title })));
      })
      .catch(() => {});
  }, []);

  function choose(qid: number, letter: string) {
    setAnswers((a) => ({ ...a, [qid]: letter }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!questions || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/self-test/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, v.toUpperCase()])),
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setError(d.error || "提交失败");
      } else {
        setResult({ wrongCount: d.wrongCount, total: d.total, allCorrect: d.allCorrect });
      }
    } catch {
      setError("网络错误");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px 60px" }}>
      <div style={{ fontSize: 13, color: "#6b7b79", marginBottom: 6 }}>
        <Link href="/" style={{ color: "#1c7c74", textDecoration: "none" }}>仪表盘</Link> / 自测
      </div>
      <h1 style={{ fontSize: 22, color: "#0e3b43", marginBottom: 4 }}>自测 · 模块练习</h1>
      <p style={{ fontSize: 13, color: "#6b7b79", margin: "0 0 14px" }}>
        每个模块学完之后可反复刷题练习，也可在学完后进行测试；无分数、只显示错了几题，结果仅本人可见。
      </p>
      <div style={{ marginBottom: 16 }}>
        <select
          value={moduleId}
          onChange={(e) => setModuleId(e.target.value)}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #d1d5db",
            fontSize: 14,
            background: "#fff",
          }}
        >
          <option value="">全部模块</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id} {m.title}
            </option>
          ))}
        </select>
      </div>
      <p style={{ fontSize: 12, color: "#6b7b79", margin: "0 0 20px" }}>
        当前{moduleId ? `「${moduleId}」模块` : "全部模块"} · 随机 {questions?.length ?? "10"} 题 · 可反复练习
      </p>

      {loading && <div style={{ textAlign: "center", color: "#6b7b79", padding: 32 }}>加载中…</div>}

      {error && !questions && (
        <div style={{ textAlign: "center", padding: 24 }}>
          <p style={{ color: "#c0492f" }}>{error}</p>
          <button onClick={() => load(moduleId)} style={{ background: "#1c7c74", color: "#fff", border: "none", padding: "10px 22px", borderRadius: 20, fontSize: 14, cursor: "pointer" }}>
            重新加载
          </button>
        </div>
      )}

      {result ? (
        <div
          style={{
            background: result.allCorrect ? "#e1f5ee" : "#fdf4da",
            border: `1px solid ${result.allCorrect ? "#9adfc9" : "#e8d9a0"}`,
            borderRadius: 12,
            padding: "28px 24px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 32, fontWeight: 800, color: result.allCorrect ? "#085041" : "#6b4e00" }}>
            {result.allCorrect ? "✅ 全部正确" : `错了 ${result.wrongCount} 题`}
          </div>
          <div style={{ fontSize: 14, color: "#44504e", marginTop: 8 }}>
            {result.allCorrect
              ? `共 ${result.total} 题，全部答对。自测完成，可截图留存。`
              : `共 ${result.total} 题，还有 ${result.wrongCount} 题没做对。再测一次，直到全部正确。`}
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 18, flexWrap: "wrap" }}>
            {!result.allCorrect && (
              <button
                onClick={() => load(moduleId)}
                style={{ background: "#1c7c74", color: "#fff", padding: "10px 22px", borderRadius: 20, fontSize: 14, cursor: "pointer", border: "none" }}
              >
                再测一次（重新抽题）
              </button>
            )}
            <Link href="/" style={{ background: "#fff", border: "1px solid #1c7c74", color: "#1c7c74", padding: "10px 22px", borderRadius: 20, fontSize: 14, textDecoration: "none" }}>
              返回首页
            </Link>
          </div>
        </div>
      ) : questions ? (
        <form onSubmit={submit}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {questions.map((q) => (
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
          </div>

          {error && <div style={{ color: "#c0492f", fontSize: 13, marginTop: 12 }}>{error}</div>}

          <div style={{ marginTop: 20 }}>
            <button
              type="submit"
              disabled={submitting || Object.keys(answers).length === 0}
              style={{
                background: "#1c7c74", color: "#fff", border: "none", padding: "12px 32px", borderRadius: 22,
                fontSize: 15, fontWeight: 600,
                cursor: submitting || Object.keys(answers).length === 0 ? "default" : "pointer",
                opacity: submitting || Object.keys(answers).length === 0 ? 0.5 : 1,
              }}
            >
              {submitting ? "提交中…" : `查看我错了几题（已答 ${Object.keys(answers).length}/${questions.length}）`}
            </button>
          </div>
        </form>
      ) : null}
    </main>
  );
}