// src/lib/env.ts — 服务端环境变量读取
export function getEnv() {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const internalToken = process.env.INTERNAL_API_TOKEN ?? "";
  const sessionTtlSeconds = Number(process.env.SESSION_TTL_SECONDS ?? 604800); // B4: 7 天
  // D10: 默认 Secure=true；本地 http 开发用 COOKIE_SECURE=false
  const cookieSecure =
    process.env.COOKIE_SECURE === undefined
      ? true
      : process.env.COOKIE_SECURE === "true" || process.env.COOKIE_SECURE === "1";
  const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
  const rateLimitMaxFailures = Number(process.env.RATE_LIMIT_MAX_FAILURES ?? 5);
  const rateLimitBlockMs = Number(process.env.RATE_LIMIT_BLOCK_MS ?? 600_000); // 10 分钟
  // CRM 内部账号接口（统一认证：wiki 登录/改密/建号均同步到 CRM；见 docs/crm-auth-sync-spec.md）
  const crmBaseUrl = process.env.CRM_BASE_URL ?? "";
  const crmInternalToken = process.env.CRM_INTERNAL_TOKEN ?? "";
  return {
    databaseUrl,
    internalToken,
    sessionTtlSeconds,
    cookieSecure,
    rateLimitWindowMs,
    rateLimitMaxFailures,
    rateLimitBlockMs,
    crmBaseUrl,
    crmInternalToken,
  };
}

export const SESSION_COOKIE = "wiki_session";
