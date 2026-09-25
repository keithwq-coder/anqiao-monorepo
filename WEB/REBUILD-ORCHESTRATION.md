# 重构编排 · 中科安樵 WEB 官网（reasonix 执行 brief）

基于安樵已公开素材重构官网，保留 Next.js 工程骨架，新增多语种与 SEO/GEO。

- 目标仓：`D:\Project\中科安樵\WEB`（Next.js 16 / React 19 / Tailwind v4，App Router）
- 素材库：`C:\Users\K\Documents\安樵`（取已公开内容）
- 执行端：reasonix（deepseek-v4-flash-0731）
- 对外统一表述：精准健康监测；内容以安樵已公开素材为准。

## 已确认信息

- 官网：`https://anqiao.aibrain.wiki`
- 地址：苏州市石湖金陵广场商务楼18楼
- 热线：`13032531078` ｜ 邮箱：`448121288@qq.com`
- 品牌：中科安樵（公司名 + 主品牌）；安守护（产品系列名）
- 产品型号：ZQ-SH100、ZQ-D100、ZQ-BH100、ZQ-GJ100、ZQ-ZH100、ZQ-W100、ZQ-KFC100、ZQ-100（健康筛查一体机）、ZQ-50（健康快速通道一体机）、安守护平台
- ICP 备案号暂缺，保持占位
- 多语种：zh（默认）en fr es ja ru；en 用安樵英文 deck 真实内容，fr/es/ja/ru 由 deepseek 译出并标注「机器翻译待校对」

## 阶段 0 · i18n 脚手架（next-intl）

- `npm i next-intl`
- `src/i18n/routing.ts`：`defineRouting({ locales: ['zh','en','fr','es','ja','ru'], defaultLocale: 'zh' })`
- `src/i18n/navigation.ts`：`createNavigation(routing)` → `Link` / `redirect` / `usePathname` / `getPathname`
- `src/i18n/request.ts`：`getRequestConfig` 按 locale 读取 `messages/<locale>.json`
- `src/middleware.ts`：`createMiddleware(routing)`，matcher 排除 `/api`、`/_next`、静态资源
- `next.config.ts`：用 `createNextIntlPlugin('./src/i18n/request.ts')` 包裹
- 创建 `messages/{zh,en,fr,es,ja,ru}.json`

## 阶段 1 · 路由迁移到 `[locale]`

- `src/app` 下全部路由移入 `src/app/[locale]/`（page、about、contact、dealers、news、news/[slug]、products、products/[slug]、solutions、layout）
- `[locale]/layout.tsx`：`setRequestLocale` + `NextIntlClientProvider`；根 `app/layout.tsx` 仅保留 html / body 透传
- 各页 `generateStaticParams` 补充 `locale` 维度（6 语言静态生成）

## 阶段 2 · UI 文案 → messages

- 导航、CTA、区块标题、标签、表单字段、footer 等界面文案抽入 `messages/zh.json`
- `en.json` 用安樵英文 deck / 英文 MD 对应文案；`fr/es/ja/ru.json` 由 deepseek 从 zh + en 译出（标注机器翻译待校对）
- 组件改用 `useTranslations` / `t()`（client）与 `getTranslations`（server）

## 阶段 3 · 数据层本地化

```ts
type Locale = 'zh' | 'en' | 'fr' | 'es' | 'ja' | 'ru';
type L<T> = Record<Locale, T>;
// Product.name: L<string>; tagline: L<string>; features: L<string[]>;
// model / slug / images 不随语言变
```

- zh 用安樵中文素材；en 用安樵英文 deck / 英文 MD 真实内容；fr/es/ja/ru 由 deepseek 从 zh + en 译出（标注机器翻译待校对）
- 产品图复制 `安樵/工作台/06-素材/产品图/<型号>/` → `WEB/public/images/products/<slug>/`（slug：za100=ZQ-100、zq50=ZQ-50、zq-sh100=ZQ-SH100 等）；删除 `public/images/products/smart-switch/`

## 阶段 4 · 内容（按安樵素材）

- 全站定位语：国家级科技创新企业 · 太湖科创中心
- `company`：address=苏州市石湖金陵广场商务楼18楼、phone=13032531078、website=https://anqiao.aibrain.wiki、email=448121288@qq.com、copyright=真实年份、icp=PENDING；`layout` 的 `metadataBase` / `openGraph.url` 设为该域名
- 产品：从安樵产品体系填写名称 / 卖点 / 功能 / 场景，产品名带系列前缀「安守护」；卖点表述为多模态融合、零摄像头零麦克风
- 方案：场景覆盖护理院 / 养老机构、社区居家养老、医疗卫生机构、大健康 · 美业、装修 · 适老化、长护险监管、居家安防、智慧酒店；设备组合用产品 slug 关联，可生成产品链接
- 新闻：3 条真实事件（民政部 MZ/T 238-2025、工信部智慧健康养老目录、凯健 × 安樵示范楼层），含真实日期与正文摘要，配场景图
- 关于页内容：公司简介、技术路线、发展历程（2023 成立）、资质（持有医疗器械经营备案凭证，二类经营资格）

## 阶段 5 · 语言切换器 + 机译提示

- `site-header` 加 `LocaleSwitcher`（next-intl `usePathname` / `Link`，保留当前页切换）
- `locale ∈ {fr, es, ja, ru}` 时页脚显示「本页非中文内容为机器翻译，仅供参考，最终以中文版为准」

## 阶段 6 · SEO / GEO

- `app/[locale]/sitemap.ts`：6 语言 URL + hreflang 互链（首页 / 产品 / 方案 / 新闻 / 关于 / 联系）
- `app/[locale]/robots.ts`：指向 sitemap
- 每页 `metadata`：title / description 含核心中文词（中科安樵、精准健康监测、60GHz 毫米波雷达、养老监护、无感监测、跌倒监测）；`metadataBase`=https://anqiao.aibrain.wiki；openGraph 图
- 根 `llms.txt`（中文）：声明站点主题与关键页面（公司 / 产品系列 / 解决方案 / 联系方式）
- JSON-LD：Organization（名称 / 地址 / 电话 / 官网 / 品牌）、各产品 Product + BreadcrumbList、FAQPage
- 文案事实化、口语化

## 阶段 7 · 构建验证

- `npm run build` 通过（6 语言静态生成）
- 逐语言逐页核对；全站定位语统一为「国家级科技创新企业 · 太湖科创中心」；切换语言界面文案随语言变化；产品图无缺失；sitemap / robots / llms.txt 可访问；结构化数据校验通过

## 素材来源

- 公司 / 英文源：`安樵/2026中科安樵-公司介绍-产品介绍(英文版).pdf`、英文 MD、`_pptx_textdump.txt`（S4）
- 产品：`安樵/知识库/13_产品体系.md`、`安樵/知识库/10_价格与价盘体系.md`、`安樵/工作台/01-营销/产品说明/中科安樵AI健康守护仪_产品核心优势_成品.md`、`_pptx_textdump.txt`（S15–S17）
- 方案：`安樵/工作台/01-营销/健康守护设备进社区合作方案`、`安樵/凯健×安樵-智能康养合作方案.md`、`安樵/长护险基金监管智能感知设备应用方案.pptx`、`安樵/知识库/17_长护险项目追踪.md`
- 图片：`安樵/工作台/06-素材/产品图/<型号>/`、`安樵/工作台/06-素材/品牌图/`、`安樵/工作台/06-素材/产品图/系统/`
