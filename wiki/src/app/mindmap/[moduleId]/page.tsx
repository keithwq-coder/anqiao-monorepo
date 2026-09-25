"use client";

// /mindmap/[moduleId] — 模块思维导图（根=模块，子=各页 slide，孙=要点；SVG 树，点击根/分支跳课件）
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface MindmapData {
  id: string;
  title: string;
  layer: string;
  branches: { slideTitle: string; points: string[] }[];
}

export default function MindmapPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<MindmapData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/mindmap/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setData(d.module);
        else setError(d.error || "加载失败");
      })
      .catch(() => setError("网络错误"));
  }, [id]);

  if (error) {
    return (
      <main style={{ maxWidth: 900, margin: "0 auto", padding: 48, textAlign: "center" }}>
        <p style={{ color: "#c0492f" }}>{error}</p>
        <Link href="/knowledge-graph" style={{ color: "#1c7c74" }}>返回知识图谱</Link>
      </main>
    );
  }

  if (!data) {
    return (
      <main style={{ maxWidth: 900, margin: "0 auto", padding: 48, textAlign: "center", color: "#6b7b79" }}>
        加载中…
      </main>
    );
  }

  // 计算布局：根最左侧，每个 slide 一个分支纵排，要点缩进
  const ROOT_X = 40;
  const BRANCH_X = 300;
  const POINT_X = 540;
  const ROW_H = 24;
  const PADDING = 40;
  const rows: { type: "root" | "branch" | "point"; x: number; y: number; text: string }[] = [];
  rows.push({ type: "root", x: ROOT_X, y: PADDING, text: `${data.id} ${data.title}` });

  let y = PADDING;
  data.branches.forEach((b) => {
    y = Math.max(y, rows[rows.length - 1].y);
    rows.push({ type: "branch", x: BRANCH_X, y: y + ROW_H, text: b.slideTitle });
    b.points.forEach((p) => {
      y += ROW_H;
      rows.push({ type: "point", x: POINT_X, y: y, text: p.length > 46 ? p.slice(0, 46) + "…" : p });
    });
    y += ROW_H;
  });

  const H = y + PADDING + 40;
  const W = 900;

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "24px 20px 60px" }}>
      <div style={{ fontSize: 13, color: "#6b7b79", marginBottom: 6 }}>
        <Link href="/knowledge-graph" style={{ color: "#1c7c74", textDecoration: "none" }}>知识图谱</Link> / 知识点地图
      </div>
      <h1 style={{ fontSize: 22, color: "#0e3b43", marginBottom: 4 }}>{data.id} {data.title} · 知识点地图</h1>
      <p style={{ fontSize: 13, color: "#6b7b79", margin: "0 0 16px" }}>本模块全部知识点一览，点击分支可跳转到课件对应内容。</p>
      <p style={{ fontSize: 13, color: "#6b7b79", marginBottom: 16 }}>
        模块 → 各页要点；点击模块标题进入课件系统学习。
      </p>

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e4ded2", padding: 12, overflowX: "auto" }}>
        <svg width={W} height={H} style={{ display: "block" }}>
          {/* 连线：根 → 各分支 → 要点 */}
          {rows.map((r, i) => {
            if (i === 0) return null;
            const prev = rows[i - 1];
            const color = r.type === "branch" ? "#1c7c74" : "#c4ccc9";
            return <line key={i} x1={prev.x + 130} y1={prev.y} x2={r.x - 4} y2={r.y} stroke={color} strokeWidth={1} />;
          })}
          {/* 根节点 */}
          <a href={`/m/${data.id}`}>
            <rect x={ROOT_X} y={rows[0].y - 18} width={260} height={36} rx={10} fill="#0e3b43" />
            <text x={ROOT_X + 130} y={rows[0].y + 6} fontSize={15} fontWeight={700} fill="#fff" textAnchor="middle">
              {rows[0].text}
            </text>
          </a>
          {/* 分支与要点 */}
          {rows.slice(1).map((r, i) =>
            r.type === "branch" ? (
              <g key={i}>
                <rect x={r.x} y={r.y - 16} width={210} height={30} rx={8} fill="#e1f5ee" />
                <text x={r.x + 8} y={r.y + 5} fontSize={14} fontWeight={700} fill="#085041">
                  {r.text.length > 20 ? r.text.slice(0, 20) + "…" : r.text}
                </text>
              </g>
            ) : (
              <text key={i} x={r.x} y={r.y} fontSize={12} fill="#44504e">
                · {r.text}
              </text>
            )
          )}
        </svg>
      </div>

      <div style={{ marginTop: 16 }}>
        <Link href={`/m/${data.id}`} style={{ background: "#1c7c74", color: "#fff", padding: "10px 22px", borderRadius: 20, textDecoration: "none", fontSize: 14, display: "inline-block" }}>
          进入 {data.id} 课件 →
        </Link>
      </div>
    </main>
  );
}