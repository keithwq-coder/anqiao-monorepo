"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ProductCard } from "@/components/product-card";
import type { LocalizedProduct } from "@/data/products";
import { sceneDimensionByLabel } from "@/data/scenes";

const DIMS = ["app", "purchase", "topic", "person"] as const;
type Dim = (typeof DIMS)[number];

/**
 * /products 按场景筛选（四维分组：应用场景 / 采购入口 / 需求主题 / 适用人群）。
 * 每组可收起/展开，默认展开「应用场景」；选中任意标签时其所属组自动展开。
 */
export function ProductsFilter({ products }: { products: LocalizedProduct[] }) {
  const t = useTranslations("filter");
  const ALL = t("all");
  const [active, setActive] = useState<string>(ALL);
  const [open, setOpen] = useState<Set<Dim>>(new Set(["app"]));

  const scenes = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      for (const s of p.scenes) set.add(s);
    }
    return [ALL, ...set];
  }, [products, ALL]);

  const grouped = useMemo(() => {
    const g: Record<Dim, string[]> = { app: [], purchase: [], topic: [], person: [] };
    for (const s of scenes) {
      if (s === ALL) continue;
      const dim = sceneDimensionByLabel(s) ?? "app";
      g[dim].push(s);
    }
    return g;
  }, [scenes, ALL]);

  const visible = useMemo(
    () =>
      active === ALL
        ? products
        : products.filter((p) => p.scenes.includes(active)),
    [products, active, ALL],
  );

  function toggle(dim: Dim) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(dim)) next.delete(dim);
      else next.add(dim);
      return next;
    });
  }

  function select(scene: string) {
    setActive(scene);
    const dim = sceneDimensionByLabel(scene);
    if (dim) {
      setOpen((prev) => (prev.has(dim) ? prev : new Set(prev).add(dim)));
    }
  }

  function countOf(scene: string): number {
    return scene === ALL
      ? products.length
      : products.filter((p) => p.scenes.includes(scene)).length;
  }

  return (
    <div>
      <div className="mb-8 space-y-4">
        {/* 「全部」常驻 */}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => select(ALL)}
            aria-pressed={active === ALL}
            className={`focus-ring rounded-md border px-4 py-2 text-sm transition-colors ${
              active === ALL
                ? "border-primary bg-primary text-white"
                : "border-border bg-white text-text hover:bg-primary-light"
            }`}
          >
            {ALL}
            <span className="ml-1.5 text-xs opacity-70">{products.length}</span>
          </button>
        </div>

        {DIMS.map((dim) => {
          const items = grouped[dim];
          if (items.length === 0) return null;
          const isOpen = open.has(dim);
          return (
            <div key={dim} className="rounded-lg border border-border bg-white">
              <button
                type="button"
                onClick={() => toggle(dim)}
                aria-expanded={isOpen}
                className="focus-ring flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-text"
              >
                <span>{t(`dim${dim.charAt(0).toUpperCase()}${dim.slice(1)}`)}</span>
                <span aria-hidden="true" className="text-primary">
                  {isOpen ? "▾" : "▸"}
                </span>
              </button>
              {isOpen ? (
                <div className="flex flex-wrap gap-3 border-t border-border px-4 pb-4 pt-3">
                  {items.map((scene) => {
                    const selected = scene === active;
                    return (
                      <button
                        key={scene}
                        type="button"
                        onClick={() => select(scene)}
                        aria-pressed={selected}
                        className={`focus-ring rounded-md border px-4 py-2 text-sm transition-colors ${
                          selected
                            ? "border-primary bg-primary text-white"
                            : "border-border bg-white text-text hover:bg-primary-light"
                        }`}
                      >
                        {scene}
                        <span className="ml-1.5 text-xs opacity-70">
                          {countOf(scene)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((product) => (
          <li key={product.slug}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    </div>
  );
}