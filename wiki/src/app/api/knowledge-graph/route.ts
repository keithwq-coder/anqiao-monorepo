// GET /api/knowledge-graph — 知识图谱（模块分层 + 主题关系，供前端 SVG 渲染）
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getKnowledgeGraph } from "@/lib/learning";

export async function GET() {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  }
  const g = getKnowledgeGraph();
  return NextResponse.json({ ok: true, nodes: g.nodes, edges: g.edges });
}