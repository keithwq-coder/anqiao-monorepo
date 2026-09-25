import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://anqiao.aibrain.wiki"),
  title: {
    default:
      "中科安樵（苏州）科技有限公司 | 精准健康监测 · 无感监测 · 养老监护",
    template: "%s | 中科安樵",
  },
  description:
    "中科安樵以毫米波雷达、红外热像等多模态融合感知技术，为养老机构、医疗卫生与大健康场景提供无感监测设备：非接触、零摄像头零麦克风，覆盖睡眠监测、跌倒监测、无感监测与养老监护等场景。",
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: "https://anqiao.aibrain.wiki",
    siteName: "中科安樵",
    title: "中科安樵（苏州）科技有限公司 | 精准健康监测 · 无感监测 · 养老监护",
    description:
      "多模态融合感知的无感监测，零摄像头零麦克风：AI健康守护仪、跌倒监测仪、健康筛查一体机，服务养老机构与社区居家养老。",
    images: [
      {
        url: "/images/brand/logo-blue.webp",
        width: 1179,
        height: 322,
        alt: "中科安樵（苏州）科技有限公司",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
