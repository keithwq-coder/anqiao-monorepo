"use client";

// 后台「考试管理与成绩单」：创建随机组卷考试（客观题 + 2 道客户挑战主观题）、成绩单、主观题评分参考、一键生成成绩图片
import { useCallback, useEffect, useState } from "react";

interface Exam {
  id: number;
  title: string;
  questionCount: number;
  scenarioCount: number;
  durationMinutes: number;
  passingScore: number;
  attemptCount: number;
  passedCount: number;
  createdAt: string | null;
}

interface Scenario {
  id: number;
  scenario: string;
  hint?: string;
}

interface Attempt {
  id: number;
  username: string;
  name: string;
  score: number;
  passed: boolean;
  correctCount: number;
  totalCount: number;
  scenarioAnswers: Record<string, string> | null;
  submittedAt: string | null;
}

export function AdminExamPanel() {
  const [exams, setExams] = useState<Exam[] | null>(null);
  const [title, setTitle] = useState("");
  const [count, setCount] = useState(20);
  const [duration, setDuration] = useState(30);
  const [passing, setPassing] = useState(80);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [openExam, setOpenExam] = useState<number | null>(null);
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [openSA, setOpenSA] = useState<Record<number, boolean>>({});
  const [imgBusy, setImgBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/exams");
      const d = await res.json();
      setExams(d.ok ? d.exams : []);
    } catch {
      setError("加载考试列表失败");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, count, durationMinutes: duration, passingScore: passing }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setError(d.error || "创建失败");
      } else {
        setTitle("");
        await load();
        alert(`考试已创建：${d.exam.title}（${d.exam.questionCount} 客观题 + ${d.exam.scenarioCount} 道客户挑战问答 / ${d.exam.durationMinutes} 分钟 / ${d.exam.passingScore} 分通过）`);
      }
    } catch {
      setError("网络错误");
    } finally {
      setBusy(false);
    }
  }

  async function toggleScoreboard(exam: Exam) {
    if (openExam === exam.id) {
      setOpenExam(null);
      setAttempts(null);
      setActiveExam(null);
      setScenarios([]);
      return;
    }
    setOpenExam(exam.id);
    setActiveExam(exam);
    setAttempts(null);
    setScenarios([]);
    setOpenSA({});
    try {
      const res = await fetch(`/api/admin/exams/${exam.id}/attempts`);
      const d = await res.json();
      if (d.ok) {
        setAttempts(d.attempts);
        setScenarios(d.exam?.scenarios ?? []);
      } else {
        setError(d.error || "加载成绩失败");
      }
    } catch {
      setError("网络错误");
    }
  }

  /** 一键生成成绩图片：canvas 绘制成绩单 → PNG 下载（浏览器内置） */
  function downloadScoreboardPng() {
    if (!activeExam || !attempts) return;
    setImgBusy(true);
    try {
      const W = 1000;
      const rowH = 36;
      const H = 250 + rowH * (attempts.length + 1);
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const font = (size: number, bold = false) => `${bold ? "bold " : ""}${size}px "Microsoft YaHei", "PingFang SC", sans-serif`;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#0e3b43";
      ctx.fillRect(0, 0, W, 96);
      ctx.fillStyle = "#ffffff";
      ctx.font = font(26, true);
      ctx.fillText(activeExam.title, 40, 44);
      ctx.font = font(14);
      ctx.fillText(`通过线 ${activeExam.passingScore} 分 · 共 ${activeExam.questionCount} 客观题 + ${activeExam.scenarioCount} 道客户问答 · ${activeExam.durationMinutes} 分钟`, 40, 74);

      const y0 = 120;
      ctx.fillStyle = "#f5f6f7";
      ctx.fillRect(0, y0, W, rowH);
      ctx.fillStyle = "#243b3a";
      ctx.font = font(15, true);
      ctx.fillText("序号", 40, y0 + 23);
      ctx.fillText("姓名（用户名）", 130, y0 + 23);
      ctx.fillText("客观分", 470, y0 + 23);
      ctx.fillText("结果", 580, y0 + 23);
      ctx.fillText("提交时间", 700, y0 + 23);

      attempts.forEach((a, i) => {
        const y = y0 + rowH * (i + 1);
        ctx.fillStyle = i % 2 ? "#f8f6f0" : "#ffffff";
        ctx.fillRect(0, y, W, rowH);
        ctx.fillStyle = "#243b3a";
        ctx.font = font(14);
        ctx.fillText(String(i + 1), 40, y + 23);
        ctx.fillText(`${a.name}（${a.username}）`, 130, y + 23);
        ctx.fillText(`${a.score} 分`, 470, y + 23);
        ctx.fillStyle = a.passed ? "#085041" : "#a32d2d";
        ctx.font = font(14, true);
        ctx.fillText(a.passed ? "通过" : "未通过", 580, y + 23);
        ctx.fillStyle = "#6b7b79";
        ctx.font = font(13);
        ctx.fillText(a.submittedAt ? new Date(a.submittedAt).toLocaleString("zh-CN", { hour12: false }) : "—", 700, y + 23);
      });

      ctx.strokeStyle = "#e4ded2";
      ctx.beginPath();
      ctx.moveTo(0, y0 + rowH);
      ctx.lineTo(W, y0 + rowH);
      ctx.stroke();

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const aEl = document.createElement("a");
        aEl.href = url;
        aEl.download = `成绩单-${activeExam.title}-${new Date().toISOString().slice(0, 10)}.png`;
        aEl.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    } finally {
      setImgBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, color: "#0e3b43", margin: "0 0 12px" }}>考试管理与成绩单</h2>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <input
          placeholder="考试名称（如：新人第 3 天正式考试）"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ border: "1px solid #d7dde0", borderRadius: 8, padding: "8px 12px", fontSize: 13, minWidth: 240 }}
        />
        <label style={{ fontSize: 13, color: "#44504e" }}>
          题数
          <input type="number" value={count} min={1} max={100}
            onChange={(e) => setCount(Number(e.target.value))}
            style={{ border: "1px solid #d7dde0", borderRadius: 8, padding: "6px 8px", fontSize: 13, width: 70, marginLeft: 6 }} />
        </label>
        <label style={{ fontSize: 13, color: "#44504e" }}>
          时长(分)
          <input type="number" value={duration} min={1} max={180}
            onChange={(e) => setDuration(Number(e.target.value))}
            style={{ border: "1px solid #d7dde0", borderRadius: 8, padding: "6px 8px", fontSize: 13, width: 70, marginLeft: 6 }} />
        </label>
        <label style={{ fontSize: 13, color: "#44504e" }}>
          通过分
          <input type="number" value={passing} min={0} max={100}
            onChange={(e) => setPassing(Number(e.target.value))}
            style={{ border: "1px solid #d7dde0", borderRadius: 8, padding: "6px 8px", fontSize: 13, width: 70, marginLeft: 6 }} />
        </label>
        <button
          onClick={create}
          disabled={busy}
          style={{ background: "#1c7c74", color: "#fff", border: "none", padding: "8px 18px", borderRadius: 8, fontSize: 13, cursor: busy ? "default" : "pointer" }}
        >
          {busy ? "创建中…" : "＋ 随机组卷创建考试"}
        </button>
      </div>
      {error && <div style={{ fontSize: 12, color: "#c0492f", marginBottom: 8 }}>{error}</div>}

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e4ded2", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {["考试", "客观题", "客户问答", "时长", "通过分", "已考 / 通过", "创建时间", "操作"].map((h) => (
                <th key={h} style={{ ...cell, background: "#0e3b43", color: "#fff", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {exams === null ? (
              <tr><td colSpan={8} style={{ ...cell, textAlign: "center", color: "#6b7b79" }}>加载中…</td></tr>
            ) : exams.length === 0 ? (
              <tr><td colSpan={8} style={{ ...cell, textAlign: "center", color: "#6b7b79" }}>暂无考试，先创建一场（随机抽客观题 + 客户挑战问答）</td></tr>
            ) : (
              exams.map((e, i) => (
                <tr key={e.id}>
                  <td style={{ ...cell, background: i % 2 ? "#f8f6f0" : "#fff", fontWeight: 600 }}>{e.title}</td>
                  <td style={{ ...cell, background: i % 2 ? "#f8f6f0" : "#fff" }}>{e.questionCount}</td>
                  <td style={{ ...cell, background: i % 2 ? "#f8f6f0" : "#fff" }}>{e.scenarioCount}</td>
                  <td style={{ ...cell, background: i % 2 ? "#f8f6f0" : "#fff" }}>{e.durationMinutes} 分</td>
                  <td style={{ ...cell, background: i % 2 ? "#f8f6f0" : "#fff" }}>{e.passingScore}</td>
                  <td style={{ ...cell, background: i % 2 ? "#f8f6f0" : "#fff" }}>{e.attemptCount} / {e.passedCount}</td>
                  <td style={{ ...cell, background: i % 2 ? "#f8f6f0" : "#fff", whiteSpace: "nowrap" }}>
                    {e.createdAt ? new Date(e.createdAt).toLocaleString("zh-CN", { hour12: false }) : "—"}
                  </td>
                  <td style={{ ...cell, background: i % 2 ? "#f8f6f0" : "#fff", whiteSpace: "nowrap" }}>
                    <button
                      onClick={() => void toggleScoreboard(e)}
                      style={{ background: "#fff", border: "1px solid #1c7c74", color: "#1c7c74", padding: "4px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer" }}
                    >
                      {openExam === e.id ? "收起成绩单" : "成绩单"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {openExam !== null && (
        <div style={{ marginTop: 12, background: "#fff", borderRadius: 12, border: "1px solid #e4ded2", padding: "14px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#243b3a" }}>
              成绩单 · {activeExam?.title}
              <span style={{ fontSize: 12, color: "#6b7b79", fontWeight: 400, marginLeft: 8 }}>
                通过线 {activeExam?.passingScore} 分（客观题）
              </span>
            </div>
            <button
              onClick={downloadScoreboardPng}
              disabled={imgBusy || !attempts || attempts.length === 0}
              style={{ background: "#1c7c74", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, fontSize: 13, cursor: imgBusy || !attempts || attempts.length === 0 ? "default" : "pointer", opacity: imgBusy || !attempts || attempts.length === 0 ? 0.5 : 1 }}
            >
              {imgBusy ? "生成中…" : "一键生成成绩图片（PNG）"}
            </button>
          </div>

          {/* 主观题评分参考（不计入总分） */}
          {scenarios.length > 0 && (
            <div style={{ background: "#fdf4da", border: "1px solid #e8d9a0", borderRadius: 10, padding: "10px 14px", marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#7c4d00", marginBottom: 6 }}>
                客户挑战问答（不计入总分 · 由管理者评分）
              </div>
              {scenarios.map((s) => (
                <div key={s.id} style={{ fontSize: 13, color: "#44504e", marginBottom: 4 }}>
                  <b>{s.scenario}</b>
                  {s.hint && <div style={{ fontSize: 12, color: "#8a5a00", marginTop: 2 }}>评分要点：{s.hint}</div>}
                </div>
              ))}
            </div>
          )}

          {attempts === null ? (
            <div style={{ fontSize: 13, color: "#6b7b79" }}>加载中…</div>
          ) : attempts.length === 0 ? (
            <div style={{ fontSize: 13, color: "#6b7b79" }}>暂无学员提交。考试链接：/exam/{openExam}</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["序号", "姓名（用户名）", "分数", "结果", "答对", "主观题作答", "提交时间"].map((h) => (
                      <th key={h} style={{ ...cell, background: "#0e3b43", color: "#fff", textAlign: "left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a, i) => (
                    <tr key={a.id}>
                      <td style={{ ...cell, background: i % 2 ? "#f8f6f0" : "#fff" }}>{i + 1}</td>
                      <td style={{ ...cell, background: i % 2 ? "#f8f6f0" : "#fff" }}>{a.name}（{a.username}）</td>
                      <td style={{ ...cell, background: i % 2 ? "#f8f6f0" : "#fff", fontWeight: 700 }}>{a.score} 分</td>
                      <td style={{ ...cell, background: i % 2 ? "#f8f6f0" : "#fff", color: a.passed ? "#085041" : "#a32d2d", fontWeight: 600 }}>
                        {a.passed ? "✅ 通过" : "未通过"}
                      </td>
                      <td style={{ ...cell, background: i % 2 ? "#f8f6f0" : "#fff" }}>{a.correctCount}/{a.totalCount}</td>
                      <td style={{ ...cell, background: i % 2 ? "#f8f6f0" : "#fff" }}>
                        {a.scenarioAnswers && Object.keys(a.scenarioAnswers).length > 0 ? (
                          <span>
                            <button
                              onClick={() => setOpenSA((o) => ({ ...o, [a.id]: !o[a.id] }))}
                              style={{ background: "#fff", border: "1px solid #e8a33d", color: "#7c4d00", padding: "3px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer" }}
                            >
                              {openSA[a.id] ? "收起" : `${Object.keys(a.scenarioAnswers).length} 题作答（人工评分）`}
                            </button>
                            {openSA[a.id] && (
                              <div style={{ marginTop: 6, fontSize: 12, color: "#44504e" }}>
                                {scenarios.map((s) => {
                                  const text = a.scenarioAnswers?.[String(s.id)] ?? "";
                                  return (
                                    <div key={s.id} style={{ marginBottom: 6 }}>
                                      <b style={{ color: "#7c4d00" }}>{s.scenario}</b>
                                      <div style={{ whiteSpace: "pre-wrap", marginTop: 2, color: "#243b3a" }}>{text || "（未作答）"}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: "#9ca3af" }}>—</span>
                        )}
                      </td>
                      <td style={{ ...cell, background: i % 2 ? "#f8f6f0" : "#fff", whiteSpace: "nowrap" }}>
                        {a.submittedAt ? new Date(a.submittedAt).toLocaleString("zh-CN", { hour12: false }) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const cell: React.CSSProperties = {
  border: "1px solid #e4ded2",
  padding: "7px 9px",
  verticalAlign: "top",
};