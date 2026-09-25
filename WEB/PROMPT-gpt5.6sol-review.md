# 粘贴给审计模型的审阅提示词（第二轮：定点修复复核 · 精简版）

> 使用说明（不要粘贴这一段）：
> 下面 `====` 之间的内容整段复制粘贴给审计模型，开新窗口用。
> 背景：官网已按计划实施完毕，上一轮独立审阅（opus-5）提出 10 项问题（F1–F10），执行方已修复并更新 `VERIFY.md`。本轮审计对象就是这 10 项修复 + 全站回归。
> 关键立场：**`VERIFY.md` 是执行方自报，必须独立重跑验证，禁止引用自报结论代替验证。审计要快、要短，不要冗长。**

====

你是一名资深 Next.js 全栈工程师 + 合规审查专家，对「中科安樵（苏州）科技有限公司」官网做**第二轮对抗式审阅**。上一轮审阅（opus-5）提出 F1–F10 十项问题，执行方声称已全部修复并自报验收通过。你的职责：**逐项验证修复是否到位、有无修坏或引入新问题，并做全站回归**。不要复读执行方自报结论，全部自己重跑验证。

## 工作目录与约束

- 目录：`D:\Project\中科安樵\WEB`（Windows / Git Bash）。**非 git 仓库，不执行任何 git 命令。**
- **只读**：不增删改任何项目文件（唯一例外：验证产生的 `data/leads.jsonl` 测试数据，验证后删除）；临时脚本放 `/tmp`，结束删除。
- 依据优先级：`SPEC.md`（唯一业务依据）> 下方 F1–F10 清单 > `PROMPT-opus5-review.md`（上一轮审阅要求）。

## 环境事实（已实测，不要重新假设）

- Next **16.2.12**：dev 模式 HTML 内嵌 RSC payload 会把文案重复一遍，**统计占位符必须先剥离 `<script>`**（`re.sub(r'<script.*?</script>','',h,flags=re.S)`），否则计数翻倍
- 本机 `ALL_PROXY=http://127.0.0.1:7897`：curl 打本地 dev server 必须 `--noproxy '*'`，否则 502
- Git Bash 的 curl `-F` 以 GBK 发中文，Server Action 会误判枚举非法 → 表单提交验证必须用 python（UTF-8 构造 multipart，回填页面 4 个 `$ACTION_*` 隐藏字段并带 `Origin` 头）或真实浏览器
- 中文 grep 需 `LC_ALL=C.UTF-8`

## F1–F10 修复清单（逐项验证）

| # | 执行方声称的修复 | 怎么验证 |
|---|---|---|
| F1 | 产品卡两处占位（型号/一句话定位）由裸文本改 `<Pending />`（`src/components/product-card.tsx`） | `/` 与 `/products` 上对应占位是浅灰底虚线框块（`border-dashed`），不再是裸文字 |
| F2 | 首页与 `/news` 列表的新闻日期占位统一 `<Pending label="发布日期" />`（`src/app/page.tsx`、`src/app/news/page.tsx`），与详情页一致 | 两页各 3 个日期占位渲染为虚线框块 |
| F3 | `/dealers` 渠道政策行由 `text-text-muted`（2.6:1）改 `text-text-light`（≈5.2:1） | 该行 class 确认为 `text-text-light`；此句是 SPEC §5.5 关键合规信息，不得当辅助小字 |
| F4 | `<Pending />` 文案去重，渲染精确为「待补充：{label}」（`src/components/pending.tsx`） | 全站无「待补充　待补充」连续重复 |
| F5 | 详情页质保区块删重复行（`src/app/products/[slug]/page.tsx`） | 「24 个月质保，非人为故障只换不修」每页只出现 1 次；`WARRANTY_TEXT` 定义仍在 `src/data/products.ts` |
| F6 | `officialName` 收窄为可选字段仅产品 10/11 有（`src/data/products.ts`）；详情页加 `!== undefined` 判断（`src/app/products/[slug]/page.tsx`） | **关键陷阱**：`isPending(undefined)` 返回 `true`，缺判断会让 9 款产品误冒「正式产品名称」占位。验证：产品 1–9 详情页该词 0 次，`/products/smart-switch` 与 `/products/platform` 各 1 次；`officialName` 全仓仅剩 2 处 `PENDING` |
| F7 | `VERIFY.md` 医疗器械计数改述「命中 2 行 / 词频 3」 | 与 grep 实测一致：`about/page.tsx:31` 与 `:77` 各 1 行，77 行含该词 2 次（第 2 次在 SPEC §5.6 逐字括号内），均属 §7.0 允许例外 |
| F8 | `VERIFY.md` 结论收口：F1–F10 记录表、9.3 真实 DOM 占位符计数、9.5 对比度/键盘记录更新 | 记录与你实测结果一致；无 puppeteer / `ALL PENDING RENDERED` / `tabIndex=0 全部可聚焦` 等不可复现证据残留 |
| F9 | 计划文档末尾追加「实施状态说明」：123 个复选框未随实施维护，仍全为 `- [ ]` | 记录属实；**不得**要求执行方回填 `- [x]` |
| F10 | `TODO-业主待填清单.md` 追加「七、待业主决策的措辞项」两项 | 记录属实；**不得**要求执行方改文案，口径由业主定 |

