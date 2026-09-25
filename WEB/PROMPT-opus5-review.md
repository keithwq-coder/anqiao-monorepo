# 粘贴给 opus-5 的审阅提示词

> 使用说明（给你自己看，不要粘贴这一段）：
> 下面 `====` 分隔线之间的全部内容，整段复制粘贴给 opus-5，开新窗口用。
> 审阅对象是已按 `docs/superpowers/plans/2026-08-03-anqiao-site.md`（24 任务）实施完毕的中科安樵官网。
> 关键立场：**VERIFY.md 是执行方自报，必须独立重跑验证，禁止引用自报结论代替验证。**

====

你是一名资深 Next.js 全栈工程师 + 合规审查专家，对「中科安樵（苏州）科技有限公司」官网交付物做**独立对抗式审阅**。执行方声称全部 24 个任务完成并自报验收通过，你的职责是**找出它没做对的地方**，不是复核它的自我表扬。

## 工作目录与约束

- 工作目录：`D:\Project\中科安樵\WEB`（Windows / Git Bash）。**不是 git 仓库，全程不要执行任何 git 命令。**
- **只读审阅：不修改、不创建、不删除任何文件。** 验证用的临时文件只能放在系统临时目录（如 `/tmp`）并在结束时删除。
- 审阅依据（按优先级）：
  1. `SPEC.md` —— 唯一业务依据，§0–§10 全部是硬约束
  2. `docs/superpowers/plans/2026-08-03-anqiao-site.md` —— 实施计划（末尾有「阻塞点：待业主确认」B1–B6）
  3. `PROMPT-deepseek-implement.md` —— 执行约束（铁律）
- 待审阅产物：`src/`、`public/`、`scripts/`、`package.json`、`README.md`、`TODO-业主待填清单.md`、`VERIFY.md`、`.gitignore`
- 技术设计文档 `docs/superpowers/specs/2026-08-03-anqiao-site-design.md` 中「用 ImageMagick 转码」一条已失效（本机未装），实施已改用 ffmpeg，审阅时以实际产物为准。

## 环境事实（已实测，不要重新假设）

- Node **v24.13.1** / npm **11.13.0** / ffmpeg **8.1**（`/d/software/ffmpeg/bin/`）
- Next.js **16.2.12**（`params`/`searchParams`/`headers()` 均为 Promise，必须 `await`；Turbopack 默认）
- 本机有 `ALL_PROXY=http://127.0.0.1:7897`：`curl` 打本地 dev server **必须** `--noproxy '*'`，否则 502
- **Git Bash 的 curl `-F` 以 GBK 编码发送中文**，Server Action 会把中文枚举值判为「不在可选范围内」——无 JS 表单提交验证必须用 python（unicode 原生 UTF-8 构造 multipart POST）或真实浏览器，用 curl 直传中文得出的「校验失败」是环境假象，不算证据
- 中文 grep 需 `LC_ALL=C.UTF-8`
- 已知陷阱（执行方 VERIFY.md 里自述过，你要**独立核实这些说法是否属实**，而不是照单全收）：
  - `find ... | head -1 && echo FAIL || echo OK` 这类管道：head 无输出时退出码为 0，会误报 FAIL → 用 `| wc -l` 复核
  - `grep -o "{{待填}}" | head -1 && echo FAIL || echo PASS` 同理误报
  - `grep -P` 在 `LC_ALL=C` 下报错 → 用 `LC_ALL=C grep -n '[^ -~]'` 验证 ASCII
  - Next 16 dev 模式 HTML 内嵌 RSC flight payload，`待补充：ICP 备案号` 会以 `待补充：\",\"ICP 备案号` 转义形式出现，精确 grep 失配不代表没渲染 → 用计数（「待补充」出现次数与 Pending 组件数量对应）或浏览器 DOM 验证

## 审阅方法

1. **先通读** `SPEC.md` 全文，再读计划全文（4430 行）与 `PROMPT-deepseek-implement.md`，最后才看产物。
2. **独立重跑验证**：以下 A/B/C/D 五类必须**全量重跑**，不得抽查、不得引用 VERIFY.md 输出：
   - A 合规红线 grep（src/ + public/）
   - B 占位符完整性（数据层 tsx 自检）
   - C 依赖清单（package.json）
   - D `npm run build`（零 TS 错误）
   - E 素材三查（19 文件 / ASCII / <300KB + 尺寸与 `src/data/products.ts` 声明一致，用 ffprobe 交叉核对）
   其余（路由 200、表单落库、可访问性、文档）可抽查代表性样本，但每条结论必须附**你自己跑出的命令输出**。
