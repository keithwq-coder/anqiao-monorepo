# 中科安樵官网 · 实施设计文档

> 日期：2026-08-03 · 状态：已获用户确认
> 本文件是实施层的技术设计。业务内容、合规红线、验收标准以根目录 `SPEC.md` 为唯一依据，两者冲突时以 SPEC.md 为准。

## 1. 范围

在 `D:\Project\中科安樵\WEB` 从零搭建中科安樵（苏州）科技有限公司企业官网（Next.js App Router + TypeScript + Tailwind v4），实现 SPEC §4–§5 全部 7 个路由、11 个产品详情页、3 条新闻详情页，以及询价/招商表单。不做 SPEC §10 列出的任何事项。

## 2. 脚手架

- 工具：`create-next-app@latest`（当前目录已含 SPEC.md / PROMPT-for-deepseek.md，不受影响）
- 选项：TypeScript、App Router、src 目录、Tailwind v4、import 别名 `@/*`
- 环境：Node v24.13.1 / npm 11.13.0 已确认

## 3. 设计令牌（Tailwind v4 CSS-first）

`src/app/globals.css` 内 `@theme` 定义：

```css
--color-primary: #0B7A75;        --color-primary-light: #E8F5F4;
--color-primary-dark: #065A56;   --color-accent: #C8956C;
--color-accent-light: #FDF6F0;   --color-bg: #FAFAF7;
--color-bg-warm: #F7F5F0;        --color-text: #2C3E3A;
--color-text-light: #5A6E68;     --color-text-muted: #8A9E98;
--color-border: #E8E6E1;         --radius-lg: 16px;  --radius-md: 10px;
--font-sans: -apple-system, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
```

正文 16px / line-height 1.8。不引入任何 UI 库、动画库。

## 4. 数据层

### 4.1 占位符常量

`src/data/pending.ts` 导出 `PENDING = "{{待填}}"` 与 `isPending(v)`（v 为 `PENDING`/`null`/空串 时视为待填）。

### 4.2 `src/data/products.ts`

```ts
export type ProductImage = { src: string; alt: string; width: number; height: number }
export type Product = {
  slug: string
  model: string          // 无资料用 PENDING
  name: string
  tagline: string        // 一句话定位，无资料用 PENDING
  features: string[]     // 核心卖点，无资料为空数组（渲染为 Pending）
  scenes: string[]       // 适用场景标签，无资料为空数组
  spec: string | null    // 技术参数，null → Pending 卡
  customers: string | null  // 适用客户，null → Pending
  warranty: string       // 统一「24 个月质保，非人为故障只换不修」
  images: ProductImage[] // 主图优先 three-view > main > screen
}
```

11 项按 SPEC §5.3.2 填写：ZQ-SH100 / ZQ-D100 有真实卖点（按 §5.3.1 照抄）；其余 9 款名称/型号/图片真实，卖点、场景、参数一律 PENDING。智能开关、系统平台的 model 用 PENDING。

### 4.3 `src/data/news.ts`

`NewsItem = { slug, title, date, summary, body?, cover? }`，3 条按 SPEC §5.7，日期 `{{待填}}`，无正文（详情页显示 Pending）。

### 4.4 `src/data/solutions.ts`

5 场景（锚点/名称/决策方/痛点/推荐设备 PENDING/文案），痛点文案按 SPEC §5.4 表格写入；`#retrofit` 面向装企/经销商，不写 C 端购买用语。

## 5. 组件

| 组件 | 说明 |
|---|---|
| `src/components/pending.tsx` | `<Pending label="技术参数" />`：浅灰底 `#F5F5F3` + 虚线边框 `1px dashed #C9C9C4`，文案「待补充」+ 小字「待补充：<用途>」。必须可见 |
| `src/components/site-header.tsx` | 6 项主导航 + 右侧「获取方案报价」CTA → `/contact`；移动端汉堡菜单（键盘可操作、focus 可见） |
| `src/components/site-footer.tsx` | 公司全称、地址、公众号二维码（`/images/brand/qr.jpg`）、电话/邮箱/ICP（Pending）、版权行 |
| `src/components/product-card.tsx` | 图（优先级 three-view > main > screen）+ 型号 + 名称 + 一句话定位 + 「查看详情」 |
| `src/components/lead-form.tsx` | `type: "inquiry" | "dealer"` 复用；`useActionState` + 服务端校验；成功提示不跳转；错误内联于字段下方 |
| `src/components/cta.tsx` | 通用按钮样式封装（Link/a 变体） |

## 6. 表单与 Server Action

