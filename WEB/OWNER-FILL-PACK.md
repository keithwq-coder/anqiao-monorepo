# 业主回填包

> 本文件记录 Phase 2（2026-08-04）业主确认的输入与当前回填状态。
> 结构对齐 `OWNER-FILL-PACK.template.md`；未回填字段保持 `PENDING` / `null`，禁止编造。

- 填写人：业主（经编排方转达）
- 日期：2026-08-04
- 批次说明：第一批（联系方式 + 下架决策 + 平台名 + 产品/方案/关于/新闻回填方向），已由执行方按产品说明书 v5 与公司介绍 ppt 摘取实施

---

## 本批业主已确认（直接写入）

| 项 | 业主输入 | 落盘位置 |
|---|---|---|
| B1-4 电话 | `13032531078` | `src/data/company.ts` `COMPANY.phone` ✅ |
| B1-4 邮箱 | `448121288@qq.com` | `src/data/company.ts` `COMPANY.email` ✅ |
| B1-4 ICP | 未提供 | `COMPANY.icp` 仍 `PENDING` ⏳ |
| 智能开关/智能插座 | 整品下架，本期不上架 | `smart-switch` 已从 `products.ts` 移除，站点所有入口不可见 ✅ |
| 平台对外名 | 「安守护」 | `platform` `name`/`officialName` = 安守护；`model` 业主无型号仍 `PENDING` ⏳ |
| 新闻方向 | 政策与商机向 3 条（MZ/T238-2025 标准、工信部智慧健康养老目录、凯健示范楼层保留） | `src/data/news.ts` 已重写 ✅ |

## 执行方按资料摘取（产品说明书 v5 / 公司介绍 ppt，非业主逐字确认）

- 9 款产品（za100、zq50、zq-bh100、zq-gj100、zq-zh100、zqkfc100、zq-w100、platform 及 zq-sh100/zq-d100 微调）的 `tagline` / `features` / `scenes` / `spec` / `customers`——以 v5 为准改写，无价格、无精度百分比、无产品资质类措辞
- `solutions.ts` 4 场景（institution / community / medical / retrofit）的 `devices` 与 `value`——以 v5 场景化方案页（P16–P18）为准
- `/about` 团队（笼统表述，无具体人名）与发展历程（2023–2026 四节点）——以公司介绍 ppt 为准
- `/products` 按场景筛选已实现（标签 = 产品 scenes 并集 +「全部」）

## 仍待业主（下批可填）

| 字段 | 说明 |
|---|---|
| ICP 备案号 | 业主提供后写 `COMPANY.icp` |
| `platform` 型号 | 业主有型号后写 `model` |
| 大健康 · 美业场景 `devices` / `value` | v5 无该场景设备依据，需业主给方向 |
| 新闻日期（MZ/T238 条、凯健条） | 业主给确切日期；工信部目录条已用公开日期 2025-04-22 |
| F10 两项措辞 | 本批不改（业主确认下批再议）：招商引流条文案、retrofit buyer 表述 |

## 合规状态（本批写入内容同样遵守）

- 禁用词零命中（src/ + public/，含注释）
- 无价格、无准确率/误差百分比、无部署台数/客户数
- 凯健仅「进入建设阶段」；紧急呼叫 = 通知家属/护理员；retrofit 无 C 端选购用语
- 产品页未出现「医疗器械注册证 / 二类医疗器械资质」表述（资质口径仅 `/about` 允许句）
