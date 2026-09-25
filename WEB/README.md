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

## 部署

本仓库 SPEC §10 明确不做部署配置（Vercel / Docker / CI）。如需部署，由业主另行处理。

> `data/leads.jsonl` 含客户个人信息（姓名、电话、机构），需限制文件权限与备份策略；该目录已在 `.gitignore` 中，不入版本库。

## 目录结构

| 路径 | 说明 |
|---|---|
| `src/app/` | 路由页面（含 `/products/[slug]`、`/news/[slug]` 两个动态段） |
| `src/components/` | 展示组件；客户端组件为 `lead-form.tsx` 与 `site-header.tsx` |
| `src/data/` | 内容数据层：`products.ts` `news.ts` `solutions.ts` `company.ts` `pending.ts` |
| `src/lib/lead.ts` | 表单类型与常量（不可放进 `"use server"` 文件） |
| `src/actions/submit-lead.ts` | 表单 Server Action，手写校验 |
| `src/app/api/ai/` | 未来 AI 服务扩展位，仅 README，无实现 |
| `scripts/build-assets.sh` | 素材管线：源图 → WebP（< 300KB） |
| `public/images/` | 已转码素材（ASCII 文件名） |
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
- 本仓库不做部署配置（SPEC §10）；如需部署由业主另行处理
- 无自动化测试；验证方式为 `npm run build` + 手工冒烟 + `grep` 合规扫描，逐条结果见 `VERIFY.md`
