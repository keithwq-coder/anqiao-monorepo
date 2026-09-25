"use client";

// /knowledge-graph — 系统性学习：知识图谱（模块按 L1/L2/L3 分层 + 主题关系连线，SVG 手绘，点击模块跳课件）
import { useEffect, useState } from "react";
import Link from "next/link";

interface GraphNode {
  id: string;
  title: string;
  layer: string;
}
interface GraphEdge {
  from: string;
  to: string;
  label: string;
}

const LAYER_ORDER = ["L1", "L2", "L3"];
const LAYER_LABEL: Record<string, string> = { L1: "L1 基础", L2: "L2 进阶", L3: "L3 实战" };
const LAYER_Y: Record<string, number> = { L1: 90, L2: 260, L3: 430 };
const NODE_W = 150;
const NODE_H = 46;

export default function KnowledgeGraphPage() {
  const [nodes, setNodes] = useState<GraphNode[] | null>(null);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/knowledge-graph")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setNodes(d.nodes);
          setEdges(d.edges);
        } else {
          setError(d.error || "加载失败");
        }
      })
      .catch(() => setError("网络错误"));
  }, []);

  if (error) {
    return (
      <main style={{ maxWidth: 900, margin: "0 auto", padding: 48, textAlign: "center" }}>
        <p style={{ color: "#c0492f" }}>{error}</p>
        <Link href="/" style={{ color: "#1c7c74" }}>返回仪表盘</Link>
      </main>
    );
  }

  const pos = new Map<string, { x: number; y: number }>();
  if (nodes) {
    for (const layer of LAYER_ORDER) {
      const inLayer = nodes.filter((n) => n.layer === layer);
      const n = Math.max(inLayer.length, 1);
      const gap = 190;
      const startX = (900 - (n - 1) * gap) / 2;
      inLayer.forEach((node, i) => {
        pos.set(node.id, { x: startX + i * gap, y: LAYER_Y[layer] ?? 90 });
      });
    }
  }

  const W = 900;
  const H = 560;

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "24px 20px 60px" }}>
      <div style={{ fontSize: 13, color: "#6b7b79", marginBottom: 6 }}>
        <Link href="/" style={{ color: "#1c7c74", textDecoration: "none" }}>仪表盘</Link> / 知识图谱
      </div>
      <h1 style={{ fontSize: 22, color: "#0e3b43", marginBottom: 4 }}>知识图谱</h1>
      <p style={{ fontSize: 13, color: "#6b7b79", marginBottom: 16 }}>
        模块按 L1 基础 → L2 进阶 → L3 实战分层；连线表示主题关联。点击模块进入课件；下方可查看各模块思维导图。
      </p>

      {!nodes ? (
        <div style={{ color: "#6b7b79", textAlign: "center", padding: 32 }}>加载中…</div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e4ded2", padding: 12, overflowX: "auto" }}>
          <svg width={W} height={H} style={{ display: "block" }}>
            {/* 分层底色区 */}
            {LAYER_ORDER.map((layer) => (
              <g key={layer}>
                <rect x={10} y={LAYER_Y[layer] - 55} width={W - 20} height={80} rx={10}
                  fill={layer === "L1" ? "#eef4ff" : layer === "L2" ? "#fdf4da" : "#e1f5ee"} opacity={0.55} />
                <text x={28} y={LAYER_Y[layer] - 30} fontSize={13} fontWeight={700} fill="#44504e">{LAYER_LABEL[layer]}</text>
              </g>
            ))}
            {/* 关系连线 */}
            {edges.map((e, i) => {
              const a = pos.get(e.from);
              const b = pos.get(e.to);
              if (!a || !b) return null;
              const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2;
              const x2 = b.x, y2 = b.y + NODE_H / 2;
              const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
              return (
                <g key={i}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#9ca3af" strokeWidth={1} strokeDasharray="4 3" />
                  <text x={mx} y={my - 4} fontSize={10} fill="#9ca3af" textAnchor="middle">
                    {e.label}
                  </text>
                </g>
              );
            })}
            {/* 模块节点 */}
            {nodes.map((n) => {
              const p = pos.get(n.id);
              if (!p) return null;
              return (
                <g key={n.id}>
                  <a href={`/m/${n.id}`}>
                    <rect x={p.x} y={p.y} width={NODE_W} height={NODE_H} rx={10}
                      fill={n.layer === "L3" ? "#0e3b43" : "#1c7c74"} />
                    <text x={p.x + NODE_W / 2} y={p.y + 20} fontSize={14} fontWeight={700} fill="#fff" textAnchor="middle">
                      {n.id} {n.title.length > 8 ? n.title.slice(0, 8) + "…" : n.title}
                    </text>
                    <text x={p.x + NODE_W / 2} y={p.y + 36} fontSize={10} fill="rgba(255,255,255,.75)" textAnchor="middle">
                      {n.title}
                    </text>
                  </a>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0e3b43", margin: "0 0 10px" }}>模块思维导图</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {nodes?.map((n) => (
            <Link key={n.id} href={`/mindmap/${n.id}`}
              style={{ background: "#fff", border: "1px solid #1c7c74", color: "#1c7c74", padding: "6px 14px", borderRadius: 10, fontSize: 13, textDecoration: "none" }}>
              {n.id} {n.title}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}