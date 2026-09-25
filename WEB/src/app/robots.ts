import type { MetadataRoute } from "next";

const SITE = "https://anqiao.aibrain.wiki";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
