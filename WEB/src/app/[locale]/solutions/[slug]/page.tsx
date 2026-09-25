import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { CtaLink } from "@/components/cta";
import { Pending } from "@/components/pending";
import { Section } from "@/components/section";
import { getLocalizedSolution, solutions } from "@/data/solutions";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    solutions.map((solution) => ({ locale, slug: solution.anchor })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const solution = getLocalizedSolution(
    slug,
    locale as "zh" | "en" | "fr" | "es" | "ja" | "ru",
  );
  if (!solution) return { title: "方案未找到 | 中科安樵" };
  return {
    title: solution.name,
    description: solution.value ?? solution.buyer,
  };
}

export default async function SolutionDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("solutionsPage");
  const solution = getLocalizedSolution(
    slug,
    locale as "zh" | "en" | "fr" | "es" | "ja" | "ru",
  );
  if (!solution) notFound();

  return (
    <>
      <section className="bg-primary-light py-14">
        <div className="container-page">
          <p className="text-sm">
            <Link href="/solutions" className="focus-ring rounded-md text-primary">
              ← {t("back")}
            </Link>
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-text">
            {solution.name}
          </h1>
          <p className="mt-3 text-text-light">
            {t("buyer")}：{solution.buyer}
          </p>
        </div>
      </section>

      <Section title={t("painPoints")} tone="warm">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {solution.painPoints.map((point) => (
            <li
              key={point}
              className="rounded-lg border border-border bg-white p-5 text-text-light"
            >
              {point}
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t("devices")} tone="bg">
        <p className="mb-4 inline-block rounded-md bg-primary-light px-3 py-1.5 text-sm font-medium text-primary-dark">
          {t("flagship")}
        </p>
        {solution.devices ? (
          <p className="max-w-4xl text-text-light">{solution.devices}</p>
        ) : (
          <Pending label={`${solution.name} 推荐设备组合`} />
        )}
        <div className="mt-6">
          <CtaLink href="/products" variant="secondary">
            {t("browseProducts")}
          </CtaLink>
        </div>
      </Section>

      <Section title={t("value")} tone="warm">
        {solution.value ? (
          <p className="max-w-4xl text-text-light">{solution.value}</p>
        ) : (
          <Pending label={`${solution.name} 交付价值`} />
        )}
      </Section>

      <Section title={t("applicationTitle")} tone="bg">
        {solution.application ? (
          <p className="max-w-4xl text-text-light">{solution.application}</p>
        ) : (
          <Pending label={`${solution.name} 如何应用`} />
        )}
      </Section>

      <Section tone="bg">
        <div className="rounded-lg border border-border bg-white p-10 text-center">
          <h2 className="text-2xl font-semibold text-text">{solution.name}</h2>
          <p className="mt-3 text-text-light">{solution.value ?? solution.buyer}</p>
          <div className="mt-8 flex justify-center">
            <CtaLink href="/contact">{t("quote")}</CtaLink>
          </div>
        </div>
      </Section>
    </>
  );
}
