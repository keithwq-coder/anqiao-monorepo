import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // 生成独立运行所需的最小 server bundle（Docker standalone 部署用，无需 node_modules）。
  output: "standalone",
};

export default withNextIntl(nextConfig);
