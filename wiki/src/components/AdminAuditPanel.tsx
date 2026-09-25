"use client";

// T-F：后台「操作审计」折叠区（仅 admin，调 /api/admin/audit）
import { useState } from "react";

interface AuditEntry {
  id: number;
  action: string;
  target: string;
  detail: string;
  adminUsername: string | null;
  createdAt: string | null;
}

const ACTION_LABEL: Record<string, string> = {
  create_user: "建号",
  reset_password: "重置密码",
  self_change: "自助改密",
};

export default function AdminAuditPanel() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const res = await fetch("/api/admin/audit");
      const d = await res.json();
      if (d.ok) {
        setEntries(d.entries);
      } else {
        setError(d.error || "加载失败");
      }
    } catch {
      setError("网络错误");
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && entries === null) void load();
  }

  return (
    <div style={{ marginTop: 28 }}>
      <button
        onClick={toggle}
        style={{
          background: "#fff",
          border: "1px solid #1c7c74",
          color: "#1c7c74",
          padding: "8px 18px",
          borderRadius: 10,
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        {open ? "收起操作审计" : "操作审计"}
      </button>
      {open && (
        <div style={{ marginTop: 12, background: "#fff", borderRadius: 12, border: "1px solid #e4ded2", padding: "14px 18px" }}>
          {error && <div style={{ fontSize: 12, color: "#c0492f", marginBottom: 8 }}>{error}</div>}
          {entries === null ? (
            <div style={{ fontSize: 13, color: "#6b7b79" }}>加载中…</div>
          ) : entries.length === 0 ? (
            <div style={{ fontSize: 13, color: "#6b7b79" }}>暂无操作记录</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["时间", "操作", "目标", "操作人", "备注"].map((h) => (
                      <th key={h} style={{ ...cell, background: "#0e3b43", color: "#fff", textAlign: "left", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, i) => (
                    <tr key={e.id}>
                      <td style={{ ...cell, background: i % 2 ? "#f8f6f0" : "#fff", whiteSpace: "nowrap" }}>
                        {e.createdAt ? new Date(e.createdAt).toLocaleString("zh-CN", { hour12: false }) : "—"}
                      </td>
                      <td style={{ ...cell, background: i % 2 ? "#f8f6f0" : "#fff" }}>
                        {ACTION_LABEL[e.action] ?? e.action}
                      </td>
                      <td style={{ ...cell, background: i % 2 ? "#f8f6f0" : "#fff" }}>{e.target}</td>
                      <td style={{ ...cell, background: i % 2 ? "#f8f6f0" : "#fff" }}>
                        {e.adminUsername ?? "（本人自助）"}
                      </td>
                      <td style={{ ...cell, background: i % 2 ? "#f8f6f0" : "#fff" }}>{e.detail || "—"}</td>
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
