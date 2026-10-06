"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { isPending } from "@/data/pending";
import { primaryImage, type LocalizedProduct } from "@/data/products";

export function ProductCard({ product }: { product: LocalizedProduct }) {
  const t = useTranslations("productCard");
  const img = primaryImage(product);

  return (
    <Link
      href={`/products/${product.slug}`}
      className="focus-ring group flex h-full flex-col border border-border bg-white transition-colors hover:border-primary/60"
    >
      {img ? (
        <div className="relative flex aspect-[4/3] items-center justify-center border-b border-border bg-paper p-6">
          {product.model && !isPending(product.model) ? (
            <span className="absolute left-4 top-4 font-mono text-[11px] font-bold tracking-wider text-primary-dark">
              {product.model}
            </span>
          ) : null}
          <Image
            src={img.src}
            alt={img.alt}
            width={img.width}
            height={img.height}
            className="h-32 w-full object-contain"
          />
        </div>
      ) : null}

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-bold leading-snug text-ink transition-colors group-hover:text-primary-dark">
          {product.name}
        </h3>
        {product.tagline && !isPending(product.tagline) ? (
          <p className="mt-2 text-xs leading-relaxed text-text-light line-clamp-2">
            {product.tagline}
          </p>
        ) : null}

        <div className="mt-auto flex items-center justify-between border-t border-border pt-4 text-xs">
          <span className="font-semibold text-text-muted">{t("inHouse")}</span>
          <span className="font-bold text-primary-dark underline decoration-primary-dark/30 underline-offset-4 group-hover:decoration-primary-dark">
            {t("details")}
          </span>
        </div>
      </div>
    </Link>
  );
}
