// GET /api/internal/certification — 只读学习档案接口（§6.3 演进：档案化，docs/cert-design.md）
// 鉴权：X-Internal-Token；只读；返回内部员工组档案 + 外部渠道组参考进度（管理组不输出）。
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { getCertification } from "@/lib/certification";

function profileOut(p: Awaited<ReturnType<typeof getCertification>>) {
  return {
    username: p.username,
    name: p.name,
    role: p.role,
    tier: p.tier,
    viewedModules: p.viewedModules,
    completedModules: p.completedModules,
    participationRate: p.participationRate,
    completionRate: p.completionRate,
    quizBestScores: p.quizBestScores,
    quizAttemptCount: p.quizAttemptCount,
    quizPassedModules: p.quizPassedModules,
    totalAttempts: p.totalAttempts,
    avgScore: p.avgScore,
    lastActiveAt: p.lastActiveAt,
  };
}

export async function GET(req: NextRequest) {
  const token = req.headers.get("x-internal-token") ?? "";
  if (!token || token !== getEnv().internalToken) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const username = req.nextUrl.searchParams.get("username")?.trim() ?? "";

  if (username) {
    const { rows } = await pool.query(
      "select * from users where username=$1 and role<>'admin'",
      [username]
    );
    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    }
    const profile = await getCertification(rows[0]);
    return NextResponse.json(profileOut(profile));
  }

  // 全部非 admin 用户（内部 + 外部参考，按用户名排序）
  const { rows } = await pool.query("select * from users where role<>'admin' order by username");
  const list = [];
  for (const u of rows) {
    list.push(profileOut(await getCertification(u)));
  }
  return NextResponse.json({ users: list });
}
