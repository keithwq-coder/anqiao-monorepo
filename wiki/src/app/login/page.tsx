"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        // 登录后一律进入系统；初始密码改密采用“提醒”方式（仪表盘顶部横幅提示）
        router.push("/");
        router.refresh();
      } else {
        setError(data.error ?? "登录失败");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(160deg,#0e3b43 0%,#1c7c74 100%)",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "#fff",
          borderRadius: 12,
          padding: "32px 28px",
          boxShadow: "0 12px 40px rgba(0,0,0,.25)",
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#0e3b43" }}>
          中科安樵 · 经销商赋能培训
        </h1>
        <p style={{ color: "#6b7280", fontSize: 13, margin: "6px 0 24px" }}>
          内部培训与认证系统，请使用分配的账号登录
        </p>
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ fontSize: 13, color: "#374151" }}>
            用户名 / 昵称
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              style={inputStyle}
              placeholder="用户名或昵称，例如 sales01"
            />
          </label>
          <label style={{ fontSize: 13, color: "#374151" }}>
            密码
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              style={inputStyle}
              placeholder="••••••••"
            />
          </label>
          {error && (
            <p style={{ color: "#c0492f", fontSize: 13, margin: 0 }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6,
              background: "#1c7c74",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "11px 0",
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "登录中…" : "登 录"}
          </button>
        </form>
        <p style={{ color: "#9ca3af", fontSize: 12, marginTop: 20, textAlign: "center" }}>
          首次登录请使用初始密码，并按要求修改密码
        </p>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 6,
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  fontSize: 14,
  boxSizing: "border-box",
};
