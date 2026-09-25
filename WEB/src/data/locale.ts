/**
 * 多语言数据层基础设施（REBUILD 阶段 3）。
 * L<T> = 六语言记录；l() 取指定语言值，缺省回退 zh。
 */

export const LOCALES = ["zh", "en", "fr", "es", "ja", "ru"] as const;
export type Locale = (typeof LOCALES)[number];
export type L<T> = Record<Locale, T>;

export const DEFAULT_LOCALE: Locale = "zh";

export function l<T>(v: L<T>, locale: Locale): T {
  return v[locale] ?? v[DEFAULT_LOCALE];
}

/** 机器翻译语言（fr/es/ja/ru），用于页脚提示。 */
export const MACHINE_TRANSLATED: ReadonlySet<Locale> = new Set([
  "fr",
  "es",
  "ja",
  "ru",
]);
