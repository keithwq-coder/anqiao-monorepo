"use client";

import { useTranslations } from "next-intl";

/**
 * 待填占位符的可见渲染。SPEC §8.1：必须视觉可辨，不得渲染成空白或隐藏。
 * @param label 字段用途，如「技术参数」「推荐设备组合」
 */
export function Pending({ label }: { label: string }) {
  const t = useTranslations("common");
  return (
    <div
      className="border border-dashed bg-[#F5F5F3] px-4 py-3 text-text-light"
      style={{ borderColor: "#C9C9C4", borderWidth: "1px" }}
    >
      <span className="font-medium">{t("pending")}</span>
      <span className="ml-1 text-sm text-text-light">：{label}</span>
    </div>
  );
}
