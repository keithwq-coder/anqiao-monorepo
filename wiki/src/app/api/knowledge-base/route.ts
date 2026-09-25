// GET /api/knowledge-base — 知识库（知识点百科：课件内容条目，模块筛选 + 关键词搜索）
import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { listKnowledgeEntries } from "@/lib/learning";

export async function GET(req: NextRequest) {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  }
  const moduleId = req.nextUrl.searchParams.get("module") ?? "";
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const entries = listKnowledgeEntries(
    /^M\d{2}$/.test(moduleId) ? moduleId : undefined,
    q || undefined
  );
  return NextResponse.json({ ok: true, total: entries.length, terms: entries });
}
