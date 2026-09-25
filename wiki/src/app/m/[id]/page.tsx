// src/app/m/[id]/page.tsx — 课件渲染（RSC，6 种 slide type）+ 浏览记录
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePortalUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { getModuleContent } from "@/lib/courseware";
import { getModuleAccessForRole, recordModuleView } from "@/lib/certification";
import type { Slide } from "@/lib/courseware";
import CompleteTracker from "@/components/CompleteTracker";
import MarkCompleteButton from "@/components/MarkCompleteButton";

export const dynamic = "force-dynamic";

export default async function CoursewarePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requirePortalUser();

  const access = await getModuleAccessForRole(id, user.role);
  if (access === "na") {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto", padding: 48, textAlign: "center" }}>
        <h1 style={{ fontSize: 20, color: "#c0492f" }}>无权限访问该模块</h1>
        <Link href="/" style={{ color: "#1c7c74", fontSize: 14 }}>
          返回仪表盘
        </Link>
      </main>
    );
  }

  const cw = getModuleContent(id);
  if (!cw) notFound();

  // 记录浏览
  void recordModuleView(user.id, id);

  const meta = await pool.query("select title from modules where id=$1", [id]);
  const title = meta.rows[0]?.title ?? cw.title;

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "24px 20px 60px" }}>
      <div style={{ fontSize: 13, color: "#6b7b79", marginBottom: 6 }}>
        <Link href="/" style={{ color: "#1c7c74", textDecoration: "none" }}>
          仪表盘
        </Link>{" "}
        / {id}
      </div>
      <h1 style={{ fontSize: 24, color: "#0e3b43", marginBottom: 2 }}>
        {id} {title}
      </h1>
      <p style={{ fontSize: 13, color: "#6b7b79", marginBottom: 20 }}>
        {cw.layer ? `${cw.layer} · ` : ""}
        {cw.duration ?? ""}　·　{access === "req" ? "必修" : "选修"}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {cw.slides.map((s, i) => (
          <SlideView key={i} slide={s} />
        ))}
      </div>

      <div
        style={{
          marginTop: 32,
          background: "#fff",
          border: "1px solid #e4ded2",
          borderRadius: 12,
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ fontSize: 14, color: "#243b3a" }}>
          {access === "req" ? "学完本节后请完成测验" : "本模块为选修，测验作练习"}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Link
            href={`/self-test?module=${id}`}
            style={{
              background: "#fff",
              color: "#1c7c74",
              padding: "10px 22px",
              borderRadius: 20,
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
              border: "1px solid #1c7c74",
            }}
          >
            练习刷题 →
          </Link>
          <MarkCompleteButton moduleId={id} />
          <Link
            href={`/m/${id}/quiz`}
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
            开始测试 →
          </Link>
        </div>
      </div>

      <CompleteTracker moduleId={id} />
    </main>
  );
}

function SlideView({ slide }: { slide: Slide }) {
  switch (slide.type) {
    case "highlight":
      return (
        <section>
          <h2 style={h2Style}>{slide.title}</h2>
          <div
            style={{
              background: "#0e3b43",
              color: "#fff",
              borderRadius: 10,
              padding: "16px 20px",
              fontSize: 15,
            }}
          >
            {slide.label && (
              <div style={{ fontSize: 12, color: "#e8a33d", fontWeight: 700, marginBottom: 6 }}>
                {slide.label}
              </div>
            )}
            {slide.lines?.map((l, i) => (
              <p key={i} style={{ margin: "4px 0" }}>
                {l}
              </p>
            ))}
          </div>
        </section>
      );
    case "points":
    case "point":
      return (
        <section>
          <h2 style={h2Style}>{slide.title}</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {slide.items?.map((it, i) => (
              <li
                key={i}
                style={{
                  background: "#fff",
                  border: "1px solid #e4ded2",
                  borderRadius: 8,
                  padding: "12px 16px 12px 40px",
                  marginBottom: 8,
                  fontSize: 14,
                  position: "relative",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    left: 12,
                    top: 12,
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "#1c7c74",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {i + 1}
                </span>
                {it}
              </li>
            ))}
          </ul>
        </section>
      );
    case "table":
      return (
        <section>
          <h2 style={h2Style}>{slide.title}</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, background: "#fff" }}>
              <thead>
                <tr>
                  {slide.headers?.map((h, i) => (
                    <th key={i} style={{ ...cellStyle, background: "#0e3b43", color: "#fff", fontWeight: 600 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slide.rows?.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((c, ci) => (
                      <td key={ci} style={{ ...cellStyle, background: ri % 2 ? "#f8f6f0" : "#fff" }}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      );
    case "twocol":
      return (
        <section>
          <h2 style={h2Style}>{slide.title}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ background: "#fff", border: "1px solid #e4ded2", borderRadius: 8, padding: "14px 16px" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1c7c74", marginBottom: 6 }}>
                {slide.left_title}
              </div>
              <ul style={{ paddingLeft: 18, margin: 0, fontSize: 13, color: "#44504e" }}>
                {slide.left?.map((l, i) => (
                  <li key={i} style={{ marginBottom: 3 }}>
                    {l}
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ background: "#fff", border: "1px solid #e4ded2", borderRadius: 8, padding: "14px 16px" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1c7c74", marginBottom: 6 }}>
                {slide.right_title}
              </div>
              <ul style={{ paddingLeft: 18, margin: 0, fontSize: 13, color: "#44504e" }}>
                {slide.right?.map((r, i) => (
                  <li key={i} style={{ marginBottom: 3 }}>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      );
    case "tip":
      return (
        <section>
          <h2 style={h2Style}>{slide.title}</h2>
          <div
            style={{
              background: "#fdf4da",
              border: "1px solid #e8d9a0",
              borderRadius: 8,
              padding: "12px 16px",
              fontSize: 13,
              color: "#6b4e00",
            }}
          >
            <b style={{ color: "#8a5a00" }}>提示：</b>
            {slide.text}
          </div>
        </section>
      );
    default:
      return (
        <section>
          <h2 style={h2Style}>{slide.title}</h2>
    case "attachment":
      return (
        <section>
          <h2 style={h2Style}>{slide.title}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {slide.files?.map((f, i) => (
              <a
                key={i}
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block",
                  background: "#eef4ff",
                  border: "1px solid #c7dcf7",
                  borderRadius: 10,
                  padding: "14px 18px",
                  color: "#24456b",
                  textDecoration: "none",
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700 }}>📄 {f.name}</div>
                {f.desc && (
                  <div style={{ fontSize: 13, color: "#44504e", marginTop: 4 }}>{f.desc}</div>
                )}
              </a>
            ))}
          </div>
        </section>
      );
          <p style={{ fontSize: 14, color: "#c0492f" }}>未知内容类型：{slide.type}</p>
        </section>
      );
  }
}

const h2Style: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 700,
  color: "#243b3a",
  marginBottom: 10,
  paddingLeft: 10,
  borderLeft: "3px solid #1c7c74",
};

const cellStyle: React.CSSProperties = {
  border: "1px solid #e4ded2",
  padding: "8px 10px",
  textAlign: "left",
  verticalAlign: "top",
};
