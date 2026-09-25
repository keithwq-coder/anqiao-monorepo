// src/lib/rate-limit.ts — 登录限速（按 IP 进程内计数，SPEC §7.7）
import { getEnv } from "./env";

interface Bucket {
  failures: number;
  firstAt: number;
  blockedUntil: number;
}

const buckets = new Map<string, Bucket>();

function now(): number {
  return Date.now();
}

function bucketFor(ip: string): Bucket {
  let b = buckets.get(ip);
  if (!b) {
    b = { failures: 0, firstAt: 0, blockedUntil: 0 };
    buckets.set(ip, b);
  }
  return b;
}

/** 返回是否放行；若被拦截返回剩余秒数 */
export function checkRateLimit(ip: string): { allowed: boolean; retryAfterSeconds: number } {
  const { rateLimitWindowMs, rateLimitBlockMs } = getEnv();
  const b = bucketFor(ip);
  const t = now();

  if (b.blockedUntil > t) {
    return { allowed: false, retryAfterSeconds: Math.ceil((b.blockedUntil - t) / 1000) };
  }
  // 窗口过期则重置
  if (b.failures > 0 && t - b.firstAt > rateLimitWindowMs) {
    b.failures = 0;
    b.firstAt = 0;
    b.blockedUntil = 0;
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** 记录一次失败；超过阈值则封锁 */
export function recordFailure(ip: string): void {
  const { rateLimitWindowMs, rateLimitMaxFailures, rateLimitBlockMs } = getEnv();
  const b = bucketFor(ip);
  const t = now();
  if (t - b.firstAt > rateLimitWindowMs) {
    b.failures = 0;
    b.firstAt = t;
  }
  if (b.firstAt === 0) b.firstAt = t;
  b.failures += 1;
  if (b.failures >= rateLimitMaxFailures) {
    b.blockedUntil = t + rateLimitBlockMs;
  }
}

/** 登录成功时清零 */
export function clearFailures(ip: string): void {
  buckets.delete(ip);
}

/** 供测试/管理：清理 */
export function resetRateLimits(): void {
  buckets.clear();
}
