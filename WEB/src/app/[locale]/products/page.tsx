import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Section } from "@/components/section";
import { ProductsFilter } from "@/components/products-filter";
import { localizeProduct, products } from "@/data/products";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "productsPage" });
  return { title: t("title"), description: t("lead") };
}

export default async function ProductsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("productsPage");
  return (
    <>
      <Section
        variant="page-head"
        title={t("title")}
        lead={t("lead")}
      />
      <Section tone="bg">
        <ProductsFilter products={products.map((p) => localizeProduct(p, locale as "zh" | "en" | "fr" | "es" | "ja" | "ru"))} />
      </Section>
    </>
  );
}
