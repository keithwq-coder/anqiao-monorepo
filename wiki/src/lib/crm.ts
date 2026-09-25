// src/lib/crm.ts — 培训 wiki → CRM 内部账号接口客户端
// SPEC: docs/crm-auth-sync-spec.md §4（X-Internal-Token 鉴权；仅内网/本机可达）
// 覆盖：登录验证、建号、改密/重置。CRM 不可达/未配置一律 fail-closed（登录拒绝）。

import { getEnv } from "@/lib/env";

const TIMEOUT_MS = 6000;

interface CrmResponse {
  status: number;
  json: { ok?: boolean; user?: { username?: string; display_name?: string; status?: string } } | null;
}

async function callCrm(path: string, body: unknown): Promise<CrmResponse> {
  const { crmBaseUrl, crmInternalToken } = getEnv();
  if (!crmBaseUrl || !crmInternalToken) {
    throw new Error("CRM 内部接口未配置（CRM_BASE_URL / CRM_INTERNAL_TOKEN）");
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${crmBaseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Token": crmInternalToken,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      cache: "no-store",
    });
    let json: CrmResponse["json"] = null;
    try {
      json = (await res.json()) as CrmResponse["json"];
    } catch {
      json = null;
    }
    return { status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
}

/** 验证用户名+密码（wiki 登录）。成功返回 CRM 用户信息，失败返回 null。 */
export async function crmVerifyCredentials(
  username: string,
  password: string
): Promise<{ username: string; display_name: string; status: string } | null> {
  const { status, json } = await callCrm("/api/internal/auth/verify", { username, password });
  if (status === 200 && json?.ok && json.user) {
    return {
      username: json.user.username ?? username,
      display_name: json.user.display_name ?? username,
      status: json.user.status ?? "enabled",
    };
  }
  return null;
}

/**
 * 创建 CRM 账号。
 * 返回 true=已创建、false=用户名已存在（409）、异常=CRM 不可达/其它失败（抛错）。
 */
export async function crmCreateUser(username: string, displayName: string, password: string): Promise<boolean> {
  const { status } = await callCrm("/api/internal/users", {
    username,
    display_name: displayName,
    password,
  });
  if (status === 200) return true;
  if (status === 409) return false;
  throw new Error(`CRM 建号失败（HTTP ${status}）`);
}

/**
 * 修改/重置 CRM 账号密码。
 * currentPassword 传空串 = 管理员重置（不验当前密码）。
 */
export async function crmChangePassword(
  username: string,
  newPassword: string,
  currentPassword = ""
): Promise<boolean> {
  const { status } = await callCrm("/api/internal/users/password", {
    username,
    current_password: currentPassword,
    new_password: newPassword,
  });
  return status === 200;
}

/** 锁定账号是否走 CRM 验证（password_hash 哨兵值）。 */
export const CRM_AUTH_SENTINEL = "!crm-auth";