import type { MetadataRoute } from "next";
import { CANONICAL_ORIGIN } from "@/lib/site";

const SITE = CANONICAL_ORIGIN;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
