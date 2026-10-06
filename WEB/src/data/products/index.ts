import type { Locale } from "@/data/locale";
import { l } from "@/data/locale";
import { filterPublicScenes } from "@/data/scenes";
import { zqSh100 } from "./zq-sh100";
import { zqD100 } from "./zq-d100";
import { za100 } from "./za100";
import { zq50 } from "./zq50";
import { zqBh100 } from "./zq-bh100";
import { zqGj100 } from "./zq-gj100";
import { zqZh100 } from "./zq-zh100";
import { zqkfc100 } from "./zqkfc100";
import { zqW100 } from "./zq-w100";
import { platform } from "./platform";
import type { LocalizedProduct, Product, ProductImage } from "./types";

export type { LocalizedProduct, Product, ProductImage };
export { primaryImage } from "./types";

/** 全部产品（L<T> 原始结构，按 slug 顺序）。 */
export const products: Product[] = [
  zqSh100,
  zqD100,
  za100,
  zq50,
  zqBh100,
  zqGj100,
  zqZh100,
  zqkfc100,
  zqW100,
  platform,
];

/** 按语言扁平化产品：组件直接访问字符串字段。 */
export function localizeProduct(
  product: Product,
  locale: Locale,
): LocalizedProduct {
  return {
    ...product,
    model: product.model,
    name: l(product.name, locale),
    officialName: product.officialName
      ? l(product.officialName, locale)
      : undefined,
    tagline: l(product.tagline, locale),
    features: l(product.features, locale),
    scenes: filterPublicScenes(l(product.scenes, locale)),
    spec: l(product.spec, locale),
    customers: l(product.customers, locale),
    warranty: l(product.warranty, locale),
    images: product.images.map((img) => ({
      ...img,
      alt: l(img.alt, locale),
    })),
    specGroups: product.specGroups?.map((group) => ({
      groupName: l(group.groupName, locale),
      items: group.items.map((item) => ({
        label: l(item.label, locale),
        value: l(item.value, locale),
      })),
    })),
    videos: product.videos?.map((v) => ({
      ...v,
      title: l(v.title, locale),
    })),
    documents: product.documents?.map((d) => ({
      ...d,
      title: l(d.title, locale),
    })),
    faqs: product.faqs?.map((f) => ({
      question: l(f.question, locale),
      answer: l(f.answer, locale),
    })),
  };
}

export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

/** 便捷：直接返回本地化产品。 */
export function getLocalizedProduct(
  slug: string,
  locale: Locale,
): LocalizedProduct | undefined {
  const product = getProduct(slug);
  return product ? localizeProduct(product, locale) : undefined;
}
