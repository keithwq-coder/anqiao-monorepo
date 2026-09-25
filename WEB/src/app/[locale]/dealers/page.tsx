import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Section } from "@/components/section";
import { LeadForm } from "@/components/lead-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dealersPage" });
  return { title: t("title"), description: t("lead") };
}



export default async function DealersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dealersPage");
  const reasons = t.raw("reasons") as { title: string; body: string }[];
  const steps = t.raw("steps") as { step: string; title: string; body: string }[];
  return (
    <>
      <section className="bg-primary-light py-14">
        <div className="container-page">
          <h1 className="text-3xl font-semibold text-text">{t("title")}</h1>
          <p className="mt-4 max-w-3xl text-text-light">{t("lead")}</p>
        </div>
      </section>

      <Section title={t("reasonsTitle")} tone="bg">
        <ul className="grid gap-5 sm:grid-cols-2">
          {reasons.map((item) => (
            <li
              key={item.title}
              className="rounded-lg border border-border bg-white p-6"
            >
              <h3 className="text-lg font-semibold text-text">{item.title}</h3>
              <p className="mt-3 text-text-light">{item.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t("stepsTitle")} tone="warm">
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((item) => (
            <li
              key={item.step}
              className="rounded-lg border border-border bg-white p-6"
            >
              <p className="text-sm font-medium text-primary">{item.step}</p>
              <h3 className="mt-2 text-lg font-semibold text-text">
                {item.title}
              </h3>
              <p className="mt-2 text-text-light">{item.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-text-light">{t("stepsNote")}</p>
      </Section>

      <Section title={t("formTitle")} lead={t("formLead")} tone="bg">
        <div className="max-w-2xl">
          <LeadForm type="dealer" defaultInquiryType="经销商加盟" />
        </div>
      </Section>
    </>
  );
}
