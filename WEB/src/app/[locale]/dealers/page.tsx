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
      <Section variant="page-head" title={t("title")} lead={t("lead")} />

      <Section num="01" title={t("reasonsTitle")} tone="bg">
        <ul className="grid gap-px border border-border bg-border sm:grid-cols-2">
          {reasons.map((item, idx) => (
            <li key={item.title} className="bg-white p-8">
              <span className="text-sm font-semibold tracking-[0.2em] text-primary-dark">
                {t("reasonLabel", { num: String(idx + 1).padStart(2, "0") })}
              </span>
              <h3 className="mt-4 text-xl font-bold text-ink">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-text-light sm:text-base">{item.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section num="02" title={t("stepsTitle")} tone="warm">
        <ol className="grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((item) => (
            <li key={item.step} className="flex flex-col bg-white p-7">
              <span className="font-mono text-lg font-bold text-primary-dark">{item.step}</span>
              <h3 className="mt-3 text-base font-bold text-ink">{item.title}</h3>
              <p className="mt-2 flex-1 text-xs leading-relaxed text-text-light sm:text-sm">{item.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-sm text-text-muted">{t("stepsNote")}</p>
      </Section>

      <Section num="03" title={t("formTitle")} lead={t("formLead")} tone="bg">
        <div className="max-w-2xl border border-border bg-white p-8 sm:p-10">
          <LeadForm type="dealer" defaultInquiryType="经销商加盟" />
        </div>
      </Section>
    </>
  );
}