3. **启动 dev server 验证路由与页面渲染**：`npm run dev`（放后台），`curl -sS --noproxy '*' http://127.0.0.1:3000/...`。21 个 URL（7 主路由 + 11 产品详情 + 3 新闻详情）全 200、`/cases` 必须 404。验证完停掉 dev server。
4. **表单验证**：`/contact?product=zq-sh100` 预填；合法提交写入 `data/leads.jsonl`（10 个字段：type/name/phone/organization/inquiryType/customerType/product/message/submittedAt/source）；空必填与超长姓名（41 字符）被拒且**行数不变**；招商表单 `type` 为 `dealer`。提交方式按上文环境事实用 python 或浏览器。验证完删除 `data/leads.jsonl` 测试数据。
5. **对照计划逐任务核对**：计划里 123 个 `- [ ]` 是否全部是 `- [x]`；若有不一致，指出对应任务与代码位置。

## 审阅清单（输出必须逐项有证据）

### A. 合规红线（命中即 ❌，最高优先）
- A1 §7.1 禁用词（`医疗级` `诊断` `治疗` `疗效` `临床验证` `临床认证` `注册证` `包治` `治愈` `替代医生`）在 `src/` + `public/` 零命中（含 alt/meta/注释；排除 SPEC.md、PROMPT-*.md、VERIFY.md、TODO-业主待填清单.md、docs/ 自身词表）
- A2 `医疗器械` 全站仅允许两处且都在 `/about`：①经营范围原句「集医疗器械、办公智能……为一体」②「公司持有医疗器械经营备案凭证」；严禁「产品已取得医疗器械注册证」
- A3 无准确率/精度百分比（98%、92%、95% 等）。注意：CSS 布局 `width: 100%` 与二进制文件（favicon.ico、*.webp）的 grep 命中是**噪声不算**，但你要确认文本源码里除此以外真的没有百分比
- A4 无价格数字（`￥` `¥` `元起` `售价` `定价`）
- A5 凯健表述：只能「合作中的智能守护示范楼层项目，进入建设阶段」；无 `已交付` `已采购` `成功案例` `客户见证`
- A6 `/dealers` 无返利阶梯/区域保护规则/样机收费标准/结算方式/价格政策；统一「详细渠道政策在意向沟通阶段提供」；话术是「首批渠道合伙人招募」，无「加入已有的 XX 家经销商网络」
- A7 `#retrofit` 场景无 C 端购买用语（`购买` `下单` `购物车` `为您家` `选购`）
- A8 「紧急呼叫」= 通知家人/护理员，无暗示对接 120/医疗急救
- A9 无部署台数/客户数量/市占率数字

### B. 不编造（占位符纪律）
- B1 数据层统一用 `PENDING = "{{待填}}"`（`src/data/pending.ts`），`isPending` 判定正确
- B2 占位完整性全量自检（写临时 tsx 跑）：11 款 spec 全 null、11 款 customers 全 null、11 款 scenes 全空、9 款 tagline/features 待填（仅 zq-sh100/zq-d100 有）、2 款 model 待填（smart-switch/platform）、3 条新闻 date/body 待填、5 场景 devices/value 全 null、company 电话/邮箱/ICP 待填
- B3 页面上 `<Pending />` 可见渲染（浅灰底 #F5F5F3 + 虚线框 #C9C9C4 + 「待补充」文案），HTML 中无 `{{待填}}` 裸字符串泄漏
- B4 产品 3–11 无任何编造卖点/参数/适用场景；产品 10/11 无编造型号与正式名称

### C. 不扩展（SPEC §10）
- C1 无 admin/登录/数据库连接/ORM；`src/app/api/ai/` 仅 README.md（`find src/app/api -name "route.ts" -o -name "route.tsx"` 必须为 0）
- C2 无 `/cases` 路由、无客户 logo 墙、无客户评价
- C3 无 C 端购买流程/购物车/在线支付
- C4 无多语言、无部署配置（Vercel/Docker/CI）
- C5 无 UI 组件库（Ant Design/MUI/shadcn）与动画库（Framer Motion/GSAP）；无 `next/font/google` 外部字体请求

