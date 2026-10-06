import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product/product-detail";
import { isPending } from "@/data/pending";
import { getLocalizedProduct, products } from "@/data/products";
import { routing } from "@/i18n/routing";
import { CANONICAL_ORIGIN } from "@/lib/site";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    products.map((product) => ({ locale, slug: product.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "notFound" });
  const product = getLocalizedProduct(slug, locale as "zh" | "en" | "fr" | "es" | "ja" | "ru");
  if (!product) return { title: `${t("product")} | 中科安樵` };
  return {
    title: `${product.name} | 中科安樵`,
    description: isPending(product.tagline)
      ? `${product.name} 产品信息。`
      : product.tagline,
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const product = getLocalizedProduct(slug, locale as "zh" | "en" | "fr" | "es" | "ja" | "ru");
  if (!product) notFound();

  const tn = await getTranslations({ locale, namespace: "nav" });
  const site = CANONICAL_ORIGIN;
  const productUrl = `${site}/${locale}/products/${product.slug}`;

  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.tagline,
    model: product.model ?? undefined,
    brand: { "@type": "Brand", name: "安守护" },
    image: product.images[0]?.src,
    additionalProperty: product.features.map((f, i) => ({
      "@type": "PropertyValue",
      name: `feature_${i + 1}`,
      value: f,
    })),
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "首页",
        item: `${site}/${locale}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: tn("products"),
        item: `${site}/${locale}/products`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: product.name,
        item: productUrl,
      },
    ],
  };

  const faqLd = product.faqs && product.faqs.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: product.faqs.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      }
    : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      {faqLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
        />
      ) : null}
      <ProductDetail product={product} />
    </>
  );
}
