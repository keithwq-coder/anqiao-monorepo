"use client";

import { useState } from "react";

interface Props {
  username: string;
  nickname: string;
  realname: string;
  idcard: string;
  phone: string;
  mustChangePassword: boolean;
}

export default function AccountForm(props: Props) {
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [nickname, setNickname] = useState(props.nickname);
  const [realname, setRealname] = useState(props.realname);
  const [idcard, setIdcard] = useState(props.idcard);
  const [phone, setPhone] = useState(props.phone);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function api(path: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function onSubmitPassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (newPw !== newPw2) {
      setMsg({ kind: "err", text: "两次输入的新密码不一致" });
      return;
    }
    setBusy(true);
    const r = await api("/api/account/change-password", {
      currentPassword: curPw,
      newPassword: newPw,
    });
    setBusy(false);
    if (r.ok) {
      setMsg({ kind: "ok", text: "密码修改成功" });
      setCurPw("");
      setNewPw("");
      setNewPw2("");
    } else {
      setMsg({ kind: "err", text: r.error ?? "修改失败" });
    }
  }

  async function onSubmitNickname(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    const r = await api("/api/account/nickname", { nickname });
    setBusy(false);
    if (r.ok) {
      setMsg({ kind: "ok", text: "昵称设置成功，可用昵称登录" });
    } else {
      setMsg({ kind: "err", text: r.error ?? "设置失败" });
    }
  }

  async function onSubmitProfile(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    const r = await api("/api/account/profile", { realname, idcard, phone });
    setBusy(false);
    if (r.ok) {
      setMsg({ kind: "ok", text: "资料已保存" });
    } else {
      setMsg({ kind: "err", text: r.error ?? "保存失败" });
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {props.mustChangePassword && (
        <div
          style={{
            background: "#fef3c7",
            border: "1px solid #f59e0b",
            color: "#92400e",
            borderRadius: 8,
            padding: "12px 16px",
            fontSize: 14,
          }}
        >
          ⚠️ 当前仍为初始密码，建议尽快修改以保障账号安全。
        </div>
      )}

      <section style={cardStyle}>
        <h2 style={cardTitle}>修改密码</h2>
        <form onSubmit={onSubmitPassword} style={formStyle}>
          <Field label="当前密码">
            <input
              type="password"
              value={curPw}
              onChange={(e) => setCurPw(e.target.value)}
              required
              style={inputStyle}
              autoComplete="current-password"
            />
          </Field>
          <Field label="新密码（至少 8 位）">
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              required
              minLength={8}
              style={inputStyle}
              autoComplete="new-password"
            />
          </Field>
          <Field label="确认新密码">
            <input
              type="password"
              value={newPw2}
              onChange={(e) => setNewPw2(e.target.value)}
              required
              minLength={8}
              style={inputStyle}
              autoComplete="new-password"
            />
          </Field>
          <SubmitBtn busy={busy} label="修改密码" />
        </form>
      </section>

      <section style={cardStyle}>
        <h2 style={cardTitle}>昵称（可用于登录）</h2>
        <form onSubmit={onSubmitNickname} style={formStyle}>
          <p style={{ color: "#6b7280", fontSize: 12, margin: "0 0 10px" }}>
            设置后可用昵称代替用户名登录；用户名不可修改。昵称不得与任何用户名重复。
          </p>
          <Field label="昵称">
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="1-20 个字符，字母/数字/中文/下划线"
              style={inputStyle}
            />
          </Field>
          <SubmitBtn busy={busy} label="保存昵称" />
        </form>
      </section>

      <section style={cardStyle}>
        <h2 style={cardTitle}>实名资料</h2>
        <form onSubmit={onSubmitProfile} style={formStyle}>
          <Field label="实名">
            <input
              value={realname}
              onChange={(e) => setRealname(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="身份证号（仅管理员可见，脱敏展示）">
            <input
              value={idcard}
              onChange={(e) => setIdcard(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="手机号">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <SubmitBtn busy={busy} label="保存资料" />
        </form>
      </section>

      {msg && (
        <p
          style={{
            color: msg.kind === "ok" ? "#15803d" : "#c0492f",
            fontSize: 14,
            margin: 0,
          }}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 10,
  padding: "20px 24px",
  border: "1px solid #e5e7eb",
};

const cardTitle: React.CSSProperties = { fontSize: 16, margin: "0 0 14px", color: "#0e3b43" };

const formStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 12 };

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 6,
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  fontSize: 14,
  boxSizing: "border-box",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ fontSize: 13, color: "#374151" }}>
      {label}
      {children}
    </label>
  );
}

function SubmitBtn({ busy, label }: { busy: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      style={{
        alignSelf: "flex-start",
        background: "#1c7c74",
        color: "#fff",
        border: "none",
        borderRadius: 8,
        padding: "9px 22px",
        fontSize: 14,
        fontWeight: 600,
        cursor: busy ? "wait" : "pointer",
      }}
    >
      {busy ? "处理中…" : label}
    </button>
  );
}
