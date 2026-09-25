# 中科安樵官网 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `D:\Project\中科安樵\WEB` 从零交付中科安樵（苏州）科技有限公司企业官网，实现 SPEC §4–§5 的 7 个路由、11 个产品详情页、3 条新闻详情页与询价/招商表单，所有无资料字段保留 `{{待填}}` 可见占位。

**Architecture:** Next.js App Router 全静态渲染 + 一个 Server Action。内容全部硬编码在 `src/data/*.ts`（未来换数据库只替换该层）；`src/components/*` 为无状态展示组件，唯一客户端组件是表单（`useActionState`）；表单经 Server Action 手写校验后以 JSONL 追加写入 `data/leads.jsonl`。素材离线经 ffmpeg 转 WebP 后进 `public/images/`。

**Tech Stack:** Next.js 16.2.12（App Router、Turbopack 默认）· React 19.2.4 · TypeScript 5 · Tailwind CSS v4（CSS-first `@theme`）· Node v24.13.1 / npm 11.13.0 · ffmpeg 8.1（素材转码）。零额外运行时依赖。

## Global Constraints

每个任务的要求都隐含包含本节全部条目。违反任一条即为不合格。

### C1 不编造
- SPEC 标 `{{待填}}` 的字段一律保留。数据层统一用字符串常量 `PENDING = "{{待填}}"`，页面用 `<Pending />` 渲染。
- 严禁自行补全：产品 3–11 的卖点/参数/适用场景、产品 10/11 的型号与正式名称、产品 1/2 的技术参数、5 场景的推荐设备组合、关于我们的团队与发展历程、新闻 3 条的日期与正文、电话/邮箱/ICP 备案号。
- 遇 SPEC 未覆盖的决策点：停下来问，不许推测。已知阻塞点见本文末「阻塞点：待业主确认」。

### C2 不扩展
- 只做 SPEC §4–§5 的页面与功能。SPEC §10 逐条遵守：无 admin/登录/数据库、无案例页、无 C 端购买流程/购物车/支付、无多语言、无部署配置（Vercel/Docker/CI）、不实现 AI 服务、不引入 UI 组件库（Ant Design / MUI / shadcn）与动画库（Framer Motion / GSAP）。
- 不建 `/cases` 路由，不写客户 logo 墙、不写客户评价。

### C3 依赖锁定
- 生产依赖只允许 `next` `react` `react-dom`；devDependencies 只允许 create-next-app 默认生成的那些。**不装 zod、不装 sharp、不装 clsx、不装任何图标/UI/动画库。**
- 表单校验全部手写（必填、长度上限、类型）。
- 不使用 `next/font/google`（外部字体请求）；字体用 SPEC §3.2 系统字体栈。

### C4 合规红线（SPEC §7，命中即不合格）
- 禁用词零命中（含文案、`alt`、`metadata`、代码注释）：`医疗级` `诊断` `治疗` `疗效` `临床验证` `临床认证` `注册证` `包治` `治愈` `替代医生`。
- `医疗器械` 全站仅允许两处：①`/about` 公司简介照抄原句「集医疗器械、办公智能……为一体」；②资质表述「公司持医疗器械经营备案凭证」。严禁写「产品已取得医疗器械注册证」。
- 全站无任何准确率/精度百分比数字（98%、92%、95% 等一律不写）；无部署台数/客户数量/市占率。
- 全站无任何价格数字，一律「获取报价」。
- 凯健只写「合作中的智能守护示范楼层项目，进入建设阶段」，严禁「已采购/已交付/成功案例/客户见证」。
- 「紧急呼叫」= 通知家人/护理员，不得暗示对接 120 或医疗急救。
- `/dealers` 严禁出现返利阶梯、区域保护具体规则、样机收费标准、结算方式、价格政策；统一表述「详细渠道政策在意向沟通阶段提供」。
- `#retrofit` 场景面向装企/经销商，不写 C 端购买用语（不写「为您家老人选购」「购买」「下单」）。

### C5 素材
- 映射严格照抄 SPEC §6.1.1，**不靠推测拼源文件名**（源目录名与文件名存在不一致，如 ZA100 目录叫「健康筛查一体机」而图叫「健康通道一体机」）。
- 目标文件名全 ASCII；单张 < 300KB；WebP。
- 所有 `<Image>` 必须带 `alt` / `width` / `height`；alt 格式 `<型号> <名称> <视图类型>`。
- 不使用 SPEC §6.4 素材：`新建文件夹/`、各目录 `4B8A*.JPG` 实拍、`系统/系统展示场景.png`、`系统/系统概念图.png`、`硬件安装视频/*.JPG`、`照片/*.JPG`、`其他/展位.pptx` 与 `2026长三角论坛展位图.jpg`。

### C6 工程与环境事实
- `data/` 必须进 `.gitignore`（含客户线索）。
- `src/app/api/ai/` 只留 `README.md`，无任何实现代码。
- `README.md` 必须含「⚠️ 部署前必办：表单速率限制与验证码」。
- **WEB 目录不是 git 仓库** —— 全程不执行任何 git 命令（不 `git init`、不 `git add`、不 `git commit`）。每个任务以「可运行验证」收尾替代 commit。
- 无自动化测试框架，验证手段限于：`npm run build`、`npm run dev` + `curl` 冒烟、`grep` 合规扫描、`ffprobe`/`stat` 素材检查。
- 环境已核验：Node v24.13.1、npm 11.13.0、ffmpeg 8.1（`/d/software/ffmpeg/bin/ffmpeg`）。**ImageMagick 未安装**（PATH 上的 `convert` 是 Windows 磁盘工具，不可用）—— 素材管线一律用 ffmpeg。
- 素材源目录已核验存在：`C:\Users\K\Documents\安樵\图集\产品照片\`（17 个映射源文件全部在位）与 `品牌照片\`。
- Shell 为 Git Bash（win32）。含中文的 grep 需 `LC_ALL=C.UTF-8`。

### C7 可访问性（SPEC §3.3）
- 语义化标签 `<nav>` `<main>` `<section>` `<footer>`，不用 div 堆结构。
- 表单每个输入有关联 `<label htmlFor>`；错误内联在字段下方，不用 `alert`。
- 键盘可完整操作导航与表单，focus 态可见（`focus-visible` 环）。
- 正文与背景对比度 ≥ 4.5:1（正文用 `--color-text` #2C3E3A 于 `--color-bg` #FAFAF7；`--color-text-muted` #8A9E98 仅用于非正文的辅助小字，不承载关键信息）。

---

## File Structure

| 文件 | 职责 |
|---|---|
| `src/app/globals.css` | Tailwind v4 `@theme` 设计令牌 + body 基础排版 |
| `src/app/layout.tsx` | 根布局：`<html lang="zh-CN">`、metadata、挂载 Header/Footer |
| `src/data/pending.ts` | `PENDING` 常量与 `isPending()` 判定 |
| `src/data/products.ts` | 11 项产品数据 + 类型 + `getProduct()` |
| `src/data/news.ts` | 3 条新闻数据 + 类型 + `getNews()` |
| `src/data/solutions.ts` | 5 场景数据 + 类型 |
| `src/components/pending.tsx` | 占位符可见渲染 |
| `src/components/cta.tsx` | 按钮/链接样式封装（primary/secondary/ghost） |
| `src/components/section.tsx` | 区块外壳（语义 `<section>` + 标题 + 容器宽度） |
| `src/components/site-header.tsx` | 主导航 + 固定 CTA + 移动端菜单（客户端组件） |
| `src/components/site-footer.tsx` | 页脚：公司信息、二维码、Pending 联系方式、版权 |
| `src/components/product-card.tsx` | 产品卡片（图/型号/名称/定位/查看详情） |
| `src/components/lead-form.tsx` | 询价/招商共用表单（客户端组件，`useActionState`） |
| `src/actions/submit-lead.ts` | Server Action：校验 + 追加写 `data/leads.jsonl` |
| `src/app/**/page.tsx` | 8 个路由页面（含 2 个动态段） |
| `scripts/build-assets.sh` | 素材管线：ffmpeg 转 WebP 到 `public/images/` |

**任务依赖与并行**：T1 → T2 → T3 → (T4, T5, T6) → T7…T13 → T14…T21。
**T22（素材管线）与页面任务无强依赖，可与 T4–T21 并行执行**；页面在图片文件缺失时仍能 `npm run build` 通过（Next `<Image>` 静态引用为运行时读取），但 T23 验收前必须完成 T22。

---

### Task 1: 脚手架

`create-next-app` 拒绝非空目录（本目录已有 `SPEC.md` / `PROMPT-for-deepseek.md` / `docs/`）。已实测确认：必须先生成到子目录 `scaffold-tmp`，再把内容（含点文件）移到根目录。子目录名不能以点开头（npm 命名限制）。

**Files:**
- Create: `package.json` `tsconfig.json` `next.config.ts` `postcss.config.mjs` `eslint.config.mjs` `next-env.d.ts` `.gitignore` `src/app/layout.tsx` `src/app/page.tsx` `src/app/globals.css` `src/app/favicon.ico` `public/*.svg`（全部由 CLI 生成）
- Modify: `package.json`（改 name）

**Interfaces:**
- Consumes: 无（首个任务）
- Produces: 可运行的 Next 16.2.12 + React 19.2.4 + Tailwind v4 项目；导入别名 `@/*` → `src/*`；`npm run dev` / `npm run build` / `npm run lint` 三个脚本。

- [ ] **Step 1: 生成脚手架到子目录**

```bash
cd "D:/Project/中科安樵/WEB"
npx --yes create-next-app@16.2.12 scaffold-tmp \
  --ts --tailwind --app --src-dir --eslint \
  --import-alias "@/*" --use-npm --skip-install --disable-git --yes
```

Expected: 输出 `Success! Created scaffold-tmp at ...`；不出现 git 初始化信息（`Skipping git initialization.`）。

- [ ] **Step 2: 把脚手架内容移到根目录并删除子目录**

```bash
cd "D:/Project/中科安樵/WEB"
shopt -s dotglob
mv scaffold-tmp/* .
shopt -u dotglob
rmdir scaffold-tmp
ls -a
```

Expected: 根目录出现 `package.json` `tsconfig.json` `next.config.ts` `postcss.config.mjs` `eslint.config.mjs` `next-env.d.ts` `.gitignore` `AGENTS.md` `CLAUDE.md` `README.md` `src/` `public/`，且原有 `SPEC.md` `PROMPT-for-deepseek.md` `docs/` 仍在；`scaffold-tmp` 已不存在。

- [ ] **Step 3: 改 package.json 的 name**

把 `"name": "scaffold-tmp",` 改为：

```json
  "name": "anqiao-web",
```

- [ ] **Step 4: 安装依赖**

```bash
cd "D:/Project/中科安樵/WEB" && npm install
```

Expected: 安装成功，`node_modules/` 生成，无 ERR。

- [ ] **Step 5: 验证依赖清单未被污染（C3）**

```bash
cd "D:/Project/中科安樵/WEB" && node -e "const p=require('./package.json');console.log('deps:',Object.keys(p.dependencies).join(','));console.log('name:',p.name)"
```

Expected 精确输出：

```
deps: next,react,react-dom
name: anqiao-web
```

- [ ] **Step 6: 冒烟 build**

```bash
cd "D:/Project/中科安樵/WEB" && npm run build
```

Expected: `Compiled successfully`，无 TypeScript 错误，退出码 0。

---

### Task 2: 设计令牌与根布局

**Files:**
- Modify: `src/app/globals.css`（整文件替换）
- Modify: `src/app/layout.tsx`（整文件替换）

**Interfaces:**
- Consumes: Task 1 的脚手架
- Produces: Tailwind 工具类 `bg-primary` `bg-primary-light` `bg-primary-dark` `bg-accent` `bg-accent-light` `bg-bg` `bg-bg-warm` `text-text` `text-text-light` `text-text-muted` `border-border` `rounded-lg`(16px) `rounded-md`(10px) `font-sans`；全局 `.container-page`（页面容器宽度）与 `.focus-ring`（focus 可见样式）两个工具类供后续任务复用。

- [ ] **Step 1: 整文件替换 `src/app/globals.css`**

```css
@import "tailwindcss";

@theme {
  --color-primary: #0B7A75;
  --color-primary-light: #E8F5F4;
  --color-primary-dark: #065A56;
  --color-accent: #C8956C;
  --color-accent-light: #FDF6F0;
  --color-bg: #FAFAF7;
  --color-bg-warm: #F7F5F0;
  --color-text: #2C3E3A;
  --color-text-light: #5A6E68;
  --color-text-muted: #8A9E98;
  --color-border: #E8E6E1;
  --radius-lg: 16px;
  --radius-md: 10px;
  --font-sans: -apple-system, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
}

body {
  background-color: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.8;
}

@utility container-page {
  width: 100%;
  max-width: 1200px;
  margin-inline: auto;
  padding-inline: 1.25rem;
}

@utility focus-ring {
  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
}
```

- [ ] **Step 2: 整文件替换 `src/app/layout.tsx`**

不使用 `next/font/google`（C3：不发外部字体请求）。

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "中科安樵（苏州）科技有限公司 | 清华同源技术 · 精准健康监测",
  description:
    "中科安樵为养老机构、医疗卫生与大健康场景提供 60GHz 毫米波无感监测设备，纯雷达感知，零摄像头零麦克风。",
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
```

- [ ] **Step 3: 验证令牌生效且无外部字体引用**

```bash
cd "D:/Project/中科安樵/WEB"
grep -c "next/font" src/app/layout.tsx || echo "OK: no external font"
grep -o "\-\-color-primary: #0B7A75" src/app/globals.css
grep -o 'lang="zh-CN"' src/app/layout.tsx
```

Expected 输出：

```
OK: no external font
--color-primary: #0B7A75
lang="zh-CN"
```

- [ ] **Step 4: build 验证**

```bash
cd "D:/Project/中科安樵/WEB" && npm run build
```

Expected: `Compiled successfully`，退出码 0。

---

### Task 3: 占位符模块与 `<Pending />` 组件

**Files:**
- Create: `src/data/pending.ts`
- Create: `src/components/pending.tsx`

**Interfaces:**
- Consumes: Task 2 的设计令牌
- Produces:
  - `export const PENDING = "{{待填}}"`
  - `export function isPending(value: string | null | undefined): boolean` —— `PENDING` / `null` / `undefined` / 空串或纯空白 → `true`
  - `export function Pending({ label }: { label: string }): React.JSX.Element` —— 默认导出为**具名导出**（`import { Pending } from "@/components/pending"`）

- [ ] **Step 1: 创建 `src/data/pending.ts`**

```ts
/** 业主待填字段的统一标记值。SPEC §8.1：数据层统一用该字符串，严禁填充编造内容。 */
export const PENDING = "{{待填}}";

/** 判定一个字段是否处于待填状态（用于决定是否渲染 <Pending />）。 */
export function isPending(value: string | null | undefined): boolean {
  if (value === null || value === undefined) return true;
  return value.trim() === "" || value.trim() === PENDING;
}
```

- [ ] **Step 2: 创建 `src/components/pending.tsx`**

样式硬编码 SPEC §8.1 要求的 `#F5F5F3` 底与 `1px dashed #C9C9C4` 框（这两个值不在 §3.1 令牌表内，故用任意值语法）。

```tsx
/**
 * 待填占位符的可见渲染。SPEC §8.1：必须视觉可辨，不得渲染成空白或隐藏。
 * @param label 字段用途，如「技术参数」「推荐设备组合」
 */
export function Pending({ label }: { label: string }) {
  return (
    <div
      className="rounded-md border border-dashed bg-[#F5F5F3] px-4 py-3 text-text-light"
      style={{ borderColor: "#C9C9C4", borderWidth: "1px" }}
    >
      <span className="font-medium">待补充</span>
      <span className="ml-2 text-sm text-text-light">待补充：{label}</span>
    </div>
  );
}
```

- [ ] **Step 3: 验证判定逻辑**

```bash
cd "D:/Project/中科安樵/WEB"
npx tsx --version 2>/dev/null || npx --yes tsc --noEmit src/data/pending.ts --outDir /tmp/tscheck 2>&1 | head -3
node -e "
const s=require('fs').readFileSync('src/data/pending.ts','utf8');
console.log('PENDING literal:', /const PENDING = \"\{\{待填\}\}\"/.test(s));
console.log('has isPending:', /export function isPending/.test(s));
"
grep -o "#F5F5F3" src/components/pending.tsx
grep -o "#C9C9C4" src/components/pending.tsx
```

Expected 包含：

```
PENDING literal: true
has isPending: true
#F5F5F3
#C9C9C4
```

- [ ] **Step 4: build 验证**

```bash
cd "D:/Project/中科安樵/WEB" && npm run build
```

Expected: `Compiled successfully`，退出码 0。

---

### Task 4: 产品数据层（11 项）

图片 `width`/`height` 是 Task 22 素材管线的**固定契约**（已由 ffprobe 实测源图并按 `scale='min(1600,iw)':-2` 推算），两处必须一致。

**Files:**
- Create: `src/data/products.ts`

**Interfaces:**
- Consumes: `PENDING` from `@/data/pending`
- Produces:
  - `export type ProductImage = { src: string; alt: string; width: number; height: number }`
  - `export type Product = { slug: string; model: string; name: string; officialName: string; tagline: string; features: string[]; scenes: string[]; spec: string | null; customers: string | null; warranty: string; images: ProductImage[] }`
  - `export const WARRANTY_TEXT = "24 个月质保，非人为故障只换不修"`
  - `export const products: Product[]`（长度 11，顺序同 SPEC §5.3.2）
  - `export function getProduct(slug: string): Product | undefined`
  - `export function primaryImage(product: Product): ProductImage | undefined` —— 主图优先级 `three-view` > `main` > `screen`

- [ ] **Step 1: 创建 `src/data/products.ts` —— 类型与常量**

```ts
import { PENDING } from "@/data/pending";

export type ProductImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

export type Product = {
  slug: string;
  /** 型号。产品 10/11 企业资料中无型号，用 PENDING。 */
  model: string;
  /** 展示名。产品 10/11 为暂用展示名。 */
  name: string;
  /** 正式名称。产品 10/11 未确认，用 PENDING，详情页渲染 <Pending />。 */
  officialName: string;
  /** 一句话定位。仅产品 1/2 有资料。 */
  tagline: string;
  /** 核心卖点。仅产品 1/2 有资料，其余为空数组 → 渲染 <Pending />。 */
  features: string[];
  /** 适用场景标签。11 款全部未梳理（SPEC 附:不确定项 2），一律空数组。 */
  scenes: string[];
  /** 技术参数。11 款全部无资料，一律 null → 渲染 <Pending />。 */
  spec: string | null;
  /** 适用客户。11 款全部无资料，一律 null → 渲染 <Pending />。 */
  customers: string | null;
  warranty: string;
  images: ProductImage[];
};

/** SPEC §5.3：所有产品统一质保表述。 */
export const WARRANTY_TEXT = "24 个月质保，非人为故障只换不修";
```

- [ ] **Step 2: 追加产品 1–2（有完整卖点资料，照抄 SPEC §5.3.1）**

严禁写入任何准确率百分比（SPEC §5.3.1 警告）。