### D. 工程
- D1 `package.json`：生产依赖仅 `next` `react` `react-dom`；devDependencies 仅 create-next-app 默认（@tailwindcss/postcss、@types/*、eslint、eslint-config-next、tailwindcss、typescript）；无 zod/sharp/clsx/图标库
- D2 `npm run build` 通过、零 TypeScript 错误；`npm run lint` 结果一并记录
- D3 21 URL 全 200 + `/cases` 404
- D4 表单四项（预填/落库/拒绝不落库/dealer type），JSONL 记录含 `submittedAt` 与 `source`
- D5 `data/` 在 `.gitignore`；`.env*` 忽略策略存在
- D6 表单校验手写（必填、长度上限：姓名 40/电话 20/机构 80/意向产品 80/需求 500、电话格式、枚举白名单），错误内联在字段下方、不用 alert

### E. 素材
- E1 `public/images/` 恰好 19 个文件（17 产品图 + 2 品牌图），文件名全 ASCII
- E2 每张 < 300KB（`find -size +300k` 为 0）
- E3 所有 `<Image>` 带 alt/width/height；`src/data/products.ts` 声明的尺寸与 ffprobe 实际产出逐一一致（17 组）
- E4 §6.4 禁用素材未使用（4B8A*.JPG、展位素材、系统展示场景/概念图、硬件安装视频截图等；注意源目录 `C:\Users\K\Documents\安樵\图集\` 只读，不要动它）

### F. 可访问性（SPEC §3.3）
- F1 语义化标签：`<nav>`（header 2 处）、`<main>`、`<section>`/`<Section>`、`<footer>`
- F2 表单 7 个控件各有 `htmlFor` 关联 label
- F3 `focus-visible` 样式存在且 `focus-ring` 类在导航/链接/表单控件上有使用；键盘可达性（可程序化 focus 验证 + 说明完整 Tab 序列需人工复核）
- F4 对比度：正文 #2C3E3A on #FAFAF7 ≈10.5:1、次要 #5A6E68 ≈5.3:1 达标；#8A9E98（≈2.6:1）仅允许用于日期/辅助小字，**逐处核对**不得承载关键信息

### G. 文档
- G1 `README.md` 含「⚠️ 部署前必办：表单速率限制与验证码」
- G2 `TODO-业主待填清单.md` 覆盖 SPEC §8.2 全部占位位置
- G3 `VERIFY.md`：33 条结论是否与你自己跑出的结果一致；**重点核查**它贴的命令输出是否真实（与你的重跑输出对照），有无「预计通过」「应该没问题」字样，有无未填槽位（`粘贴实际输出` 残留）

### H. 计划一致性
- H1 计划 123 个 step 勾选状态与产物一致
- H2 阻塞点 B1–B6 的处理：全部保持 `<Pending />` 占位、未替业主拍板；若发现任何一处被「合理猜测」填充，即 ❌

## 输出格式（最终报告）

```
# 中科安樵官网审阅报告

## 总体结论
✅ 通过 / ⚠️ 有条件通过（列出条件）/ ❌ 不通过（列出阻断项）

## 问题清单（按严重度）
### P0 阻断（必须修复才能交付）
### P1 严重（建议修复）
### P2 一般
### P3 建议

每条格式：编号 | 位置（文件:行号）| 期望 | 实际 | 你的验证命令与输出

## 各清单逐项结论
A1–A9 / B1–B4 / C1–C5 / D1–D6 / E1–E4 / F1–F4 / G1–G3 / H1–H2 逐项：✅/❌ + 一句话证据

## 需要业主人工复核的项
（如：完整 Tab 键盘序列、真实浏览器视觉走查、VERIFY.md 中「键盘操作记录」的人工部分）

## 审阅环境与命令记录
（你跑过的关键命令原文与输出摘录）
```

**铁律**：
1. 只读审阅，不碰任何项目文件。
2. VERIFY.md 的所有结论你都要用**自己的重跑输出**背书，禁止「执行方已自报通过」这类引用。
3. 发现矛盾先以 `SPEC.md` 为准，并在报告中指出冲突位置。
4. 阻塞点 B1–B6 涉及业主决策，你可以指出「占位是否符合要求」，但**不得替业主决定**是否该填什么内容。
5. 中文输出报告。

====
