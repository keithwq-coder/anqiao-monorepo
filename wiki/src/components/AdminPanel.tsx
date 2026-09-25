"use client";

// 后台学员表格 + 筛选 + 新建账号 + 重置密码 + 分页/排序/导出（档案化 + 占位过滤 + T-D）
import { useCallback, useEffect, useState } from "react";

interface AdminUser {
  id: number;
  username: string;
  name: string;
  role: string;
  tier: "admin" | "internal" | "external";
  realname: string;
  phone: string;
  isPlaceholder: boolean;
  participationRate: number;
  completionRate: number;
  viewedModules: string[];
  completedModules: string[];
  quizPassedModules: string[];
  totalAttempts: number;
  avgScore: number;
  lastActiveAt: string | null;
  isActive: boolean;
}

const TIER_LABEL: Record<string, string> = {
  admin: "管理",
  internal: "内部",
  external: "外部",
};

const PAGE_SIZE = 20;

export function AdminPanel() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [total, setTotal] = useState(0);
  const [role, setRole] = useState("");
  const [q, setQ] = useState("");
  const [placeholder, setPlaceholder] = useState(""); // ""=默认排除 | all | only
  const [sort, setSort] = useState("id");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (role) params.set("role", role);
      if (q.trim()) params.set("q", q.trim());
      if (placeholder) params.set("placeholder", placeholder);
      params.set("sort", sort);
      params.set("order", order);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const d = await res.json();
      setUsers(d.ok ? d.users : []);
      setTotal(d.ok ? d.total : 0);
    } finally {
      setLoading(false);
    }
  }, [role, q, placeholder, sort, order, page]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  // 筛选/排序变化时回到第一页
  useEffect(() => {
    setPage(1);
  }, [role, q, placeholder, sort, order]);

  function toggleSort(key: string) {
    if (sort === key) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSort(key);
      setOrder(key === "name" || key === "id" ? "asc" : "desc");
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const exportParams = new URLSearchParams();
  if (role) exportParams.set("role", role);
  if (q.trim()) exportParams.set("q", q.trim());
  if (placeholder) exportParams.set("placeholder", placeholder);
  const exportQuery = exportParams.toString();

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <input
          placeholder="搜索用户名 / 姓名"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ border: "1px solid #d7dde0", borderRadius: 8, padding: "8px 12px", fontSize: 13, minWidth: 200 }}
        />
        <select value={role} onChange={(e) => setRole(e.target.value)} style={{ border: "1px solid #d7dde0", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}>
          <option value="">全部角色</option>
          <option value="dealer">经销商</option>
          <option value="agent">代理商</option>
          <option value="reseller">代销商</option>
          <option value="internal_sales">内部销售</option>
          <option value="internal_tech">内部技术</option>
          <option value="internal_ops">内部仓管/财务</option>
          <option value="admin">管理员</option>
        </select>
        <select value={placeholder} onChange={(e) => setPlaceholder(e.target.value)} style={{ border: "1px solid #d7dde0", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}>
          <option value="">只看真实账号</option>
          <option value="all">含占位账号</option>
          <option value="only">只看占位账号</option>
        </select>
        <a href={`/api/admin/export/csv?${exportQuery}`} style={{ background: "#fff", border: "1px solid #1c7c74", color: "#1c7c74", padding: "8px 16px", borderRadius: 8, fontSize: 13, textDecoration: "none" }}>
          导出 CSV（当前筛选）
        </a>
        <a href={`/api/admin/export/json?${exportQuery}`} style={{ background: "#fff", border: "1px solid #1c7c74", color: "#1c7c74", padding: "8px 16px", borderRadius: 8, fontSize: 13, textDecoration: "none" }}>
          导出 JSON（当前筛选）
        </a>
        <CreateUserForm onCreated={load} />
        <BulkCreateForm onCreated={load} />
      </div>

      <div className="zk-admin-table" style={{ overflowX: "auto", background: "#fff", borderRadius: 12, border: "1px solid #e4ded2" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...cell, background: "#0e3b43", color: "#fff", whiteSpace: "nowrap" }}>用户名</th>
              <th style={{ ...cell, background: "#0e3b43", color: "#fff", whiteSpace: "nowrap" }}>
                <SortHeader label="姓名" sortKey="name" sort={sort} order={order} onToggle={toggleSort} />
              </th>
              <th style={{ ...cell, background: "#0e3b43", color: "#fff", whiteSpace: "nowrap" }}>角色/组</th>
              <th style={{ ...cell, background: "#0e3b43", color: "#fff", whiteSpace: "nowrap" }}>实名</th>
              <th style={{ ...cell, background: "#0e3b43", color: "#fff", whiteSpace: "nowrap" }}>手机</th>
              <th style={{ ...cell, background: "#0e3b43", color: "#fff", whiteSpace: "nowrap" }}>
                <SortHeader label="参与度" sortKey="participationRate" sort={sort} order={order} onToggle={toggleSort} />
              </th>
              <th style={{ ...cell, background: "#0e3b43", color: "#fff", whiteSpace: "nowrap" }}>
                <SortHeader label="学完度" sortKey="completionRate" sort={sort} order={order} onToggle={toggleSort} />
              </th>
              <th style={{ ...cell, background: "#0e3b43", color: "#fff", whiteSpace: "nowrap" }}>已学/已学完</th>
              <th style={{ ...cell, background: "#0e3b43", color: "#fff", whiteSpace: "nowrap" }}>测验通过</th>
              <th style={{ ...cell, background: "#0e3b43", color: "#fff", whiteSpace: "nowrap" }}>平均分</th>
              <th style={{ ...cell, background: "#0e3b43", color: "#fff", whiteSpace: "nowrap" }}>
                <SortHeader label="最近活跃" sortKey="lastActiveAt" sort={sort} order={order} onToggle={toggleSort} />
              </th>
              <th style={{ ...cell, background: "#0e3b43", color: "#fff", whiteSpace: "nowrap" }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && !users && (
              <tr>
                <td colSpan={12} style={{ ...cell, textAlign: "center", color: "#6b7b79" }}>
                  加载中…
                </td>
              </tr>
            )}
            {users?.map((u, i) => (
              <tr key={u.id}>
                <td style={{ ...cell, background: i % 2 ? "#f8f6f0" : "#fff", fontWeight: 600 }}>
                  {u.username}
                  {u.isPlaceholder && (
                    <span style={{ marginLeft: 6, fontSize: 11, color: "#9ca3af" }}>占位</span>
                  )}
                </td>
                <td style={{ ...cell, background: i % 2 ? "#f8f6f0" : "#fff" }}>{u.name}</td>
                <td style={{ ...cell, background: i % 2 ? "#f8f6f0" : "#fff" }}>
                  {u.role} <span style={{ fontSize: 11, color: "#6b7b79" }}>({TIER_LABEL[u.tier] ?? u.tier})</span>
                </td>
                <td style={{ ...cell, background: i % 2 ? "#f8f6f0" : "#fff" }}>{u.realname || "—"}</td>
                <td style={{ ...cell, background: i % 2 ? "#f8f6f0" : "#fff" }}>{u.phone || "—"}</td>
                <td style={{ ...cell, background: i % 2 ? "#f8f6f0" : "#fff" }}>
                  {Math.round(u.participationRate * 100)}%
                </td>
                <td style={{ ...cell, background: i % 2 ? "#f8f6f0" : "#fff" }}>
                  {Math.round(u.completionRate * 100)}%
                </td>
                <td style={{ ...cell, background: i % 2 ? "#f8f6f0" : "#fff" }}>
                  {u.viewedModules.length}/{u.completedModules.length}
                </td>
                <td style={{ ...cell, background: i % 2 ? "#f8f6f0" : "#fff" }}>
                  {u.quizPassedModules.length > 0 ? u.quizPassedModules.join(",") : "—"}
                </td>
                <td style={{ ...cell, background: i % 2 ? "#f8f6f0" : "#fff" }}>
                  {u.totalAttempts > 0 ? `${u.avgScore}（${u.totalAttempts}次）` : "—"}
                </td>
                <td style={{ ...cell, background: i % 2 ? "#f8f6f0" : "#fff", whiteSpace: "nowrap" }}>
                  {u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString("zh-CN", { hour12: false }) : "—"}
                </td>
                <td style={{ ...cell, background: i % 2 ? "#f8f6f0" : "#fff" }}>
                  <ResetPasswordButton userId={u.id} username={u.username} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* T-D：分页控件 */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page <= 1}
          style={{ background: "#fff", border: "1px solid #d7dde0", borderRadius: 8, padding: "6px 14px", fontSize: 13, cursor: page <= 1 ? "default" : "pointer", opacity: page <= 1 ? 0.5 : 1 }}
        >
          上一页
        </button>
        <span style={{ fontSize: 13, color: "#44504e" }}>
          第 {page} / {totalPages} 页 · 共 {total} 人
        </span>
        <button
          onClick={() => setPage(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          style={{ background: "#fff", border: "1px solid #d7dde0", borderRadius: 8, padding: "6px 14px", fontSize: 13, cursor: page >= totalPages ? "default" : "pointer", opacity: page >= totalPages ? 0.5 : 1 }}
        >
          下一页
        </button>
      </div>
    </div>
  );
}

function SortHeader({ label, sortKey, sort, order, onToggle }: { label: string; sortKey: string; sort: string; order: "asc" | "desc"; onToggle: (k: string) => void }) {
  const active = sort === sortKey;
  return (
    <button
      onClick={() => onToggle(sortKey)}
      title="点击排序"
      style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: 0, whiteSpace: "nowrap" }}
    >
      {label} {active ? (order === "asc" ? "▲" : "▼") : "↕"}
    </button>
  );
}

function ResetPasswordButton({ userId, username }: { userId: number; username: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function reset() {
    if (!confirm(`确定重置「${username}」的密码？其旧会话将全部失效。`)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, { method: "POST" });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setError(d.error || "重置失败");
      } else {
        setResult(d.initialPassword);
        setOpen(true);
      }
    } catch {
      setError("网络错误");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span>
      <button
        onClick={reset}
        disabled={busy}
        style={{
          background: "#fff",
          border: "1px solid #c0492f",
          color: "#c0492f",
          padding: "4px 10px",
          borderRadius: 8,
          fontSize: 12,
          cursor: busy ? "default" : "pointer",
        }}
      >
        {busy ? "重置中…" : "重置密码"}
      </button>
      {open && result && (
        <div style={{ marginTop: 6, fontSize: 12, color: "#085041", background: "#e1f5ee", padding: "6px 8px", borderRadius: 6 }}>
          新密码：<b>{result}</b>（仅显示一次，首登须改密）
        </div>
      )}
      {error && <div style={{ marginTop: 6, fontSize: 12, color: "#c0492f" }}>{error}</div>}
    </span>
  );
}

function CreateUserForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("dealer");
  const [name, setName] = useState("");
  const [result, setResult] = useState<{ username: string; initialPassword: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, name }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setError(d.error || "创建失败");
      } else {
        setResult(d.user);
        setName("");
        onCreated();
      }
    } catch {
      setError("网络错误");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      {open && (
        <>
          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ border: "1px solid #d7dde0", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}>
            <option value="dealer">经销商</option>
            <option value="agent">代理商</option>
            <option value="reseller">代销商</option>
            <option value="internal_sales">内部销售</option>
          </select>
          <input
            placeholder="显示名（可选，如：经销商张三）"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ border: "1px solid #d7dde0", borderRadius: 8, padding: "8px 12px", fontSize: 13, minWidth: 180 }}
          />
          <button
            onClick={create}
            disabled={busy}
            style={{ background: "#1c7c74", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, fontSize: 13, cursor: busy ? "default" : "pointer" }}
          >
            {busy ? "创建中…" : "创建"}
          </button>
          {error && <span style={{ fontSize: 12, color: "#c0492f" }}>{error}</span>}
          {result && (
            <span style={{ fontSize: 12, color: "#085041", background: "#e1f5ee", padding: "6px 10px", borderRadius: 8 }}>
              已创建 <b>{result.username}</b>　初始密码：<b>{result.initialPassword}</b>（仅显示一次，首登须改密）
            </span>
          )}
        </>
      )}
      <button
        onClick={() => setOpen(!open)}
        style={{ background: "#fff", border: "1px solid #1c7c74", color: "#1c7c74", padding: "8px 16px", borderRadius: 8, fontSize: 13, cursor: "pointer" }}
      >
        {open ? "收起" : "＋ 新建账号"}
      </button>
    </div>
  );
}

