// src/proxy.ts — 全站鉴权 + 安全头（Next 16 proxy 约定，替代 middleware；D9：仅 cookie 存在性拦截）
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/env";

/**
 * SPEC §7：
 * - 除 /login、静态框架资源、robots、favicon、api/auth/login（登录接口）、api/internal（token 鉴权，非会话）
 *   之外的所有路由都要求会话 cookie；
 * - 无 cookie 的页面请求 → 302 /login；无 cookie 的 API 请求 → 401 JSON；
 * - 全站响应头 X-Robots-Tag: noindex, nofollow（§7.4）。
 * 注：DB 会话有效性在服务端 RSC/API 层校验（proxy 无法连 pg）。
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has(SESSION_COOKIE);

  const res = hasSession
    ? NextResponse.next()
    : pathname.startsWith("/api/")
      ? NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
      : NextResponse.redirect(new URL("/login", req.url), 302);

  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

export const config = {
  // exclude 式：全站覆盖，未来新增路由自动受保护
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|login|api/auth/login|api/internal).*)",
  ],
};
