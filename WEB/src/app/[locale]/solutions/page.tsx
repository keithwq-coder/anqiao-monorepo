import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CtaLink } from "@/components/cta";
import { Section } from "@/components/section";
import { localizeSolution, solutions } from "@/data/solutions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "solutionsPage" });
  return { title: t("title"), description: t("lead") };
}

export default async function SolutionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("solutionsPage");
  const loc = locale as "zh" | "en" | "fr" | "es" | "ja" | "ru";
  const localized = solutions.map((item) => localizeSolution(item, loc));

  return (
    <>
      <Section variant="page-head" title={t("title")} lead={t("lead")}>
        <nav aria-label={t("navAria")} className="mt-8">
          <ul className="flex flex-wrap gap-2.5">
            {localized.map((s) => (
              <li key={s.anchor}>
                <a
                  href={`#${s.anchor}`}
                  className="focus-ring inline-flex items-center border border-border bg-white px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-primary-dark hover:text-primary-dark"
                >
                  {s.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </Section>

      {localized.map((s, index) => (
        <section
          key={s.anchor}
          id={s.anchor}
          className={`scroll-mt-20 border-b border-border last:border-0 py-20 sm:py-28 ${index % 2 === 0 ? "bg-paper" : "bg-white"}`}
        >
          <div className="container-page">
            <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold tracking-[0.2em] text-primary-dark">
                  {t("scenarioLabel", { num: String(index + 1).padStart(2, "0") })}
                </p>
                <h2
                  className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl lg:text-4xl"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {s.name}
                </h2>
              </div>
              <div className="self-start border border-border bg-white px-4 py-2 text-xs sm:text-sm">
                <span className="font-bold text-text-muted">{t("buyer")}：</span>
                <span className="font-medium text-ink">{s.buyer}</span>
              </div>
            </div>

            <div className="mt-10 grid gap-px border border-border bg-border md:grid-cols-3">
              <div className="flex flex-col bg-white p-7">
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-text-muted">
                  {t("painPoints")}
                </h3>
                <ul className="mt-5 flex-1 space-y-3">
                  {s.painPoints.map((point) => (
                    <li key={point} className="flex gap-2.5 text-xs leading-relaxed text-text-light sm:text-sm">
                      <span aria-hidden="true" className="mt-0.5 font-bold text-primary-dark">
                        ·
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col bg-white p-7">
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-text-muted">
                  {t("devices")}
                </h3>
                <div className="mt-5 flex-1 text-xs leading-relaxed text-text-light sm:text-sm">
                  {s.devices ? (
                    <p>{s.devices}</p>
                  ) : (
                    <p className="border border-border bg-paper p-4 text-text-muted">{t("devicesConsult")}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col bg-primary-light p-7">
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-primary-dark">
                  {t("value")}
                </h3>
                <div className="mt-5 flex-1 text-xs font-medium leading-relaxed text-ink sm:text-sm">
                  {s.value ? (
                    <p>{s.value}</p>
                  ) : (
                    <p className="border border-border bg-white p-4 text-text-muted">{t("valueConsult")}</p>
                  )}
                </div>
              </div>
            </div>

            {s.application ? (
              <div className="mt-8 border border-border bg-white p-7">
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-text-muted">
                  {t("applicationTitle")}
                </h3>
                <p className="mt-3 text-xs leading-relaxed text-text-light sm:text-sm">{s.application}</p>
              </div>
            ) : null}

            <div className="mt-10 flex items-center">
              <CtaLink href="/contact">{t("quote")}</CtaLink>
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
