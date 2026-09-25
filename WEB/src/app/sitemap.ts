import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { products } from "@/data/products";
import { news } from "@/data/news";
import { solutions } from "@/data/solutions";

const SITE = "https://anqiao.aibrain.wiki";

const STATIC_PATHS = [
  "",
  "/products",
  "/solutions",
  "/dealers",
  "/about",
  "/news",
  "/contact",
];

function alternates(
  path: string,
): MetadataRoute.Sitemap[number]["alternates"] {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) {
    languages[l] = `${SITE}/${l}${path}`;
  }
  return { languages };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    for (const p of STATIC_PATHS) {
      entries.push({
        url: `${SITE}/${locale}${p}`,
        alternates: alternates(p),
      });
    }
    for (const p of products) {
      const path = `/products/${p.slug}`;
      entries.push({
        url: `${SITE}/${locale}${path}`,
        alternates: alternates(path),
      });
    }
    for (const n of news) {
      const path = `/news/${n.slug}`;
      entries.push({
        url: `${SITE}/${locale}${path}`,
        alternates: alternates(path),
      });
    }
    for (const s of solutions) {
      const path = `/solutions/${s.anchor}`;
      entries.push({
        url: `${SITE}/${locale}${path}`,
        alternates: alternates(path),
      });
    }
  }

  return entries;
}
