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
import { Pending } from "@/components/pending";
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
      <div className="sticky top-16 z-40 border-b border-border bg-white/95 backdrop-blur">
        <div className="container-page flex flex-wrap gap-1 py-3">
          {availableTabs.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => selectTab(key)}
              className={`focus-ring rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                active === key
                  ? "bg-primary-light text-primary-dark"
                  : "text-text-light hover:bg-bg-warm"
              }`}
            >
              {td(`tabs.${key}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="container-page py-10">
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
  const tpc = useTranslations("productCard");
  const locale = useLocale() as "zh" | "en" | "fr" | "es" | "ja" | "ru";
  const [mainIdx, setMainIdx] = useState(0);
  const imgs = product.images;
  const main = imgs[Math.min(mainIdx, imgs.length - 1)];

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-white p-4">
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
          <div className="flex flex-wrap gap-3">
            {imgs.map((img, i) => (
              <button
                key={img.src}
                type="button"
                onClick={() => setMainIdx(i)}
                className={`focus-ring w-20 overflow-hidden rounded-md border bg-white p-1 transition-colors ${
                  i === mainIdx
                    ? "border-primary"
                    : "border-border hover:border-primary"
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
        {isPending(product.model) ? (
          <Pending label={tpc("model")} />
        ) : (
          <p className="text-sm font-medium text-primary">{product.model}</p>
        )}
        <h1 className="mt-3 text-3xl font-semibold text-text">{product.name}</h1>

        {product.officialName !== undefined && isPending(product.officialName) ? (
          <div className="mt-3">
            <Pending label={td("officialName")} />
          </div>
        ) : null}

        <div className="mt-4">
          {isPending(product.tagline) ? (
            <Pending label={tpc("tagline")} />
          ) : (
            <p className="text-lg text-text-light">{product.tagline}</p>
          )}
        </div>

        {product.deployment && product.deployment.length > 0 ? (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-text-light">{td("deployment")}</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {product.deployment.map((d) => (
                <li
                  key={d}
                  className="rounded-md bg-bg-warm px-3 py-1 text-sm text-text"
                >
                  {d}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <h2 className="mt-8 text-lg font-semibold text-text">{td("sellingPoints")}</h2>
        <div className="mt-3">
          {product.features.length > 0 ? (
            <ul className="space-y-2">
              {product.features.map((f) => (
                <li key={f} className="flex gap-2 text-text-light">
                  <span aria-hidden="true" className="text-primary">
                    ·
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Pending label={td("sellingPoints")} />
          )}
        </div>

        {product.slug === "zq-sh100" ? (
          <div className="mt-5 rounded-lg border border-primary/20 bg-primary-light/60 p-4 text-sm text-primary-dark">
            <p className="flex items-center gap-1.5 font-semibold">
              <span aria-hidden="true">🛡️</span>
              <span>{td("privacyBadgeTitle")}</span>
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-text-light">
              {td("privacyBadgeDesc")}
            </p>
          </div>
        ) : null}

        <h2 className="mt-8 text-lg font-semibold text-text">{td("scenes")}</h2>
        <div className="mt-3">
          {product.scenes.length > 0 ? (
            <SceneGroups scenes={product.scenes} locale={locale} td={td} />
          ) : (
            <Pending label={td("scenesTags")} />
          )}
        </div>

        <div className="mt-8">
          <CtaLink href={`/contact?product=${product.slug}`}>{td("quote")}</CtaLink>
        </div>
      </div>
    </div>
  );
}

/* ---------- 功能亮点：卡片网格 ---------- */
function Features({ product }: { product: LocalizedProduct }) {
  const td = useTranslations("productDetail");
  if (product.features.length === 0) {
    return <Pending label={td("sellingPoints")} />;
  }
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {product.features.map((f, i) => (
        <div
          key={f}
          className="rounded-lg border border-border bg-white p-5 transition-shadow hover:shadow-md"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-sm font-semibold text-primary-dark">
            {i + 1}
          </span>
          <p className="mt-3 text-text">{f}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------- 技术规格：分组表优先于纯文本 ---------- */
function Specs({ product }: { product: LocalizedProduct }) {
  const td = useTranslations("productDetail");
  if (product.specGroups && product.specGroups.length > 0) {
    return (
      <div className="space-y-8">
        {product.specGroups.map((group) => (
          <div key={group.groupName}>
            <h3 className="text-lg font-semibold text-text">{group.groupName}</h3>
            <dl className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
              {group.items.map((item) => (
                <div
                  key={item.label}
                  className="grid grid-cols-1 gap-1 bg-white px-4 py-3 sm:grid-cols-3"
                >
                  <dt className="text-text-light sm:col-span-1">{item.label}</dt>
                  <dd className="text-text sm:col-span-2">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    );
  }
  if (product.spec !== null) {
    return <p className="whitespace-pre-line text-text-light">{product.spec}</p>;
  }
  return <Pending label={td("tabs.specs")} />;
}

/* ---------- 视频 ---------- */
function Videos({ product }: { product: LocalizedProduct }) {
  const td = useTranslations("productDetail");
  if (!product.videos || product.videos.length === 0) {
    return <Pending label={td("tabs.video")} />;
  }
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {product.videos.map((v) => (
        <div
          key={v.url}
          className="overflow-hidden rounded-lg border border-border bg-white"
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
          <div className="p-4">
            <span className="rounded bg-primary-light px-2 py-0.5 text-xs text-primary-dark">
              {td(
                `videoType.${v.type === "intro" ? "intro" : v.type === "installation" ? "installation" : "scene"}`,
              )}
            </span>
            <h3 className="mt-2 font-semibold text-text">{v.title}</h3>
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
    return <Pending label={td("tabs.docs")} />;
  }
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
      {product.documents.map((doc) => (
        <li key={doc.url}>
          <a
            href={doc.url}
            download
            className="focus-ring flex items-center justify-between gap-4 bg-white px-4 py-4 hover:bg-bg-warm"
          >
            <span className="flex items-center gap-3">
              <span className="rounded bg-primary-light px-2 py-0.5 text-xs text-primary-dark">
                {td.has(`docType.${doc.type}`) ? td(`docType.${doc.type}`) : doc.type}
              </span>
              <span className="text-text">{doc.title}</span>
            </span>
            <span className="text-sm text-primary">{doc.size ?? td("download")} ↓</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/* ---------- 常见问题：原生 details 折叠 ---------- */
function Faqs({ product }: { product: LocalizedProduct }) {
  const td = useTranslations("productDetail");
  if (!product.faqs || product.faqs.length === 0) {
    return <Pending label={td("tabs.faq")} />;
  }
  return (
    <div className="space-y-3">
      {product.faqs.map((faq) => (
        <details
          key={faq.question}
          className="group overflow-hidden rounded-lg border border-border bg-white"
        >
          <summary className="focus-ring flex cursor-pointer items-center justify-between px-4 py-4 font-medium text-text">
            {faq.question}
            <span
              aria-hidden="true"
              className="text-primary transition-transform group-open:rotate-180"
            >
              ▾
            </span>
          </summary>
          <div className="border-t border-border px-4 py-4 text-text-light">
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
        <Pending label={td("relatedEmpty")} />
        <CtaLink href="/products" variant="secondary">
          浏览全部产品
        </CtaLink>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {related.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {related.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      ) : null}

      {showPlatformCard ? (
        <div className="rounded-lg border border-primary bg-primary-light p-5">
          <p className="text-sm font-semibold text-primary-dark">
            {td("platformTitle")}
          </p>
          <p className="mt-2 text-text-light">
            {td("platformBody")}
          </p>
          <div className="mt-3">
            <CtaLink href="/products/platform" variant="secondary">
              了解安守护云平台
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
  const groups = SCENE_GROUP_ORDER.map((dim) => ({
    dim,
    items: scenes.filter((s) => SCENE_DIMENSION[sceneKeyOf(s)] === dim),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.dim}>
          <p className="text-sm font-semibold text-text-light">
            {td(`dim${cap(g.dim)}`)}
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {g.items.map((s) => {
              const anchor = sceneAnchorByLabel(s, locale);
              return anchor ? (
                <li key={s}>
                  <Link
                    href={`/solutions/${anchor}`}
                    className="focus-ring inline-block rounded-md bg-primary-light px-3 py-1 text-sm text-primary-dark transition-colors hover:bg-primary hover:text-white"
                  >
                    {s}
                  </Link>
                </li>
              ) : (
                <li
                  key={s}
                  className="rounded-md bg-bg-warm px-3 py-1 text-sm text-text"
                >
                  {s}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
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

