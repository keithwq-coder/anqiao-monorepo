"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const NAMES: Record<(typeof routing.locales)[number], string> = {
  zh: "中文",
  en: "English",
  fr: "Français",
  es: "Español",
  ja: "日本語",
  ru: "Русский",
};

/** 语言切换器：下拉菜单，保留当前页路径切换。 */
export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    router.replace(pathname, { locale: event.target.value });
  }

  return (
    <select
      value={locale}
      onChange={onChange}
      aria-label="切换语言"
      className="focus-ring cursor-pointer rounded-md border border-border bg-white px-2 py-1.5 text-sm text-text transition-colors hover:bg-bg-warm"
    >
      {routing.locales.map((l) => (
        <option key={l} value={l}>
          {NAMES[l]}
        </option>
      ))}
    </select>
  );
}
