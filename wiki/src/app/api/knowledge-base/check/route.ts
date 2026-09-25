// POST /api/knowledge-base/check — 知识库单题作答判分（答后显示正确答案；学习反馈，不落成绩）
import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { checkKnowledgeBaseAnswer } from "@/lib/learning";

export async function POST(req: NextRequest) {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  }
  let body: { id?: unknown; answer?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "参数格式错误" }, { status: 400 });
  }
  const id = Number(body.id);
  const answer = typeof body.answer === "string" ? body.answer : "";
  if (!Number.isInteger(id) || !answer) {
    return NextResponse.json({ ok: false, error: "参数错误" }, { status: 400 });
  }
  const r = await checkKnowledgeBaseAnswer(id, answer);
  if (!r) {
    return NextResponse.json({ ok: false, error: "题目不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, ...r });
}