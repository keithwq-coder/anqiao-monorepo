// src/app/page.tsx — 仪表盘：按 layer 分组模块卡片 + 继续学习卡（T-B）
import Link from "next/link";
import { requirePortalUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { getRoleMatrix, type ModuleAccessRow } from "@/lib/certification";
import { getCourseware } from "@/lib/courseware";
import { GROUP_LABELS, ROLE_LABELS, tierForRole } from "@/lib/types";

export const dynamic = "force-dynamic";

const LAYER_LABELS: Record<string, string> = { L1: "L1 基础", L2: "L2", L3: "L3" };

export default async function Home() {
  const user = await requirePortalUser();
  const tier = tierForRole(user.role);
  const isAdmin = tier === "admin";

  const cw = getCourseware();
  const ordById = new Map(cw.map((m, i) => [m.id, i]));

  let matrix: Map<string, ModuleAccessRow>;
  if (isAdmin) {
    matrix = new Map(cw.map((m) => [m.id, { module_id: m.id, access: "req" as const, required: false }]));
  } else {
    const rows = await getRoleMatrix(user.role);
    matrix = new Map(rows.map((r) => [r.module_id, r]));
  }

  const [viewsRes, passedRes] = await Promise.all([
    pool.query("select module_id, has_completed from course_views where user_id=$1", [user.id]),
    pool.query("select distinct module_id from quiz_attempts where user_id=$1 and passed=true", [
      user.id,
    ]),
  ]);
  const viewed = new Set(viewsRes.rows.map((r) => r.module_id));
  const completed = new Set(viewsRes.rows.filter((r) => r.has_completed).map((r) => r.module_id));
  const passed = new Set(passedRes.rows.map((r) => r.module_id));

  const modules = cw
    .map((m) => {
      const row = matrix.get(m.id);
      const access = row?.access ?? (isAdmin ? "req" : "na");
      return { m, access, quizRequired: row?.required ?? false };
    })
    .filter((x) => x.access !== "na") // na 模块不显示
    .sort((a, b) => ordById.get(a.m.id)! - ordById.get(b.m.id)!);

  // T-B：按 layer 分组（L1 → L2 → L3），组内保持模块顺序
  const groups: { layer: string; items: typeof modules }[] = [];
  for (const layer of ["L1", "L2", "L3"]) {
    const items = modules.filter((x) => x.m.layer === layer);
    if (items.length > 0) groups.push({ layer, items });
  }
  const ungrouped = modules.filter((x) => !x.m.layer || !LAYER_LABELS[x.m.layer]);
  if (ungrouped.length > 0) groups.push({ layer: "", items: ungrouped });

  // T-B：继续学习卡 —— 必修（access=req）中「已浏览未学完」序最小者，其次「未浏览」序最小者
  const reqModules = modules.filter((x) => x.access === "req");
  const resume = reqModules.find((x) => viewed.has(x.m.id) && !completed.has(x.m.id));
  const next = resume ?? reqModules.find((x) => !viewed.has(x.m.id));
  const allDone = reqModules.length > 0 && reqModules.every((x) => completed.has(x.m.id));
  const isFirstLogin = viewed.size === 0; // 首登空态

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "24px 20px 60px" }}>
      {user.must_change_password && (
        <div
          style={{
            background: "#fef3c7",
            border: "1px solid #f59e0b",
            color: "#92400e",
            borderRadius: 8,
            padding: "12px 16px",
            fontSize: 14,
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <span>⚠️ 当前仍在使用初始密码，建议尽快修改以保障账号安全。</span>
          <Link
            href="/account"
            style={{ color: "#92400e", fontWeight: 700, textDecoration: "underline", whiteSpace: "nowrap" }}
          >
            去修改密码 →
          </Link>
        </div>
      )}
      <h1 style={{ fontSize: 24, color: "#0e3b43", margin: "0 0 4px" }}>
        欢迎，{user.name}
      </h1>
      <p style={{ fontSize: 13, color: "#6b7b79", margin: "0 0 24px" }}>
        {user.username}
        {user.nickname ? `（昵称：${user.nickname}）` : ""} · {ROLE_LABELS[user.role]} ·{" "}
        {GROUP_LABELS[tier]}
      </p>

      {/* T-B：继续学习卡（首屏顶部） */}
      {reqModules.length > 0 && (
        <div
          style={{
            background: "#eef4ff",
            border: "1px solid #c7dcf7",
            borderRadius: 12,
            padding: "14px 20px",
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#24456b" }}>🚀 继续学习</div>
            {allDone ? (
              <div style={{ fontSize: 13, color: "#44504e", marginTop: 2 }}>
                🎉 太棒了，必修模块已全部学完！可回头复习或完成选修模块。
              </div>
            ) : next ? (
              <div style={{ fontSize: 13, color: "#44504e", marginTop: 2 }}>
                {isFirstLogin ? "新学员你好，建议从 L1 必修模块开始：" : "下一课（必修）："}
                <b>
                  {next.m.id} {next.m.title}
                </b>
                {next.m.layer ? ` · ${next.m.layer}` : ""}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "#44504e", marginTop: 2 }}>暂无必修模块。</div>
            )}
          </div>
          {!allDone && next && (
            <Link
              href={`/m/${next.m.id}`}
              style={{
                background: "#1c7c74",
                color: "#fff",
                padding: "10px 22px",
                borderRadius: 20,
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {resume ? "继续学习 →" : "开始学习 →"}
            </Link>
          )}
        </div>
      )}

      {/* 学习辅助入口：知识库 / 知识点地图 */}
      {!isAdmin && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
          <Link href="/knowledge-base" style={{ ...learnLink, background: "#1c7c74", color: "#fff", border: "1px solid #1c7c74" }}>
            📚 知识库
          </Link>
          <Link href="/knowledge-graph" style={{ ...learnLink, background: "#fff", border: "1px solid #1c7c74", color: "#1c7c74" }}>
            🧭 知识点地图
          </Link>
          <Link href="/exam/practice" style={{ ...learnLink, background: "#fff", border: "1px solid #1c7c74", color: "#1c7c74" }}>
            📋 模拟测试
          </Link>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.layer} style={{ marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0e3b43", margin: 0 }}>
              {g.layer ? LAYER_LABELS[g.layer] : "其他"}
            </h2>
            <span style={{ fontSize: 12, color: "#6b7b79" }}>
              建议按 1 → {g.items.length} 顺序学习
            </span>
          </div>
          <div className="zk-card-grid">
            {g.items.map(({ m, access, quizRequired }, i) => {
              const isViewed = viewed.has(m.id);
              const isDone = completed.has(m.id);
              const isPassed = passed.has(m.id);
              return (
                <Link
                  key={m.id}
                  href={`/m/${m.id}`}
                  style={{
                    background: "#fff",
                    border: "1px solid #e4ded2",
                    borderRadius: 12,
                    padding: "16px 18px",
                    textDecoration: "none",
                    color: "inherit",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <b style={{ fontSize: 15, color: "#0e3b43" }}>{m.id}</b>
                    <Badge access={access} quizRequired={quizRequired} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#243b3a" }}>{m.title}</div>
                  <div style={{ fontSize: 12, color: "#6b7b79" }}>
                    {m.layer ?? ""}
                    {m.duration ? ` · ${m.duration}` : ""}
                  </div>
                  <StatusDot viewed={isViewed} done={isDone} passed={isPassed} access={access} />
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>推荐顺序：第 {i + 1} 步</div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}

function Badge({ access, quizRequired }: { access: string; quizRequired: boolean }) {
  if (access === "req") {
    return (
      <span style={badgeStyle("#e8a33d", "#7c4d00")}>
        {quizRequired ? "必修 · 有测验" : "必修"}
      </span>
    );
  }
  return <span style={badgeStyle("#1c7c74", "#0b3f3a")}>选修</span>;
}

function badgeStyle(bg: string, fg: string): React.CSSProperties {
  return {
    background: bg,
    color: fg,
    fontSize: 11,
    fontWeight: 700,
    borderRadius: 10,
    padding: "2px 8px",
  };
}

const learnLink: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 18px",
  borderRadius: 10,
  fontSize: 14,
  textDecoration: "none",
};

function StatusDot({ viewed, done, passed, access }: { viewed: boolean; done: boolean; passed: boolean; access: string }) {
  if (access === "req" && passed) {
    return <span style={statusStyle("#085041", "#d9f2e8")}>✅ 测验已过</span>;
  }
  if (done) {
    return <span style={statusStyle("#085041", "#d9f2e8")}>📖 已学完</span>;
  }
  if (viewed) {
    return <span style={statusStyle("#6b4e00", "#fdf4da")}>◐ 已浏览</span>;
  }
  return <span style={statusStyle("#6b7280", "#f0f1f3")}>○ 未开始</span>;
}

function statusStyle(fg: string, bg: string): React.CSSProperties {
  return {
    color: fg,
    background: bg,
    fontSize: 12,
    borderRadius: 10,
    padding: "3px 10px",
    alignSelf: "flex-start",
  };
}
