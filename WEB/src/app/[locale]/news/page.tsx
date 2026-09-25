import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Section } from "@/components/section";
import { Pending } from "@/components/pending";
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
    <Section title={t("title")} tone="bg">
      <ul className="space-y-5">
        {news.map((item) => localizeNews(item, locale as "zh" | "en" | "fr" | "es" | "ja" | "ru")).map((item) => (
          <li key={item.slug}>
            <Link
              href={`/news/${item.slug}`}
              className="focus-ring block rounded-lg border border-border bg-white p-6 transition-shadow hover:shadow-md"
            >
              {isPending(item.date) ? (
                <Pending label={t("date")} />
              ) : (
                <p className="text-sm text-text-muted">{item.date}</p>
              )}
              <h2 className="mt-2 text-xl font-semibold text-text">
                {item.title}
              </h2>
              <p className="mt-3 text-text-light">{item.summary}</p>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