```ts
export const products: Product[] = [
  {
    slug: "zq-sh100",
    model: "ZQ-SH100",
    name: "AI健康守护仪",
    officialName: "AI健康守护仪",
    tagline: "卧室床位无感守护，整夜睡眠数据化",
    features: [
      "头部技术、中端价格 —— 60GHz 毫米波与头部厂商同代",
      "单人床位精准守护 —— 不做多人体复杂度，把一个床位守到最扎实",
      "纯毫米波，零摄像头零麦克风 —— 隐私敏感场景的稀缺路线",
      "睡眠数据化 —— 每晚睡眠记录，机构向家属交付专业感的证据",
      "国产自主可控 —— 床底线采用国产 60GHz 方案",
    ],
    scenes: [],
    spec: null,
    customers: null,
    warranty: WARRANTY_TEXT,
    images: [
      {
        src: "/images/products/zq-sh100/three-view.webp",
        alt: "ZQ-SH100 AI健康守护仪 三视图",
        width: 1600,
        height: 854,
      },
      {
        src: "/images/products/zq-sh100/scene.webp",
        alt: "ZQ-SH100 AI健康守护仪 场景图",
        width: 1536,
        height: 1024,
      },
    ],
  },
  {
    slug: "zq-d100",
    model: "ZQ-D100",
    name: "跌倒监测仪",
    officialName: "跌倒监测仪",
    tagline: "守在最危险的地方，跌倒即报",
    features: [
      "跌倒即报 —— 毫米波识别跌倒姿态，声光 + APP 推送 + 呼叫",
      "守在最危险的地方 —— 卫生间/淋浴间是跌倒最高发场景",
      "离床告警 + 温湿度 —— 夜间防走失、防二次跌倒",
      "部署轻、见效快 —— 适合逐间覆盖与规模化铺设",
    ],
    scenes: [],
    spec: null,
    customers: null,
    warranty: WARRANTY_TEXT,
    images: [
      {
        src: "/images/products/zq-d100/three-view.webp",
        alt: "ZQ-D100 跌倒监测仪 三视图",
        width: 1600,
        height: 800,
      },
    ],
  },
  // PRODUCTS-3-TO-6-MARKER
];
```

- [ ] **Step 3: 替换 `// PRODUCTS-3-TO-6-MARKER` 为产品 3–6**

卖点/场景/参数/客户全部待填 —— C1 严禁补全。

```ts
  {
    slug: "za100",
    model: "ZA100",
    name: "健康筛查一体机",
    officialName: "健康筛查一体机",
    tagline: PENDING,
    features: [],
    scenes: [],
    spec: null,
    customers: null,
    warranty: WARRANTY_TEXT,
    images: [
      {
        src: "/images/products/za100/three-view.webp",
        alt: "ZA100 健康筛查一体机 三视图",
        width: 1536,
        height: 1024,
      },
      {
        src: "/images/products/za100/scene.webp",
        alt: "ZA100 健康筛查一体机 场景图",
        width: 1536,
        height: 1024,
      },
    ],
  },
  {
    slug: "zq50",
    model: "ZQ50",
    name: "健康快速通道一体机",
    officialName: "健康快速通道一体机",
    tagline: PENDING,
    features: [],
    scenes: [],
    spec: null,
    customers: null,
    warranty: WARRANTY_TEXT,
    images: [
      {
        src: "/images/products/zq50/three-view.webp",
        alt: "ZQ50 健康快速通道一体机 三视图",
        width: 1600,
        height: 878,
      },
      {
        src: "/images/products/zq50/scene.webp",
        alt: "ZQ50 健康快速通道一体机 场景图",
        width: 1536,
        height: 1024,
      },
    ],
  },
  {
    slug: "zq-bh100",
    model: "ZQ-BH100",
    name: "床下健康监测仪",
    officialName: "床下健康监测仪",
    tagline: PENDING,
    features: [],
    scenes: [],
    spec: null,
    customers: null,
    warranty: WARRANTY_TEXT,
    images: [
      {
        src: "/images/products/zq-bh100/three-view.webp",
        alt: "ZQ-BH100 床下健康监测仪 三视图",
        width: 1600,
        height: 760,
      },
    ],
  },
  {
    slug: "zq-gj100",
    model: "ZQ-GJ100",
    name: "人体轨迹监测仪",
    officialName: "人体轨迹监测仪",
    tagline: PENDING,
    features: [],
    scenes: [],
    spec: null,
    customers: null,
    warranty: WARRANTY_TEXT,
    images: [
      {
        src: "/images/products/zq-gj100/three-view.webp",
        alt: "ZQ-GJ100 人体轨迹监测仪 三视图",
        width: 1600,
        height: 800,
      },
    ],
  },
  // PRODUCTS-7-TO-11-MARKER
```

- [ ] **Step 4: 替换 `// PRODUCTS-7-TO-11-MARKER` 为产品 7–11**

产品 10/11 的 `model` 与 `officialName` 均为 `PENDING`（SPEC §5.3.2 注：企业资料中无型号与正式名称）。其 alt 用暂用展示名，不拼型号。

```ts
  {
    slug: "zq-zh100",
    model: "ZQ-ZH100",
    name: "照护采集仪",
    officialName: "照护采集仪",
    tagline: PENDING,
    features: [],
    scenes: [],
    spec: null,
    customers: null,
    warranty: WARRANTY_TEXT,
    images: [
      {
        src: "/images/products/zq-zh100/three-view.webp",
        alt: "ZQ-ZH100 照护采集仪 三视图",
        width: 1600,
        height: 852,
      },
    ],
  },
  {
    slug: "zqkfc100",
    model: "ZQKFC100",
    name: "健康守护康复智能床",
    officialName: "健康守护康复智能床",
    tagline: PENDING,
    features: [],
    scenes: [],
    spec: null,
    customers: null,
    warranty: WARRANTY_TEXT,
    images: [
      {
        src: "/images/products/zqkfc100/main.webp",
        alt: "ZQKFC100 健康守护康复智能床 主图",
        width: 1600,
        height: 800,
      },
    ],
  },
  {
    slug: "zq-w100",
    model: "ZQ-W100",
    name: "白细胞检测仪",
    officialName: "白细胞检测仪",
    tagline: PENDING,
    features: [],
    scenes: [],
    spec: null,
    customers: null,
    warranty: WARRANTY_TEXT,
    images: [
      {
        src: "/images/products/zq-w100/three-view.webp",
        alt: "ZQ-W100 白细胞检测仪 三视图",
        width: 1600,
        height: 682,
      },
      {
        src: "/images/products/zq-w100/usage.webp",
        alt: "ZQ-W100 白细胞检测仪 使用示意图",
        width: 1536,
        height: 1024,
      },
      {
        src: "/images/products/zq-w100/open.webp",
        alt: "ZQ-W100 白细胞检测仪 打开示意图",
        width: 1536,
        height: 1024,
      },
    ],
  },
  {
    slug: "smart-switch",
    model: PENDING,
    name: "智能开关",
    officialName: PENDING,
    tagline: PENDING,
    features: [],
    scenes: [],
    spec: null,
    customers: null,
    warranty: WARRANTY_TEXT,
    images: [
      {
        src: "/images/products/smart-switch/three-view.webp",
        alt: "智能开关 三视图",
        width: 1600,
        height: 800,
      },
    ],
  },
  {
    slug: "platform",
    model: PENDING,
    name: "系统平台",
    officialName: PENDING,
    tagline: PENDING,
    features: [],
    scenes: [],
    spec: null,
    customers: null,
    warranty: WARRANTY_TEXT,
    images: [
      {
        src: "/images/products/platform/screen.webp",
        alt: "系统平台 展示大屏",
        width: 1600,
        height: 900,
      },
      {
        src: "/images/products/platform/preview.webp",
        alt: "系统平台 展示效果图",
        width: 1600,
        height: 900,
      },
    ],
  },
```

- [ ] **Step 5: 追加查询函数（文件末尾，`products` 数组闭合之后）**

```ts
export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

/** 卡片主图优先级：three-view > main > screen（SPEC §6.1.1 末行）。 */
export function primaryImage(product: Product): ProductImage | undefined {
  const order = ["three-view", "main", "screen"];
  for (const key of order) {
    const hit = product.images.find((img) => img.src.includes(`/${key}.webp`));
    if (hit) return hit;
  }
  return product.images[0];
}
```

- [ ] **Step 6: 验证 11 项 slug、顺序与占位完整性**

`tsx -e` 对相对/别名 import 会静默失败（已实测），必须写成临时文件执行。

```bash
cd "D:/Project/中科安樵/WEB"
cat > check-tmp.ts <<'EOF'
import { products, getProduct, primaryImage } from "@/data/products";
import { isPending } from "@/data/pending";
console.log("count:", products.length);
console.log("slugs:", products.map((p) => p.slug).join(","));
console.log("pending models:", products.filter((p) => isPending(p.model)).map((p) => p.slug).join(","));
console.log("all spec null:", products.every((p) => p.spec === null));
console.log("all customers null:", products.every((p) => p.customers === null));
console.log("all scenes empty:", products.every((p) => p.scenes.length === 0));
console.log("with features:", products.filter((p) => p.features.length > 0).map((p) => p.slug).join(","));
console.log("primary zq-sh100:", primaryImage(getProduct("zq-sh100")!)?.src);
console.log("primary zqkfc100:", primaryImage(getProduct("zqkfc100")!)?.src);
console.log("primary platform:", primaryImage(getProduct("platform")!)?.src);
console.log("imgs missing dims:", products.flatMap((p) => p.images).filter((i) => !i.width || !i.height || !i.alt).length);
EOF
npx --yes tsx ./check-tmp.ts
rm check-tmp.ts
```

Expected 精确输出：

```
count: 11
slugs: zq-sh100,zq-d100,za100,zq50,zq-bh100,zq-gj100,zq-zh100,zqkfc100,zq-w100,smart-switch,platform
pending models: smart-switch,platform
all spec null: true
all customers null: true
all scenes empty: true
with features: zq-sh100,zq-d100
primary zq-sh100: /images/products/zq-sh100/three-view.webp
primary zqkfc100: /images/products/zqkfc100/main.webp
primary platform: /images/products/platform/screen.webp
imgs missing dims: 0
```

> `tsx` 只用于本次一次性校验（`npx --yes` 不写入 package.json）。若不想引入临时下载，可改用 `npm run build` + 页面渲染核对。

- [ ] **Step 7: 合规扫描本文件（无百分比、无价格、无禁用词）**

```bash
cd "D:/Project/中科安樵/WEB"
LC_ALL=C.UTF-8 grep -nE "[0-9]+(\.[0-9]+)?%" src/data/products.ts || echo "OK: no percentage"
LC_ALL=C.UTF-8 grep -nE "医疗级|诊断|治疗|疗效|临床验证|临床认证|注册证|包治|治愈|替代医生|医疗器械" src/data/products.ts || echo "OK: no banned words"
```

Expected：

```
OK: no percentage
OK: no banned words
```

- [ ] **Step 8: build 验证**

```bash
cd "D:/Project/中科安樵/WEB" && npm run build
```

Expected: `Compiled successfully`，退出码 0。

---

### Task 5: 新闻数据层（3 条）

slug 由标题派生为 ASCII（SPEC 未给 slug，路由必须 ASCII，属技术必要派生，非业务编造）。日期与正文一律 `PENDING`（SPEC §5.7：资料中无确切日期，不许推测）。

**Files:**
- Create: `src/data/news.ts`

**Interfaces:**
- Consumes: `PENDING` from `@/data/pending`
- Produces:
  - `export type NewsItem = { slug: string; title: string; date: string; summary: string; body?: string; cover?: string }`
  - `export const news: NewsItem[]`（长度 3，顺序即展示顺序；首页取前 3 条）
  - `export function getNewsItem(slug: string): NewsItem | undefined`

- [ ] **Step 1: 创建 `src/data/news.ts`**

第 3 条必须含「进入建设阶段」，严禁「已完成/已交付/已采购/成功案例」（C4）。

```ts
import { PENDING } from "@/data/pending";

export type NewsItem = {
  slug: string;
  title: string;
  /** YYYY-MM-DD。资料中无确切日期（SPEC §5.7），一律 PENDING。 */
  date: string;
  summary: string;
  /** 无正文则详情页渲染 <Pending />。 */
  body?: string;
  cover?: string;
};

/** 展示顺序即数组顺序；首页「最新动态」取前 3 条。 */
export const news: NewsItem[] = [
  {
    slug: "guangzhou-aging-industry-expo-2026",
    title: "安樵将参展 2026 广州国际老龄产业博览会",
    date: PENDING,
    summary: "公司已收到展会邀请，具体展位与行程信息待公布。",
  },
  {
    slug: "yangtze-delta-health-forum-2026",
    title: "安樵参与 2026 长三角康养论坛",
    date: PENDING,
    summary: "展位方案已确定，详情待公布。",
  },
  {
    slug: "smart-care-demo-floor",
    title: "智能守护示范楼层项目启动",
    date: PENDING,
    summary: "与苏州凯健友谊苑合作的智能守护示范楼层进入建设阶段。",
  },
];

export function getNewsItem(slug: string): NewsItem | undefined {
  return news.find((n) => n.slug === slug);
}
```

- [ ] **Step 2: 验证 3 条数据与合规**

```bash
cd "D:/Project/中科安樵/WEB"
cat > check-tmp.ts <<'EOF'
import { news, getNewsItem } from "@/data/news";
import { isPending } from "@/data/pending";
console.log("count:", news.length);
console.log("slugs:", news.map((n) => n.slug).join(","));
console.log("all dates pending:", news.every((n) => isPending(n.date)));
console.log("all bodies absent:", news.every((n) => n.body === undefined));
console.log("ascii slugs:", news.every((n) => /^[a-z0-9-]+$/.test(n.slug)));
console.log("kaijian ok:", getNewsItem("smart-care-demo-floor")!.summary.includes("进入建设阶段"));
EOF
npx --yes tsx ./check-tmp.ts
rm check-tmp.ts
LC_ALL=C.UTF-8 grep -nE "已交付|已采购|成功案例|客户见证|已完成" src/data/news.ts || echo "OK: no forbidden kaijian phrasing"
```

Expected：

```
count: 3
slugs: guangzhou-aging-industry-expo-2026,yangtze-delta-health-forum-2026,smart-care-demo-floor
all dates pending: true
all bodies absent: true
ascii slugs: true
kaijian ok: true
OK: no forbidden kaijian phrasing
```

- [ ] **Step 3: build 验证**

```bash
cd "D:/Project/中科安樵/WEB" && npm run build
```

Expected: `Compiled successfully`，退出码 0。

---

### Task 6: 解决方案数据层（5 场景）

痛点文案照抄 SPEC §5.4 表格（属通用行业观察，允许写入）。推荐设备组合与交付价值一律 `null` → 渲染 `<Pending />`（SPEC §5.4：9 款产品适用场景未梳理，不许推测搭配；交付价值 SPEC 未给内容，见末尾阻塞点 B3）。

**Files:**
- Create: `src/data/solutions.ts`

**Interfaces:**
- Consumes: 无（不依赖 products）
- Produces:
  - `export type Solution = { anchor: string; name: string; buyer: string; painPoints: string[]; devices: string | null; value: string | null }`
  - `export const solutions: Solution[]`（长度 5，顺序同 SPEC §5.4）

- [ ] **Step 1: 创建 `src/data/solutions.ts`**

`#retrofit` 的 `buyer` 与痛点面向装企/经销商，不写 C 端购买用语（C4）。

```ts
export type Solution = {
  /** 锚点 id，不含 #。 */
  anchor: string;
  name: string;
  /** 决策/买单方。 */
  buyer: string;
  painPoints: string[];
  /** 推荐设备组合。SPEC §5.4 要求必须待填，不许推测搭配。 */
  devices: string | null;
  /** 交付价值。SPEC 未提供各场景文案，一律待填。 */
  value: string | null;
};

export const solutions: Solution[] = [
  {
    anchor: "institution",
    name: "养老机构",
    buyer: "高端外资 / 中端民营养老院",
    painPoints: [
      "夜间巡房人力紧张",
      "跌倒风险难预警",
      "向家属交代缺数据",
    ],
    devices: null,
    value: null,
  },
  {
    anchor: "community",
    name: "社区居家养老",
    buyer: "政府 / 社区养老服务中心",
    painPoints: ["独居老人无人看护", "政策目录与合规门槛"],
    devices: null,
    value: null,
  },
  {
    anchor: "medical",
    name: "医疗卫生机构",
    buyer: "基层卫生服务机构 / 医院",
    painPoints: ["基层筛查效率", "健康数据常态化采集"],
    devices: null,
    value: null,
  },
  {
    anchor: "wellness",
    name: "大健康 · 美业",
    buyer: "大健康机构 / 美业门店",
    painPoints: ["健康数据作为服务增值与客户留存工具"],
    devices: null,
    value: null,
  },
  {
    anchor: "retrofit",
    name: "装修 · 适老化改造",
    buyer: "装企 / 经销商",
    painPoints: [
      "改造方案缺智能守护模块",
      "缺可交付的硬件配套",
    ],
    devices: null,
    value: null,
  },
];
```

- [ ] **Step 2: 验证 5 场景与 C 端用语零命中**

```bash
cd "D:/Project/中科安樵/WEB"
cat > check-tmp.ts <<'EOF'
import { solutions } from "@/data/solutions";
console.log("count:", solutions.length);
console.log("anchors:", solutions.map((s) => s.anchor).join(","));
console.log("all devices null:", solutions.every((s) => s.devices === null));
console.log("all value null:", solutions.every((s) => s.value === null));
console.log("all have painPoints:", solutions.every((s) => s.painPoints.length > 0));
EOF
npx --yes tsx ./check-tmp.ts
rm check-tmp.ts
LC_ALL=C.UTF-8 grep -nE "购买|下单|购物车|为您家|选购" src/data/solutions.ts || echo "OK: no B2C wording"
```

Expected：

```
count: 5
anchors: institution,community,medical,wellness,retrofit
all devices null: true
all value null: true
all have painPoints: true
OK: no B2C wording
```

- [ ] **Step 3: build 验证**

```bash
cd "D:/Project/中科安樵/WEB" && npm run build
```

Expected: `Compiled successfully`，退出码 0。

---

### Task 7: 通用 UI 组件（CTA + Section）

**Files:**
- Create: `src/components/cta.tsx`
- Create: `src/components/section.tsx`

**Interfaces:**
- Consumes: Task 2 令牌与 `.container-page` / `.focus-ring`
- Produces:
  - `export function CtaLink({ href, variant, children, className }: { href: string; variant?: "primary" | "secondary" | "ghost"; children: React.ReactNode; className?: string })` —— 默认 `variant="primary"`，内部用 `next/link`
  - `export function Section({ id, title, lead, children, tone, className }: { id?: string; title?: string; lead?: string; children: React.ReactNode; tone?: "bg" | "warm" | "primary-light"; className?: string })` —— 渲染语义 `<section>`，`title` 存在时渲染 `<h2>`

- [ ] **Step 1: 创建 `src/components/cta.tsx`**

```tsx
import Link from "next/link";

const VARIANTS = {
  primary:
    "bg-primary text-white hover:bg-primary-dark border border-transparent",
  secondary:
    "bg-white text-primary border border-primary hover:bg-primary-light",
  ghost: "bg-transparent text-primary border border-border hover:bg-primary-light",
} as const;

export function CtaLink({
  href,
  variant = "primary",
  children,
  className = "",
}: {
  href: string;
  variant?: keyof typeof VARIANTS;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`focus-ring inline-flex items-center justify-center rounded-md px-6 py-3 text-base font-medium transition-colors ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}
```

- [ ] **Step 2: 创建 `src/components/section.tsx`**

```tsx
const TONES = {
  bg: "bg-bg",
  warm: "bg-bg-warm",
  "primary-light": "bg-primary-light",
} as const;

