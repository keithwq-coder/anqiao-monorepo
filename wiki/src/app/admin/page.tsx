// src/app/admin/page.tsx — 后台管理（仅 admin）：档案化统计 + 学员列表
import { requireUser } from "@/lib/auth";
import { listUsersWithProfile } from "@/lib/admin";
import { GROUP_LABELS, ROLE_LABELS, type GroupTier } from "@/lib/types";
import { AdminPanel } from "@/components/AdminPanel";
import AdminAuditPanel from "@/components/AdminAuditPanel";
import { AdminExamPanel } from "@/components/AdminExamPanel";

export default async function AdminPage() {
  const user = await requireUser();
  if (user.role !== "admin") {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto", padding: 48, textAlign: "center" }}>
        <h1 style={{ fontSize: 20, color: "#c0492f" }}>无权限</h1>
        <p style={{ fontSize: 14, color: "#6b7b79" }}>仅管理员可访问后台。</p>
      </main>
    );
  }

  const list = await listUsersWithProfile(false); // 排除占位
  const total = list.length;
  const tierCount: Record<GroupTier, number> = { admin: 0, internal: 0, external: 0 };
  for (const u of list) tierCount[u.tier]++;

  // 内部组档案完成度（均值）与外部参与度
  const internal = list.filter((u) => u.tier === "internal");
  const external = list.filter((u) => u.tier === "external");
  const avgInternalCompletion =
    internal.length === 0
      ? 0
      : Math.round((internal.reduce((s, u) => s + u.completionRate, 0) / internal.length) * 100);
  const avgExternalParticipation =
    external.length === 0
      ? 0
      : Math.round((external.reduce((s, u) => s + u.participationRate, 0) / external.length) * 100);

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 20px 60px" }}>
      <h1 style={{ fontSize: 22, color: "#0e3b43", marginBottom: 4 }}>后台管理</h1>
      <p style={{ fontSize: 13, color: "#6b7b79", marginBottom: 20 }}>
        学员档案 / 学习统计 / 报表导出 / 新建账号（默认不显示种子占位账号）
      </p>

      {/* 统计概览（按三组） */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 24 }}>
        <StatCard label="真实学员（排除占位）" value={String(total)} />
        <StatCard label={GROUP_LABELS.admin} value={String(tierCount.admin)} />
        <StatCard label={GROUP_LABELS.internal} value={String(tierCount.internal)} />
        <StatCard label={GROUP_LABELS.external} value={String(tierCount.external)} />
        <StatCard label="内部档案平均完成度" value={`${avgInternalCompletion}%`} />
        <StatCard label="外部渠道平均参与度" value={`${avgExternalParticipation}%`} />
      </div>

      {/* 角色分布 */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {Object.entries(ROLE_LABELS).map(([r, label]) => {
          const n = list.filter((u) => u.role === r).length;
          return (
            <span key={r} style={{ background: "#fff", border: "1px solid #e4ded2", borderRadius: 10, padding: "4px 12px", fontSize: 12, color: "#44504e" }}>
              {label}: {n}
            </span>
          );
        })}
      </div>

      <AdminPanel />

      {/* T-F：操作审计折叠区 */}
      <AdminAuditPanel />

      {/* 考试管理与成绩单（随机组卷 + 成绩图片） */}
      <AdminExamPanel />
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e4ded2", borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ fontSize: 13, color: "#6b7b79" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "#0e3b43" }}>{value}</div>
    </div>
  );
}
