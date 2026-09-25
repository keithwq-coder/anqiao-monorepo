// src/lib/validation.ts — 手写校验（不装 zod）
// 注：USERNAME_RE 支持中文（CRM 同步约定，用户名=中文实名，见 docs/crm-auth-sync-spec.md §2）
export const USERNAME_RE = /^[\p{L}\p{N}_]{1,32}$/u;
export const NICKNAME_RE = /^[\p{L}\p{N}_]{1,20}$/u; // 字母/数字/中文/下划线
export const NAME_RE = /^[\p{L}\p{N}·\s]{1,40}$/u;
export const PHONE_RE = /^[0-9+\-\s]{0,20}$/;
export const IDCARD_RE = /^[0-9Xx]{0,18}$/;

export interface FieldError {
  field: string;
  message: string;
}

/** 校验字符串必填+长度上限 */
export function reqStr(v: unknown, field: string, max: number, label: string): FieldError | null {
  if (typeof v !== "string" || v.trim().length === 0) {
    return { field, message: `${label}不能为空` };
  }
  if (v.length > max) {
    return { field, message: `${label}过长（最多 ${max} 字符）` };
  }
  return null;
}

/** 登录标识：username 或 nickname（CRM 同步后支持中文用户名，最短 1 字符） */
export function validLoginId(v: string): boolean {
  return v.length >= 1 && v.length <= 32 && USERNAME_RE.test(v);
}

/** 密码：至少 3 位（初始口令统一 123，首登强制改密后可设更强口令；原下限 8 位，应业主统一口令要求下调）
 *  注：降低强度下限属业主明确决策，生产如有合规要求建议后续改为 8 位并调整初始口令策略。 */
export function validPassword(v: string): boolean {
  return typeof v === "string" && v.length >= 3 && v.length <= 128;
}

export function validNickname(v: string): boolean {
  return typeof v === "string" && v.length >= 1 && v.length <= 20 && NICKNAME_RE.test(v);
}
