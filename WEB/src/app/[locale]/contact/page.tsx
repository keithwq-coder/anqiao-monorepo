import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
import { LeadForm } from "@/components/lead-form";
import { Pending } from "@/components/pending";
import { Section } from "@/components/section";
import { localizeCompany } from "@/data/company";
import { isPending } from "@/data/pending";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contactPage" });
  return { title: t("title"), description: t("description") };
}

export default async function ContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ product?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("contactPage");
  const { product } = await searchParams;
  const c = localizeCompany(locale as "zh" | "en" | "fr" | "es" | "ja" | "ru");

  return (
    <>
      <Section variant="page-head" title={t("title")} lead={t("description")} />

      <Section tone="bg">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="border border-border bg-white p-8 sm:p-10 lg:col-span-5">
            <p className="text-sm font-semibold tracking-[0.2em] text-primary-dark">{t("directChannels")}</p>
            <h2 className="mt-4 text-xl font-bold text-ink">{t("infoTitle")}</h2>
            <dl className="mt-6 space-y-6">
              <div>
                <dt className="font-mono text-xs uppercase tracking-wider text-text-muted">{t("fullName")}</dt>
                <dd className="mt-1 text-sm font-semibold text-ink sm:text-base">{c.fullName}</dd>
              </div>
              <div>
                <dt className="font-mono text-xs uppercase tracking-wider text-text-muted">{t("address")}</dt>
                <dd className="mt-1 text-sm text-text-light sm:text-base">{c.address}</dd>
              </div>
              <div>
                <dt className="font-mono text-xs uppercase tracking-wider text-text-muted">{t("phone")}</dt>
                <dd className="mt-1 text-base sm:text-lg">
                  {isPending(c.phone) ? (
                    <Pending label={t("phone")} />
                  ) : (
                    <a href={`tel:${c.phone}`} className="font-bold text-ink transition-colors hover:text-primary-dark">
                      {c.phone}
                    </a>
                  )}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-xs uppercase tracking-wider text-text-muted">{t("email")}</dt>
                <dd className="mt-1 text-sm sm:text-base">
                  {isPending(c.email) ? (
                    <Pending label={t("email")} />
                  ) : (
                    <a href={`mailto:${c.email}`} className="font-semibold text-ink transition-colors hover:text-primary-dark">
                      {c.email}
                    </a>
                  )}
                </dd>
              </div>
            </dl>

            <h2 className="mt-10 border-t border-border pt-8 text-base font-bold text-ink">{t("followTitle")}</h2>
            <div className="mt-4 inline-block border border-border bg-paper p-3">
              <Image
                src="/images/brand/qr.webp"
                alt="中科安樵微信公众号二维码"
                width={422}
                height={423}
                className="h-36 w-36 object-contain"
              />
            </div>
            <p className="mt-2 text-xs text-text-muted">{t("followNote")}</p>
          </div>

          <div className="border border-border bg-white p-8 sm:p-10 lg:col-span-7">
            <p className="text-sm font-semibold tracking-[0.2em] text-primary-dark">{t("inquiryCta")}</p>
            <h2 className="mt-4 text-xl font-bold text-ink">{t("inquiryTitle")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-text-light">{t("inquiryLead")}</p>
            <div className="mt-8">
              <LeadForm type="inquiry" defaultProduct={product ?? ""} />
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