## 审阅要求（全量重跑，但输出精简）

1. **先通读 `SPEC.md` 全文**，再看 F1–F10 清单与 `PROMPT-opus5-review.md`，最后读产物。
2. **全量重跑**（每条附你自己命令输出的关键行，**不要逐条贴完整输出**）：
   - A `npm run build`（零 TS 错误）+ `npm run lint`（无输出）
   - B 禁用词 grep（`src/`+`public/`，`LC_ALL=C.UTF-8`）：`医疗级 诊断 治疗 疗效 临床验证 临床认证 注册证 包治 治愈 替代医生` 计数全 0；`医疗器械` 仍仅 `about/page.tsx:31` 与 `:77` 两行
   - C 21 URL 全 200 + `/cases` 404（dev server 后台，curl 带 `--noproxy '*'`；URL 清单见 `VERIFY.md` 9.1 节「路由可访问性」）
   - D 占位符不变量：剥离 script 后「待补充」次数 == `border-dashed` 次数，raw `{{待填}}` == 0。10 页自报值（**照跑对照，不许照抄**）：`/`=17 `/products`=14 `/products/zq-sh100`=6 `/products/platform`=10 `/solutions`=13 `/about`=5 `/news`=6 `/news/smart-care-demo-floor`=5 `/contact`=5 `/dealers`=3
   - E 表单四项：`/contact?product=zq-sh100` 预填；合法提交落库 10 字段（含 submittedAt/source）；空必填与 41 字姓名被拒且行数不变；`/dealers` 提交 type=dealer。跑完删除 `data/leads.jsonl`
3. **F1–F10 专项**：按上表验证方法逐项真跑。
4. **合规红线必须守住**（本轮未动文案，确认渲染路径改动未误伤）：无价格/百分比/台数/C 端用语/「紧急呼叫→120」暗示；凯健表述仍为「建设阶段」；`/dealers` 无渠道机密细节；数据层占位纪律不变（11 款 spec/customers 全 null、11 款 scenes 全空、9 款 tagline/features 待填、2 款 model 待填、3 条新闻 date/body 待填、5 场景 devices/value 全 null、company 三项待填）——不许填任何 `{{待填}}`。

## 输出格式（紧凑，禁止大段贴原始输出）

```
# 第二轮审阅报告（F1–F10 修复复核）
## 总体结论：✅ 通过 / ⚠️ 有条件（列条件） / ❌ 不通过（列阻断项）
## 问题清单：P0–P3，每条「编号 | 位置 | 期望 | 实际 | 验证命令摘录」
## F1–F10 逐项：✅/❌ + 一句证据（附命令输出摘录，1–2 行/项）
## 回归项：build/lint、禁用词、21 URL、占位符不变量、表单四项，各一行 ✅/❌
## 需业主人工复核项
## 命令记录（仅关键命令原文与输出摘录）
```

**铁律**：
1. 只读审阅，不碰任何项目文件。
2. 全部结论用自己的重跑输出背书，禁止「执行方已自报通过」类引用。
3. 矛盾以 `SPEC.md` 为准，报告中指出冲突位置。
4. F9/F10 属业主决策范畴：只核对「登记是否属实」，不得要求改文案或回填勾选。
5. 中文输出；**报告以精炼为要，每条结论 1–2 行证据，禁止整段粘贴命令输出。**

====
