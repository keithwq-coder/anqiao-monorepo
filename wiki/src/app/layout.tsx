// src/app/layout.tsx — 全局布局 + 登录态顶栏
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { getSessionUser } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/types";
import LogoutButton from "@/components/LogoutButton";

export const metadata: Metadata = {
  title: "中科安樵 · 经销商赋能培训",
  description: "内部经销商赋能培训与认证系统",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// 整个应用动态渲染（layout 顶层读 cookies()，避免错误页静态预渲染时上下文为 null）
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const su = await getSessionUser();

  return (
    <html lang="zh-CN">
      <body>
        {su && (
          <header
            className="zk-nav"
            style={{
              background: "#0e3b43",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              gap: 20,
              padding: "10px 24px",
              flexWrap: "wrap",
            }}
          >
            <Link href="/" style={{ color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 16 }}>
              中科安樵 · 经销商赋能培训
            </Link>
            <nav style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <Link href="/" style={{ color: "rgba(255,255,255,.85)", textDecoration: "none", fontSize: 14 }}>
                仪表盘
              </Link>
              <Link href="/account" style={{ color: "rgba(255,255,255,.85)", textDecoration: "none", fontSize: 14 }}>
                账号设置
              </Link>
              {su.user.role === "admin" && (
                <Link href="/admin" style={{ color: "rgba(255,255,255,.85)", textDecoration: "none", fontSize: 14 }}>
                  后台管理
                </Link>
              )}
              <span
                title="AI 工具二期上线"
                style={{ color: "rgba(255,255,255,.4)", fontSize: 14, cursor: "not-allowed" }}
              >
                AI 工具
              </span>
            </nav>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 13, opacity: 0.9 }}>
                {su.user.name}
                <span style={{ marginLeft: 6, opacity: 0.6 }}>{ROLE_LABELS[su.user.role]}</span>
              </span>
              <LogoutButton compact />
            </div>
          </header>
        )}
        {children}
      </body>
    </html>
  );
}
