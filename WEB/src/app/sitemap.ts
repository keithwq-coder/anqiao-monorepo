import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { products } from "@/data/products";
import { solutions } from "@/data/solutions";
import { CANONICAL_ORIGIN } from "@/lib/site";

const SITE = CANONICAL_ORIGIN;

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
  const locale = "zh";

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
  for (const s of solutions) {
    const path = `/solutions/${s.anchor}`;
    entries.push({
      url: `${SITE}/${locale}${path}`,
      alternates: alternates(path),
    });
  }

  return entries;
}
