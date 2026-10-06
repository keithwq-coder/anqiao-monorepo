import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { LeadForm } from "@/components/lead-form";
import { SignalWaveform } from "@/components/signal-waveform";
import { localizeProduct, primaryImage, products } from "@/data/products";
import { localizeSolution, solutions } from "@/data/solutions";

type Principle = { title: string; body: string };
type DealerPolicy = { term: string; detail: string };

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const currentLocale = locale as "zh" | "en" | "fr" | "es" | "ja" | "ru";
  setRequestLocale(locale);

  const t = await getTranslations("home");
  const principles = t.raw("principles") as Principle[];
  const dealerPolicies = t.raw("dealerPolicies") as DealerPolicy[];

  const featured = localizeProduct(products[0], currentLocale);
  const featuredImage = featured ? primaryImage(featured) : undefined;
  const catalog = products
    .filter((p) => !p.isPlatform)
    .map((p) => localizeProduct(p, currentLocale));
  const platformProduct = products.find((p) => p.isPlatform);
  const platformLine = platformProduct
    ? localizeProduct(platformProduct, currentLocale)
    : undefined;

  const allLocalizedSolutions = solutions.map((s) =>
    localizeSolution(s, currentLocale),
  );

  return (
    <div className="bg-paper text-ink selection:bg-primary-light selection:text-primary-dark">
      {/* ================= 首屏：立场 + 感知信号 ================= */}
      <section className="border-b border-border bg-paper">
        <div className="container-page py-16 sm:py-24 lg:py-32">
          <p className="text-sm font-semibold tracking-[0.2em] text-primary-dark">
            {t("heroKicker")}
          </p>
          <h1
            className="mt-6 max-w-4xl text-4xl leading-[1.25] font-bold tracking-tight sm:text-5xl lg:text-[56px]"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {t("heroTitle")}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-text-light sm:text-lg">
            {t("heroLead")}
          </p>

          <SignalWaveform
            className="mt-12 max-w-4xl border border-border bg-white p-6 sm:p-8"
            labels={[t("sigBreath"), t("sigMove"), t("sigExit")]}
          />

          <div className="mt-12 flex flex-col gap-6 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/products"
              className="focus-ring inline-flex items-center gap-2 text-base font-bold text-primary-dark underline decoration-primary-dark/40 decoration-2 underline-offset-8 hover:decoration-primary-dark"
            >
              {t("heroCta")}
              <span aria-hidden="true">→</span>
            </Link>
            <p className="text-sm text-text-muted">{t("heroAffiliation")}</p>
          </div>
        </div>
      </section>

      {/* ================= 01 / 技术原理 ================= */}
      <section className="border-b border-border bg-white py-20 sm:py-28">
        <div className="container-page">
          <header className="border-b border-border pb-6">
            <p className="text-sm font-semibold tracking-[0.2em] text-primary-dark">
              01
            </p>
            <h2
              className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {t("principlesTitle")}
            </h2>
          </header>
          <div className="mt-10 grid gap-10 lg:grid-cols-3 lg:gap-12">
            {principles.map((item, idx) => (
              <div key={item.title}>
                <p className="text-xs font-semibold text-text-muted">
                  01.{idx + 1}
                </p>
                <h3 className="mt-3 text-xl font-bold text-ink">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-text-light">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= 02 / 主打产品 + 全系列规格速览 ================= */}
      <section className="border-b border-border bg-paper py-20 sm:py-28">
        <div className="container-page">
          <header className="border-b border-border pb-6">
            <p className="text-sm font-semibold tracking-[0.2em] text-primary-dark">
              02
            </p>
            <h2
              className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {t("featuredTitle")}
            </h2>
          </header>

          {featured && featuredImage && (
            <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:gap-16">
              <div className="border border-border bg-white p-6">
                <Image
                  src={featuredImage.src}
                  alt={featuredImage.alt}
                  width={featuredImage.width}
                  height={featuredImage.height}
                  priority
                  className="h-auto w-full"
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-primary-dark">
                  {featured.model ?? featured.name}
                </p>
                <h3 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">
                  {featured.officialName ?? featured.name}
                </h3>
                <p className="mt-4 text-base leading-relaxed text-text-light">
                  {featured.tagline}
                </p>
                <dl className="mt-8 border-t border-border">
                  {featured.features.slice(0, 3).map((f, i) => (
                    <div
                      key={f}
                      className="grid grid-cols-[auto_1fr] gap-4 border-b border-border py-3 text-sm"
                    >
                      <dt className="font-semibold text-text-muted">0{i + 1}</dt>
                      <dd className="text-ink">{f}</dd>
                    </div>
                  ))}
                </dl>
                <Link
                  href={`/products/${featured.slug}`}
                  className="focus-ring mt-8 inline-flex items-center gap-2 text-base font-bold text-primary-dark underline decoration-primary-dark/40 decoration-2 underline-offset-8 hover:decoration-primary-dark"
                >
                  {t("featuredCta")}
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          )}

          <h3 className="mt-20 text-xl font-bold text-ink">
            {t("specTableTitle")}
          </h3>
          <div className="mt-6 overflow-x-auto border border-border bg-white">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs tracking-wider text-text-muted">
                  <th className="px-5 py-3 font-semibold">{t("colModel")}</th>
                  <th className="px-5 py-3 font-semibold">{t("colPosition")}</th>
                  <th className="px-5 py-3 font-semibold">{t("colFeature")}</th>
                  <th className="px-5 py-3 font-semibold">{t("colWarranty")}</th>
                </tr>
              </thead>
              <tbody>
                {catalog.map((p) => (
                  <tr
                    key={p.slug}
                    className="border-b border-border/70 last:border-0 hover:bg-bg-warm/60"
                  >
                    <td className="px-5 py-3 font-semibold whitespace-nowrap text-primary-dark">
                      {p.model ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/products/${p.slug}`}
                        className="focus-ring font-semibold text-ink underline decoration-transparent underline-offset-4 hover:decoration-primary-dark"
                      >
                        {p.name}
                      </Link>
                      <span className="block text-xs text-text-muted">
                        {p.tagline}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-text-light">
                      {p.features[0]}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-text-light">
                      {p.warranty}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {platformLine && (
            <p className="mt-4 text-sm text-text-light">
              <Link
                href={`/products/${platformLine.slug}`}
                className="focus-ring font-semibold text-primary-dark underline decoration-primary-dark/40 underline-offset-4 hover:decoration-primary-dark"
              >
                {platformLine.name}
              </Link>
              {" — "}
              {platformLine.tagline}
            </p>
          )}
        </div>
      </section>

      {/* ================= 03 / 面向谁 ================= */}
      <section className="border-b border-border bg-white py-20 sm:py-28">
        <div className="container-page">
          <header className="border-b border-border pb-6">
            <p className="text-sm font-semibold tracking-[0.2em] text-primary-dark">
              03
            </p>
            <h2
              className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {t("scenariosTitle")}
            </h2>
          </header>
          <ul className="mt-2 divide-y divide-border">
            {allLocalizedSolutions.map((item, idx) => (
              <li key={item.anchor}>
                <Link
                  href={`/solutions#${item.anchor}`}
                  className="focus-ring group grid gap-2 py-6 sm:grid-cols-[64px_1fr_1fr_auto] sm:items-baseline sm:gap-8"
                >
                  <span className="text-sm font-semibold text-text-muted">
                    03.{idx + 1}
                  </span>
                  <span>
                    <span className="text-lg font-bold text-ink group-hover:text-primary-dark">
                      {item.name}
                    </span>
                    <span className="mt-1 block text-xs text-text-muted">
                      {t("buyerLabel")}
                      {item.buyer}
                    </span>
                  </span>
                  <span className="text-sm leading-relaxed text-text-light">
                    {(Array.isArray(item.painPoints)
                      ? item.painPoints
                      : [item.painPoints]
                    )[0] ?? item.value ?? ""}
                  </span>
                  <span
                    className="text-primary-dark transition-transform group-hover:translate-x-1.5"
                    aria-hidden="true"
                  >
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ================= 04 / 试点与示范 ================= */}
      <section className="border-b border-border bg-paper py-20 sm:py-28">
        <div className="container-page">
          <header className="border-b border-border pb-6">
            <p className="text-sm font-semibold tracking-[0.2em] text-primary-dark">
              04
            </p>
            <h2
              className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {t("casesTitle")}
            </h2>
          </header>
          <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-16">
            <p className="text-base leading-relaxed text-text-light">
              {t("casesBody")}
            </p>
            <div className="flex flex-col justify-between border border-dashed border-border p-8">
              <p className="text-sm leading-relaxed text-text-muted">
                {t("casesNote")}
              </p>
              <Link
                href="/contact"
                className="focus-ring mt-6 inline-flex items-center gap-2 self-start text-base font-bold text-primary-dark underline decoration-primary-dark/40 decoration-2 underline-offset-8 hover:decoration-primary-dark"
              >
                {t("casesCta")}
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 05 / 招商政策 ================= */}
      <section className="border-b border-border bg-white py-20 sm:py-28">
        <div className="container-page">
          <header className="flex flex-col gap-6 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold tracking-[0.2em] text-primary-dark">
                05
              </p>
              <h2
                className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {t("dealerTitle")}
              </h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-text-light">
              {t("dealerLead")}
            </p>
          </header>
          <div className="mt-6 overflow-x-auto border border-border bg-white">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs tracking-wider text-text-muted">
                  <th className="px-5 py-3 font-semibold">{t("dealerColTerm")}</th>
                  <th className="px-5 py-3 font-semibold">{t("dealerColDetail")}</th>
                </tr>
              </thead>
              <tbody>
                {dealerPolicies.map((p) => (
                  <tr
                    key={p.term}
                    className="border-b border-border/70 last:border-0"
                  >
                    <td className="px-5 py-4 font-bold whitespace-nowrap text-ink">
                      {p.term}
                    </td>
                    <td className="px-5 py-4 leading-relaxed text-text-light">
                      {p.detail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link
            href="/dealers"
            className="focus-ring mt-8 inline-flex items-center gap-2 text-base font-bold text-primary-dark underline decoration-primary-dark/40 decoration-2 underline-offset-8 hover:decoration-primary-dark"
          >
            {t("dealerCta")}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      {/* ================= 06 / 联系 ================= */}
      <section className="bg-paper py-20 sm:py-28">
        <div className="container-page">
          <header className="border-b border-border pb-6">
            <p className="text-sm font-semibold tracking-[0.2em] text-primary-dark">
              06
            </p>
            <h2
              className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {t("contactTitle")}
            </h2>
          </header>
          <div className="mt-10 grid gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <p className="text-sm leading-relaxed text-text-light">
                {t("contactLead")}
              </p>
              <div className="mt-8 space-y-6 border-t border-border pt-8">
                <div>
                  <p className="text-xs font-semibold tracking-wider text-text-muted">
                    {t("contactPhoneLabel")}
                  </p>
                  <a
                    href="tel:13405084570"
                    className="focus-ring mt-1 block text-2xl font-bold text-primary-dark"
                  >
                    13405084570
                  </a>
                </div>
                <div>
                  <p className="text-xs font-semibold tracking-wider text-text-muted">
                    {t("contactMailLabel")}
                  </p>
                  <a
                    href="mailto:13405084570@139.com"
                    className="focus-ring mt-1 block font-semibold text-ink hover:text-primary-dark"
                  >
                    13405084570@139.com
                  </a>
                </div>
                <p className="text-xs leading-relaxed text-text-muted">
                  {t("contactAddr")}
                </p>
              </div>
            </div>
            <div className="border border-border bg-white p-6 sm:p-10 lg:col-span-8">
              <LeadForm type="inquiry" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
