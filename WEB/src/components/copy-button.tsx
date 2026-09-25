"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/** 复制场景图片提示词（文生图 ChatGPT 用）。 */
export function CopyButton({ text }: { text: string }) {
  const t = useTranslations("solutionsPage");
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 剪贴板不可用时降级：提示
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="focus-ring inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
    >
      {copied ? t("copied") : t("copy")}
    </button>
  );
}