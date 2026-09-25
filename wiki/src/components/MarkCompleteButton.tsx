"use client";

// T-C：「标记本章已学完」按钮 —— 显式学完动作（调用既有 POST /api/course/[moduleId]/complete）
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MarkCompleteButton({ moduleId }: { moduleId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function mark() {
    if (busy || done) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/course/${moduleId}/complete`, { method: "POST" });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setError(d.error || "操作失败");
      } else {
        setDone(true);
        router.refresh(); // 刷新 RSC，仪表盘状态即时翻「已学完」
      }
    } catch {
      setError("网络错误");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <button
        onClick={mark}
        disabled={busy || done}
        style={{
          background: done ? "#e1f5ee" : "#fff",
          border: `1px solid ${done ? "#9adfc9" : "#1c7c74"}`,
          color: done ? "#085041" : "#1c7c74",
          padding: "10px 22px",
          borderRadius: 20,
          fontSize: 14,
          cursor: busy || done ? "default" : "pointer",
        }}
      >
        {busy ? "标记中…" : done ? "✓ 本章已学完" : "标记本章已学完"}
      </button>
      {error && <span style={{ fontSize: 12, color: "#c0492f" }}>{error}</span>}
    </span>
  );
}
