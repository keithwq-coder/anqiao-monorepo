import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { Pending } from "@/components/pending";
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
      <article className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-semibold text-text">{item.title}</h1>

        <div className="mt-4">
          {isPending(item.date) ? (
            <Pending label={t("date")} />
          ) : (
            <p className="text-sm text-text-muted">{item.date}</p>
          )}
        </div>

        <p className="mt-6 text-lg text-text-light">{item.summary}</p>

        <h2 className="mt-10 text-lg font-semibold text-text">{t("body")}</h2>
        <div className="mt-3">
          {isPending(item.body) ? (
            <Pending label={t("body")} />
          ) : (
            <p className="whitespace-pre-line text-text-light">{item.body}</p>
          )}
        </div>

        <p className="mt-10">
          <Link href="/news" className="focus-ring rounded-md text-primary">
            {t("back")}
          </Link>
        </p>
      </article>
    </Section>
  );
}
