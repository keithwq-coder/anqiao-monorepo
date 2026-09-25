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
    <Section title={t("title")} tone="bg">
      <div className="grid gap-12 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold text-text">{t("infoTitle")}</h2>
          <dl className="mt-5 space-y-5">
            <div>
              <dt className="text-sm text-text-light">{t("fullName")}</dt>
              <dd className="mt-1 text-text">{c.fullName}</dd>
            </div>
            <div>
              <dt className="text-sm text-text-light">{t("address")}</dt>
              <dd className="mt-1 text-text">{c.address}</dd>
            </div>
            <div>
              <dt className="text-sm text-text-light">{t("phone")}</dt>
              <dd className="mt-1">
                {isPending(c.phone) ? (
                  <Pending label={t("phone")} />
                ) : (
                  c.phone
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-text-light">{t("email")}</dt>
              <dd className="mt-1">
                {isPending(c.email) ? (
                  <Pending label={t("email")} />
                ) : (
                  c.email
                )}
              </dd>
            </div>
          </dl>

          <h2 className="mt-10 text-lg font-semibold text-text">{t("followTitle")}</h2>
          <Image
            src="/images/brand/qr.webp"
            alt="中科安樵微信公众号二维码"
            width={422}
            height={423}
            className="mt-4 h-40 w-40 rounded-md border border-border"
          />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-text">{t("inquiryTitle")}</h2>
          <p className="mt-2 text-text-light">{t("inquiryLead")}</p>
          <div className="mt-6">
            <LeadForm type="inquiry" defaultProduct={product ?? ""} />
          </div>
        </div>
      </div>
    </Section>
  );
}
