"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Pending } from "@/components/pending";
import { isPending } from "@/data/pending";
import { primaryImage, type LocalizedProduct } from "@/data/products";

export function ProductCard({ product }: { product: LocalizedProduct }) {
  const t = useTranslations("productCard");
  const img = primaryImage(product);

  return (
    <Link
      href={`/products/${product.slug}`}
      className="focus-ring group flex flex-col overflow-hidden rounded-lg border border-border bg-white transition-shadow hover:shadow-md"
    >
      {img ? (
        <div className="bg-bg-warm p-4">
          <Image
            src={img.src}
            alt={img.alt}
            width={img.width}
            height={img.height}
            className="h-40 w-full object-contain"
          />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col gap-2 p-5">
        {isPending(product.model) ? (
          <Pending label={t("model")} />
        ) : (
          <p className="text-sm font-medium text-primary">{product.model}</p>
        )}
        <h3 className="text-lg font-semibold text-text">{product.name}</h3>
        {isPending(product.tagline) ? (
          <Pending label={t("tagline")} />
        ) : (
          <p className="text-text-light">{product.tagline}</p>
        )}
        <span className="mt-auto pt-3 text-primary group-hover:text-primary-dark">
          {t("details")}
        </span>
      </div>
    </Link>
  );
}
