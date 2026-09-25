// src/lib/types.ts — 共享类型（普通模块，供 RSC/API/Server Action 引用）
export type Role =
  | "admin"
  | "internal_sales"
  | "internal_tech"
  | "internal_ops"
  | "dealer"
  | "agent"
  | "reseller";

/** 三组差异化（docs/cert-design.md）：管理组 / 内部员工组 / 外部渠道组 */
export type GroupTier = "admin" | "internal" | "external";

/** 角色 → 分组 */
export function tierForRole(role: Role): GroupTier {
  if (role === "admin") return "admin";
  if (role === "internal_sales" || role === "internal_tech" || role === "internal_ops") {
    return "internal";
  }
  return "external";
}

export const GROUP_LABELS: Record<GroupTier, string> = {
  admin: "管理组",
  internal: "内部员工组",
  external: "外部渠道组",
};

export interface UserRow {
  id: number;
  username: string;
  nickname: string | null;
  password_hash: string;
  role: Role;
  name: string;
  realname: string;
  idcard: string;
  phone: string;
  must_change_password: boolean;
  is_active: boolean;
  is_placeholder: boolean; // 种子占位账号（dl_0001..0099）
  created_at: Date;
  last_active_at: Date | null;
}

export interface ModuleRow {
  id: string;
  title: string;
  layer: string | null;
  ordinal: number;
}

export interface QuizQuestionRow {
  id: number;
  module_id: string;
  ordinal: number;
  question: string;
  options: string[];
  answer: string;
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "管理员",
  internal_sales: "内部销售",
  internal_tech: "内部技术",
  internal_ops: "内部仓管/财务",
  dealer: "经销商",
  agent: "代理商",
  reseller: "代销商",
};

export const ROLE_COLORS: Record<Role, string> = {
  admin: "#E8A33D",
  internal_sales: "#1C7C74",
  internal_tech: "#534AB7",
  internal_ops: "#0E3B43",
  dealer: "#C0492F",
  agent: "#BA7517",
  reseller: "#888780",
};

export const ALL_ROLES: Role[] = [
  "admin",
  "internal_sales",
  "internal_tech",
  "internal_ops",
  "dealer",
  "agent",
  "reseller",
];
