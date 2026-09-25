import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { CtaLink } from "@/components/cta";
import { Section } from "@/components/section";
import { ProductCard } from "@/components/product-card";
import { localizeNews, news } from "@/data/news";
import { localizeProduct, products } from "@/data/products";
import { localizeSolution, solutions } from "@/data/solutions";

type Advantage = { title: string; body: string };

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const currentLocale = locale as "zh" | "en" | "fr" | "es" | "ja" | "ru";
  setRequestLocale(locale);

  const t = await getTranslations("home");
  const advantages = t.raw("advantages") as Advantage[];

  const allLocalizedProducts = products.map((p) => localizeProduct(p, currentLocale));
  const sh100 = allLocalizedProducts.find((p) => p.slug === "zq-sh100");
  const d100 = allLocalizedProducts.find((p) => p.slug === "zq-d100");
  const expansionSlugs = ["zq-bh100", "zq-gj100", "za100", "platform"];
  const expansionProducts = allLocalizedProducts.filter((p) => expansionSlugs.includes(p.slug));

  const allLocalizedSolutions = solutions.map((s) => localizeSolution(s, currentLocale));
  const localizedNews = news.slice(0, 3).map((item) => localizeNews(item, currentLocale));

  return (
    <>
      {/* 1. 首屏 HERO：工业硬件实物 + 手机实时守护态势复合展示（消除假洋房与悬浮P图感） */}
      <section className="border-b border-border/80 bg-linear-to-b from-[#F3F8F6] via-[#F9FBFB] to-white">
        <div className="container-page grid items-center gap-12 py-16 lg:grid-cols-12 lg:py-24">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3.5 py-1 text-xs font-semibold text-primary">
              <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
              {t("heroBadge")}
            </div>
            <h1 className="mt-5 text-3xl font-bold tracking-tight text-text sm:text-4xl lg:text-5xl">
              {t("heroTitle")}
            </h1>
            <p className="mt-3 text-base font-semibold text-primary sm:text-lg">
              {t("heroTagline")}
            </p>
            <p className="mt-4 text-base leading-relaxed text-text-light sm:text-lg">
              {t("heroBody")}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <CtaLink href="/contact">{t("quote")}</CtaLink>
              <CtaLink href="/dealers" variant="secondary">
                {t("dealer")}
              </CtaLink>
            </div>

            {/* 核心保障要点微注 */}
            <div className="mt-8 grid grid-cols-3 gap-3 border-t border-border/70 pt-6 text-xs text-text-light sm:text-sm">
              <div className="flex items-center gap-1.5 font-medium">
                <span className="text-primary font-bold">✓</span> 纯微波探测
              </div>
              <div className="flex items-center gap-1.5 font-medium">
                <span className="text-primary font-bold">✓</span> 0 摄像头 0 录音
              </div>
              <div className="flex items-center gap-1.5 font-medium">
                <span className="text-primary font-bold">✓</span> 12 个月保修
              </div>
            </div>
          </div>

          {/* 右侧：实机三维质感 + 手机端实时守护看板复合卡片 */}
          <div className="lg:col-span-5">
            <div className="relative rounded-2xl border border-border bg-white p-5 shadow-lg shadow-primary/5">
              {/* 实机展示区 */}
              <div className="relative flex flex-col items-center justify-center rounded-xl bg-linear-to-b from-bg-warm/60 to-white p-6 border border-border/50">
                <div className="absolute top-3 left-3 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                  ZQ-SH100 · 60GHz
                </div>
                <div className="absolute top-3 right-3 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                  {t("heroPrivacyBadge")}
                </div>
                <Image
                  src="/images/products/zq-sh100/three-view.webp"
                  alt="ZQ-SH100 AI健康守护仪 实机展示"
                  width={500}
                  height={320}
                  priority
                  className="h-44 w-auto object-contain drop-shadow-sm transition-transform duration-300 hover:scale-105"
                />
              </div>

              {/* 手机端监护看板 Mockup */}
              <div className="mt-4 rounded-xl border border-border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                    </span>
                    <span className="text-xs font-semibold text-text">{t("heroLiveStatus")}</span>
                  </div>
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                    {t("heroLiveOnline")}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-bg-warm p-2">
                    <div className="text-[11px] text-text-muted">{t("heroVitalsRespiration")}</div>
                    <div className="mt-1 text-sm font-bold text-text">16 <span className="text-[10px] font-normal text-text-light">次/分</span></div>
                    <div className="text-[10px] font-medium text-emerald-600">正常平稳</div>
                  </div>
                  <div className="rounded-lg bg-bg-warm p-2">
                    <div className="text-[11px] text-text-muted">{t("heroVitalsHeartRate")}</div>
                    <div className="mt-1 text-sm font-bold text-text">68 <span className="text-[10px] font-normal text-text-light">bpm</span></div>
                    <div className="text-[10px] font-medium text-emerald-600">窦性节律</div>
                  </div>
                  <div className="rounded-lg bg-bg-warm p-2">
                    <div className="text-[11px] text-text-muted">在床状态</div>
                    <div className="mt-1 text-sm font-bold text-primary">{t("heroVitalsStatus")}</div>
                    <div className="text-[10px] text-text-muted">深睡 5.2h</div>
                  </div>
                </div>

                {/* 微信/短信实时告警推送 */}
                <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs">
                  <span className="text-base leading-none">🔔</span>
                  <div>
                    <div className="font-semibold text-primary">{t("heroAlertNotification")}</div>
                    <div className="mt-0.5 text-[11px] text-text-light leading-snug">{t("heroAlertText")}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. 四大商业与技术信赖基石（打破卡片疲劳，建立信赖底气） */}
      <section className="border-b border-border bg-white py-12">
        <div className="container-page">
          <h2 className="text-center text-xs font-bold uppercase tracking-widest text-text-muted">
            {t("advantagesTitle")}
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {advantages.map((item, idx) => (
              <div
                key={item.title}
                className="flex flex-col rounded-xl border border-border/80 bg-[#FAFAFA] p-5 transition-shadow hover:shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                    0{idx + 1}
                  </span>
                  <h3 className="font-semibold text-text">{item.title}</h3>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-text-light">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. 两大量产拳头产品（深剖旗舰，不搞全量无重点倒出） */}
      <Section
        title={t("flagshipTitle")}
        lead={t("flagshipSubtitle")}
        tone="warm"
      >
        <div className="grid gap-8 lg:grid-cols-2">
          {/* 旗舰 1：ZQ-SH100 */}
          {sh100 && (
            <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {t("flagshipBedTag")}
                </span>
                <span className="text-xs font-medium text-text-muted">{sh100.model}</span>
              </div>
              <h3 className="mt-3 text-2xl font-bold text-text">{t("flagshipBedTitle")}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-light">{t("flagshipBedDesc")}</p>

              <div className="my-6 flex justify-center rounded-xl bg-bg-warm p-4">
                <Image
                  src="/images/products/zq-sh100/three-view.webp"
                  alt={sh100.name}
                  width={400}
                  height={220}
                  className="h-44 w-auto object-contain"
                />
              </div>

              <ul className="space-y-2.5 text-xs text-text-light">
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">▸</span>
                  <span>{t("flagshipBedPoint1")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">▸</span>
                  <span>{t("flagshipBedPoint2")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">▸</span>
                  <span>{t("flagshipBedPoint3")}</span>
                </li>
              </ul>

              <div className="mt-6 pt-4 border-t border-border/60">
                <Link
                  href={`/products/${sh100.slug}`}
                  className="font-semibold text-primary hover:text-primary-dark text-sm inline-flex items-center gap-1"
                >
                  {t("viewProductDetail")} →
                </Link>
              </div>
            </div>
          )}

          {/* 旗舰 2：ZQ-D100 */}
          {d100 && (
            <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-700">
                  {t("flagshipFallTag")}
                </span>
                <span className="text-xs font-medium text-text-muted">{d100.model}</span>
              </div>
              <h3 className="mt-3 text-2xl font-bold text-text">{t("flagshipFallTitle")}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-light">{t("flagshipFallDesc")}</p>

              <div className="my-6 flex justify-center rounded-xl bg-bg-warm p-4">
                <Image
                  src="/images/products/zq-d100/three-view.webp"
                  alt={d100.name}
                  width={400}
                  height={220}
                  className="h-44 w-auto object-contain"
                />
              </div>

              <ul className="space-y-2.5 text-xs text-text-light">
                <li className="flex items-start gap-2">
                  <span className="text-rose-600 font-bold">▸</span>
                  <span>{t("flagshipFallPoint1")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-600 font-bold">▸</span>
                  <span>{t("flagshipFallPoint2")}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-600 font-bold">▸</span>
                  <span>{t("flagshipFallPoint3")}</span>
                </li>
              </ul>

              <div className="mt-6 pt-4 border-t border-border/60">
                <Link
                  href={`/products/${d100.slug}`}
                  className="font-semibold text-rose-700 hover:text-rose-800 text-sm inline-flex items-center gap-1"
                >
                  {t("viewProductDetail")} →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* 配套与拓展产品矩阵 */}
        <div className="mt-14">
          <div className="border-t border-border/80 pt-10">
            <h3 className="text-lg font-bold text-text">{t("matrixTitle")}</h3>
            <p className="mt-1 text-sm text-text-light">{t("matrixLead")}</p>
            <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {expansionProducts.map((product) => (
                <li key={product.slug}>
                  <ProductCard product={product} />
                </li>
              ))}
            </ul>
            <div className="mt-8 flex justify-center">
              <CtaLink href="/products" variant="secondary">
                {t("viewAllProducts")}
              </CtaLink>
            </div>
          </div>
        </div>
      </Section>

      {/* 4. 场景方案（带痛点直击与交付价值，拒绝冷冰冰的文本块） */}
      <Section title={t("solutionsTitle")} lead={t("solutionsLead")} tone="bg">
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {allLocalizedSolutions.map((item) => (
            <li key={item.anchor}>
              <Link
                href={`/solutions/${item.anchor}`}
                className="focus-ring group flex h-full flex-col rounded-xl border border-border bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    {item.name}
                  </span>
                  <span className="text-xs text-text-muted">{item.anchor}</span>
                </div>

                <p className="mt-3 text-xs text-text-muted leading-snug">
                  <strong className="text-text font-medium">适用主体：</strong>
                  {item.buyer}
                </p>

                <div className="mt-4 rounded-lg bg-bg-warm p-3 text-xs leading-relaxed text-text-light flex-1">
                  {item.painPoints ? (
                    <p className="line-clamp-3">{item.painPoints}</p>
                  ) : (
                    <p>{item.value}</p>
                  )}
                </div>

                <span className="mt-4 pt-3 border-t border-border/50 text-xs font-semibold text-primary group-hover:text-primary-dark inline-flex items-center gap-1">
                  {t("viewSolution")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* 5. 渠道招商赋能 Banner */}
      <section className="bg-primary text-white">
        <div className="container-page flex flex-col gap-6 py-12 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <h3 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              {t("dealerBanner")}
            </h3>
            <p className="mt-2 text-sm text-white/80">
              提供样机借测、区域价格与报备保护、完整招投标控标参数交底、12 个月规范保修支持。
            </p>
          </div>
          <CtaLink href="/dealers" variant="secondary" className="shrink-0 bg-white text-primary hover:bg-neutral-100">
            {t("dealerCta")}
          </CtaLink>
        </div>
      </section>

      {/* 6. 最新动态（日期规范真实，彻底消除「待填」草稿痕迹） */}
      <Section title={t("newsTitle")} lead={t("newsLead")} tone="warm">
        <ul className="grid gap-5 lg:grid-cols-3">
          {localizedNews.map((item) => (
            <li key={item.slug}>
              <Link
                href={`/news/${item.slug}`}
                className="focus-ring group flex h-full flex-col rounded-xl border border-border bg-white p-6 transition-shadow hover:shadow-md"
              >
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span className="rounded bg-bg-warm px-2 py-0.5 font-medium text-text-light">
                    {item.date}
                  </span>
                  <span className="text-primary font-medium group-hover:underline">阅读详情</span>
                </div>
                <h3 className="mt-3 text-base font-semibold leading-snug text-text group-hover:text-primary">
                  {item.title}
                </h3>
                <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-text-light">
                  {item.summary}
                </p>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex justify-center">
          <CtaLink href="/news" variant="secondary">
            {t("viewAllNews")}
          </CtaLink>
        </div>
      </Section>

      {/* 7. 底部咨询与报价 CTA */}
      <Section tone="bg">
        <div className="rounded-2xl border border-border bg-white p-10 text-center shadow-xs">
          <h2 className="text-2xl font-bold text-text sm:text-3xl">{t("ctaTitle")}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-text-light sm:text-base">
            {t("ctaBody")}
          </p>
          <div className="mt-8 flex justify-center">
            <CtaLink href="/contact">{t("quote")}</CtaLink>
          </div>
        </div>
      </Section>
    </>
  );
}