- `src/actions/submit-lead.ts`（"use server"）：接收 `formData`，手写校验（必填、长度上限：姓名 40 / 电话 20 / 机构 80 / 需求 500 / 意向产品 80；电话含 `tel` 类型正则），超长与空必填返回字段级错误
- 写入：`data/leads.jsonl` 追加一行 JSON `{ type, name, phone, organization, inquiryType, customerType, product, message, submittedAt, source }`；`source` 取请求 `Referer` 头，无则 `"unknown"`
- `data/` 目录写入 `.gitignore`
- 表单位段按 SPEC §5.8（姓名/联系电话/机构名称必填；咨询类型必填 select；客户类型/意向产品/需求说明可选）
- `/contact?product=<slug>` 通过 `searchParams` 预填「意向产品」

## 7. 素材管线

- 源：`C:\Users\K\Documents\安樵\图集\产品照片\`（16 张，已核验全部存在）与 `品牌照片\`
- 目标：`public/images/products/<slug>/`、`public/images/brand/`，文件名 ASCII（映射严格照抄 SPEC §6.1.1，不推测）
- 压缩：ImageMagick `magick` 转 WebP（quality 自适应，必要时缩放），单张 < 300KB；读取原图尺寸后按比例写入图片元数据，`<Image>` 全部给定 width/height/alt
- alt 格式：`<型号> <名称> <视图类型>`（如「ZQ-SH100 AI健康守护仪 三视图」）
- 不使用 SPEC §6.4 列出的任何素材

## 8. 页面清单

| 路由 | 要点 |
|---|---|
| `/` | 7 区块：Hero（主/副标题、双 CTA、ZQSH100 场景图）→ 核心优势 4 卡 → 产品矩阵 11 卡（点击进详情）→ 场景 5 卡（锚点跳转）→ 经销商引流条 → 最新动态 3 条 → 底部询价 CTA |
| `/products` | 页头 + 场景筛选（标签取自 `scenes`，无字段归「全部」）+ 11 卡网格；不显示价格 |
| `/products/[slug]` | 统一模板：图区（多图小画廊）→ 信息区（型号/名称/定位/卖点/场景标签/「获取报价」CTA → `/contact?product=<slug>`）→ 技术参数表（无则 Pending 卡）→ 适用客户（无则 Pending）→ 质保说明；`generateStaticParams` 生成 11 个 slug |
| `/solutions` | 单页 5 场景锚点导航，每场景：痛点 → 推荐设备组合（Pending）→ 交付价值 → 询价 CTA |
| `/dealers` | 页头「首批渠道合伙人招募」→ 为什么选安樵 4 卡 → 合作流程 4 步 → 意向登记表单（type=dealer）；无返利/区域/样机/结算细节 |
| `/about` | 公司简介（照抄 §5.6，含 §7.0 唯一例外句）、技术路线、质量保障表、资质（经营备案凭证表述）、团队/发展历程 Pending |
| `/news` | 卡片流（日期+标题+摘要） |
| `/news/[slug]` | 标题/日期/正文，无正文显示 Pending |
| `/contact` | 左栏联系信息（全称/地址/电话/邮箱 Pending/二维码）+ 右栏询价表单（type=inquiry） |
| `src/app/api/ai/` | 仅 `README.md`（未来 AI 服务扩展位说明），无任何实现 |

所有页面 `<metadata>` 的 title/description 不出现 §7.1 禁用词。

## 9. 验收

按 SPEC §9 逐条执行：

1. `npm install && npm run dev` 冒烟通过；`npm run build` 无 TS 错误
2. 7 路由 + 11 产品详情 + 3 新闻详情可访问；slug 与 §5.3.2 一致
3. 表单：询价写入 `leads.jsonl`、招商 type=dealer、校验生效、`?product=` 预填生效
4. grep 禁用词（范围 `src/` + `public/`，排除 SPEC.md / PROMPT-for-deepseek.md / VERIFY.md），§7.1 词表零命中；`医疗器械` 仅允许两处；无百分比数字；无价格；凯健文案含「建设阶段」
5. 所有 Pending 可见渲染；`TODO-业主待填清单.md` 完整
6. 图片 ASCII 文件名、<300KB、alt/width/height 齐全
7. 键盘可操作、label 关联、语义化标签、对比度 ≥ 4.5:1
8. `.gitignore` 含 `data/leads.jsonl`；`api/ai/README.md` 存在；README 含「⚠️ 部署前必办：表单速率限制与验证码」；无 SPEC 外依赖

交付物：可运行项目 + `README.md` + `TODO-业主待填清单.md` + `VERIFY.md`（SPEC §9 逐条自查报告，含 grep 实际输出）。

## 10. 明确不做

同 SPEC §10：无 admin/登录/数据库、无案例页、无 C 端购买流程、无多语言、无部署配置、无 AI 实现、无 UI/动画库、不补全任何 `{{待填}}`。

## 11. 已知盲区（遇则停下问，不自行决定）

同 SPEC 附：智能开关/系统平台正式名称与型号、产品-场景对应关系、团队披露范围、电话/邮箱/备案号、新闻日期。
