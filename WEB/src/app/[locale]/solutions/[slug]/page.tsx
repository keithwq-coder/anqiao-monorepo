import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { CtaLink } from "@/components/cta";
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
  const t = await getTranslations({ locale, namespace: "notFound" });
  const solution = getLocalizedSolution(
    slug,
    locale as "zh" | "en" | "fr" | "es" | "ja" | "ru",
  );
  if (!solution) return { title: t("solution") };
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
      <Section
        variant="page-head"
        title={solution.name}
        lead={`${t("buyer")}：${solution.buyer}`}
      >
        <p className="text-sm">
          <Link
            href="/solutions"
            className="focus-ring text-sm font-semibold text-primary-dark underline decoration-primary-dark/40 decoration-2 underline-offset-8 hover:decoration-primary-dark"
          >
            ← {t("back")}
          </Link>
        </p>
      </Section>

      <Section num="01" title={t("painPoints")} tone="warm">
        <ul className="grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {solution.painPoints.map((point) => (
            <li
              key={point}
              className="bg-white p-7 text-xs leading-relaxed text-text-light sm:text-sm"
            >
              <span className="mr-1.5 font-bold text-primary-dark">·</span>
              {point}
            </li>
          ))}
        </ul>
      </Section>

      <Section num="02" title={t("devices")} tone="bg">
        <div className="max-w-4xl border border-border bg-white p-8 sm:p-10">
          <p className="mb-4 font-mono text-xs font-bold uppercase tracking-wider text-primary-dark">
            {t("devicesLabel")} // {t("flagship")}
          </p>
          {solution.devices ? (
            <p className="text-base font-medium leading-relaxed text-ink sm:text-lg">{solution.devices}</p>
          ) : (
            <p className="text-sm leading-relaxed text-text-muted sm:text-base">{t("devicesConsult")}</p>
          )}
          <div className="mt-8">
            <CtaLink href="/products" variant="secondary">
              {t("browseProducts")}
            </CtaLink>
          </div>
        </div>
      </Section>

      <Section num="03" title={t("value")} tone="warm">
        <div className="max-w-4xl border border-primary/30 bg-primary-light p-8 sm:p-10">
          {solution.value ? (
            <p className="text-base font-semibold leading-relaxed text-ink sm:text-lg">{solution.value}</p>
          ) : (
            <p className="text-sm leading-relaxed text-text-muted sm:text-base">{t("valueConsult")}</p>
          )}
        </div>
      </Section>

      {solution.application ? (
        <Section num="04" title={t("applicationTitle")} tone="bg">
          <div className="max-w-4xl border border-border bg-white p-8 sm:p-10">
            <p className="text-sm leading-relaxed text-text-light sm:text-base">{solution.application}</p>
          </div>
        </Section>
      ) : null}

      <Section tone="bg">
        <div className="border border-border bg-paper p-10 sm:p-14">
          <h2
            className="text-2xl font-bold text-ink sm:text-3xl"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {solution.name}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-text-light sm:text-lg">{solution.value ?? solution.buyer}</p>
          <div className="mt-8 flex">
            <CtaLink href="/contact">{t("quote")}</CtaLink>
          </div>
        </div>
      </Section>
    </>
  );
}
