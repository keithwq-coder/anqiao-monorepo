import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { Section } from "@/components/section";
import { isPending } from "@/data/pending";
import { getLocalizedNews, news } from "@/data/news";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    news.map((item) => ({ locale, slug: item.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "notFound" });
  const item = getLocalizedNews(slug, locale as "zh" | "en" | "fr" | "es" | "ja" | "ru");
  if (!item) return { title: `${t("news")} | 中科安樵` };
  return { title: `${item.title} | 中科安樵`, description: item.summary };
}

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("newsPage");
  const item = getLocalizedNews(slug, locale as "zh" | "en" | "fr" | "es" | "ja" | "ru");
  if (!item) notFound();

  return (
    <Section tone="bg">
      <article className="mx-auto max-w-3xl border border-border bg-white p-8 sm:p-14">
        <div className="border-b border-border pb-8">
          {item.date && !isPending(item.date) ? (
            <span className="font-mono text-xs font-semibold tracking-wider text-text-muted">
              {item.date}
            </span>
          ) : null}
          <h1
            className="mt-4 text-2xl font-bold leading-snug tracking-tight text-ink sm:text-3xl lg:text-4xl"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {item.title}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-text-light sm:text-lg">
            {item.summary}
          </p>
        </div>

        <div className="mt-10">
          {item.body && !isPending(item.body) ? (
            <div className="whitespace-pre-line text-base leading-relaxed text-ink sm:text-lg">
              {item.body}
            </div>
          ) : (
            <p className="border border-border bg-paper p-5 text-sm text-text-muted">{t("unpublished")}</p>
          )}
        </div>

        <div className="mt-12 border-t border-border pt-8">
          <Link
            href="/news"
            className="focus-ring text-sm font-semibold text-primary-dark underline decoration-primary-dark/40 decoration-2 underline-offset-8 hover:decoration-primary-dark"
          >
            ← {t("back")}
          </Link>
        </div>
      </article>
    </Section>
  );
}
