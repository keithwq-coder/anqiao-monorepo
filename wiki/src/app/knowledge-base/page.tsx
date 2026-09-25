"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface Term {
  moduleId: string;
  moduleTitle: string;
  title: string;
  content: string;
  url: string;
}

export default function KnowledgeBasePage() {
  const [moduleId, setModuleId] = useState("");
  const [modules, setModules] = useState<{ id: string; title: string }[]>([]);
  const [q, setQ] = useState("");
  const [terms, setTerms] = useState<Term[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/knowledge-base")
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) {
          setError(d.error || "加载失败");
          return;
        }
        const seen = new Map<string, string>();
        for (const e of d.terms) seen.set(e.moduleId, e.moduleTitle);
        setModules([...seen.entries()].map(([id, title]) => ({ id, title })));
      })
      .catch(() => setError("网络错误"));
  }, []);

  const load = useCallback((mid: string, kw: string) => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (mid) params.set("module", mid);
    if (kw.trim()) params.set("q", kw.trim());
    fetch(`/api/knowledge-base?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) {
          setError(d.error || "加载失败");
          setTerms(null);
        } else {
          setTerms(d.terms);
          setTotal(d.total);
        }
      })
      .catch(() => {
        setError("网络错误");
        setTerms(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(moduleId, q), 250);
    return () => clearTimeout(t);
  }, [moduleId, q, load]);

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "24px 20px 60px" }}>
      <div style={{ fontSize: 13, color: "#6b7b79" }}>
        <Link href="/" style={{ color: "#1c7c74", textDecoration: "none" }}>仪表盘</Link> / 知识库
      </div>
      <h1 style={{ fontSize: 22, color: "#0e3b43", marginBottom: 4 }}>知识库</h1>
      <p style={{ fontSize: 13, color: "#6b7b79", margin: "0 0 20px" }}>
        全部课程知识点词条，按字母数字排序；输入关键词检索，点击词条跳转对应课件。
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索词条…"
          style={{
            flex: "1 1 220px",
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #d1d5db",
            fontSize: 14,
            boxSizing: "border-box",
          }}
        />
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

      {loading && <p style={{ color: "#6b7b79" }}>加载中…</p>}
      {error && <p style={{ color: "#c0492f" }}>{error}</p>}
      {!loading && !error && (
        <>
          <p style={{ fontSize: 12, color: "#6b7b79", margin: "0 0 12px" }}>共 {total} 条词条</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {terms && terms.length > 0 ? (
              terms.map((e, i) => (
                <Link
                  key={`${e.moduleId}-${i}`}
                  href={e.url}
                  style={{
                    display: "block",
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    padding: "10px 14px",
                    textDecoration: "none",
                    color: "#243b3a",
                  }}
                >
                  <span style={{ fontSize: 11, color: "#1c7c74", marginRight: 8 }}>
                    {e.moduleId}
                  </span>
                  <span style={{ fontWeight: 600, color: "#0e3b43" }}>{e.title}</span>
                  <span style={{ color: "#5b6b69", fontSize: 13, display: "block", marginTop: 2 }}>
                    {e.content}
                  </span>
                </Link>
              ))
            ) : (
              <p style={{ color: "#6b7b79" }}>没有匹配的词条。</p>
            )}
          </div>
        </>
      )}
    </main>
  );
}
