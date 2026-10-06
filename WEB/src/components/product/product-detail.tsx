"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { CtaLink } from "@/components/cta";
import { Link } from "@/i18n/navigation";
import {
  SCENE_ANCHORS,
  SCENE_DIMENSION,
  sceneAnchorByLabel,
} from "@/data/scenes";
import { ProductCard } from "@/components/product-card";
import { isPending } from "@/data/pending";
import { getLocalizedProduct, type LocalizedProduct } from "@/data/products";

const TABS = ["overview", "features", "specs", "video", "docs", "faq", "related"] as const;
type TabKey = (typeof TABS)[number];

export function ProductDetail({ product }: { product: LocalizedProduct }) {
  const td = useTranslations("productDetail");

  // 计算当前产品有内容的 Tabs（无视频/无文档时静默隐藏，避免毛坯占位符）
  const availableTabs = TABS.filter((key) => {
    if (key === "video") return Boolean(product.videos && product.videos.length > 0);
    if (key === "docs") return Boolean(product.documents && product.documents.length > 0);
    if (key === "faq") return Boolean(product.faqs && product.faqs.length > 0);
    if (key === "specs") return Boolean((product.specGroups && product.specGroups.length > 0) || product.spec !== null);
    return true;
  });

  const [selectedTab, setSelectedTab] = useState<TabKey>("overview");

  // 从 URL ?tab= 恢复（不依赖 next/navigation，避免 Suspense 边界要求）
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && TABS.includes(t as TabKey)) {
      setTimeout(() => {
        setSelectedTab(t as TabKey);
      }, 0);
    }
  }, []);

  const active = availableTabs.includes(selectedTab)
    ? selectedTab
    : (availableTabs[0] ?? "overview");

  function selectTab(key: TabKey) {
    setSelectedTab(key);
    window.history.replaceState(null, "", `?tab=${key}`);
  }

  return (
    <>
      <div className="sticky top-16 z-40 border-b border-border bg-white/95 backdrop-blur-md">
        <div className="container-page flex flex-wrap gap-2 py-3">
          {availableTabs.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => selectTab(key)}
              className={`focus-ring px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                active === key
                  ? "bg-primary-dark text-white"
                  : "text-text-light hover:bg-paper hover:text-primary-dark"
              }`}
            >
              {td(`tabs.${key}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="container-page py-10 sm:py-14">
        {active === "overview" && <Overview product={product} />}
        {active === "features" && <Features product={product} />}
        {active === "specs" && <Specs product={product} />}
        {active === "video" && <Videos product={product} />}
        {active === "docs" && <Docs product={product} />}
        {active === "faq" && <Faqs product={product} />}
        {active === "related" && <Related product={product} />}
      </div>
    </>
  );
}

/* ---------- 概览：主图+缩略图画廊 + 信息区 ---------- */
function Overview({ product }: { product: LocalizedProduct }) {
  const td = useTranslations("productDetail");
  const locale = useLocale() as "zh" | "en" | "fr" | "es" | "ja" | "ru";
  const [mainIdx, setMainIdx] = useState(0);
  const imgs = product.images;
  const main = imgs[Math.min(mainIdx, imgs.length - 1)];

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="relative flex items-center justify-center overflow-hidden border border-border bg-paper p-6">
          <Image
            key={main.src}
            src={main.src}
            alt={main.alt}
            width={main.width}
            height={main.height}
            className="mx-auto max-h-[480px] w-full object-contain"
          />
        </div>
        {imgs.length > 1 ? (
          <div className="flex flex-wrap gap-2.5">
            {imgs.map((img, i) => (
              <button
                key={img.src}
                type="button"
                onClick={() => setMainIdx(i)}
                className={`focus-ring w-20 overflow-hidden border-2 bg-white p-1 transition-colors ${
                  i === mainIdx
                    ? "border-primary-dark"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <Image
                  src={img.src}
                  alt={img.alt}
                  width={img.width}
                  height={img.height}
                  className="h-16 w-full object-contain"
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div>
        {product.model && !isPending(product.model) ? (
          <div className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
            SPEC MODEL // {product.model}
          </div>
        ) : null}
        <h1
          className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {product.name}
        </h1>

        {product.officialName && !isPending(product.officialName) ? (
          <p className="mt-2 font-mono text-xs text-text-muted">
            {td("officialName")}：{product.officialName}
          </p>
        ) : null}

        {product.tagline && !isPending(product.tagline) ? (
          <p className="mt-4 text-base sm:text-lg leading-relaxed text-text-light">{product.tagline}</p>
        ) : null}

        {product.deployment && product.deployment.length > 0 ? (
          <div className="mt-6">
            <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-text-muted">{td("deployment")}</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {product.deployment.map((d) => (
                <li
                  key={d}
                  className="border border-border bg-white px-2.5 py-1 text-xs font-medium text-text"
                >
                  {d}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {product.features.length > 0 ? (
          <>
            <h2 className="mt-8 text-base font-bold text-text">{td("sellingPoints")}</h2>
            <ul className="mt-3 space-y-2">
              {product.features.map((f) => (
                <li key={f} className="flex gap-2 text-xs sm:text-sm text-text-light leading-relaxed">
                  <span aria-hidden="true" className="font-mono font-bold text-primary">
                    ›
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {product.slug === "zq-sh100" ? (
          <div className="mt-6 border border-primary/30 bg-primary-light p-5 text-sm text-primary-dark">
            <p className="font-bold">
              <span className="mr-2 font-mono text-xs font-bold uppercase tracking-wider text-primary-dark/70" aria-hidden="true">
                PRIVACY //
              </span>
              <span>{td("privacyBadgeTitle")}</span>
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-text-light">
              {td("privacyBadgeDesc")}
            </p>
          </div>
        ) : null}

        {product.scenes.length > 0 ? (
          <>
            <h2 className="mt-8 text-base font-bold text-text">{td("scenes")}</h2>
            <div className="mt-3">
              <SceneGroups scenes={product.scenes} locale={locale} td={td} />
            </div>
          </>
        ) : null}

        <div className="mt-8">
          <CtaLink href={`/contact?product=${product.slug}`}>{td("quote")}</CtaLink>
        </div>
      </div>
    </div>
  );
}

/* ---------- 功能亮点：卡片网格 ---------- */
function Features({ product }: { product: LocalizedProduct }) {
  if (product.features.length === 0) {
    return null;
  }
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {product.features.map((f, i) => (
        <div
          key={f}
          className="border border-border bg-white p-6 transition-colors hover:border-primary/60"
        >
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
            FEATURE 0{i + 1}
          </span>
          <p className="mt-3 text-sm sm:text-base leading-relaxed text-text">{f}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------- 技术规格：分组表优先于纯文本 ---------- */
function Specs({ product }: { product: LocalizedProduct }) {
  if (product.specGroups && product.specGroups.length > 0) {
    return (
      <div className="space-y-8">
        {product.specGroups.map((group) => (
          <div key={group.groupName}>
            <div className="font-mono text-xs font-bold uppercase tracking-wider text-primary mb-2">
              SPECIFICATION // {group.groupName}
            </div>
            <h3 className="text-lg font-bold text-text">{group.groupName}</h3>
            <dl className="mt-3 divide-y divide-border/60 border border-border bg-white">
              {group.items.map((item) => (
                <div
                  key={item.label}
                  className="grid grid-cols-1 gap-1 px-5 py-3.5 sm:grid-cols-3 transition-colors hover:bg-paper"
                >
                  <dt className="text-xs sm:text-sm font-semibold text-text-muted sm:col-span-1">{item.label}</dt>
                  <dd className="text-xs sm:text-sm font-medium text-text sm:col-span-2">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    );
  }
  if (product.spec !== null) {
    return <p className="whitespace-pre-line text-sm sm:text-base leading-relaxed text-text-light font-mono">{product.spec}</p>;
  }
  return null;
}

/* ---------- 视频 ---------- */
function Videos({ product }: { product: LocalizedProduct }) {
  const td = useTranslations("productDetail");
  if (!product.videos || product.videos.length === 0) {
    return null;
  }
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {product.videos.map((v) => (
        <div
          key={v.url}
          className="overflow-hidden border border-border bg-white"
        >
          <div className="aspect-video bg-black">
            {v.url.endsWith(".mp4") ? (
              <video
                controls
                preload="none"
                poster={v.url.replace(".mp4", "-poster.jpg")}
                className="h-full w-full"
                src={v.url}
              />
            ) : (
              <iframe
                src={v.url}
                title={v.title}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}
          </div>
          <div className="p-5">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
              {td(
                `videoType.${v.type === "intro" ? "intro" : v.type === "installation" ? "installation" : "scene"}`,
              )}
            </span>
            <h3 className="mt-2 font-bold text-text">{v.title}</h3>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- 文档下载 ---------- */
function Docs({ product }: { product: LocalizedProduct }) {
  const td = useTranslations("productDetail");
  if (!product.documents || product.documents.length === 0) {
    return null;
  }
  return (
    <ul className="divide-y divide-border/60 border border-border bg-white">
      {product.documents.map((doc) => (
        <li key={doc.url}>
          <a
            href={doc.url}
            download
            className="focus-ring flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-paper"
          >
            <span className="flex items-center gap-3">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
                {td.has(`docType.${doc.type}`) ? td(`docType.${doc.type}`) : doc.type}
              </span>
              <span className="text-sm font-medium text-text">{doc.title}</span>
            </span>
            <span className="font-mono text-xs font-semibold text-primary">{doc.size ?? td("download")} ↓</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/* ---------- 常见问题：原生 details 折叠 ---------- */
function Faqs({ product }: { product: LocalizedProduct }) {
  if (!product.faqs || product.faqs.length === 0) {
    return null;
  }
  return (
    <div className="space-y-3">
      {product.faqs.map((faq) => (
        <details
          key={faq.question}
          className="group overflow-hidden border border-border bg-white"
        >
          <summary className="focus-ring flex cursor-pointer items-center justify-between px-6 py-4 font-bold text-text">
            <span>{faq.question}</span>
            <span
              aria-hidden="true"
              className="text-primary text-xs transition-transform group-open:rotate-180"
            >
              ▼
            </span>
          </summary>
          <div className="border-t border-border/60 bg-paper px-6 py-4 text-sm leading-relaxed text-text-light">
            {faq.answer}
          </div>
        </details>
      ))}
    </div>
  );
}

/* ---------- 相关产品：互补硬件 + 平台中枢 ---------- */
function Related({ product }: { product: LocalizedProduct }) {
  const td = useTranslations("productDetail");
  const locale = useLocale() as "zh" | "en" | "fr" | "es" | "ja" | "ru";
  const related = (product.relatedSlugs ?? [])
    .map((slug) => getLocalizedProduct(slug, locale))
    .filter((p): p is LocalizedProduct => p !== undefined);

  const showPlatformCard = !product.isPlatform;

  if (related.length === 0 && !showPlatformCard) {
    return (
      <div className="space-y-4">
        <CtaLink href="/products" variant="secondary">
          {td("browseAll")}
        </CtaLink>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {related.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {related.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      ) : null}

      {showPlatformCard ? (
        <div className="border border-primary/30 bg-primary-light p-6 sm:p-8">
          <p className="text-base font-bold text-primary-dark">
            {td("platformTitle")}
          </p>
          <p className="mt-2 text-sm sm:text-base leading-relaxed text-text-light">
            {td("platformBody")}
          </p>
          <div className="mt-5">
            <CtaLink href="/products/platform" variant="secondary">
              {td("platformCta")}
            </CtaLink>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- 场景四维分组：应用场景链接合作地图，采购/主题/人群为标签组 ---------- */
type SceneGroupKey = "app" | "purchase" | "topic" | "person";

const SCENE_GROUP_ORDER: SceneGroupKey[] = ["app", "purchase", "topic", "person"];

function SceneGroups({
  scenes,
  locale,
  td,
}: {
  scenes: string[];
  locale: "zh" | "en" | "fr" | "es" | "ja" | "ru";
  td: (key: string) => string;
}) {
  const grouped = SCENE_GROUP_ORDER.map((dim) => ({
    dim,
    items: scenes.filter((s) => SCENE_DIMENSION[sceneKeyOf(s)] === dim),
  })).filter((g) => g.items.length > 0);
  const groupedSet = new Set(grouped.flatMap((g) => g.items));
  const leftover = scenes.filter((s) => !groupedSet.has(s));

  return (
    <div className="space-y-4">
      {grouped.map((g) => (
        <div key={g.dim}>
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-text-muted">
            {td(`dim${cap(g.dim)}`)}
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {g.items.map((s) => {
              const anchor = sceneAnchorByLabel(s, locale);
              return anchor ? (
                <li key={s}>
                  <Link
                    href={`/solutions#${anchor}`}
                    className="focus-ring inline-block border border-primary/30 bg-primary-light px-2.5 py-1 text-xs font-semibold text-primary-dark transition-colors hover:bg-primary-dark hover:text-white"
                  >
                    {s}
                  </Link>
                </li>
              ) : (
                <li
                  key={s}
                  className="border border-border bg-white px-2.5 py-1 text-xs font-medium text-text"
                >
                  {s}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {leftover.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {leftover.map((s) => (
            <li
              key={s}
              className="border border-border bg-white px-2.5 py-1 text-xs font-medium text-text"
            >
              {s}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** 按当前语言标签反查场景 key（用于维度归类）。 */
function sceneKeyOf(label: string): string {
  for (const sc of SCENE_ANCHORS) {
    if (Object.values(sc.label).includes(label)) return sc.anchor;
  }
  return "";
}
