import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["zh", "en", "fr", "es", "ja", "ru"],
  defaultLocale: "zh",
});

export type Locale = (typeof routing.locales)[number];
