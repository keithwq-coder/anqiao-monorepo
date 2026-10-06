import { CANONICAL_ORIGIN } from "@/lib/site";
import type { L } from "./locale";
import { PENDING } from "./pending";

/**
 * 企业公开信息。未填写字段以 PENDING 标记，由 <Pending /> 渲染占位（SPEC §4.2 / §8）。
 * 多语言字段按 REBUILD 阶段 3/4 补齐；电话/邮箱/ICP 不随语言变。
 */
export const COMPANY = {
  fullName: {
    zh: "中科安樵（苏州）科技有限公司",
    en: "Zhongke Anqiao (Suzhou) Technology Co., Ltd.",
    fr: "Zhongke Anqiao (Suzhou) Technology Co., Ltd.",
    es: "Zhongke Anqiao (Suzhou) Technology Co., Ltd.",
    ja: "中科安樵（蘇州）科技有限会社",
    ru: "Zhongke Anqiao (Suzhou) Technology Co., Ltd.",
  } satisfies L<string>,
  /** REBUILD 阶段 4：业主确认地址。 */
  address: {
    zh: "苏州市石湖金陵广场商务楼 18 楼",
    en: "18F, Business Building, Shihu Jinling Plaza, Suzhou",
    fr: "18e étage, immeuble de bureaux, place Shihu Jinling, Suzhou",
    es: "Planta 18, edificio de oficinas, plaza Shihu Jinling, Suzhou",
    ja: "蘇州市石湖金陵広場ビジネスビル 18階",
    ru: "18 этаж, деловой центр Shihu Jinling Plaza, Сучжоу",
  } satisfies L<string>,
  /** 业主提供(2026-09-29)：对公电话。 */
  phone: "13405084570",
  /** 业主提供(2026-09-29)：对公邮箱。 */
  email: "13405084570@139.com",
  /** SPEC §4.2：ICP 备案号仍待业主提供真实号，页脚继续占位。 */
  icp: PENDING,
  /**
   * 规范域名。裸域 anqiaokj.com 由 nginx 301 到 www。
   * 旧域 anqiao.aibrain.wiki 上线后同样 301 过来。
   */
  website: CANONICAL_ORIGIN,
  copyright: {
    zh: "© 2026 中科安樵（苏州）科技有限公司",
    en: "© 2026 Zhongke Anqiao (Suzhou) Technology Co., Ltd.",
    fr: "© 2026 Zhongke Anqiao (Suzhou) Technology Co., Ltd.",
    es: "© 2026 Zhongke Anqiao (Suzhou) Technology Co., Ltd.",
    ja: "© 2026 中科安樵（蘇州）科技有限会社",
    ru: "© 2026 Zhongke Anqiao (Suzhou) Technology Co., Ltd.",
  } satisfies L<string>,
} as const;

/** 本地化后的公司信息（组件直接访问字符串字段）。 */
export function localizeCompany(locale: keyof L<unknown>) {
  return {
    fullName: COMPANY.fullName[locale as "zh"] ?? COMPANY.fullName.zh,
    address: COMPANY.address[locale as "zh"] ?? COMPANY.address.zh,
    copyright: COMPANY.copyright[locale as "zh"] ?? COMPANY.copyright.zh,
    phone: COMPANY.phone,
    email: COMPANY.email,
    icp: COMPANY.icp,
    website: COMPANY.website,
  };
}
