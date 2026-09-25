/** 表单来源：询价页 / 招商页共用同一个 Server Action（SPEC §5.8）。 */
export type LeadType = "inquiry" | "dealer";

export type LeadFormState = {
  ok: boolean;
  message: string;
  /** 字段名 → 错误文案，渲染在对应字段下方（不用 alert）。 */
  errors: Record<string, string>;
};

export const EMPTY_LEAD_STATE: LeadFormState = {
  ok: false,
  message: "",
  errors: {},
};

/** 咨询类型（必填 select，SPEC §5.8）。 */
export const INQUIRY_TYPES = ["设备采购", "方案咨询", "经销商加盟"] as const;

/** 客户类型（可选 select，SPEC §5.8）。 */
export const CUSTOMER_TYPES = [
  "养老机构",
  "社区居家",
  "医疗卫生",
  "大健康美业",
  "装修适老化改造",
  "其他",
] as const;

/** 输入长度上限（SPEC §2.3：拒绝超长输入）。 */
export const LIMITS = {
  name: 40,
  phone: 20,
  organization: 80,
  product: 80,
  message: 500,
} as const;
