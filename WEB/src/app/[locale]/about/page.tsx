import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Section } from "@/components/section";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "aboutPage" });
  return { title: t("title"), description: t("introBody") };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("aboutPage");
  const qualityStages = t.raw("qualityStages") as {
    stage: string;
    time: string;
    promise: string;
  }[];
  const history = t.raw("history") as {
    year: string;
    title: string;
    body: string;
  }[];

  return (
    <>
      <Section variant="page-head" title={t("title")} lead={t("lead")} />

      <Section num="01" title={t("introTitle")} tone="warm">
        <p className="max-w-4xl text-base sm:text-lg leading-relaxed text-text-light">{t("introBody")}</p>
      </Section>

      <Section num="02" title={t("techTitle")} tone="bg">
        <p className="max-w-4xl text-base sm:text-lg leading-relaxed text-text-light">{t("techBody")}</p>
      </Section>

      <Section num="03" title={t("qualityTitle")} tone="warm">
        <div className="overflow-x-auto border border-border bg-white">
          <table className="w-full min-w-[540px] border-collapse text-left text-sm">
            <caption className="sr-only">{t("qualityTableCaption")}</caption>
            <thead>
              <tr className="border-b border-border text-xs tracking-wider text-text-muted">
                <th scope="col" className="px-5 py-3 font-semibold">
                  {t("qualityStage")}
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  {t("qualityTime")}
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  {t("qualityPromise")}
                </th>
              </tr>
            </thead>
            <tbody>
              {qualityStages.map((row) => (
                <tr key={row.stage} className="border-b border-border/70 last:border-0 hover:bg-bg-warm/60">
                  <th scope="row" className="px-5 py-4 font-bold whitespace-nowrap text-ink">
                    {row.stage}
                  </th>
                  <td className="px-5 py-4 whitespace-nowrap text-text-light">{row.time}</td>
                  <td className="px-5 py-4 text-text-light leading-relaxed">{row.promise}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section num="04" title={t("certTitle")} tone="bg">
        <div className="max-w-4xl border border-border bg-white p-8 sm:p-10">
          <p className="text-base sm:text-lg leading-relaxed text-text-light">{t("certBody")}</p>
        </div>
      </Section>

      <Section num="05" title={t("teamTitle")} tone="warm">
        <p className="max-w-4xl text-base sm:text-lg leading-relaxed text-text-light">{t("teamBody")}</p>
      </Section>

      <Section num="06" title={t("historyTitle")} tone="bg">
        <ul className="divide-y divide-border">
          {history.map((item) => (
            <li
              key={item.year}
              className="grid gap-2 py-8 sm:grid-cols-[140px_minmax(0,220px)_1fr] sm:items-baseline sm:gap-8"
            >
              <span className="text-sm font-semibold tracking-wider text-primary-dark">
                {item.year}
                {t("yearSuffix")}
              </span>
              <h3 className="text-xl font-bold text-ink">{item.title}</h3>
              <p className="text-sm sm:text-base leading-relaxed text-text-light">{item.body}</p>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
