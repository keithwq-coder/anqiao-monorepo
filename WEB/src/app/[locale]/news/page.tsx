import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Section } from "@/components/section";
import { isPending } from "@/data/pending";
import { localizeNews, news } from "@/data/news";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "newsPage" });
  return { title: t("title"), description: t("description") };
}

export default async function NewsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("newsPage");
  return (
    <>
      <Section variant="page-head" title={t("title")} lead={t("description")} />

      <Section tone="bg">
        <ul className="max-w-4xl divide-y divide-border border-y border-border">
          {news.map((item) => localizeNews(item, locale as "zh" | "en" | "fr" | "es" | "ja" | "ru")).map((item) => (
            <li key={item.slug}>
              <Link
                href={`/news/${item.slug}`}
                className="focus-ring group grid gap-2 py-8 sm:grid-cols-[120px_1fr_auto] sm:items-baseline sm:gap-8"
              >
                {item.date && !isPending(item.date) ? (
                  <span className="font-mono text-xs font-semibold tracking-wider text-text-muted">
                    {item.date}
                  </span>
                ) : (
                  <span className="hidden sm:block" />
                )}
                <span>
                  <h2 className="text-xl font-bold leading-snug text-ink transition-colors group-hover:text-primary-dark">
                    {item.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-text-light sm:text-base">{item.summary}</p>
                </span>
                <span className="text-sm font-semibold text-primary-dark underline decoration-primary-dark/40 decoration-2 underline-offset-8 group-hover:decoration-primary-dark">
                  {t("readMore")} <span aria-hidden="true">→</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
