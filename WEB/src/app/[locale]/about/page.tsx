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
      <section className="bg-primary-light py-14">
        <div className="container-page">
          <h1 className="text-3xl font-semibold text-text">{t("title")}</h1>
          <p className="mt-4 text-text-light">{t("lead")}</p>
        </div>
      </section>

      <Section title={t("introTitle")} tone="bg">
        <p className="max-w-4xl text-text-light">{t("introBody")}</p>
      </Section>

      <Section title={t("techTitle")} tone="warm">
        <p className="max-w-4xl text-text-light">{t("techBody")}</p>
      </Section>

      <Section title={t("qualityTitle")} tone="bg">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left">
            <caption className="sr-only">{t("qualityTableCaption")}</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-3 pr-4 font-semibold text-text">
                  {t("qualityStage")}
                </th>
                <th scope="col" className="py-3 pr-4 font-semibold text-text">
                  {t("qualityTime")}
                </th>
                <th scope="col" className="py-3 font-semibold text-text">
                  {t("qualityPromise")}
                </th>
              </tr>
            </thead>
            <tbody>
              {qualityStages.map((row) => (
                <tr key={row.stage} className="border-b border-border">
                  <th scope="row" className="py-3 pr-4 font-medium text-text">
                    {row.stage}
                  </th>
                  <td className="py-3 pr-4 text-text-light">{row.time}</td>
                  <td className="py-3 text-text-light">{row.promise}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={t("certTitle")} tone="warm">
        <p className="text-text-light">{t("certBody")}</p>
      </Section>

      <Section title={t("teamTitle")} tone="bg">
        <p className="max-w-4xl text-text-light">{t("teamBody")}</p>
      </Section>

      <Section title={t("historyTitle")} tone="warm">
        <ol className="space-y-5">
          {history.map((item) => (
            <li
              key={item.year}
              className="rounded-lg border border-border bg-white p-5"
            >
              <p className="text-sm font-medium text-primary">{item.year}</p>
              <h3 className="mt-1 text-lg font-semibold text-text">
                {item.title}
              </h3>
              <p className="mt-2 text-text-light">{item.body}</p>
            </li>
          ))}
        </ol>
      </Section>
    </>
  );
}