const cell: React.CSSProperties = {
  border: "1px solid #e4ded2",
  padding: "8px 10px",
  textAlign: "left",
  verticalAlign: "top",
};

function BulkCreateForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [result, setResult] = useState<{
    created: { username: string; name: string; role: string; initialPassword: string }[];
    failed: { role: string; name: string; reason: string }[];
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: text,
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setError(d.error || "批量创建失败");
      } else {
        setResult(d);
        setText("");
        onCreated();
      }
    } catch {
      setError("网络错误");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ background: "#fff", border: "1px solid #1c7c74", color: "#1c7c74", padding: "8px 16px", borderRadius: 8, fontSize: 13, cursor: "pointer" }}
      >
        {open ? "收起" : "批量建号"}
      </button>
      {open && (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder={"每行一条：角色 显示名（可选）\n例如：\ndealer 经销商张三\ndealer,经销商李四\n代理商"}
            style={{ border: "1px solid #d7dde0", borderRadius: 8, padding: "8px 12px", fontSize: 13, minWidth: 240, fontFamily: "inherit" }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
            <button
              onClick={submit}
              disabled={busy || !text.trim()}
              style={{ background: "#1c7c74", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, fontSize: 13, cursor: busy || !text.trim() ? "default" : "pointer", opacity: busy || !text.trim() ? 0.5 : 1 }}
            >
              {busy ? "创建中…" : "提交（单次 ≤50）"}
            </button>
            {error && <span style={{ fontSize: 12, color: "#c0492f" }}>{error}</span>}
          </div>
          {result && (
            <div style={{ fontSize: 12, background: "#f8f6f0", border: "1px solid #e4ded2", borderRadius: 8, padding: "8px 12px", minWidth: 260 }}>
              {result.created.length > 0 && (
                <div>
                  <b style={{ color: "#085041" }}>成功 {result.created.length} 个：</b>
                  {result.created.map((c) => (
                    <div key={c.username} style={{ marginTop: 2 }}>
                      {c.username}（{c.name}）初始密码 <b>{c.initialPassword}</b>（仅显示一次，首登须改密）
                    </div>
                  ))}
                </div>
              )}
              {result.failed.length > 0 && (
                <div style={{ color: "#a32d2d", marginTop: 6 }}>
                  <b>失败 {result.failed.length} 个：</b>
                  {result.failed.map((f, i) => (
                    <div key={i}>
                      {f.role} {f.name} — {f.reason}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