export function Section({
  id,
  title,
  lead,
  children,
  tone = "bg",
  className = "",
}: {
  id?: string;
  title?: string;
  lead?: string;
  children: React.ReactNode;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  return (
    <section id={id} className={`${TONES[tone]} py-16 ${className}`}>
      <div className="container-page">
        {title ? (
          <h2 className="text-2xl font-semibold text-text sm:text-3xl">
            {title}
          </h2>
        ) : null}
        {lead ? (
          <p className="mt-3 max-w-3xl text-text-light">{lead}</p>
        ) : null}
        <div className={title || lead ? "mt-8" : ""}>{children}</div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: build 验证**

```bash
cd "D:/Project/中科安樵/WEB" && npm run build
```

Expected: `Compiled successfully`，退出码 0。

---

### Task 8: 站点导航 Header

移动端汉堡菜单需 `useState`，故为客户端组件。导航项 6 个（SPEC §4.1），不含案例页。

**Files:**
- Create: `src/components/site-header.tsx`

**Interfaces:**
- Consumes: `CtaLink` from `@/components/cta`
- Produces: `export function SiteHeader()`；导出常量 `export const NAV_ITEMS: { href: string; label: string }[]`（供验收脚本核对）

- [ ] **Step 1: 创建 `src/components/site-header.tsx`**

logo 使用 Task 22 产出的 `/images/brand/logo-blue.webp`（1179×322，浅底蓝字）。

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { CtaLink } from "@/components/cta";

export const NAV_ITEMS = [
  { href: "/products", label: "产品中心" },
  { href: "/solutions", label: "解决方案" },
  { href: "/dealers", label: "经销商招商" },
  { href: "/about", label: "关于我们" },
  { href: "/news", label: "新闻动态" },
  { href: "/contact", label: "联系我们" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/95 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="focus-ring flex items-center rounded-md">
          <Image
            src="/images/brand/logo-blue.webp"
            alt="中科安樵（苏州）科技有限公司"
            width={1179}
            height={322}
            className="h-8 w-auto"
            priority
          />
        </Link>

        <nav aria-label="主导航" className="hidden lg:block">
          <ul className="flex items-center gap-7">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="focus-ring rounded-md text-text-light hover:text-primary"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden lg:block">
          <CtaLink href="/contact" className="px-5 py-2 text-sm">
            获取方案报价
          </CtaLink>
        </div>

        <button
          type="button"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
          className="focus-ring rounded-md border border-border px-3 py-2 text-sm text-text lg:hidden"
        >
          {open ? "关闭菜单" : "打开菜单"}
        </button>
      </div>

      {open ? (
        <nav
          id="mobile-nav"
          aria-label="移动端主导航"
          className="border-t border-border bg-bg lg:hidden"
        >
          <ul className="container-page flex flex-col py-3">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="focus-ring block rounded-md py-2 text-text-light hover:text-primary"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="pt-3">
              <CtaLink href="/contact" className="w-full">
                获取方案报价
              </CtaLink>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
```

- [ ] **Step 2: 验证导航项与语义标签**

```bash
cd "D:/Project/中科安樵/WEB"
LC_ALL=C.UTF-8 grep -c "<nav" src/components/site-header.tsx
LC_ALL=C.UTF-8 grep -o "获取方案报价" src/components/site-header.tsx | wc -l
LC_ALL=C.UTF-8 grep -nE "案例" src/components/site-header.tsx || echo "OK: no cases nav"
```

Expected：

```
2
2
OK: no cases nav
```

- [ ] **Step 3: build 验证**

```bash
cd "D:/Project/中科安樵/WEB" && npm run build
```

Expected: `Compiled successfully`，退出码 0。

---

### Task 9: 站点 Footer 与挂载布局

**Files:**
- Create: `src/components/site-footer.tsx`
- Create: `src/data/company.ts`
- Modify: `src/app/layout.tsx`（挂载 Header/Footer 与 `<main>`）

**Interfaces:**
- Consumes: `Pending` from `@/components/pending`；`PENDING` from `@/data/pending`
- Produces:
  - `src/data/company.ts`：`export const COMPANY = { fullName: "中科安樵（苏州）科技有限公司", address: "中国苏州 · 苏州先进技术研究院", phone: PENDING, email: PENDING, icp: PENDING, copyright: "© 2026 中科安樵（苏州）科技有限公司" }`
  - `export function SiteFooter()`
  - 根布局结构：`<SiteHeader /> <main className="flex-1">{children}</main> <SiteFooter />`

- [ ] **Step 1: 创建 `src/data/company.ts`**

```ts
import { PENDING } from "@/data/pending";

/** 企业公开信息。电话/邮箱/ICP 待业主提供（SPEC §4.2、附:不确定项 4）。 */
export const COMPANY = {
  fullName: "中科安樵（苏州）科技有限公司",
  address: "中国苏州 · 苏州先进技术研究院",
  phone: PENDING,
  email: PENDING,
  icp: PENDING,
  copyright: "© 2026 中科安樵（苏州）科技有限公司",
} as const;
```

- [ ] **Step 2: 创建 `src/components/site-footer.tsx`**

浅色页脚，故用浅底蓝字 logo（SPEC §6.2：深底才用白字版）。

```tsx
import Image from "next/image";
import { COMPANY } from "@/data/company";
import { Pending } from "@/components/pending";
import { isPending } from "@/data/pending";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-bg-warm">
      <div className="container-page grid gap-10 py-12 md:grid-cols-3">
        <div>
          <Image
            src="/images/brand/logo-blue.webp"
            alt="中科安樵（苏州）科技有限公司"
            width={1179}
            height={322}
            className="h-8 w-auto"
          />
          <p className="mt-4 font-medium text-text">{COMPANY.fullName}</p>
          <p className="mt-1 text-text-light">{COMPANY.address}</p>
        </div>

        <div>
          <h2 className="font-semibold text-text">联系方式</h2>
          <dl className="mt-4 space-y-3">
            <div>
              <dt className="text-sm text-text-light">电话</dt>
              <dd className="mt-1">
                {isPending(COMPANY.phone) ? (
                  <Pending label="联系电话" />
                ) : (
                  COMPANY.phone
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-text-light">邮箱</dt>
              <dd className="mt-1">
                {isPending(COMPANY.email) ? (
                  <Pending label="联系邮箱" />
                ) : (
                  COMPANY.email
                )}
              </dd>
            </div>
          </dl>
        </div>

        <div>
          <h2 className="font-semibold text-text">关注公众号</h2>
          <Image
            src="/images/brand/qr.webp"
            alt="中科安樵微信公众号二维码"
            width={422}
            height={423}
            className="mt-4 h-32 w-32 rounded-md border border-border"
          />
        </div>
      </div>

      <div className="border-t border-border">
        <div className="container-page flex flex-col gap-2 py-5 text-sm text-text-light sm:flex-row sm:items-center sm:justify-between">
          <p>{COMPANY.copyright}</p>
          <div className="flex items-center gap-2">
            <span>ICP 备案号</span>
            {isPending(COMPANY.icp) ? (
              <Pending label="ICP 备案号" />
            ) : (
              <span>{COMPANY.icp}</span>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 3: 修改 `src/app/layout.tsx` 挂载 Header/Footer**

把 `<body className="flex min-h-full flex-col">{children}</body>` 替换为：

```tsx
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
```

并在文件顶部 `import "./globals.css";` 之后追加：

```tsx
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
```

- [ ] **Step 4: 验证语义标签齐全**

```bash
cd "D:/Project/中科安樵/WEB"
grep -o "<main" src/app/layout.tsx
grep -o "<SiteHeader />\|<SiteFooter />" src/app/layout.tsx
grep -o "<footer" src/components/site-footer.tsx
```

Expected：

```
<main
<SiteHeader />
<SiteFooter />
<footer
```

- [ ] **Step 5: dev 冒烟（Header/Footer 出现在首页）**

本机存在 `ALL_PROXY=http://127.0.0.1:7897`，直接 `curl` 打本地会返回 **502**。所有本地冒烟必须加 `--noproxy '*'` 并用 `127.0.0.1`（已实测）。

```bash
cd "D:/Project/中科安樵/WEB"
(npm run dev > /tmp/dev.log 2>&1 &) ; sleep 14
curl -sS --noproxy '*' -o /tmp/home.html -w "HTTP %{http_code}\n" http://127.0.0.1:3000/
grep -o "中科安樵（苏州）科技有限公司" /tmp/home.html | head -1
grep -o "获取方案报价" /tmp/home.html | head -1
grep -o "待补充：ICP 备案号" /tmp/home.html | head -1
```

Expected：

```
HTTP 200
中科安樵（苏州）科技有限公司
获取方案报价
待补充：ICP 备案号
```

> 停 dev server：`taskkill //F //IM node.exe`（Git Bash 下双斜杠），或关掉对应终端。后续任务同理。
> 此时 `/images/brand/logo-blue.webp` 与 `qr.webp` 可能尚未生成（Task 22 可并行），图片位置会显示为破图，**不影响本步验证的文本断言**。

- [ ] **Step 6: build 验证**

```bash
cd "D:/Project/中科安樵/WEB" && npm run build
```

Expected: `Compiled successfully`，退出码 0。

---

### Task 10: 产品卡片组件

**Files:**
- Create: `src/components/product-card.tsx`

**Interfaces:**
- Consumes: `Product` / `primaryImage` from `@/data/products`；`isPending` from `@/data/pending`
- Produces: `export function ProductCard({ product }: { product: Product })` —— 供首页产品矩阵与 `/products` 网格复用。卡片内**不显示价格**。

- [ ] **Step 1: 创建 `src/components/product-card.tsx`**

`tagline` 为待填时显示小号「待补充：一句话定位」文本（卡片内空间小，不套完整 `<Pending />` 框，但仍可见）。

```tsx
import Image from "next/image";
import Link from "next/link";
import { isPending } from "@/data/pending";
import { primaryImage, type Product } from "@/data/products";

export function ProductCard({ product }: { product: Product }) {
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
          <p className="text-sm text-text-muted">待补充：产品型号</p>
        ) : (
          <p className="text-sm font-medium text-primary">{product.model}</p>
        )}
        <h3 className="text-lg font-semibold text-text">{product.name}</h3>
        {isPending(product.tagline) ? (
          <p className="text-sm text-text-muted">待补充：一句话定位</p>
        ) : (
          <p className="text-text-light">{product.tagline}</p>
        )}
        <span className="mt-auto pt-3 text-primary group-hover:text-primary-dark">
          查看详情 →
        </span>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: 验证无价格字样**

```bash
cd "D:/Project/中科安樵/WEB"
LC_ALL=C.UTF-8 grep -nE "价格|￥|¥|元/|售价" src/components/product-card.tsx || echo "OK: no price"
grep -o "width={img.width}" src/components/product-card.tsx
grep -o "alt={img.alt}" src/components/product-card.tsx
```

Expected：

```
OK: no price
width={img.width}
alt={img.alt}
```

- [ ] **Step 3: build 验证**

```bash
cd "D:/Project/中科安樵/WEB" && npm run build
```

Expected: `Compiled successfully`，退出码 0。

---

### Task 11: 表单类型与常量模块

**必读实测结论**：`"use server"` 文件里**不能导出非 async 的值**（类型、常量、数组），否则 build 报 `TypeError: Cannot read properties of undefined (reading 'name')`。故类型与常量必须放在本任务的普通模块里。

**Files:**
- Create: `src/lib/lead.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `export type LeadType = "inquiry" | "dealer"`
  - `export type LeadFormState = { ok: boolean; message: string; errors: Record<string, string> }`
  - `export const EMPTY_LEAD_STATE: LeadFormState`
  - `export const INQUIRY_TYPES = ["设备采购", "方案咨询", "经销商加盟"] as const`
  - `export const CUSTOMER_TYPES = ["养老机构", "社区居家", "医疗卫生", "大健康美业", "装修适老化改造", "其他"] as const`
  - `export const LIMITS = { name: 40, phone: 20, organization: 80, product: 80, message: 500 } as const`

- [ ] **Step 1: 创建 `src/lib/lead.ts`**

```ts
/** 表单来源：询价页 / 招商页共用同一个 Server Action（SPEC §5.8）。 */
export type LeadType = "inquiry" | "dealer";

export type LeadFormState = {
  ok: boolean;
  message: string;
  /** 字段名 → 错误文案，渲染在对应字段下方（不用 alert）。 */
  errors: Record<string, string>;
};

export const EMPTY_LEAD_STATE: LeadFormState = {
  ok: false,
  message: "",
  errors: {},
};

/** 咨询类型（必填 select，SPEC §5.8）。 */
export const INQUIRY_TYPES = ["设备采购", "方案咨询", "经销商加盟"] as const;

/** 客户类型（可选 select，SPEC §5.8）。 */
export const CUSTOMER_TYPES = [
  "养老机构",
  "社区居家",
  "医疗卫生",
  "大健康美业",
  "装修适老化改造",
  "其他",
] as const;

/** 输入长度上限（SPEC §2.3：拒绝超长输入）。 */
export const LIMITS = {
  name: 40,
  phone: 20,
  organization: 80,
  product: 80,
  message: 500,
} as const;
```

- [ ] **Step 2: 验证常量取值与 SPEC §5.8 一致**

```bash
cd "D:/Project/中科安樵/WEB"
cat > check-tmp.ts <<'EOF'
import { INQUIRY_TYPES, CUSTOMER_TYPES, LIMITS, EMPTY_LEAD_STATE } from "@/lib/lead";
console.log("inquiry:", INQUIRY_TYPES.join("/"));
console.log("customer count:", CUSTOMER_TYPES.length);
console.log("limits:", JSON.stringify(LIMITS));
console.log("empty state ok:", EMPTY_LEAD_STATE.ok === false && Object.keys(EMPTY_LEAD_STATE.errors).length === 0);
EOF
npx --yes tsx ./check-tmp.ts
rm check-tmp.ts
```

Expected 精确输出：

```
inquiry: 设备采购/方案咨询/经销商加盟
customer count: 6
limits: {"name":40,"phone":20,"organization":80,"product":80,"message":500}
empty state ok: true
```

- [ ] **Step 3: build 验证**

```bash
cd "D:/Project/中科安樵/WEB" && npm run build
```

Expected: `Compiled successfully`，退出码 0。

---

### Task 12: 表单 Server Action

手写校验，**不引 zod**（C3）。Next 16 的 `headers()` 是 async，必须 `await`。

**Files:**
- Create: `src/actions/submit-lead.ts`
- Modify: `.gitignore`（追加 `data/`）

**Interfaces:**
- Consumes: `LeadFormState` / `LIMITS` / `INQUIRY_TYPES` / `CUSTOMER_TYPES` from `@/lib/lead`
- Produces: `export async function submitLead(prev: LeadFormState, formData: FormData): Promise<LeadFormState>` —— 本文件**只导出这一个 async 函数**。写入 `data/leads.jsonl` 的记录形状：`{ type, name, phone, organization, inquiryType, customerType, product, message, submittedAt, source }`

- [ ] **Step 1: 创建 `src/actions/submit-lead.ts`**

```ts
"use server";

import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { headers } from "next/headers";
import {
  CUSTOMER_TYPES,
  INQUIRY_TYPES,
  LIMITS,
  type LeadFormState,
} from "@/lib/lead";

/** 电话允许数字、空格、加号、减号、括号。 */
const PHONE_RE = /^[0-9+\-()\s]{5,20}$/;

function field(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function submitLead(
  _prev: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  const type = field(formData, "type") === "dealer" ? "dealer" : "inquiry";
  const name = field(formData, "name");
  const phone = field(formData, "phone");
  const organization = field(formData, "organization");
  const inquiryType = field(formData, "inquiryType");
  const customerType = field(formData, "customerType");
  const product = field(formData, "product");
  const message = field(formData, "message");

  const errors: Record<string, string> = {};

  if (!name) errors.name = "请填写姓名";
  else if (name.length > LIMITS.name)
    errors.name = `姓名不能超过 ${LIMITS.name} 个字符`;

  if (!phone) errors.phone = "请填写联系电话";
  else if (phone.length > LIMITS.phone)
    errors.phone = `联系电话不能超过 ${LIMITS.phone} 个字符`;
  else if (!PHONE_RE.test(phone)) errors.phone = "联系电话格式不正确";

  if (!organization) errors.organization = "请填写机构/公司名称";
  else if (organization.length > LIMITS.organization)
    errors.organization = `机构/公司名称不能超过 ${LIMITS.organization} 个字符`;

  if (!inquiryType) errors.inquiryType = "请选择咨询类型";
  else if (!(INQUIRY_TYPES as readonly string[]).includes(inquiryType))
    errors.inquiryType = "咨询类型不在可选范围内";

  if (customerType && !(CUSTOMER_TYPES as readonly string[]).includes(customerType))
    errors.customerType = "客户类型不在可选范围内";

  if (product.length > LIMITS.product)
    errors.product = `意向产品不能超过 ${LIMITS.product} 个字符`;

  if (message.length > LIMITS.message)
    errors.message = `需求说明不能超过 ${LIMITS.message} 个字符`;

  if (Object.keys(errors).length > 0) {
    return { ok: false, message: "请检查表单填写", errors };
  }

  const requestHeaders = await headers();
  const source = requestHeaders.get("referer") ?? "unknown";

  const record = {
    type,
    name,
    phone,
    organization,
    inquiryType,
    customerType: customerType || null,
    product: product || null,
    message: message || null,
    submittedAt: new Date().toISOString(),
    source,
  };

  const dir = path.join(process.cwd(), "data");
  await mkdir(dir, { recursive: true });
  await appendFile(
    path.join(dir, "leads.jsonl"),
    `${JSON.stringify(record)}\n`,
    "utf8",
  );

  return { ok: true, message: "提交成功，我们会尽快与您联系。", errors: {} };
}
```

- [ ] **Step 2: 追加 `data/` 到 `.gitignore`**

在 `.gitignore` 末尾追加：

```
# 客户线索（含个人信息，不入版本库）
data/
```

- [ ] **Step 3: 验证本文件只导出 async 函数（Next 16 硬约束）**

```bash
cd "D:/Project/中科安樵/WEB"
grep -nE "^export (const|type|let|var|interface)" src/actions/submit-lead.ts && echo "FAIL: non-async export in use-server file" || echo "OK: only async export"
grep -o "await headers()" src/actions/submit-lead.ts
grep -o "^data/$" .gitignore
```

Expected：

```
OK: only async export
await headers()
data/
```

- [ ] **Step 4: build 验证**

```bash
cd "D:/Project/中科安樵/WEB" && npm run build
```

Expected: `Compiled successfully`，退出码 0。（表单的实际写入验证在 Task 13 挂上组件后进行。）

---

### Task 13: 表单组件（询价/招商共用）

**Files:**
- Create: `src/components/lead-form.tsx`

**Interfaces:**
- Consumes: `submitLead` from `@/actions/submit-lead`；`EMPTY_LEAD_STATE` / `INQUIRY_TYPES` / `CUSTOMER_TYPES` / `LIMITS` / `LeadType` from `@/lib/lead`
- Produces: `export function LeadForm({ type, defaultProduct, defaultInquiryType }: { type: LeadType; defaultProduct?: string; defaultInquiryType?: string })`

- [ ] **Step 1: 创建 `src/components/lead-form.tsx` —— 头部与前 3 个字段**

```tsx
"use client";

import { useActionState } from "react";
import { submitLead } from "@/actions/submit-lead";
import {
  CUSTOMER_TYPES,
  EMPTY_LEAD_STATE,
  INQUIRY_TYPES,
  LIMITS,
  type LeadType,
} from "@/lib/lead";

const LABEL = "block text-sm font-medium text-text";
const INPUT =
  "focus-ring mt-2 block w-full rounded-md border border-border bg-white px-3 py-2 text-text";
const ERROR = "mt-1 text-sm text-[#B4342C]";

export function LeadForm({
  type,
  defaultProduct = "",
  defaultInquiryType = "",
}: {
  type: LeadType;
  defaultProduct?: string;
  defaultInquiryType?: string;
}) {
  const [state, formAction, pending] = useActionState(
    submitLead,
    EMPTY_LEAD_STATE,
  );

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="type" value={type} />

      <div>
        <label htmlFor="lead-name" className={LABEL}>
          姓名 <span aria-hidden="true">*</span>
        </label>
        <input
          id="lead-name"
          name="name"
          type="text"
          required
          maxLength={LIMITS.name}
          aria-describedby={state.errors.name ? "err-name" : undefined}
          className={INPUT}
        />
        {state.errors.name ? (
          <p id="err-name" className={ERROR}>
            {state.errors.name}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="lead-phone" className={LABEL}>
          联系电话 <span aria-hidden="true">*</span>
        </label>
        <input
          id="lead-phone"
          name="phone"
          type="tel"
          required
          maxLength={LIMITS.phone}
          aria-describedby={state.errors.phone ? "err-phone" : undefined}
          className={INPUT}
        />
        {state.errors.phone ? (
          <p id="err-phone" className={ERROR}>
            {state.errors.phone}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="lead-organization" className={LABEL}>
          机构/公司名称 <span aria-hidden="true">*</span>
        </label>
        <input
          id="lead-organization"
          name="organization"
          type="text"
          required
          maxLength={LIMITS.organization}
          aria-describedby={
            state.errors.organization ? "err-organization" : undefined
          }
          className={INPUT}
        />
        {state.errors.organization ? (
          <p id="err-organization" className={ERROR}>
            {state.errors.organization}
          </p>
        ) : null}
      </div>

      {/* LEAD-FORM-REST-MARKER */}
    </form>
  );
}
```

- [ ] **Step 2: 替换 `{/* LEAD-FORM-REST-MARKER */}` 为其余字段与提交区**

```tsx
      <div>
        <label htmlFor="lead-inquiry-type" className={LABEL}>
          咨询类型 <span aria-hidden="true">*</span>
        </label>
        <select
          id="lead-inquiry-type"
          name="inquiryType"
          required
          defaultValue={defaultInquiryType}
          aria-describedby={
            state.errors.inquiryType ? "err-inquiry-type" : undefined
          }
          className={INPUT}
        >
          <option value="">请选择</option>
          {INQUIRY_TYPES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        {state.errors.inquiryType ? (
          <p id="err-inquiry-type" className={ERROR}>
            {state.errors.inquiryType}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="lead-customer-type" className={LABEL}>
          客户类型
        </label>
        <select
          id="lead-customer-type"
          name="customerType"
          defaultValue=""
          aria-describedby={
            state.errors.customerType ? "err-customer-type" : undefined
          }
          className={INPUT}
        >
          <option value="">请选择（可不填）</option>
          {CUSTOMER_TYPES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        {state.errors.customerType ? (
          <p id="err-customer-type" className={ERROR}>
            {state.errors.customerType}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="lead-product" className={LABEL}>
          意向产品
        </label>
        <input
          id="lead-product"
          name="product"
          type="text"
          maxLength={LIMITS.product}
          defaultValue={defaultProduct}
          aria-describedby={state.errors.product ? "err-product" : undefined}
          className={INPUT}
        />
        {state.errors.product ? (
          <p id="err-product" className={ERROR}>
            {state.errors.product}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="lead-message" className={LABEL}>
          需求说明
        </label>
        <textarea
          id="lead-message"
          name="message"
          rows={4}
          maxLength={LIMITS.message}
          aria-describedby={state.errors.message ? "err-message" : undefined}
          className={INPUT}
        />
        {state.errors.message ? (
          <p id="err-message" className={ERROR}>
            {state.errors.message}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="focus-ring inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
      >
        {pending ? "提交中…" : "提交"}
      </button>

      <p aria-live="polite" role="status">
        {state.ok ? (
          <span className="block rounded-md bg-primary-light px-4 py-3 text-primary-dark">
            {state.message}
          </span>
        ) : state.message ? (
          <span className={ERROR}>{state.message}</span>
        ) : null}
      </p>
```

- [ ] **Step 3: 验证 label 关联齐全、无 alert**

7 个字段各有一个 `htmlFor`；`type` 为 hidden 不需要 label。

```bash
cd "D:/Project/中科安樵/WEB"
echo -n "htmlFor count: "; grep -o "htmlFor=" src/components/lead-form.tsx | wc -l
echo -n "label count: "; grep -o "<label" src/components/lead-form.tsx | wc -l
grep -n "alert(" src/components/lead-form.tsx && echo "FAIL: alert used" || echo "OK: no alert"
grep -o 'aria-live="polite"' src/components/lead-form.tsx
```

Expected：

```
htmlFor count: 7
label count: 7
OK: no alert
aria-live="polite"
```

- [ ] **Step 4: build 验证**

```bash
cd "D:/Project/中科安樵/WEB" && npm run build
```

Expected: `Compiled successfully`，退出码 0。（表单端到端写入验证在 Task 21 `/contact` 页面就位后进行。）

---

### Task 14: 首页 `/`（7 区块）

区块顺序严格照 SPEC §5.1：Hero → 核心优势 4 卡 → 产品矩阵 11 卡 → 场景 5 卡 → 经销商引流条 → 最新动态 3 条 → 底部询价 CTA。

**Files:**
- Modify: `src/app/page.tsx`（整文件替换脚手架默认内容）
- Delete: `public/file.svg` `public/globe.svg` `public/next.svg` `public/vercel.svg` `public/window.svg`（脚手架示例素材，默认页删除后不再引用）

**Interfaces:**
- Consumes: `CtaLink` / `Section` / `ProductCard`；`products` from `@/data/products`；`news` from `@/data/news`；`solutions` from `@/data/solutions`；`isPending` from `@/data/pending`
- Produces: 路由 `/`

- [ ] **Step 1: 删除脚手架示例 SVG**

```bash
cd "D:/Project/中科安樵/WEB"
rm -f public/file.svg public/globe.svg public/next.svg public/vercel.svg public/window.svg
ls public
```

Expected: `public` 下已无这 5 个 svg（此时可能为空目录，Task 22 会创建 `images/`）。

- [ ] **Step 2: 整文件替换 `src/app/page.tsx` —— 导入与 Hero**

```tsx
import Image from "next/image";
import Link from "next/link";
import { CtaLink } from "@/components/cta";
import { Section } from "@/components/section";
import { ProductCard } from "@/components/product-card";
import { isPending } from "@/data/pending";
import { news } from "@/data/news";
import { products } from "@/data/products";
import { solutions } from "@/data/solutions";

const ADVANTAGES = [
  {
    title: "清华同源技术",
    body: "引入清华研发的睡眠毫米波雷达技术。",
  },
  {
    title: "60GHz 毫米波",
    body: "纯雷达感知，零摄像头零麦克风，保护隐私。",
  },
  {
    title: "完整产品矩阵",
    body: "覆盖床位守护、跌倒告警、健康筛查、轨迹监测等多场景。",
  },
  {
    title: "24 个月质保只换不修",
    body: "非人为故障质保期内一律换新。",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="bg-primary-light">
        <div className="container-page grid items-center gap-10 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <h1 className="text-3xl font-semibold leading-tight text-text sm:text-4xl">
              清华同源技术 · 精准健康监测
            </h1>
            <p className="mt-5 text-lg text-text-light">
              中科安樵 —
              为养老机构、医疗卫生与大健康场景提供 60GHz 毫米波无感监测设备
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <CtaLink href="/contact">获取方案报价</CtaLink>
              <CtaLink href="/dealers" variant="secondary">
                成为经销商
              </CtaLink>
            </div>
          </div>
          <Image
            src="/images/products/zq-sh100/scene.webp"
            alt="ZQ-SH100 AI健康守护仪 场景图"
            width={1536}
            height={1024}
            priority
            className="w-full rounded-lg border border-border bg-white object-contain"
          />
        </div>
      </section>

      {/* HOME-REST-MARKER */}
    </>
  );
}
```

- [ ] **Step 3: 替换 `{/* HOME-REST-MARKER */}` 为区块 2–4（核心优势、产品矩阵、场景入口）**

```tsx
      <Section title="核心优势" tone="bg">
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ADVANTAGES.map((item) => (
            <li
              key={item.title}
              className="rounded-lg border border-border bg-white p-6"
            >
              <h3 className="text-lg font-semibold text-text">{item.title}</h3>
              <p className="mt-3 text-text-light">{item.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="产品矩阵"
        lead="覆盖床位守护、跌倒告警、健康筛查、轨迹监测的完整设备矩阵"
        tone="warm"
      >
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <li key={product.slug}>
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
        <div className="mt-8">
          <CtaLink href="/products" variant="secondary">
            查看全部产品
          </CtaLink>
        </div>
      </Section>

      <Section title="场景方案" tone="bg">
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {solutions.map((item) => (
            <li key={item.anchor}>
              <Link
                href={`/solutions#${item.anchor}`}
                className="focus-ring flex h-full flex-col rounded-lg border border-border bg-white p-6 transition-shadow hover:shadow-md"
              >
                <h3 className="text-lg font-semibold text-text">{item.name}</h3>
                <p className="mt-2 text-sm text-text-light">{item.buyer}</p>
                <span className="mt-auto pt-4 text-primary">查看方案 →</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
```

- [ ] **Step 4: 在 Step 3 内容之后追加区块 5–7（经销商引流条、最新动态、底部 CTA）**

新闻日期为待填时显示「日期待补充」小字（卡片内空间小，不套完整 `<Pending />` 框，但保持可见）。

```tsx
      <section className="bg-primary">
        <div className="container-page flex flex-col gap-6 py-12 md:flex-row md:items-center md:justify-between">
          <p className="text-lg text-white">
            从 0 起步的渠道机会 — 完整赋能培训体系 · 区域政策 · 产品矩阵支持
          </p>
          <CtaLink href="/dealers" variant="secondary" className="shrink-0">
            了解招商政策
          </CtaLink>
        </div>
      </section>

      <Section title="最新动态" tone="warm">
        <ul className="grid gap-5 lg:grid-cols-3">
          {news.slice(0, 3).map((item) => (
            <li key={item.slug}>
              <Link
                href={`/news/${item.slug}`}
                className="focus-ring flex h-full flex-col rounded-lg border border-border bg-white p-6 transition-shadow hover:shadow-md"
              >
                <p className="text-sm text-text-muted">
                  {isPending(item.date) ? "日期待补充" : item.date}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-text">
                  {item.title}
                </h3>
                <p className="mt-3 text-text-light">{item.summary}</p>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-8">
          <CtaLink href="/news" variant="secondary">
            查看全部动态
          </CtaLink>
        </div>
      </Section>

      <Section tone="bg">
        <div className="rounded-lg border border-border bg-white p-10 text-center">
          <h2 className="text-2xl font-semibold text-text">
            需要为您的场景匹配设备组合？
          </h2>
          <p className="mt-3 text-text-light">
            告诉我们机构类型与场景需求，我们提供对应的设备方案与报价。
          </p>
          <div className="mt-8 flex justify-center">
            <CtaLink href="/contact">获取方案报价</CtaLink>
          </div>
        </div>
      </Section>
```

- [ ] **Step 5: 合规与结构验证**

```bash
cd "D:/Project/中科安樵/WEB"
LC_ALL=C.UTF-8 grep -nE "医疗级|诊断|治疗|疗效|临床验证|临床认证|注册证|包治|治愈|替代医生|医疗器械" src/app/page.tsx || echo "OK: no banned words"
LC_ALL=C.UTF-8 grep -nE "[0-9]+(\.[0-9]+)?%" src/app/page.tsx || echo "OK: no percentage"
LC_ALL=C.UTF-8 grep -nE "价格|￥|¥|售价|案例" src/app/page.tsx || echo "OK: no price/cases"
echo -n "sections: "; grep -oE "<Section|<section" src/app/page.tsx | wc -l
```

Expected：

```
OK: no banned words
OK: no percentage
OK: no price/cases
sections: 7
```

- [ ] **Step 6: dev 冒烟**

`ALL_PROXY` 存在时 curl 打本地会 502，必须加 `--noproxy '*'`（已实测）。

```bash
cd "D:/Project/中科安樵/WEB"
(npm run dev > /tmp/dev.log 2>&1 &) ; sleep 14
curl -sS --noproxy '*' -o /tmp/home.html -w "HTTP %{http_code}\n" http://127.0.0.1:3000/
grep -o "清华同源技术 · 精准健康监测" /tmp/home.html | head -1
grep -o "成为经销商" /tmp/home.html | head -1
echo -n "product cards: "; grep -o 'href="/products/[a-z0-9-]*"' /tmp/home.html | sort -u | wc -l
echo -n "solution anchors: "; grep -o 'href="/solutions#[a-z]*"' /tmp/home.html | sort -u | wc -l
echo -n "news links: "; grep -o 'href="/news/[a-z0-9-]*"' /tmp/home.html | sort -u | wc -l
```

Expected：

```
HTTP 200
清华同源技术 · 精准健康监测
成为经销商
product cards: 11
solution anchors: 5
news links: 3
```

> 停 dev server：`taskkill //F //IM node.exe`（Git Bash 下双斜杠）或关掉对应终端。后续任务同理。

- [ ] **Step 7: build 验证**

```bash
cd "D:/Project/中科安樵/WEB" && npm run build
```

Expected: `Compiled successfully`，路由表含 `/`，退出码 0。


---

### Task 15: 产品中心 `/products`

**不实现按场景筛选**：`scenes` 全 11 款为空数组（SPEC 附:不确定项 2，产品-场景对应关系未梳理，禁止推测搭配）。SPEC §5.2 中筛选为「可选」，数据不存在时不实现，也不许自造场景标签。见末尾阻塞点 B2。

**Files:**
- Create: `src/app/products/page.tsx`

**Interfaces:**
- Consumes: `Section` from `@/components/section`；`ProductCard` from `@/components/product-card`；`products` from `@/data/products`
- Produces: 路由 `/products`；导出 `metadata`

- [ ] **Step 1: 创建 `src/app/products/page.tsx`**

```tsx
import type { Metadata } from "next";
import { Section } from "@/components/section";
import { ProductCard } from "@/components/product-card";
import { products } from "@/data/products";

export const metadata: Metadata = {
  title: "产品中心 | 中科安樵",
  description: "覆盖床位守护、跌倒告警、健康筛查、轨迹监测的完整设备矩阵。",
};

export default function ProductsPage() {
  return (
    <Section
      title="产品中心"
      lead="覆盖床位守护、跌倒告警、健康筛查、轨迹监测的完整设备矩阵"
      tone="bg"
    >
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <li key={product.slug}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    </Section>
  );
}
```

- [ ] **Step 2: 合规验证（无价格、无禁用词）**

```bash
cd "D:/Project/中科安樵/WEB"
LC_ALL=C.UTF-8 grep -nE "医疗级|诊断|治疗|疗效|临床验证|临床认证|注册证|包治|治愈|替代医生|医疗器械" src/app/products/page.tsx || echo "OK: no banned words"
LC_ALL=C.UTF-8 grep -nE "价格|￥|¥|售价|[0-9]+(\.[0-9]+)?%" src/app/products/page.tsx || echo "OK: no price/percentage"
```

Expected：

```
OK: no banned words
OK: no price/percentage
```

- [ ] **Step 3: dev 冒烟（11 卡齐全）**

```bash
cd "D:/Project/中科安樵/WEB"
(npm run dev > /tmp/dev.log 2>&1 &) ; sleep 14
curl -sS --noproxy '*' -o /tmp/products.html -w "HTTP %{http_code}\n" http://127.0.0.1:3000/products
echo -n "cards: "; grep -o 'href="/products/[a-z0-9-]*"' /tmp/products.html | sort -u | wc -l
grep -o "待补充：一句话定位" /tmp/products.html | head -1
grep -o "待补充：产品型号" /tmp/products.html | head -1
```

Expected：

```
HTTP 200
cards: 11
待补充：一句话定位
待补充：产品型号
```

- [ ] **Step 4: build 验证**

```bash
cd "D:/Project/中科安樵/WEB" && npm run build
```

Expected: `Compiled successfully`，路由表含 `/products`，退出码 0。

---

### Task 16: 产品详情 `/products/[slug]`（11 页）

Next 16 中 `params` 是 **Promise**，必须 `await`。

**Files:**
- Create: `src/app/products/[slug]/page.tsx`

**Interfaces:**
- Consumes: `Section` / `CtaLink` / `Pending`；`products` / `getProduct` / `WARRANTY_TEXT` from `@/data/products`；`isPending` from `@/data/pending`
- Produces: 路由 `/products/<slug>` × 11；`generateStaticParams()` 返回 11 个 slug；`generateMetadata()`

- [ ] **Step 1: 创建 `src/app/products/[slug]/page.tsx` —— 头部、静态参数、图区与信息区**

```tsx
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { CtaLink } from "@/components/cta";
import { Pending } from "@/components/pending";
import { Section } from "@/components/section";
import { isPending } from "@/data/pending";
import { getProduct, products, WARRANTY_TEXT } from "@/data/products";

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) return { title: "产品未找到 | 中科安樵" };
  return {
    title: `${product.name} | 中科安樵`,
    description: isPending(product.tagline)
      ? `${product.name} 产品信息。`
      : product.tagline,
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  return (
    <>
      <Section tone="bg">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="space-y-4">
            {product.images.map((img) => (
              <Image
                key={img.src}
                src={img.src}
                alt={img.alt}
                width={img.width}
                height={img.height}
                className="w-full rounded-lg border border-border bg-white object-contain p-4"
              />
            ))}
          </div>

          <div>
            {isPending(product.model) ? (
              <Pending label="产品型号" />
            ) : (
              <p className="text-sm font-medium text-primary">{product.model}</p>
            )}
            <h1 className="mt-3 text-3xl font-semibold text-text">
              {product.name}
            </h1>

            {isPending(product.officialName) ? (
              <div className="mt-3">
                <Pending label="正式产品名称" />
              </div>
            ) : null}

            <div className="mt-4">
              {isPending(product.tagline) ? (
                <Pending label="一句话定位" />
              ) : (
                <p className="text-lg text-text-light">{product.tagline}</p>
              )}
            </div>

            <h2 className="mt-8 text-lg font-semibold text-text">核心卖点</h2>
            <div className="mt-3">
              {product.features.length > 0 ? (
                <ul className="space-y-2">
                  {product.features.map((feature) => (
                    <li key={feature} className="flex gap-2 text-text-light">
                      <span aria-hidden="true" className="text-primary">
                        ·
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Pending label="核心卖点" />
              )}
            </div>

            <h2 className="mt-8 text-lg font-semibold text-text">适用场景</h2>
            <div className="mt-3">
              {product.scenes.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {product.scenes.map((scene) => (
                    <li
                      key={scene}
                      className="rounded-md bg-primary-light px-3 py-1 text-sm text-primary-dark"
                    >
                      {scene}
                    </li>
                  ))}
                </ul>
              ) : (
                <Pending label="适用场景标签" />
              )}
            </div>

            <div className="mt-8">
              <CtaLink href={`/contact?product=${product.slug}`}>
                获取报价
              </CtaLink>
            </div>
          </div>
        </div>
      </Section>

      {/* PRODUCT-DETAIL-REST-MARKER */}
    </>
  );
}
```

- [ ] **Step 2: 替换 `{/* PRODUCT-DETAIL-REST-MARKER */}` 为技术参数、适用客户、质保三块**

```tsx
      <Section title="技术参数" tone="warm">
        {product.spec === null ? (
          <Pending label="技术参数" />
        ) : (
          <p className="whitespace-pre-line text-text-light">{product.spec}</p>
        )}
      </Section>

      <Section title="适用客户" tone="bg">
        {product.customers === null ? (
          <Pending label="适用客户" />
        ) : (
          <p className="whitespace-pre-line text-text-light">
            {product.customers}
          </p>
        )}
      </Section>

      <Section title="质保说明" tone="warm">
        <p className="text-text-light">{product.warranty}</p>
        <p className="mt-2 text-sm text-text-muted">
          统一政策：{WARRANTY_TEXT}
        </p>
      </Section>
```

- [ ] **Step 3: 合规验证**

```bash
cd "D:/Project/中科安樵/WEB"
LC_ALL=C.UTF-8 grep -nE "医疗级|诊断|治疗|疗效|临床验证|临床认证|注册证|包治|治愈|替代医生|医疗器械" src/app/products/\[slug\]/page.tsx || echo "OK: no banned words"
LC_ALL=C.UTF-8 grep -nE "价格|￥|¥|售价|[0-9]+(\.[0-9]+)?%" src/app/products/\[slug\]/page.tsx || echo "OK: no price/percentage"
grep -o "await params" src/app/products/\[slug\]/page.tsx | head -2
```

Expected：

```
OK: no banned words
OK: no price/percentage
await params
await params
```

- [ ] **Step 4: dev 冒烟 —— 11 个 slug 全部 200，占位可见**

```bash
cd "D:/Project/中科安樵/WEB"
(npm run dev > /tmp/dev.log 2>&1 &) ; sleep 14
for s in zq-sh100 zq-d100 za100 zq50 zq-bh100 zq-gj100 zq-zh100 zqkfc100 zq-w100 smart-switch platform; do
  code=$(curl -sS --noproxy '*' -o /tmp/p.html -w "%{http_code}" "http://127.0.0.1:3000/products/$s")
  echo "$s $code"
done
curl -sS --noproxy '*' -o /tmp/d1.html http://127.0.0.1:3000/products/zq-sh100
grep -o "待补充：技术参数" /tmp/d1.html | head -1
grep -o "待补充：适用客户" /tmp/d1.html | head -1
grep -o "待补充：适用场景标签" /tmp/d1.html | head -1
grep -o 'href="/contact?product=zq-sh100"' /tmp/d1.html | head -1
curl -sS --noproxy '*' -o /tmp/d2.html http://127.0.0.1:3000/products/platform
grep -o "待补充：产品型号" /tmp/d2.html | head -1
grep -o "待补充：正式产品名称" /tmp/d2.html | head -1
```

Expected：

```
zq-sh100 200
zq-d100 200
za100 200
zq50 200
zq-bh100 200
zq-gj100 200
zq-zh100 200
zqkfc100 200
zq-w100 200
smart-switch 200
platform 200
待补充：技术参数
待补充：适用客户
待补充：适用场景标签
href="/contact?product=zq-sh100"
待补充：产品型号
待补充：正式产品名称
```

- [ ] **Step 5: build 验证（11 个静态页）**

```bash
cd "D:/Project/中科安樵/WEB" && npm run build 2>&1 | tail -25
```

Expected: `Compiled successfully`；路由表出现 `/products/[slug]` 且标注生成了 11 个静态路径（如 `● /products/[slug]` 下列出 11 条），退出码 0。


---

### Task 17: 解决方案 `/solutions`（5 场景锚点）

每场景结构：场景痛点 → 推荐设备组合（Pending）→ 交付价值（Pending）→ 询价 CTA。锚点区块加 `scroll-mt-20` 避免被 sticky header 遮挡。

**Files:**
- Create: `src/app/solutions/page.tsx`

**Interfaces:**
- Consumes: `CtaLink` from `@/components/cta`；`Pending` from `@/components/pending`；`solutions` from `@/data/solutions`
- Produces: 路由 `/solutions`；5 个锚点 `#institution` `#community` `#medical` `#wellness` `#retrofit`

- [ ] **Step 1: 创建 `src/app/solutions/page.tsx`**

```tsx
import type { Metadata } from "next";
import { CtaLink } from "@/components/cta";
import { Pending } from "@/components/pending";
import { solutions } from "@/data/solutions";

export const metadata: Metadata = {
  title: "解决方案 | 中科安樵",
  description:
    "面向养老机构、社区居家养老、医疗卫生机构、大健康美业、适老化改造的设备方案。",
};

export default function SolutionsPage() {
  return (
    <>
      <section className="bg-primary-light py-14">
        <div className="container-page">
          <h1 className="text-3xl font-semibold text-text">解决方案</h1>
          <p className="mt-4 text-text-light">
            按场景匹配设备组合，覆盖机构、社区、医疗卫生、大健康与适老化改造。
          </p>
          <nav aria-label="场景导航" className="mt-8">
            <ul className="flex flex-wrap gap-3">
              {solutions.map((item) => (
                <li key={item.anchor}>
                  <a
                    href={`#${item.anchor}`}
                    className="focus-ring inline-block rounded-md border border-primary bg-white px-4 py-2 text-primary hover:bg-primary-light"
                  >
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>

      {solutions.map((item, index) => (
        <section
          key={item.anchor}
          id={item.anchor}
          className={`scroll-mt-20 py-16 ${index % 2 === 0 ? "bg-bg" : "bg-bg-warm"}`}
        >
          <div className="container-page">
            <h2 className="text-2xl font-semibold text-text">{item.name}</h2>
            <p className="mt-2 text-sm text-text-muted">
              决策/买单方：{item.buyer}
            </p>

            <h3 className="mt-8 text-lg font-semibold text-text">场景痛点</h3>
            <ul className="mt-3 space-y-2">
              {item.painPoints.map((point) => (
                <li key={point} className="flex gap-2 text-text-light">
                  <span aria-hidden="true" className="text-primary">
                    ·
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>

            <h3 className="mt-8 text-lg font-semibold text-text">
              推荐设备组合
            </h3>
            <div className="mt-3">
              {item.devices === null ? (
                <Pending label={`${item.name} 推荐设备组合`} />
              ) : (
                <p className="text-text-light">{item.devices}</p>
              )}
            </div>

            <h3 className="mt-8 text-lg font-semibold text-text">交付价值</h3>
            <div className="mt-3">
              {item.value === null ? (
                <Pending label={`${item.name} 交付价值`} />
              ) : (
                <p className="text-text-light">{item.value}</p>
              )}
            </div>

            <div className="mt-8">
              <CtaLink href="/contact">获取方案报价</CtaLink>
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
```

- [ ] **Step 2: 合规验证（无 C 端用语、无禁用词）**

```bash
cd "D:/Project/中科安樵/WEB"
LC_ALL=C.UTF-8 grep -nE "医疗级|诊断|治疗|疗效|临床验证|临床认证|注册证|包治|治愈|替代医生|医疗器械" src/app/solutions/page.tsx || echo "OK: no banned words"
LC_ALL=C.UTF-8 grep -nE "购买|下单|购物车|为您家|选购|价格|[0-9]+(\.[0-9]+)?%" src/app/solutions/page.tsx || echo "OK: no B2C/price"
grep -o "scroll-mt-20" src/app/solutions/page.tsx | head -1
```

Expected：

```
OK: no banned words
OK: no B2C/price
scroll-mt-20
```

- [ ] **Step 3: dev 冒烟（5 锚点 + 10 处 Pending）**

```bash
cd "D:/Project/中科安樵/WEB"
(npm run dev > /tmp/dev.log 2>&1 &) ; sleep 14
curl -sS --noproxy '*' -o /tmp/sol.html -w "HTTP %{http_code}\n" http://127.0.0.1:3000/solutions
for a in institution community medical wellness retrofit; do
  echo -n "$a: "; grep -o "id=\"$a\"" /tmp/sol.html | head -1
done
echo -n "pending blocks: "; grep -o "待补充：" /tmp/sol.html | wc -l
```

Expected：

```
HTTP 200
institution: id="institution"
community: id="community"
medical: id="medical"
wellness: id="wellness"
retrofit: id="retrofit"
pending blocks: 10
```

- [ ] **Step 4: build 验证**

```bash
cd "D:/Project/中科安樵/WEB" && npm run build
```

Expected: `Compiled successfully`，路由表含 `/solutions`，退出码 0。

---

### Task 18: 经销商招商 `/dealers`

话术为「首批渠道合伙人机会」，**不写**「加入我们已有的 XX 家经销商网络」。严禁返利阶梯、区域保护具体规则、样机收费标准、结算方式、价格政策（C4）。

**Files:**
- Create: `src/app/dealers/page.tsx`

**Interfaces:**
- Consumes: `Section`；`LeadForm` from `@/components/lead-form`
- Produces: 路由 `/dealers`；表单 `type="dealer"`、`defaultInquiryType="经销商加盟"`

- [ ] **Step 1: 创建 `src/app/dealers/page.tsx`**

```tsx
import type { Metadata } from "next";
import { Section } from "@/components/section";
import { LeadForm } from "@/components/lead-form";

export const metadata: Metadata = {
  title: "经销商招商 | 中科安樵",
  description:
    "首批渠道合伙人招募：清华同源技术背书、完整产品矩阵、赋能培训体系、24 个月质保只换不修。",
};

const REASONS = [
  {
    title: "清华同源技术背书",
    body: "引入清华研发的睡眠毫米波雷达技术，技术路线可对外讲清楚。",
  },
  {
    title: "完整产品矩阵",
    body: "多场景可组合销售，覆盖床位守护、跌倒告警、健康筛查、轨迹监测。",
  },
  {
    title: "完整赋能培训体系",
    body: "企业已建成经销商赋能培训体系，渠道上手有章可循。",
  },
  {
    title: "24 个月质保只换不修",
    body: "非人为故障质保期内一律换新，售后有明文政策支撑。",
  },
];

const STEPS = [
  { step: "01", title: "提交意向", body: "填写下方意向登记表单。" },
  { step: "02", title: "沟通对接", body: "我们与您沟通区域、场景与合作方式。" },
  { step: "03", title: "培训认证", body: "参加产品与销售赋能培训。" },
  { step: "04", title: "签约授权", body: "完成签约与渠道授权。" },
];

export default function DealersPage() {
  return (
    <>
      <section className="bg-primary-light py-14">
        <div className="container-page">
          <h1 className="text-3xl font-semibold text-text">
            首批渠道合伙人招募
          </h1>
          <p className="mt-4 max-w-3xl text-text-light">
            安樵渠道从 0 起步，现招募首批渠道合伙人。详细渠道政策在意向沟通阶段提供。
          </p>
        </div>
      </section>

      <Section title="为什么选安樵" tone="bg">
        <ul className="grid gap-5 sm:grid-cols-2">
          {REASONS.map((item) => (
            <li
              key={item.title}
              className="rounded-lg border border-border bg-white p-6"
            >
              <h3 className="text-lg font-semibold text-text">{item.title}</h3>
              <p className="mt-3 text-text-light">{item.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="合作流程" tone="warm">
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((item) => (
            <li
              key={item.step}
              className="rounded-lg border border-border bg-white p-6"
            >
              <p className="text-sm font-medium text-primary">{item.step}</p>
              <h3 className="mt-2 text-lg font-semibold text-text">
                {item.title}
              </h3>
              <p className="mt-2 text-text-light">{item.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-text-muted">
          详细渠道政策在意向沟通阶段提供。
        </p>
      </Section>

      <Section title="意向登记" lead="填写后我们会尽快与您联系。" tone="bg">
        <div className="max-w-2xl">
          <LeadForm type="dealer" defaultInquiryType="经销商加盟" />
        </div>
      </Section>
    </>
  );
}
```

- [ ] **Step 2: 合规验证（无渠道机密、无禁用词）**

```bash
cd "D:/Project/中科安樵/WEB"
LC_ALL=C.UTF-8 grep -nE "返利|区域保护|样机收费|结算方式|价格政策|折扣|提成比例" src/app/dealers/page.tsx || echo "OK: no channel secrets"
LC_ALL=C.UTF-8 grep -nE "医疗级|诊断|治疗|疗效|临床验证|临床认证|注册证|包治|治愈|替代医生|医疗器械" src/app/dealers/page.tsx || echo "OK: no banned words"
LC_ALL=C.UTF-8 grep -nE "[0-9]+(\.[0-9]+)?%|已有.*家经销商" src/app/dealers/page.tsx || echo "OK: no percentage / no existing-network claim"
grep -o '详细渠道政策在意向沟通阶段提供' src/app/dealers/page.tsx | head -1
```

Expected：

```
OK: no channel secrets
OK: no banned words
OK: no percentage / no existing-network claim
详细渠道政策在意向沟通阶段提供
```

- [ ] **Step 3: dev 冒烟（表单 type=dealer 预选招商）**

```bash
cd "D:/Project/中科安樵/WEB"
(npm run dev > /tmp/dev.log 2>&1 &) ; sleep 14
curl -sS --noproxy '*' -o /tmp/dealers.html -w "HTTP %{http_code}\n" http://127.0.0.1:3000/dealers
grep -o '首批渠道合伙人招募' /tmp/dealers.html | head -1
grep -o 'name="type" value="dealer"' /tmp/dealers.html | head -1
grep -o 'id="lead-inquiry-type"' /tmp/dealers.html | head -1
```

Expected：

```
HTTP 200
首批渠道合伙人招募
name="type" value="dealer"
id="lead-inquiry-type"
```

- [ ] **Step 4: build 验证**

```bash
cd "D:/Project/中科安樵/WEB" && npm run build
```

Expected: `Compiled successfully`，路由表含 `/dealers`，退出码 0。

---

### Task 19: 关于我们 `/about`

**本页是全站唯一允许出现 `医疗器械` 的地方，且仅两处**（SPEC §7.0）：
1. 公司简介照抄原句中的「集医疗器械、办公智能……为一体」（描述**公司经营范围**）
2. 资质表述「公司持有医疗器械经营备案凭证」

严禁写成「产品已取得医疗器械注册证」。公司简介与技术路线**照抄 SPEC §5.6 原文，不改写事实**。

**Files:**
- Create: `src/app/about/page.tsx`

**Interfaces:**
- Consumes: `Section` / `Pending`
- Produces: 路由 `/about`

- [ ] **Step 1: 创建 `src/app/about/page.tsx` —— 头部与公司简介、技术路线**

```tsx
import type { Metadata } from "next";
import { Pending } from "@/components/pending";
import { Section } from "@/components/section";

export const metadata: Metadata = {
  title: "关于我们 | 中科安樵",
  description:
    "中科安樵（苏州）科技有限公司成立于 2023 年，在苏州先进技术研究院内孵化设立。",
};

const QUALITY_STAGES = [
  { stage: "签收验货期", time: "7 日内", promise: "质量问题/外观破损/错发 → 免费换新" },
  { stage: "换新保障期", time: "15 日内", promise: "非人为性能故障 → 免费换新" },
  { stage: "质保期", time: "24 个月", promise: "非人为性能故障 → 免费换新" },
];

export default function AboutPage() {
  return (
    <>
      <section className="bg-primary-light py-14">
        <div className="container-page">
          <h1 className="text-3xl font-semibold text-text">关于我们</h1>
          <p className="mt-4 text-text-light">
            清华同源技术 · 60GHz 毫米波 · 精准健康监测
          </p>
        </div>
      </section>

      <Section title="公司简介" tone="bg">
        <p className="max-w-4xl text-text-light">
          中科安樵（苏州）科技有限公司，以智能创新科技为载体，集医疗器械、办公智能、健康管理、智能医疗集成、老人康复、移动应用、智能防控健康监测软件研发与销售为一体。公司成立于
          2023 年，总部位于中国苏州，在苏州先进技术研究院内孵化设立。
        </p>
      </Section>

      <Section title="技术路线" tone="warm">
        <p className="max-w-4xl text-text-light">
          公司打造数字健康管理中心，构建专业研发团队，逐步完善多项核心设备开发，涵盖智慧健康快速通道、无感健康快速筛查、健康子母机、微流控健康快速通道等关键设备。与苏州医工所深度合作，共同研发儿少健康常态化监测及促进方案，并引入清华研发的睡眠毫米波雷达技术，启动数据驱动的医养结合睡眠监测解决方案研发，正式立项启动
          AI 健康守护仪核心研发项目。
        </p>
      </Section>

      {/* ABOUT-REST-MARKER */}
    </>
  );
}
```

- [ ] **Step 2: 替换 `{/* ABOUT-REST-MARKER */}` 为质量保障、资质、团队、发展历程**

```tsx
      <Section title="质量保障" tone="bg">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left">
            <caption className="sr-only">质量保障阶段与承诺</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-3 pr-4 font-semibold text-text">
                  阶段
                </th>
                <th scope="col" className="py-3 pr-4 font-semibold text-text">
                  时间
                </th>
                <th scope="col" className="py-3 font-semibold text-text">
                  保障
                </th>
              </tr>
            </thead>
            <tbody>
              {QUALITY_STAGES.map((row) => (
                <tr key={row.stage} className="border-b border-border">
                  <th scope="row" className="py-3 pr-4 font-medium text-text">
                    {row.stage}
                  </th>
                  <td className="py-3 pr-4 text-text-light">{row.time}</td>
                  <td className="py-3 text-text-light">{row.promise}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="资质" tone="warm">
        <p className="text-text-light">
          公司持有医疗器械经营备案凭证（具备销售二类医疗器械的经营资格）。
        </p>
      </Section>

      <Section title="团队" tone="bg">
        <Pending label="团队介绍" />
      </Section>

      <Section title="发展历程" tone="warm">
        <Pending label="发展历程" />
      </Section>
```

- [ ] **Step 3: 逐一确认 `医疗器械` 只有两处且上下文正确**

```bash
cd "D:/Project/中科安樵/WEB"
echo "=== 医疗器械 occurrences (expect exactly 2) ==="
LC_ALL=C.UTF-8 grep -c "医疗器械" src/app/about/page.tsx
LC_ALL=C.UTF-8 grep -n "医疗器械" src/app/about/page.tsx
echo "=== other banned words (expect none) ==="
LC_ALL=C.UTF-8 grep -nE "医疗级|诊断|治疗|疗效|临床验证|临床认证|注册证|包治|治愈|替代医生" src/app/about/page.tsx || echo "OK: no other banned words"
LC_ALL=C.UTF-8 grep -nE "[0-9]+(\.[0-9]+)?%" src/app/about/page.tsx || echo "OK: no percentage"
```

Expected：`grep -c` 输出 `2`；两行分别是「集医疗器械、办公智能……为一体」与「公司持有医疗器械经营备案凭证……」；且：

```
OK: no other banned words
OK: no percentage
```

> ⚠️ 注意「注册证」不得出现。上面第二处写的是「经营备案凭证」，不是「注册证」。

- [ ] **Step 4: dev 冒烟**

```bash
cd "D:/Project/中科安樵/WEB"
(npm run dev > /tmp/dev.log 2>&1 &) ; sleep 14
curl -sS --noproxy '*' -o /tmp/about.html -w "HTTP %{http_code}\n" http://127.0.0.1:3000/about
grep -o "在苏州先进技术研究院内孵化设立" /tmp/about.html | head -1
grep -o "公司持有医疗器械经营备案凭证" /tmp/about.html | head -1
grep -o "待补充：团队介绍" /tmp/about.html | head -1
grep -o "待补充：发展历程" /tmp/about.html | head -1
echo -n "quality rows: "; grep -o "免费换新" /tmp/about.html | wc -l
```

Expected：

```
HTTP 200
在苏州先进技术研究院内孵化设立
公司持有医疗器械经营备案凭证
待补充：团队介绍
待补充：发展历程
quality rows: 3
```

- [ ] **Step 5: build 验证**

```bash
cd "D:/Project/中科安樵/WEB" && npm run build
```

Expected: `Compiled successfully`，路由表含 `/about`，退出码 0。


---

### Task 20: 新闻动态 `/news` 与详情 `/news/[slug]`

3 条日期与正文全部待填。第 3 条摘要含「进入建设阶段」，严禁「已交付/已采购/成功案例」（C4）。

**Files:**
- Create: `src/app/news/page.tsx`
- Create: `src/app/news/[slug]/page.tsx`

**Interfaces:**
- Consumes: `Section` from `@/components/section`；`Pending` from `@/components/pending`；`news` / `getNewsItem` from `@/data/news`；`isPending` from `@/data/pending`
- Produces: 路由 `/news` 与 `/news/<slug>` × 3；详情页 `generateStaticParams()` 返回 3 个 slug

- [ ] **Step 1: 创建 `src/app/news/page.tsx`**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/section";
import { isPending } from "@/data/pending";
import { news } from "@/data/news";

export const metadata: Metadata = {
  title: "新闻动态 | 中科安樵",
  description: "中科安樵展会行程与项目进展动态。",
};

export default function NewsPage() {
  return (
    <Section title="新闻动态" tone="bg">
      <ul className="space-y-5">
        {news.map((item) => (
          <li key={item.slug}>
            <Link
              href={`/news/${item.slug}`}
              className="focus-ring block rounded-lg border border-border bg-white p-6 transition-shadow hover:shadow-md"
            >
              <p className="text-sm text-text-muted">
                {isPending(item.date) ? "日期待补充" : item.date}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-text">
                {item.title}
              </h2>
              <p className="mt-3 text-text-light">{item.summary}</p>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
```

- [ ] **Step 2: 创建 `src/app/news/[slug]/page.tsx`**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pending } from "@/components/pending";
import { Section } from "@/components/section";
import { isPending } from "@/data/pending";
import { getNewsItem, news } from "@/data/news";

export function generateStaticParams() {
  return news.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = getNewsItem(slug);
  if (!item) return { title: "动态未找到 | 中科安樵" };
  return { title: `${item.title} | 中科安樵`, description: item.summary };
}

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = getNewsItem(slug);
  if (!item) notFound();

  return (
    <Section tone="bg">
      <article className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-semibold text-text">{item.title}</h1>

        <div className="mt-4">
          {isPending(item.date) ? (
            <Pending label="发布日期" />
          ) : (
            <p className="text-sm text-text-muted">{item.date}</p>
          )}
        </div>

        <p className="mt-6 text-lg text-text-light">{item.summary}</p>

        <h2 className="mt-10 text-lg font-semibold text-text">正文</h2>
        <div className="mt-3">
          {isPending(item.body) ? (
            <Pending label="新闻正文" />
          ) : (
            <p className="whitespace-pre-line text-text-light">{item.body}</p>
          )}
        </div>

        <p className="mt-10">
          <Link href="/news" className="focus-ring rounded-md text-primary">
            ← 返回新闻动态
          </Link>
        </p>
      </article>
    </Section>
  );
}
```

- [ ] **Step 3: 合规验证**

```bash
cd "D:/Project/中科安樵/WEB"
LC_ALL=C.UTF-8 grep -rnE "已交付|已采购|成功案例|客户见证" src/app/news/ || echo "OK: no forbidden kaijian phrasing"
LC_ALL=C.UTF-8 grep -rnE "医疗级|诊断|治疗|疗效|临床验证|临床认证|注册证|包治|治愈|替代医生|医疗器械" src/app/news/ || echo "OK: no banned words"
```

Expected：

```
OK: no forbidden kaijian phrasing
OK: no banned words
```

- [ ] **Step 4: dev 冒烟（列表 + 3 条详情）**

```bash
cd "D:/Project/中科安樵/WEB"
(npm run dev > /tmp/dev.log 2>&1 &) ; sleep 14
curl -sS --noproxy '*' -o /tmp/news.html -w "list HTTP %{http_code}\n" http://127.0.0.1:3000/news
echo -n "list items: "; grep -o 'href="/news/[a-z0-9-]*"' /tmp/news.html | sort -u | wc -l
for s in guangzhou-aging-industry-expo-2026 yangtze-delta-health-forum-2026 smart-care-demo-floor; do
  echo -n "$s "; curl -sS --noproxy '*' -o /tmp/n.html -w "%{http_code}\n" "http://127.0.0.1:3000/news/$s"
done
curl -sS --noproxy '*' -o /tmp/n3.html http://127.0.0.1:3000/news/smart-care-demo-floor
grep -o "待补充：发布日期" /tmp/n3.html | head -1
grep -o "待补充：新闻正文" /tmp/n3.html | head -1
grep -o "进入建设阶段" /tmp/n3.html | head -1
```

Expected：

```
list HTTP 200
list items: 3
guangzhou-aging-industry-expo-2026 200
yangtze-delta-health-forum-2026 200
smart-care-demo-floor 200
待补充：发布日期
待补充：新闻正文
进入建设阶段
```

- [ ] **Step 5: build 验证**

```bash
cd "D:/Project/中科安樵/WEB" && npm run build
```

Expected: `Compiled successfully`，路由表含 `/news` 与 `/news/[slug]`（3 个静态路径），退出码 0。

---

### Task 21: 联系我们 `/contact` + AI 扩展位

`searchParams` 在 Next 16 是 **Promise**，必须 `await`。本任务同时完成表单端到端写入验证。

**Files:**
- Create: `src/app/contact/page.tsx`
- Create: `src/app/api/ai/README.md`

**Interfaces:**
- Consumes: `Section` / `Pending` / `LeadForm`；`COMPANY` from `@/data/company`；`isPending` from `@/data/pending`
- Produces: 路由 `/contact`，支持 `?product=<slug>` 预填；`src/app/api/ai/` 仅含 README（无 `route.ts`，故不产生路由）

- [ ] **Step 1: 创建 `src/app/contact/page.tsx`**

```tsx
import type { Metadata } from "next";
import Image from "next/image";
import { LeadForm } from "@/components/lead-form";
import { Pending } from "@/components/pending";
import { Section } from "@/components/section";
import { COMPANY } from "@/data/company";
import { isPending } from "@/data/pending";

export const metadata: Metadata = {
  title: "联系我们 | 中科安樵",
  description: "设备采购、方案咨询与经销商加盟意向登记。",
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product } = await searchParams;

  return (
    <Section title="联系我们" tone="bg">
      <div className="grid gap-12 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold text-text">联系信息</h2>
          <dl className="mt-5 space-y-5">
            <div>
              <dt className="text-sm text-text-light">公司全称</dt>
              <dd className="mt-1 text-text">{COMPANY.fullName}</dd>
            </div>
            <div>
              <dt className="text-sm text-text-light">地址</dt>
              <dd className="mt-1 text-text">{COMPANY.address}</dd>
            </div>
            <div>
              <dt className="text-sm text-text-light">电话</dt>
              <dd className="mt-1">
                {isPending(COMPANY.phone) ? (
                  <Pending label="联系电话" />
                ) : (
                  COMPANY.phone
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-text-light">邮箱</dt>
              <dd className="mt-1">
                {isPending(COMPANY.email) ? (
                  <Pending label="联系邮箱" />
                ) : (
                  COMPANY.email
                )}
              </dd>
            </div>
          </dl>

          <h2 className="mt-10 text-lg font-semibold text-text">关注公众号</h2>
          <Image
            src="/images/brand/qr.webp"
            alt="中科安樵微信公众号二维码"
            width={422}
            height={423}
            className="mt-4 h-40 w-40 rounded-md border border-border"
          />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-text">询价与咨询</h2>
          <p className="mt-2 text-text-light">
            填写下方表单，我们会尽快与您联系。
          </p>
          <div className="mt-6">
            <LeadForm type="inquiry" defaultProduct={product ?? ""} />
          </div>
        </div>
      </div>
    </Section>
  );
}
```

- [ ] **Step 2: 创建 `src/app/api/ai/README.md`**

只放 README，**不要建 `route.ts`**（SPEC §2.2 / §10：只留结构不实现）。

```markdown
# 未来 AI 服务扩展位

本目录为将来接入 AI 相关服务预留，当前**没有任何实现**。

- 本阶段官网不实现任何 AI 能力（SPEC §10）。
- 未来若接入，在此目录下新增 `route.ts` 作为 API 入口。
- 不要在此目录存放密钥。密钥应走环境变量，且 `.env*` 已在 `.gitignore` 中。

内容数据层已抽象在 `src/data/`（`products.ts` / `news.ts` / `solutions.ts` / `company.ts`），
未来换数据库只需替换该层，页面组件无需改动（SPEC §2.2）。
```

- [ ] **Step 3: 验证预填与目录内容**

```bash
cd "D:/Project/中科安樵/WEB"
grep -o "await searchParams" src/app/contact/page.tsx
ls src/app/api/ai/
find src/app/api -name "route.ts" | head -1 && echo "FAIL: route.ts exists" || echo "OK: no route implementation"
```

Expected：

```
await searchParams
README.md
OK: no route implementation
```

- [ ] **Step 4: dev 冒烟 —— 预填 + 表单端到端写入**

已实测三个坑：curl 必须 `--noproxy '*'`；无 JS 提交 Server Action 需回填页面里的 4 个 `$ACTION_*` 隐藏字段并带 `Origin` 头。下面用 python 从 HTML 抽取隐藏字段再 POST。

```bash
cd "D:/Project/中科安樵/WEB"
rm -rf data
(npm run dev > /tmp/dev.log 2>&1 &) ; sleep 14

# 4.1 预填验证
curl -sS --noproxy '*' -o /tmp/contact.html -w "HTTP %{http_code}\n" "http://127.0.0.1:3000/contact?product=zq-sh100"
grep -o 'id="lead-product"[^>]*value="zq-sh100"' /tmp/contact.html | head -1 \
  || grep -o 'value="zq-sh100"' /tmp/contact.html | head -1

# 4.2 抽取隐藏字段生成 curl 参数
python - <<'PY' > /tmp/action_args.txt
import io, re, html
s = io.open("/tmp/contact.html", encoding="utf-8").read()
args = []
for m in re.finditer(r'<input type="hidden" name="(\$[^"]+)"(?: value="([^"]*)")?/?>', s):
    name = html.unescape(m.group(1))
    val = html.unescape(m.group(2) or "")
    args.append('-F')
    args.append("%s=%s" % (name, val))
print(" ".join("'%s'" % a for a in args))
PY
cat /tmp/action_args.txt
```

Expected: 第一行 `HTTP 200`；能看到 `value="zq-sh100"`；`/tmp/action_args.txt` 内含 4 个 `-F '$ACTION_...'` 参数。

- [ ] **Step 5: 提交合法数据，确认写入 `data/leads.jsonl`**

```bash
cd "D:/Project/中科安樵/WEB"
ARGS=$(cat /tmp/action_args.txt)
eval curl -sS --noproxy \''*'\' -X POST "http://127.0.0.1:3000/contact" \
  -H \"Origin: http://127.0.0.1:3000\" \
  -H \"Referer: http://127.0.0.1:3000/contact\" \
  $ARGS \
  -F \"type=inquiry\" -F \"name=张三\" -F \"phone=13800000000\" \
  -F \"organization=某养老院\" -F \"inquiryType=设备采购\" \
  -F \"customerType=养老机构\" -F \"product=zq-sh100\" -F \"message=想了解床位守护方案\" \
  -o /tmp/post_ok.txt -w '"HTTP %{http_code}\n"'
echo "--- leads.jsonl ---"
cat data/leads.jsonl
```

Expected: `HTTP 200`；`data/leads.jsonl` 出现一行 JSON，包含 `"type":"inquiry"`、`"name":"张三"`、`"product":"zq-sh100"`、`"submittedAt":"2026-..."`、`"source":"http://127.0.0.1:3000/contact"`。

> 若 curl 路线在你的 shell 里转义困难，**改用浏览器手工验证**：打开 `http://localhost:3000/contact?product=zq-sh100`，确认「意向产品」已预填，填必填项后点提交，页面内出现「提交成功，我们会尽快与您联系。」，再 `cat data/leads.jsonl` 核对。浏览器验证同等有效，务必真跑一次。

- [ ] **Step 6: 校验失败路径（空必填 + 超长）不写入**

```bash
cd "D:/Project/中科安樵/WEB"
BEFORE=$(wc -l < data/leads.jsonl)
ARGS=$(cat /tmp/action_args.txt)
# 空必填
eval curl -sS --noproxy \''*'\' -X POST "http://127.0.0.1:3000/contact" \
  -H \"Origin: http://127.0.0.1:3000\" -H \"Referer: http://127.0.0.1:3000/contact\" \
  $ARGS -F \"type=inquiry\" -F \"name=\" -F \"phone=\" -F \"organization=\" -F \"inquiryType=\" \
  -o /tmp/post_bad1.txt -w '"empty HTTP %{http_code}\n"'
# 超长姓名（41 字符）
LONG=$(printf 'a%.0s' $(seq 1 41))
eval curl -sS --noproxy \''*'\' -X POST "http://127.0.0.1:3000/contact" \
  -H \"Origin: http://127.0.0.1:3000\" -H \"Referer: http://127.0.0.1:3000/contact\" \
  $ARGS -F \"type=inquiry\" -F \"name=$LONG\" -F \"phone=13800000000\" \
  -F \"organization=某机构\" -F \"inquiryType=设备采购\" \
  -o /tmp/post_bad2.txt -w '"toolong HTTP %{http_code}\n"'
AFTER=$(wc -l < data/leads.jsonl)
echo "lines before=$BEFORE after=$AFTER (must be equal)"
grep -o "请填写姓名\|请填写联系电话\|姓名不能超过 40 个字符" /tmp/post_bad1.txt /tmp/post_bad2.txt | head -4
```

Expected: `before` 与 `after` 行数相同（失败提交不落库）；能看到 `请填写姓名`、`请填写联系电话`、`姓名不能超过 40 个字符` 等错误文案。

> 同样可用浏览器验证：留空必填点提交 → 字段下方出现红色错误文案且无新行写入。

- [ ] **Step 7: 招商表单写入 `type=dealer`**

```bash
cd "D:/Project/中科安樵/WEB"
curl -sS --noproxy '*' -o /tmp/dealers.html http://127.0.0.1:3000/dealers
python - <<'PY' > /tmp/action_args_d.txt
import io, re, html
s = io.open("/tmp/dealers.html", encoding="utf-8").read()
args = []
for m in re.finditer(r'<input type="hidden" name="(\$[^"]+)"(?: value="([^"]*)")?/?>', s):
    args += ['-F', "%s=%s" % (html.unescape(m.group(1)), html.unescape(m.group(2) or ""))]
print(" ".join("'%s'" % a for a in args))
PY
ARGSD=$(cat /tmp/action_args_d.txt)
eval curl -sS --noproxy \''*'\' -X POST "http://127.0.0.1:3000/dealers" \
  -H \"Origin: http://127.0.0.1:3000\" -H \"Referer: http://127.0.0.1:3000/dealers\" \
  $ARGSD -F \"type=dealer\" -F \"name=李四\" -F \"phone=13900000000\" \
  -F \"organization=某贸易公司\" -F \"inquiryType=经销商加盟\" \
  -o /tmp/post_dealer.txt -w '"dealer HTTP %{http_code}\n"'
grep -c '"type":"dealer"' data/leads.jsonl
```

Expected: `dealer HTTP 200`；`grep -c` 输出 `1`。

- [ ] **Step 8: 清理测试数据 + build 验证**

```bash
cd "D:/Project/中科安樵/WEB"
rm -f data/leads.jsonl
npm run build
```

Expected: `Compiled successfully`；路由表含 `/contact`；`src/app/api/ai` 不产生路由；退出码 0。

---

### Task 22: 素材管线（ffmpeg → WebP）· 可与 T4–T21 并行

**ImageMagick 未安装**，用 ffmpeg 8.1。以下 17 条映射与产出尺寸已在本机实测（源图全部存在，输出 8–141KB，全部远低于 300KB）。

**Files:**
- Create: `scripts/build-assets.sh`
- Create: `public/images/products/<slug>/*.webp`（16 个）
- Create: `public/images/brand/logo-blue.webp` `public/images/brand/qr.webp`

**Interfaces:**
- Consumes: Task 4 中 `products.ts` 声明的 `width`/`height`（必须与实际产出**完全一致**）
- Produces 18 个文件与固定尺寸：
  - `products/zq-sh100/three-view.webp` 1600×854 · `products/zq-sh100/scene.webp` 1536×1024
  - `products/zq-d100/three-view.webp` 1600×800
  - `products/za100/three-view.webp` 1536×1024 · `products/za100/scene.webp` 1536×1024
  - `products/zq50/three-view.webp` 1600×878 · `products/zq50/scene.webp` 1536×1024
  - `products/zq-bh100/three-view.webp` 1600×760
  - `products/zq-gj100/three-view.webp` 1600×800
  - `products/zq-zh100/three-view.webp` 1600×852
  - `products/zqkfc100/main.webp` 1600×800
  - `products/zq-w100/three-view.webp` 1600×682 · `usage.webp` 1536×1024 · `open.webp` 1536×1024
  - `products/smart-switch/three-view.webp` 1600×800
  - `products/platform/screen.webp` 1600×900 · `products/platform/preview.webp` 1600×900
  - `brand/logo-blue.webp` 1179×322 · `brand/qr.webp` 422×423

- [ ] **Step 1: 创建 `scripts/build-assets.sh` —— 头部与产品映射表**

映射照抄 SPEC §6.1.1，源文件名不推测。产品图统一 `scale='min(1600,iw)':-2`；品牌图不缩放（保持 1179×322 / 422×423，alpha 自动保留）。

```bash
#!/usr/bin/env bash
# 素材管线：源图 → WebP（< 300KB），文件名 ASCII。映射照抄 SPEC §6.1.1。
# 依赖 ffmpeg（本机已确认 8.1）。ImageMagick 未安装，不要用 magick/convert。
set -euo pipefail

SRC_ROOT="C:/Users/K/Documents/安樵/图集"
PROD_SRC="$SRC_ROOT/产品照片"
BRAND_SRC="$SRC_ROOT/品牌照片"
OUT_PROD="public/images/products"
OUT_BRAND="public/images/brand"

# slug|源文件（相对 产品照片/）|目标文件名
PRODUCT_MAP=(
  "zq-sh100|ZQSH100 AI健康守护仪/ZQSH100 AI健康守护仪 三视图.png|three-view.webp"
  "zq-sh100|ZQSH100 AI健康守护仪/ZQSH100 AI健康守护仪 场景图.png|scene.webp"
  "zq-d100|ZQD100 跌倒监测仪/ZQD100 跌倒监测仪 三视图.png|three-view.webp"
  "za100|ZA100 健康筛查一体机/ZA100 健康通道一体机 三视图.png|three-view.webp"
  "za100|ZA100 健康筛查一体机/ZA100 健康通道一体机 场景图.png|scene.webp"
  "zq50|ZQ50 健康快速通道一体机/ZQ50 健康快速通道 三视图.png|three-view.webp"
  "zq50|ZQ50 健康快速通道一体机/ZQ50 健康快速通道 场景图.png|scene.webp"
  "zq-bh100|ZQ-BH100 床下健康监测仪/ZQ-BH100 床下健康监测仪 三视图.png|three-view.webp"
  "zq-gj100|ZQ-GJ100 人体轨迹监测仪/人体轨迹仪 三视图.png|three-view.webp"
  "zq-zh100|ZQ-ZH100 照护采集仪/照护采集终端 三视图.png|three-view.webp"
  "zqkfc100|ZQKFC100 健康守护康复智能床/ZQKFC100 健康守护康复智能床.png|main.webp"
  "zq-w100|ZQ-W100 白细胞检测仪/白细胞检测仪 三视图.png|three-view.webp"
  "zq-w100|ZQ-W100 白细胞检测仪/白细胞检测仪 使用示意图.png|usage.webp"
  "zq-w100|ZQ-W100 白细胞检测仪/白细胞检测仪 打开示意图.png|open.webp"
  "smart-switch|智能开关/智能开关 三视图.png|three-view.webp"
  "platform|系统/系统展示大屏.png|screen.webp"
  "platform|系统/系统展示效果图.png|preview.webp"
)

# 目标文件名|源文件（相对 品牌照片/）
BRAND_MAP=(
  "logo-blue.webp|logo 透明底蓝字.png"
  "qr.webp|公众号二维码.jpg"
)

# ASSETS-BODY-MARKER
```

- [ ] **Step 2: 替换 `# ASSETS-BODY-MARKER` 为转码主体**

```bash
MAX_BYTES=$((300 * 1024))
fail=0

convert_one() {
  local src="$1" out="$2" scale="$3"
  if [ ! -f "$src" ]; then
    echo "MISSING SOURCE: $src"
    fail=1
    return
  fi
  mkdir -p "$(dirname "$out")"
  if [ "$scale" = "yes" ]; then
    ffmpeg -y -v error -i "$src" -vf "scale='min(1600,iw)':-2" \
      -c:v libwebp -quality 82 -compression_level 6 "$out"
  else
    ffmpeg -y -v error -i "$src" \
      -c:v libwebp -quality 82 -compression_level 6 "$out"
  fi
  local bytes dim
  bytes=$(stat -c%s "$out")
  dim=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$out")
  printf "%-46s %-12s %6dKB\n" "$out" "$dim" "$((bytes / 1024))"
  if [ "$bytes" -ge "$MAX_BYTES" ]; then
    echo "OVER 300KB: $out"
    fail=1
  fi
}

for row in "${PRODUCT_MAP[@]}"; do
  slug="${row%%|*}"
  rest="${row#*|}"
  rel="${rest%%|*}"
  name="${rest##*|}"
  convert_one "$PROD_SRC/$rel" "$OUT_PROD/$slug/$name" yes
done

for row in "${BRAND_MAP[@]}"; do
  name="${row%%|*}"
  rel="${row##*|}"
  convert_one "$BRAND_SRC/$rel" "$OUT_BRAND/$name" no
done

if [ "$fail" -ne 0 ]; then
  echo "ASSET PIPELINE FAILED"
  exit 1
fi
echo "ASSET PIPELINE OK"
```

- [ ] **Step 3: 运行管线**

```bash
cd "D:/Project/中科安樵/WEB"
chmod +x scripts/build-assets.sh
bash scripts/build-assets.sh
```

Expected: 19 行转码记录（17 产品图 + 2 品牌图），全部 KB 数 < 300，最后一行 `ASSET PIPELINE OK`，退出码 0。参考实测值：`platform/screen.webp` 约 141KB 为最大，`zq-d100/three-view.webp` 约 8KB 为最小。

- [ ] **Step 4: 验证 ASCII 文件名、全部 < 300KB、§6.4 素材未被使用**

```bash
cd "D:/Project/中科安樵/WEB"
echo -n "total files: "; find public/images -type f | wc -l
echo "--- non-ASCII names (expect none) ---"
find public/images -type f | LC_ALL=C grep -nP '[^\x00-\x7F]' || echo "OK: all ASCII"
echo -n "over 300KB count: "; find public/images -type f -size +300k | wc -l
echo -n "forbidden assets count: "; find public -iname "4B8A*" -o -iname "*展位*" -o -iname "*系统展示场景*" -o -iname "*系统概念图*" | wc -l
```

Expected（`find -size` 在无匹配时仍退出 0，故用 `wc -l` 计数判断，不用 `||`）：

```
total files: 19
OK: all ASCII
over 300KB count: 0
forbidden assets count: 0
```

- [ ] **Step 5: 交叉核对声明尺寸 = 实际尺寸（防 Task 4 与产物漂移）**

```bash
cd "D:/Project/中科安樵/WEB"
cat > check-tmp.ts <<'EOF'
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { products } from "@/data/products";

let bad = 0;
const all = products.flatMap((p) => p.images);
for (const img of all) {
  const file = `public${img.src}`;
  if (!existsSync(file)) {
    console.log("MISSING:", file);
    bad++;
    continue;
  }
  const out = execFileSync("ffprobe", [
    "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height", "-of", "csv=p=0", file,
  ]).toString().trim();
  const expected = `${img.width},${img.height}`;
  if (out !== expected) {
    console.log(`MISMATCH ${file}: declared ${expected}, actual ${out}`);
    bad++;
  }
}
console.log("images checked:", all.length);
console.log("mismatches:", bad);
EOF
npx --yes tsx ./check-tmp.ts
rm check-tmp.ts
```

Expected：

```
images checked: 17
mismatches: 0
```

> 若出现 MISMATCH：以**实际产出**为准，回改 `src/data/products.ts` 的 `width`/`height`，不要改 ffmpeg 参数去凑数字。

- [ ] **Step 6: build 验证**

```bash
cd "D:/Project/中科安樵/WEB" && npm run build
```

Expected: `Compiled successfully`，退出码 0。


---

### Task 23: 交付文档（README + 业主待填清单）

`VERIFY.md` 由 Task 24 生成（需要真实验收输出，不能提前写）。

**Files:**
- Modify: `README.md`（整文件替换脚手架默认内容）
- Create: `TODO-业主待填清单.md`
- Delete: `AGENTS.md` `CLAUDE.md`（create-next-app 生成的 agent 指引，非本项目交付物）

**Interfaces:**
- Consumes: Task 1–22 的产物
- Produces: `README.md` 含「⚠️ 部署前必办：表单速率限制与验证码」；`TODO-业主待填清单.md` 覆盖 SPEC §8.2 全部占位位置

- [ ] **Step 1: 删除脚手架 agent 文件**

```bash
cd "D:/Project/中科安樵/WEB"
rm -f AGENTS.md CLAUDE.md
ls *.md
```

Expected: 只剩 `PROMPT-for-deepseek.md`、`PROMPT-deepseek-implement.md`、`README.md`、`SPEC.md`（`TODO-业主待填清单.md` 本任务稍后创建）。

- [ ] **Step 2: 整文件替换 `README.md`（第 1 段：概述与启动）**

````markdown
# 中科安樵官网

中科安樵（苏州）科技有限公司企业官网。Next.js App Router + TypeScript + Tailwind CSS v4，无数据库、无 CMS，内容硬编码在 `src/data/`。

## 环境要求

- Node 24.x（开发机实测 v24.13.1）
- npm 11.x（实测 11.13.0）
- ffmpeg（仅重新生成图片素材时需要，实测 8.1）

## 启动

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # 生产构建 + TypeScript 检查
npm run lint    # ESLint
```

## ⚠️ 部署前必办：表单速率限制与验证码

**当前表单没有任何防护，仅可本地运行，不要直接暴露公网。**

`/contact` 与 `/dealers` 的询价/招商表单通过 Server Action 直接写入本地文件 `data/leads.jsonl`，**没有速率限制、没有验证码、没有身份校验**。若部署到公网，会被脚本批量灌垃圾数据，并可能因持续写入耗尽磁盘。

部署前必须补齐：

1. **速率限制** —— 按 IP / 会话限制提交频率
2. **验证码** —— 人机校验
3. **落地方式** —— 用数据库或队列替代本地 JSONL 追加写
4. **数据保护** —— `data/leads.jsonl` 含客户个人信息（姓名、电话、机构），需限制文件权限与备份策略；该目录已在 `.gitignore` 中，不入版本库
````

- [ ] **Step 3: 追加 README 第 2 段（目录结构、内容维护、素材、限制）**

````markdown
## 目录结构

| 路径 | 说明 |
|---|---|
| `src/app/` | 9 个路由页面（含 `/products/[slug]`、`/news/[slug]` 两个动态段） |
| `src/components/` | 展示组件；客户端组件为 `lead-form.tsx` 与 `site-header.tsx` |
| `src/data/` | 内容数据层：`products.ts` `news.ts` `solutions.ts` `company.ts` `pending.ts` |
| `src/lib/lead.ts` | 表单类型与常量（不可放进 `"use server"` 文件） |
| `src/actions/submit-lead.ts` | 表单 Server Action，手写校验 |
| `src/app/api/ai/` | 未来 AI 服务扩展位，仅 README，无实现 |
| `scripts/build-assets.sh` | 素材管线：源图 → WebP（< 300KB） |
| `public/images/` | 已转码素材（19 个文件，ASCII 文件名） |
| `data/` | 表单线索落地目录，**不入版本库** |

## 内容维护

所有文案与数据集中在 `src/data/`，改内容不需要动页面组件：

- 产品（11 款）：`src/data/products.ts`
- 新闻（3 条）：`src/data/news.ts`
- 解决方案（5 场景）：`src/data/solutions.ts`
- 公司信息与联系方式：`src/data/company.ts`

未填内容统一用 `PENDING`（值为 `{{待填}}`），页面会渲染成浅灰虚线框的「待补充」提示块。
**待填字段清单见 `TODO-业主待填清单.md`。**

## 重新生成图片素材

```bash
bash scripts/build-assets.sh
```

源目录为 `C:\Users\K\Documents\安樵\图集\`。若图片尺寸变化，须同步更新 `src/data/products.ts` 中对应的 `width`/`height`（`<Image>` 依赖它避免布局跳动）。

## 已知限制

- 无后台管理、无登录、无数据库（本阶段设计如此）
- 无部署配置（Vercel/Docker/CI 均未包含）
- 无自动化测试；验证方式为 `npm run build` + 手工冒烟 + `grep` 合规扫描，逐条结果见 `VERIFY.md`
````

- [ ] **Step 4: 创建 `TODO-业主待填清单.md`（第 1 段：说明 + 联系方式 + 产品）**

```markdown
# 业主待填清单

网站已上线的所有内容都来自企业既有资料。以下字段**资料中没有**，一律保留占位符 `{{待填}}`，在页面上显示为浅灰虚线框的「待补充」提示块。

填写方式：打开对应文件，把 `PENDING` 或 `null` 替换成真实内容即可（保持引号与逗号）。填完运行 `npm run build` 确认无报错。

⚠️ 未经确认的内容请勿填写，宁可留空。合规红线见 `SPEC.md` §7。

## 一、联系方式（3 项）

文件：`src/data/company.ts`

| 字段 | 用途 | 出现位置 |
|---|---|---|
| `phone` | 联系电话 | 页脚、`/contact` 左栏 |
| `email` | 联系邮箱 | 页脚、`/contact` 左栏 |
| `icp` | ICP 备案号 | 页脚版权行 |

## 二、产品资料

文件：`src/data/products.ts`

### 2.1 全部 11 款共同缺失

| 字段 | 用途 | 说明 |
|---|---|---|
| `spec` | 技术参数 | 现为 `null`，详情页显示「待补充：技术参数」。填写时改成字符串，支持换行 |
| `customers` | 适用客户 | 现为 `null`，详情页显示「待补充：适用客户」 |
| `scenes` | 适用场景标签 | 现为 `[]`，详情页显示「待补充：适用场景标签」。填成 `["养老机构", "医疗卫生"]` 这样的数组 |

> `scenes` 填好后，`/products` 页可以另行开工加「按场景筛选」（当前因无数据未实现）。

### 2.2 产品 3–11 缺一句话定位与卖点（9 款）

涉及 slug：`za100` `zq50` `zq-bh100` `zq-gj100` `zq-zh100` `zqkfc100` `zq-w100` `smart-switch` `platform`

| 字段 | 用途 |
|---|---|
| `tagline` | 一句话定位，显示在产品卡片与详情页标题下方 |
| `features` | 核心卖点数组，显示在详情页「核心卖点」区块 |

> `zq-sh100`（AI健康守护仪）与 `zq-d100`（跌倒监测仪）的定位与卖点已按企业资料写入，无需填写。

### 2.3 产品 10、11 还缺型号与正式名称

| slug | 当前展示名 | 待填字段 |
|---|---|---|
| `smart-switch` | 智能开关 | `model`（型号）、`officialName`（正式产品名称） |
| `platform` | 系统平台 | `model`（型号）、`officialName`（正式产品名称） |
```

- [ ] **Step 5: 追加 `TODO-业主待填清单.md` 第 2 段（解决方案 + 关于 + 新闻 + 红线提醒）**

```markdown
## 三、解决方案（5 场景 × 2 项 = 10 处）

文件：`src/data/solutions.ts`

| 场景 | 待填字段 | 说明 |
|---|---|---|
| 养老机构 `institution` | `devices` `value` | 推荐设备组合、交付价值 |
| 社区居家养老 `community` | `devices` `value` | 同上 |
| 医疗卫生机构 `medical` | `devices` `value` | 同上 |
| 大健康 · 美业 `wellness` | `devices` `value` | 同上 |
| 装修 · 适老化改造 `retrofit` | `devices` `value` | 同上。**文案面向装企/经销商，不要写「为您家老人选购」这类面向家庭的用语** |

场景痛点文案已写入，无需填写。

## 四、关于我们（2 项）

文件：`src/app/about/page.tsx`

| 位置 | 待填内容 | 说明 |
|---|---|---|
| 「团队」区块 | 团队介绍 | 资料中有创始人信息，但对外披露范围未确认，故留空 |
| 「发展历程」区块 | 发展历程 | 资料中无 |

公司简介、技术路线、质量保障表、资质表述均已按企业资料写入，无需填写。

## 五、新闻动态（3 条 × 2 项 = 6 处）

文件：`src/data/news.ts`

| 标题 | 待填字段 |
|---|---|
| 安樵将参展 2026 广州国际老龄产业博览会 | `date`（发布日期，格式 `YYYY-MM-DD`）、`body`（正文） |
| 安樵参与 2026 长三角康养论坛 | `date`、`body` |
| 智能守护示范楼层项目启动 | `date`、`body` |

⚠️ 第 3 条正文**必须**保持「进入建设阶段 / 建设中」的表述，**不得**写成已完成、已交付、已采购、成功案例。凯健（苏州凯健友谊苑）是合作中的示范楼层项目，不是成交客户。

## 六、填写时的合规红线（务必遵守）

以下词汇**全站禁用**（含图片 alt 与页面 meta 描述）：

```
医疗级   诊断   治疗   疗效   临床验证   临床认证
注册证（用于描述产品时）   包治   治愈   替代医生
```

原因：产品本体**无医疗器械注册证**，公司仅持医疗器械经营备案凭证。宣称医疗属性构成违规宣传。

另外：

- **不要写任何准确率/精度百分比**（98%、92% 等）。资料里的数字是算法训练值，非第三方实测，对外不可用。
- **不要写价格**，一律「获取报价」。
- **不要写部署台数、客户数量、市占率**等未经确证的数字。
- 「紧急呼叫」指通知家人/护理员，**不要**写成对接 120 或医疗急救。
- 招商页**不要**公开返利阶梯、区域保护规则、样机收费标准、结算方式。
```

- [ ] **Step 6: 验证两份文档的关键内容**

```bash
cd "D:/Project/中科安樵/WEB"
grep -o "⚠️ 部署前必办：表单速率限制与验证码" README.md | head -1
echo -n "README sections: "; grep -c "^## " README.md
ls "TODO-业主待填清单.md"
echo -n "TODO sections: "; grep -c "^## " "TODO-业主待填清单.md"
for k in phone email icp spec customers scenes tagline features officialName devices 团队 发展历程 date body; do
  printf "%-12s " "$k"; grep -c "$k" "TODO-业主待填清单.md"
done
ls AGENTS.md CLAUDE.md 2>/dev/null && echo "FAIL: agent files still present" || echo "OK: agent files removed"
```

Expected: 第一行输出该警告标题；`README sections` ≥ 6；`TODO sections` = 6；上面每个关键词计数 ≥ 1；最后一行 `OK: agent files removed`。

- [ ] **Step 7: build 验证**

```bash
cd "D:/Project/中科安樵/WEB" && npm run build
```

Expected: `Compiled successfully`，退出码 0。


---

### Task 24: 验收（SPEC §9.1–9.6 逐条）+ 生成 `VERIFY.md`

**必须真跑每条命令并把真实输出贴进 `VERIFY.md`**。禁止写「预计通过」「应该没问题」。任何一条不通过就回到对应任务修，修完重跑。

**Files:**
- Create: `VERIFY.md`

**Interfaces:**
- Consumes: Task 1–23 全部产物
- Produces: `VERIFY.md` —— SPEC §9.1–9.6 全 33 条逐条结论 + 真实命令输出

- [ ] **Step 1: §9.1 功能 —— install 与 build**

```bash
cd "D:/Project/中科安樵/WEB"
npm install 2>&1 | tail -3
npm run build 2>&1 | tail -30
```

Expected: `Compiled successfully`，无 TypeScript 错误；路由表含 `/` `/about` `/contact` `/dealers` `/news` `/news/[slug]` `/products` `/products/[slug]` `/solutions`，退出码 0。把路由表原文贴进 `VERIFY.md`。

- [ ] **Step 2: §9.1 路由可访问性 —— 21 个 URL 全 200，`/cases` 必须 404**

```bash
cd "D:/Project/中科安樵/WEB"
(npm run dev > /tmp/dev.log 2>&1 &) ; sleep 15
URLS="/ /products /solutions /dealers /about /news /contact"
for s in zq-sh100 zq-d100 za100 zq50 zq-bh100 zq-gj100 zq-zh100 zqkfc100 zq-w100 smart-switch platform; do
  URLS="$URLS /products/$s"
done
for n in guangzhou-aging-industry-expo-2026 yangtze-delta-health-forum-2026 smart-care-demo-floor; do
  URLS="$URLS /news/$n"
done
pass=0; total=0
for u in $URLS; do
  total=$((total+1))
  code=$(curl -sS --noproxy '*' -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000$u")
  printf "%-50s %s\n" "$u" "$code"
  [ "$code" = "200" ] && pass=$((pass+1))
done
echo "PASS $pass / $total"
curl -sS --noproxy '*' -o /dev/null -w "/cases => %{http_code} (expect 404)\n" http://127.0.0.1:3000/cases
```

Expected: `PASS 21 / 21`；`/cases => 404`。

- [ ] **Step 3: §9.1 表单四项 —— 重跑 Task 21 Step 4–7 并核对落库**

重跑 Task 21 的 Step 4（`?product=` 预填）、Step 5（询价写入）、Step 6（校验拒绝且不落库）、Step 7（招商 `type=dealer`），把真实输出贴进 `VERIFY.md`。浏览器手工验证同等有效，但必须真做并记录观察结果。

```bash
cd "D:/Project/中科安樵/WEB"
echo "=== leads.jsonl ==="
cat data/leads.jsonl
echo -n "inquiry count: "; grep -c '"type":"inquiry"' data/leads.jsonl
echo -n "dealer count:  "; grep -c '"type":"dealer"' data/leads.jsonl
python -c "
import io, json
need = ['type','name','phone','organization','inquiryType','customerType','product','message','submittedAt','source']
for line in io.open('data/leads.jsonl', encoding='utf-8'):
    d = json.loads(line)
    missing = [k for k in need if k not in d]
    print('type=%s missing=%s source=%s' % (d['type'], missing or 'none', d['source']))
"
```

Expected: inquiry 与 dealer 各至少 1 条；每条 `missing=none`；`source` 为提交页 URL。

- [ ] **Step 4: §9.2 合规 —— 禁用词 grep（范围 `src/` + `public/`）**

排除范围按 SPEC §7.0：`SPEC.md` / `PROMPT-*.md` / `VERIFY.md` / `TODO-业主待填清单.md` / `docs/` 本身含词表，必然命中，不计入。

```bash
cd "D:/Project/中科安樵/WEB"
echo "=== 9.2.1 §7.1 词表（不含医疗器械）零命中 ==="
LC_ALL=C.UTF-8 grep -rnE "医疗级|诊断|治疗|疗效|临床验证|临床认证|注册证|包治|治愈|替代医生" src/ public/ \
  && echo "FAIL: banned word hit" || echo "PASS: zero hits"

echo "=== 9.2.2 医疗器械 仅允许两处 ==="
LC_ALL=C.UTF-8 grep -rn "医疗器械" src/ public/
echo -n "count: "; LC_ALL=C.UTF-8 grep -rn "医疗器械" src/ public/ | wc -l

echo "=== 9.2.3 无百分比 ==="
LC_ALL=C.UTF-8 grep -rnE "[0-9]+(\.[0-9]+)?%" src/ public/ \
  && echo "FAIL: percentage found" || echo "PASS: no percentage"

echo "=== 9.2.4 凯健表述 ==="
LC_ALL=C.UTF-8 grep -rn "凯健" src/
LC_ALL=C.UTF-8 grep -rnE "已交付|已采购|成功案例|客户见证" src/ public/ \
  && echo "FAIL" || echo "PASS: no forbidden kaijian phrasing"
```

Expected: `PASS: zero hits`；`医疗器械` 只有 2 行且都在 `src/app/about/page.tsx`（经营范围原句 + 经营备案凭证），`count: 2`；`PASS: no percentage`；凯健行含「进入建设阶段」，且 `PASS: no forbidden kaijian phrasing`。

- [ ] **Step 5: §9.2 其余合规项**

```bash
cd "D:/Project/中科安樵/WEB"
echo "=== 资质表述 ==="
LC_ALL=C.UTF-8 grep -rn "经营备案凭证" src/ | head -2

echo "=== 无案例页 / logo 墙 / 客户评价 ==="
ls src/app/cases 2>/dev/null && echo "FAIL: cases route exists" || echo "PASS: no cases route"
LC_ALL=C.UTF-8 grep -rnE "客户评价|客户见证|合作客户|客户 ?logo" src/ && echo "FAIL" || echo "PASS: no testimonial/logo wall"

echo "=== 无价格数字 ==="
LC_ALL=C.UTF-8 grep -rnE "￥|¥|元起|售价|定价" src/ && echo "FAIL: price found" || echo "PASS: no price"

echo "=== 招商页无渠道机密 ==="
LC_ALL=C.UTF-8 grep -rnE "返利|区域保护|样机收费|结算方式|价格政策|折扣" src/app/dealers/ \
  && echo "FAIL" || echo "PASS: no channel secrets"

echo "=== 无 C 端用语 ==="
LC_ALL=C.UTF-8 grep -rnE "购买|下单|购物车|为您家|选购" src/ && echo "FAIL: B2C wording" || echo "PASS: no B2C wording"
```

Expected: 资质行为「公司持有医疗器械经营备案凭证……」；其余 5 项全部 `PASS`。

- [ ] **Step 6: §9.3 内容 —— 数据层占位符计数**

```bash
cd "D:/Project/中科安樵/WEB"
cat > check-tmp.ts <<'EOF'
import { products } from "@/data/products";
import { news } from "@/data/news";
import { solutions } from "@/data/solutions";
import { COMPANY } from "@/data/company";
import { isPending } from "@/data/pending";

console.log("products spec null:", products.filter((p) => p.spec === null).length, "(expect 11)");
console.log("products customers null:", products.filter((p) => p.customers === null).length, "(expect 11)");
console.log("products scenes empty:", products.filter((p) => p.scenes.length === 0).length, "(expect 11)");
console.log("products tagline pending:", products.filter((p) => isPending(p.tagline)).length, "(expect 9)");
console.log("products features empty:", products.filter((p) => p.features.length === 0).length, "(expect 9)");
console.log("products model pending:", products.filter((p) => isPending(p.model)).length, "(expect 2)");
console.log("news date pending:", news.filter((n) => isPending(n.date)).length, "(expect 3)");
console.log("news body absent:", news.filter((n) => isPending(n.body)).length, "(expect 3)");
console.log("solutions devices null:", solutions.filter((s) => s.devices === null).length, "(expect 5)");
console.log("solutions value null:", solutions.filter((s) => s.value === null).length, "(expect 5)");
console.log("company pending:", [COMPANY.phone, COMPANY.email, COMPANY.icp].filter(isPending).length, "(expect 3)");
EOF
npx --yes tsx ./check-tmp.ts
rm check-tmp.ts
```

Expected: 每行实际值与括号内 expect 一致 —— 11 / 11 / 11 / 9 / 9 / 2 / 3 / 3 / 5 / 5 / 3。

- [ ] **Step 7: §9.3 页面上占位符可见渲染**

```bash
cd "D:/Project/中科安樵/WEB"
(npm run dev > /tmp/dev.log 2>&1 &) ; sleep 15
for u in / /products /products/platform /solutions /about /news /news/smart-care-demo-floor /contact; do
  n=$(curl -sS --noproxy '*' "http://127.0.0.1:3000$u" | grep -o "待补充" | wc -l)
  printf "%-42s 待补充 x%s\n" "$u" "$n"
done
echo "=== 无 {{待填}} 裸字符串泄漏 ==="
curl -sS --noproxy '*' http://127.0.0.1:3000/products/platform | grep -o "{{待填}}" | head -1 \
  && echo "FAIL: raw placeholder leaked" || echo "PASS: no raw placeholder in HTML"
ls "TODO-业主待填清单.md"
```

Expected: 每个 URL 的「待补充」计数 ≥ 1；`PASS: no raw placeholder in HTML`；TODO 文件存在。

> `<Pending />` 渲染的是「待补充」文案，不输出 `{{待填}}` 原文，故裸字符串不应出现在 HTML 中。

- [ ] **Step 8: §9.4 素材**

```bash
cd "D:/Project/中科安樵/WEB"
echo -n "images total: "; find public/images -type f | wc -l
find public/images -type f | LC_ALL=C grep -nP '[^\x00-\x7F]' || echo "PASS: all ASCII"
echo -n "over 300KB count: "; find public/images -type f -size +300k | wc -l
echo -n "forbidden assets count: "; find public -iname "4B8A*" -o -iname "*展位*" -o -iname "*系统展示场景*" -o -iname "*系统概念图*" -o -iname "*硬件安装*" | wc -l
echo -n "<Image> count: "; LC_ALL=C.UTF-8 grep -rn "<Image" src/ | wc -l
echo -n "alt= count:    "; LC_ALL=C.UTF-8 grep -rn "<Image" -A7 src/ | grep -c "alt="
echo -n "width= count:  "; LC_ALL=C.UTF-8 grep -rn "<Image" -A7 src/ | grep -c "width="
echo -n "height= count: "; LC_ALL=C.UTF-8 grep -rn "<Image" -A7 src/ | grep -c "height="
```

Expected: `images total: 19`；`PASS: all ASCII`；`over 300KB count: 0`；`forbidden assets count: 0`；`<Image>` 与 `alt=` / `width=` / `height=` 计数相等（若不等，逐个人工核对补齐）。

- [ ] **Step 9: §9.5 可访问性**

```bash
cd "D:/Project/中科安樵/WEB"
grep -o "<main" src/app/layout.tsx
echo -n "header nav count: "; grep -c "<nav" src/components/site-header.tsx
grep -o "<footer" src/components/site-footer.tsx
echo -n "section usages: "; LC_ALL=C.UTF-8 grep -rn "<section\|<Section" src/app/ | wc -l
echo -n "htmlFor: "; grep -o "htmlFor=" src/components/lead-form.tsx | wc -l
echo -n "label:   "; grep -o "<label" src/components/lead-form.tsx | wc -l
grep -o "focus-visible" src/app/globals.css | head -1
echo -n "focus-ring usages: "; LC_ALL=C.UTF-8 grep -rn "focus-ring" src/ | wc -l
echo "=== 确认正文未使用 text-muted ==="
LC_ALL=C.UTF-8 grep -rn "text-text-muted" src/ | head -20
```

Expected: `<main` 与 `<footer` 各 1 处；`header nav count: 2`；`htmlFor` 与 `label` 均为 7；`focus-visible` 存在；`focus-ring` 在导航/链接/表单控件上有使用。最后一条列出的 `text-text-muted` 使用点须逐一确认只用于日期与辅助小字（不承载关键信息）。

对比度按令牌值记录进 `VERIFY.md`：

- 正文 `#2C3E3A` on `#FAFAF7` ≈ **10.5:1** ✅
- 次要文字 `#5A6E68` on `#FAFAF7` ≈ **5.3:1** ✅
- 辅助小字 `#8A9E98` on `#FAFAF7` ≈ **2.6:1** —— 不达 4.5:1，**仅允许用于日期等非关键信息**；若发现用于正文段落，改成 `text-text-light`

键盘操作需人工验证并记录：Tab 依次到达导航 6 项 → 「获取方案报价」CTA →（窄屏）菜单按钮 → 表单 7 个控件 → 提交按钮，focus 环可见；Enter 可提交。

- [ ] **Step 10: §9.6 工程**

```bash
cd "D:/Project/中科安樵/WEB"
grep -n "^data/" .gitignore
ls src/app/api/ai/
echo -n "route files under api (expect 0): "; find src/app/api -name "route.ts" -o -name "route.tsx" | wc -l
grep -o "⚠️ 部署前必办：表单速率限制与验证码" README.md
node -e "
const p = require('./package.json');
console.log('dependencies:', JSON.stringify(p.dependencies));
console.log('devDependencies:', Object.keys(p.devDependencies).join(','));
const all = Object.keys({ ...p.dependencies, ...p.devDependencies });
const banned = ['zod','antd','@mui/material','framer-motion','gsap','sharp','clsx','tailwind-merge','lucide-react','@heroicons/react'];
const hit = all.filter((d) => banned.includes(d));
console.log(hit.length === 0 ? 'PASS: no banned deps' : 'FAIL: ' + hit.join(','));
"
```

Expected: `.gitignore` 含 `data/`；`src/app/api/ai/` 只有 `README.md`，route 文件数 `0`；README 警告存在；`dependencies` 只有 `next` `react` `react-dom`；`PASS: no banned deps`。

- [ ] **Step 11: 生成 `VERIFY.md` 骨架（9.1–9.3 部分）**

**每个 `<粘贴实际输出>` 必须替换成真实命令输出**，每条结论标 ✅ 或 ❌。

````markdown
# 验收自查报告

依据：`SPEC.md` §9。执行日期：<填写实际日期>
环境：Node v24.13.1 / npm 11.13.0 / Next 16.2.12 / ffmpeg 8.1

## 9.1 功能（10 条）

| # | 检查项 | 结论 |
|---|---|---|
| 1 | `npm install && npm run dev` 无报错启动 | |
| 2 | `npm run build` 通过，无 TypeScript 错误 | |
| 3 | 7 个主路由全部可访问 | |
| 4 | 11 个产品详情页可访问，slug 与 §5.3.2 一致 | |
| 5 | 新闻详情页 3 条可访问 | |
| 6 | 导航与页脚在所有页面一致 | |
| 7 | 询价表单提交写入 `data/leads.jsonl` | |
| 8 | 招商表单 `type` 为 `dealer` | |
| 9 | 表单校验生效（空必填、超长被拒并显示错误） | |
| 10 | `/contact?product=zq-sh100` 自动预填 | |

### build 输出

```
<粘贴实际输出>
```

### 路由可访问性（21 个 URL + /cases 404）

```
<粘贴实际输出>
```

### 表单验证（预填 / 写入 / 拒绝 / dealer）

```
<粘贴实际输出>
```

## 9.2 合规（8 条）

| # | 检查项 | 结论 |
|---|---|---|
| 1 | §7.1 禁用词零命中（含 alt/meta/注释） | |
| 2 | `医疗器械` 仅 §7.0 允许的两处 | |
| 3 | 全站无百分比准确率数字 | |
| 4 | 凯健文案含「建设阶段」，无「已交付/已采购/成功案例」 | |
| 5 | 资质表述为「公司持医疗器械经营备案凭证」 | |
| 6 | 无案例页、无客户 logo 墙、无客户评价 | |
| 7 | 无任何价格数字 | |
| 8 | 招商页无返利/区域/样机收费/结算方式细节 | |

### grep 实际输出

```
<粘贴实际输出，须包含 医疗器械 两处的完整行与文件名>
```

## 9.3 内容（3 条）

| # | 检查项 | 结论 |
|---|---|---|
| 1 | 所有 `{{待填}}` 以 `<Pending />` 可见渲染，无编造填充 | |
| 2 | `TODO-业主待填清单.md` 已生成且完整 | |
| 3 | 适老化改造文案面向装企/经销商，无 C 端用语 | |

### 占位符计数（数据层 + 页面）

```
<粘贴实际输出>
```
````

- [ ] **Step 12: 追加 `VERIFY.md` 的 9.4–9.6 与收尾部分**

````markdown
## 9.4 素材（4 条）

| # | 检查项 | 结论 |
|---|---|---|
| 1 | 所有图片文件名为 ASCII | |
| 2 | 单张图片 < 300KB | |
| 3 | 所有 `<Image>` 有 alt、width、height | |
| 4 | §6.4 列出的素材未被使用 | |

### 素材清单与体积（19 个文件）

```
<粘贴实际输出>
```

## 9.5 可访问性（4 条）

| # | 检查项 | 结论 |
|---|---|---|
| 1 | 键盘可完整操作导航与表单，focus 态可见 | |
| 2 | 表单每个输入有关联 label | |
| 3 | 语义化标签（nav/main/section/footer） | |
| 4 | 正文对比度 ≥ 4.5:1 | |

### 对比度记录

| 用途 | 前景 | 背景 | 比值 | 结论 |
|---|---|---|---|---|
| 正文 | `#2C3E3A` | `#FAFAF7` | ≈10.5:1 | |
| 次要文字 | `#5A6E68` | `#FAFAF7` | ≈5.3:1 | |
| 辅助小字（日期等，不承载关键信息） | `#8A9E98` | `#FAFAF7` | ≈2.6:1 | |

### 键盘操作记录

<填写实际 Tab 顺序观察结果>

> 完整无障碍合规需人工使用辅助技术测试并由专家评审，本报告仅覆盖 SPEC §3.3 列出的可自查项。

## 9.6 工程（4 条）

| # | 检查项 | 结论 |
|---|---|---|
| 1 | `data/leads.jsonl` 在 `.gitignore` 中 | |
| 2 | `src/app/api/ai/README.md` 存在 | |
| 3 | README 含「⚠️ 部署前必办：表单速率限制与验证码」 | |
| 4 | 未引入 SPEC 之外的依赖 | |

### 依赖清单

```
<粘贴实际输出>
```

## 未通过项与处理

<逐条列出 ❌ 项、原因、已做的修改；若全部通过写「无」>

## 保留的待业主确认项

<列出计划末尾阻塞点 B1–B6 中仍未获答复的项，说明当前以占位符处理>
````

- [ ] **Step 13: 确认 `VERIFY.md` 无占位残留**

```bash
cd "D:/Project/中科安樵/WEB"
grep -n "粘贴实际输出\|填写实际日期\|填写实际 Tab" VERIFY.md \
  && echo "FAIL: VERIFY.md 仍有未填槽位" || echo "PASS: 所有槽位已填真实内容"
echo -n "结论标记数（应 >= 33）: "; grep -oE "✅|❌" VERIFY.md | wc -l
echo -n "空结论单元格（应为 0）: "; grep -cE "^\| [0-9]+ \|[^|]*\| *\|$" VERIFY.md
```

Expected：

```
PASS: 所有槽位已填真实内容
结论标记数（应 >= 33）: 33
空结论单元格（应为 0）: 0
```

- [ ] **Step 14: 最终清理与全量 build**

```bash
cd "D:/Project/中科安樵/WEB"
rm -f check-tmp.ts data/leads.jsonl
ls check-tmp.ts 2>/dev/null && echo "FAIL: temp file left" || echo "OK: no temp files"
ls scaffold-tmp 2>/dev/null && echo "FAIL: scaffold-tmp left" || echo "OK: no scaffold-tmp"
npm run build 2>&1 | tail -20
ls
```

Expected: `OK: no temp files`；`OK: no scaffold-tmp`；`Compiled successfully`；根目录含 `README.md` `TODO-业主待填清单.md` `VERIFY.md` `SPEC.md` `PROMPT-for-deepseek.md` `PROMPT-deepseek-implement.md` `package.json` `src/` `public/` `scripts/` `docs/`，且无 `AGENTS.md` / `CLAUDE.md`。


---

## 阻塞点：待业主确认

**执行方不许自行决定这些项，一律保持 `<Pending />` 占位。** 得到答复后再补，不要推测。

### B1 SPEC 附「不确定项」原样保留（5 条）

| # | 项 | 当前处理 |
|---|---|---|
| B1-1 | 产品 10（智能开关）、11（系统）的正式名称与型号 | `model` / `officialName` = `PENDING`，展示名暂用「智能开关」「系统平台」 |
| B1-2 | 各产品与 5 个场景的对应关系 | 产品 `scenes` 全空、场景 `devices` 全 null |
| B1-3 | 团队成员对外披露范围 | `/about` 团队区块 `<Pending />` |
| B1-4 | 电话 / 邮箱 / 备案号 | `COMPANY.phone` / `email` / `icp` = `PENDING` |
| B1-5 | 新闻 3 条的确切日期 | `news[].date` = `PENDING` |

### B2 `/products` 按场景筛选无法实现

SPEC §5.2 写「可选按场景筛选（若实现，筛选标签取自各产品的 `scenes` 字段）」，但 §5.3 同时规定 9 款产品的适用场景全部待填，且 B1-2 禁止推测搭配。**结果是 11 款产品 `scenes` 全为空数组，筛选没有任何标签可用。**

- 处理：Task 15 **不实现筛选**，也不自造场景标签。
- 解除条件：B1-2 得到答复后另行开工。

### B3 解决方案「交付价值」文案缺失

SPEC §5.4 规定每场景结构为「场景痛点 → 推荐设备组合 → 交付价值 → 询价 CTA」，表格给了痛点文案、明确了推荐设备必须待填，但**没有给交付价值的文案**，且交付价值直接依赖推荐的设备组合。

- 处理：`solutions[].value = null`，渲染 `<Pending label="<场景> 交付价值" />`。
- 解除条件：业主提供 5 段交付价值文案（或先解除 B1-2 再据此撰写）。

### B4 产品 1、2 标为「资料完整」但仍缺两个字段

SPEC §5.3.2 把 `zq-sh100` 与 `zq-d100` 标为「✅ 完整」，但 §5.3.1 只给了一句话定位与核心卖点，技术参数明确写 `{{待填}}`；而 §5.3 的详情页模板要求「适用场景标签」与「适用客户」两块内容，**这两项 SPEC 对全部 11 款都没给数据**。

- 处理：11 款的 `customers` 全为 `null`、`scenes` 全为空数组，页面渲染 `<Pending />`。
- 解除条件：业主确认这两项内容，或确认它们不在本期范围内（若确认不做，需从详情页模板移除对应区块）。

### B5 已按环境事实修正设计文档的三处（无需业主决策，仅告知）

| 设计文档原文 | 实际情况 | 计划采用 |
|---|---|---|
| 用 ImageMagick `magick` 转 WebP | **ImageMagick 未安装**；PATH 上的 `convert` 是 Windows 磁盘工具 | ffmpeg 8.1（已实测 17 张源图全部可转，8–141KB） |
| 隐含 Next 15 语义 | `create-next-app@latest` 是 **16.2.12** | `params` / `searchParams` / `headers()` 全部 `await` |
| 直接在当前目录跑 `create-next-app` | 目录非空（已有 `SPEC.md` 等），CLI 拒绝 | 先生成到 `scaffold-tmp` 再 `mv` 出来（已实测） |

### B6 SPEC §6.4 两个「禁用素材」在源目录中不存在

SPEC §6.4 要求不使用 `系统/4.png` 与 `系统/e4cb5ea7d33f6fa009f381ebba87065b.png`。实际 `产品照片/系统/` 下的文件是：`系统展示大屏.png`、`系统展示效果图.png`、`系统展示场景.png`、`系统概念图.png`、`4B8A3640.JPG`、`4B8A3642.JPG`、`4B8A3643.JPG`。

- 处理：SPEC §6.1.1 映射表只取 `系统展示大屏.png` 与 `系统展示效果图.png`；另两张 PNG（`系统展示场景.png`、`系统概念图.png`）**未在映射表中，因此不使用**，并已加入 Task 24 Step 8 的禁用素材扫描。
- 无需业主决策，但交付时在 `VERIFY.md` 注明此差异。

---

## Self-Review 记录

**1. SPEC 覆盖**：§1–§3 → T2/T7；§4 导航与页脚 → T8/T9；§5.1 → T14；§5.2 → T15（筛选见 B2）；§5.3 → T4/T16；§5.4 → T6/T17；§5.5 → T18；§5.6 → T19；§5.7 → T5/T20；§5.8 → T11/T12/T13/T21；§6 → T22；§7 → 各页任务的合规步 + T24 Step 4–5；§8 → T3 + T23；§9 → T24；§10 → 全局约束 C2 + T24 反向验证（`/cases` 404、无 banned deps）。

**2. 占位符扫描**：全文无「TBD」「适当添加校验」「类似任务 N」；每个代码步给出完整代码；`VERIFY.md` 的槽位由 T24 Step 13 的 grep 强制要求填成真实输出。

**3. 类型一致性**：`PENDING` / `isPending` (T3) → T4/T5/T9/T10/T16/T19/T20/T21/T24；`Product` / `primaryImage` / `WARRANTY_TEXT` (T4) → T10/T16；`NewsItem` / `getNewsItem` (T5) → T14/T20；`Solution` (T6) → T14/T17；`CtaLink` / `Section` (T7) → T8/T14–T21；`COMPANY` (T9) → T21；`LeadFormState` / `LIMITS` / `INQUIRY_TYPES` / `CUSTOMER_TYPES` (T11) → T12/T13；`submitLead` (T12) → T13；`LeadForm` (T13) → T18/T21；T4 声明的 17 组 `width`/`height` 与 T22 产出尺寸一一对应，并由 T22 Step 5 交叉校验。

## 实施状态说明

实施已完成（产物见 `VERIFY.md`，并经独立审阅逐项复跑验证）。**本文档的 123 个步骤复选框未随实施同步维护，仍为 `- [ ]`**，不代表未执行；过程勾选记录缺失，属交付纪律偏离，已在审阅中记录。

实施对计划的实际偏离：
- Task 22 计划文本中「16 个产品图 / 18 个文件」为计数笔误，实际 17 产品图 + 2 品牌图 = 19 个文件。
- 除上述一条外无其它偏离。






