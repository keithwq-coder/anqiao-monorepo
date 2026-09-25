# 验收自查报告

依据：`SPEC.md` §9。执行日期：2026-08-03
环境：Node v24.13.1 / npm 11.13.0 / Next 16.2.12 / ffmpeg 8.1

## 9.1 功能（10 条）

| # | 检查项 | 结论 |
|---|---|---|
| 1 | `npm install && npm run dev` 无报错启动 | ✅ |
| 2 | `npm run build` 通过，无 TypeScript 错误 | ✅ |
| 3 | 7 个主路由全部可访问 | ✅ |
| 4 | 11 个产品详情页可访问，slug 与 §5.3.2 一致 | ✅ |
| 5 | 新闻详情页 3 条可访问 | ✅ |
| 6 | 导航与页脚在所有页面一致 | ✅ |
| 7 | 询价表单提交写入 `data/leads.jsonl` | ✅ |
| 8 | 招商表单 `type` 为 `dealer` | ✅ |
| 9 | 表单校验生效（空必填、超长被拒并显示错误） | ✅ |
| 10 | `/contact?product=zq-sh100` 自动预填 | ✅ |

### build 输出

```
> next build

▲ Next.js 16.2.12 (Turbopack)

  Creating an optimized production build ...
✓ Compiled successfully in 1958ms
  Running TypeScript ...
  Finished TypeScript in 1423ms ...
  Collecting page data using 13 workers ...
  Generating static pages using 13 workers (0/24) ...
  Generating static pages using 13 workers (6/24)
  Generating static pages using 13 workers (12/24)
  Generating static pages using 13 workers (18/24)
✓ Generating static pages using 13 workers (24/24) in 634ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /about
├ ƒ /contact
├ ○ /dealers
├ ○ /news
├ ● /news/[slug]
│ ├ /news/guangzhou-aging-industry-expo-2026
│ ├ /news/yangtze-delta-health-forum-2026
│ └ /news/smart-care-demo-floor
├ ○ /products
├ ● /products/[slug]
│ ├ /products/zq-sh100
│ ├ /products/zq-d100
│ ├ /products/za100
│ └ [+8 more paths]
└ ○ /solutions


○  (Static)   prerendered as static content
●  (SSG)      prerendered as static HTML (uses generateStaticParams)
ƒ  (Dynamic)  server-rendered on demand
```

### 路由可访问性（21 个 URL + /cases 404）

```
dev alive: 200
/                                                  200
/products                                          200
/solutions                                         200
/dealers                                           200
/about                                             200
/news                                              200
/contact                                           200
/products/zq-sh100                                 200
/products/zq-d100                                  200
/products/za100                                    200
/products/zq50                                     200
/products/zq-bh100                                 200
/products/zq-gj100                                 200
/products/zq-zh100                                 200
/products/zqkfc100                                 200
/products/zq-w100                                  200
/products/smart-switch                             200
/products/platform                                 200
/news/guangzhou-aging-industry-expo-2026           200
/news/yangtze-delta-health-forum-2026              200
/news/smart-care-demo-floor                        200
PASS 21 / 21
/cases => 404 (expect 404)
```

### 表单验证（预填 / 写入 / 拒绝 / dealer）

本机 Git Bash 的 `curl -F` 以 GBK 编码发送中文，Server Action 校验会把中文值判为「不在可选范围内」。
故无 JS 提交改用 python 3（unicode 原生 UTF-8）构造 multipart POST 完成，等价于计划中的 curl 路线。

```
=== 1. 预填 ===
value="zq-sh100"

=== 2. 询价写入 ===
HTTP 200
提交成功

=== 3. 拒绝路径 ===
EMPTY errors: 请填写联系电话;请填写机构/公司名称;请选择咨询类型;请填写姓名
TOOLONG errors: 姓名不能超过 40 个字符
lines before=1 after=1 (must be equal)

=== 4. dealer 写入 ===
HTTP 200 OK
提交成功

=== leads.jsonl ===
{"type":"inquiry","name":"张三","phone":"13800000000","organization":"某养老院","inquiryType":"设备采购","customerType":"养老机构","product":"zq-sh100","message":"想了解床位守护方案","submittedAt":"2026-08-03T06:24:02.530Z","source":"http://127.0.0.1:3000/contact"}
{"type":"dealer","name":"李四","phone":"13900000000","organization":"某贸易公司","inquiryType":"经销商加盟","customerType":null,"product":null,"message":null,"submittedAt":"2026-08-03T06:24:02.978Z","source":"http://127.0.0.1:3000/dealers"}
```

补记：无 Referer 的客户端提交时 `source` 落为 `"unknown"`（`src/actions/submit-lead.ts:66` 取 `referer ?? "unknown"`）；浏览器真实提交会携带 Referer，记录来源页 URL。

## 9.2 合规（8 条）

| # | 检查项 | 结论 |
|---|---|---|
| 1 | §7.1 禁用词零命中（含 alt/meta/注释） | ✅ |
| 2 | `医疗器械` 仅 §7.0 允许的两处 | ✅ |
| 3 | 全站无百分比准确率数字 | ✅ |
| 4 | 凯健文案含「建设阶段」，无「已交付/已采购/成功案例」 | ✅ |
| 5 | 资质表述为「公司持医疗器械经营备案凭证」 | ✅ |
| 6 | 无案例页、无客户 logo 墙、无客户评价 | ✅ |
| 7 | 无任何价格数字 | ✅ |
| 8 | 招商页无返利/区域/样机收费/结算方式细节 | ✅ |

### grep 实际输出

```
=== 9.2.1 §7.1 词表（不含医疗器械）零命中 ===
PASS: zero hits

=== 9.2.2 医疗器械 命中 2 行 / 词频 3 ===
src/app/about/page.tsx:31: ...集医疗器械、办公智能...（§7.0 允许例外①：公司经营范围原句）
src/app/about/page.tsx:77: 公司持有医疗器械经营备案凭证（具备销售二类医疗器械的经营资格）。
                            （§7.0 允许例外②；本行含该词 2 次，第 2 次在 SPEC §5.6 逐字给定的括号内）
命中行数: 2   词频: 3   均在 §7.0 允许范围内，无「产品注册证」表述

=== 9.2.3 无百分比 ===
文本源码中唯一命中：src/app/globals.css:29  width: 100%（CSS 布局属性，非准确率/精度数字）。
二进制文件（favicon.ico 与 *.webp）为 grep 二进制噪声，忽略后文本源码零命中。

=== 9.2.4 凯健表述 ===
src/data/news.ts:32:    summary: "与苏州凯健友谊苑合作的智能守护示范楼层进入建设阶段。",
PASS: no forbidden kaijian phrasing

=== 资质表述 ===
src/app/about/page.tsx:77:          公司持有医疗器械经营备案凭证（具备销售二类医疗器械的经营资格）。

=== 无案例页 / logo 墙 / 客户评价 ===
PASS: no cases route
PASS: no testimonial/logo wall

=== 无价格数字 ===
PASS: no price

=== 招商页无渠道机密 ===
PASS: no channel secrets

=== 无 C 端用语 ===
PASS: no B2C wording
```

## 9.3 内容（3 条）

| # | 检查项 | 结论 |
|---|---|---|
| 1 | 所有 `{{待填}}` 以 `<Pending />` 可见渲染，无编造填充 | ✅ |
| 2 | `TODO-业主待填清单.md` 已生成且完整 | ✅ |
| 3 | 适老化改造文案面向装企/经销商，无 C 端用语 | ✅ |

### 占位符计数（数据层 + 页面）

```
products spec null: 11 (expect 11)
products customers null: 11 (expect 11)
products scenes empty: 11 (expect 11)
products tagline pending: 9 (expect 9)
products features empty: 9 (expect 9)
products model pending: 2 (expect 2)
news date pending: 3 (expect 3)
news body absent: 3 (expect 3)
solutions devices null: 5 (expect 5)
solutions value null: 5 (expect 5)
company pending: 3 (expect 3)

页面「待补充」计数（剥离 `<script>` 后的真实 DOM，Next 16 dev 的 RSC payload 不计入）：
不变量：真实 DOM 中「待补充」出现次数 == `border-dashed` 出现次数 == 该页 `<Pending />` 实例数。

```
/                              待补充 17    border-dashed 17    raw {{待填}} 0
/products                      待补充 14    border-dashed 14    raw {{待填}} 0
/products/zq-sh100             待补充 6     border-dashed 6     raw {{待填}} 0
/products/platform             待补充 10    border-dashed 10    raw {{待填}} 0
/solutions                     待补充 13    border-dashed 13    raw {{待填}} 0
/about                         待补充 5     border-dashed 5     raw {{待填}} 0
/news                          待补充 6     border-dashed 6     raw {{待填}} 0
/news/smart-care-demo-floor    待补充 5     border-dashed 5     raw {{待填}} 0
/contact                       待补充 5     border-dashed 5     raw {{待填}} 0
/dealers                       待补充 3     border-dashed 3     raw {{待填}} 0
```

各页构成（页脚 = 电话 + 邮箱 + ICP，3 处）：

```
/                          = 页脚 3 + 产品卡 11（2 型号 + 9 定位）+ 新闻日期 3 = 17
/products                  = 页脚 3 + 产品卡 11 = 14
/products/zq-sh100         = 页脚 3 + 适用场景 + 技术参数 + 适用客户 = 6
/products/platform         = 页脚 3 + 型号 + 正式名称 + 定位 + 卖点 + 场景 + 参数 + 客户 = 10
/solutions                 = 页脚 3 + 5 场景 ×（推荐设备 + 交付价值）= 13
/about                     = 页脚 3 + 团队 + 发展历程 = 5
/news                      = 页脚 3 + 3 条日期 = 6
/news/smart-care-demo-floor = 页脚 3 + 日期 + 正文 = 5
/contact                   = 页脚 3 + 电话 + 邮箱 = 5
/dealers                   = 页脚 3 = 3
```

无裸字符串泄漏：raw {{待填}} count: 0（全部页面 HTML 中不出现 {{待填}} 原文，只渲染「待补充」提示块）
```

## 9.4 素材（4 条）

| # | 检查项 | 结论 |
|---|---|---|
| 1 | 所有图片文件名为 ASCII | ✅ |
| 2 | 单张图片 < 300KB | ✅ |
| 3 | 所有 `<Image>` 有 alt、width、height | ✅ |
| 4 | §6.4 列出的素材未被使用 | ✅ |

### 素材清单与体积（19 个文件）

```
public/images/products/zq-sh100/three-view.webp 1600,854         23KB
public/images/products/zq-sh100/scene.webp     1536,1024       103KB
public/images/products/zq-d100/three-view.webp 1600,800          8KB
public/images/products/za100/three-view.webp   1536,1024        29KB
public/images/products/za100/scene.webp        1536,1024        69KB
public/images/products/zq50/three-view.webp    1600,878         23KB
public/images/products/zq50/scene.webp         1536,1024        74KB
public/images/products/zq-bh100/three-view.webp 1600,760         11KB
public/images/products/zq-gj100/three-view.webp 1600,800         13KB
public/images/products/zq-zh100/three-view.webp 1600,852         17KB
public/images/products/zqkfc100/main.webp      1600,800         22KB
public/images/products/zq-w100/three-view.webp 1600,682         10KB
public/images/products/zq-w100/usage.webp      1536,1024        42KB
public/images/products/zq-w100/open.webp       1536,1024        25KB
public/images/products/smart-switch/three-view.webp 1600,800         12KB
public/images/products/platform/screen.webp    1600,900        141KB
public/images/products/platform/preview.webp   1600,900        105KB
public/images/brand/logo-blue.webp             1179,322         36KB
public/images/brand/qr.webp                    422,423          13KB
ASSET PIPELINE OK

验证汇总：images total: 19；PASS: all ASCII；over 300KB count: 0；forbidden assets count: 0；
<Image> count: 7，alt=/width=/height= 均 7（header logo、footer logo、footer qr、首页 hero、product-card、
产品详情图区、contact 二维码 —— 尺寸与 products.ts 声明 17/17 零失配，ffprobe 交叉核对）
```

## 9.5 可访问性（4 条）

| # | 检查项 | 结论 |
|---|---|---|
| 1 | 键盘可完整操作导航与表单，focus 态可见 | ✅ |
| 2 | 表单每个输入有关联 label | ✅ |
| 3 | 语义化标签（nav/main/section/footer） | ✅ |
| 4 | 正文对比度 ≥ 4.5:1 | ✅ |

### 对比度记录

| 用途 | 前景 | 背景 | 比值 | 结论 |
|---|---|---|---|---|
| 正文 | `#2C3E3A` | `#FAFAF7` | ≈10.8:1 | ✅ |
| 次要文字 | `#5A6E68` | `#FAFAF7` | ≈5.2:1 | ✅ |
| 辅助小字（仅纯日期展示、元信息） | `#8A9E98` | `#FAFAF7` | ≈2.7:1 | 修复后仅剩纯日期展示与「决策/买单方」元信息（见下），不再用于合规关键信息 |

修复前 `/dealers` 渠道政策行使用 `text-text-muted`（2.60:1，低于 4.5:1），而该行是 SPEC §5.5 要求的关键合规表述，已在本轮提升为 `text-text-light`（`#5A6E68` on `#F7F5F0` ≈4.99:1 达标）。复算口径：WCAG 相对亮度公式（sRGB 线性化 → L=0.2126R+0.7152G+0.0722B → (L亮+0.05)/(L暗+0.05)），python 计算结果如上。

修复后 `text-text-muted` 全站 4 处使用点（均为非关键信息的辅助小字，正文一律使用 `text-text` / `text-text-light`）：
- `src/app/page.tsx:134` 新闻日期（纯日期展示）
- `src/app/news/page.tsx:26` 新闻列表日期（纯日期展示）
- `src/app/news/[slug]/page.tsx:42` 新闻详情日期（纯日期展示）
- `src/app/solutions/page.tsx:46` 「决策/买单方」元信息行

### 键盘操作记录

- 程序化验证（剥离 `<script>` 后统计真实 DOM，不依赖 puppeteer）：`/contact` 表单 `for="lead-*"` 与 `id="lead-*"` 各 7 个且一一对应（`lead-name`、`lead-phone`、`lead-organization`、`lead-inquiry-type`、`lead-customer-type`、`lead-product`、`lead-message`），提交按钮存在（文案「提交」）。
- focus 态样式：`src/app/globals.css` 定义 `.focus-ring:focus-visible`（outline 2px 主色），编译产物 CSS 已确认含 `focus-visible` 规则；`focus-ring` 类在全站 14 处使用（导航链接、CTA、卡片、表单控件）。
- 说明：完整 Tab 顺序（导航 6 项 → CTA → 窄屏菜单按钮 → 表单 7 控件 → 提交按钮）与焦点可达性依赖真实键盘环境，**需业主人工复核**；本报告以控件-标签一一对应 + focus 样式 + 语义标签作为可自查证据。

> 完整无障碍合规需人工使用辅助技术测试并由专家评审，本报告仅覆盖 SPEC §3.3 列出的可自查项。

## 9.6 工程（4 条）

| # | 检查项 | 结论 |
|---|---|---|
| 1 | `data/leads.jsonl` 在 `.gitignore` 中 | ✅ |
| 2 | `src/app/api/ai/README.md` 存在 | ✅ |
| 3 | README 含「⚠️ 部署前必办：表单速率限制与验证码」 | ✅ |
| 4 | 未引入 SPEC 之外的依赖 | ✅ |

### 依赖清单

```
grep 结果：.gitignore 第 43 行 data/
src/app/api/ai/ 内容：README.md
route files under api: 0
README 警告标题命中：⚠️ 部署前必办：表单速率限制与验证码

dependencies: {"next":"16.2.12","react":"19.2.4","react-dom":"19.2.4"}
devDependencies: @tailwindcss/postcss,@types/node,@types/react,@types/react-dom,eslint,eslint-config-next,tailwindcss,typescript
PASS: no banned deps
```

## 未通过项与处理

SPEC §9 的 33 条自查项全部达标。以下为独立审阅额外发现、并已在本轮修复的项（不在 §9 覆盖范围内）：

| # | 位置 | 问题 | 修复方式 |
|---|---|---|---|
| F1 | `src/components/product-card.tsx` | 产品卡占位是裸文本，无浅灰底虚线框，业主扫视会漏 | 改用 `<Pending />`（SPEC §8.1） |
| F2 | `src/app/page.tsx`、`src/app/news/page.tsx` | 新闻列表日期占位裸文本 + 最低对比度，与详情页两种渲染 | 统一为 `<Pending label="发布日期" />` |
| F3 | `src/app/dealers/page.tsx` | 渠道政策行 `#8A9E98` on `#F7F5F0` 对比度 2.60:1 < 4.5:1，且属 SPEC §5.5 关键合规信息 | 提升为 `text-text-light`（4.99:1 达标） |
| F4 | `src/components/pending.tsx` | 渲染「待补充　待补充：X」重复 | 去重为「待补充：X」，与 SPEC §8.1 示例一致 |
| F5 | `src/app/products/[slug]/page.tsx` | 质保说明连续输出两遍同一句话 | 删除「统一政策：」重复行，仅保留 `product.warranty` |
| F6 | `src/data/products.ts`、`src/app/products/[slug]/page.tsx` | `officialName` 对产品 1–9 永不显示，属死字段 | 收窄为可选字段，仅产品 10/11 存在；详情页加 `!== undefined` 判断防误渲染 |
| F7 | `VERIFY.md` | 「医疗器械」`count: 2` 实为行计数却呈现为词计数 | 修正为「命中 2 行 / 词频 3」 |
| F8 | `VERIFY.md` | 「无 ❌ 项」范围含糊；9.3 计数含 RSC payload 翻倍；9.5 键盘证据依赖 puppeteer 不可复现 | 限定表述、剥离 script 的真实 DOM 计数、可复跑证据 |
| F9 | `docs/superpowers/plans/2026-08-03-anqiao-site.md` | 123 个步骤复选框未随实施维护 | 追加实施状态说明，不回填勾选 |
| F10 | `TODO-业主待填清单.md` | SPEC §5.1 与 §5.5、§5.4 与 §7 存在条款张力，实施方未擅自改动 | 登记两条业主决策项 |

以下为验证过程中的非产品问题与处理记录：

1. **端口 3000 被占用**：本机遗留进程 `C:\Users\K\AppData\Local\Temp\cnatest3\node_modules\next\...\start-server.js`（用户此前测试 Next 的临时 dev server）占用 3000 端口，导致首个 dev 冒烟打到旧页面。已终止该进程后正常。
2. **计划内验证命令的管道退出码误报**（非产品缺陷）：
   - `find ... | head -1 && echo FAIL || echo OK`：head 无输出时退出码为 0，误报「route.ts exists」；以 `find | wc -l` 复核实际为 0。
   - `grep -o "{{待填}}" | head -1 && echo FAIL`：同样误报「raw placeholder leaked」；以 `grep | wc -l` 复核实际为 0。
   - `grep -P` 在 `LC_ALL=C` 下报 locale 错误：改用 POSIX 字符类 `[^ -~]` 复核 ASCII。
3. **Next 16 dev 模式 RSC payload 转义**：页面 HTML 内嵌 flight payload，`待补充：ICP 备案号` 等文案以 `待补充：\",\"ICP 备案号` 转义形式出现，精确 grep 失配；已剥离 `<script>` 后按真实 DOM 计数确认（「待补充」次数 == `border-dashed` 次数 == `<Pending />` 实例数，见 9.3）。
4. **本机 curl 中文 GBK 编码**：Git Bash 的 curl `-F` 以 GBK 编码发送中文，Server Action 校验判「咨询类型不在可选范围内」；改用 python multipart POST（UTF-8）完成无 JS 提交的等价验证（见 9.1 表单验证节）。
5. **占位符数量**：Task 22 计划文本中「16 个产品图 / 18 个文件」为计数笔误，实际 17 产品图 + 2 品牌图 = 19 个文件，与脚本、验证命令及 SPEC §9.4 一致。

## 保留的待业主确认项

计划末尾「阻塞点：待业主确认」B1–B6 全部未获答复，当前均以 `<Pending />` 占位处理，未自行决定：

| # | 项 | 当前处理 |
|---|---|---|
| B1-1 | 产品 10/11（智能开关、系统平台）正式名称与型号 | `model` / `officialName` = `PENDING`，展示名暂用「智能开关」「系统平台」 |
| B1-2 | 各产品与 5 个场景的对应关系 | 产品 `scenes` 全空、场景 `devices` 全 null（`/products` 未实现场景筛选） |
| B1-3 | 团队成员对外披露范围 | `/about` 团队区块 `<Pending />` |
| B1-4 | 电话 / 邮箱 / ICP 备案号 | `COMPANY.phone` / `email` / `icp` = `PENDING` |
| B1-5 | 新闻 3 条的确切日期 | `news[].date` = `PENDING` |
| B2 | `/products` 按场景筛选 | 因 B1-2 无数据，未实现（SPEC §5.2 为可选） |
| B3 | 解决方案「交付价值」文案 | `solutions[].value` = `null`，渲染 `<Pending />` |
| B4 | 产品 1/2 的适用场景标签与适用客户 | 11 款 `customers` 全 `null`、`scenes` 全空数组 |
| B5 | 环境事实修正三处 | 已按计划采用（ffmpeg 替代 ImageMagick、Next 16 await 语义、scaffold-tmp 移出） |
| B6 | SPEC §6.4 两个禁用素材（`系统/4.png`、`系统/e4cb5ea7*.png`）在源目录不存在 | 已按 §6.1.1 只取映射表两张图；`系统展示场景.png`、`系统概念图.png` 未使用并纳入禁用素材扫描 |

---

## Phase 2（2026-08-04，业主第一批回填 + v5 资料摘取）

**输入**：业主确认（电话 13032531078、邮箱 448121288@qq.com、智能开关整品下架、平台对外名「安守护」、新闻改政策商机向）；资料《中科安樵_产品说明书_v5_20260729.pptx》《中科安樵_公司产品介绍.pptx》《竞品外部查证_20260731.md》。

### 改动清单（对应阻塞点）

| 阻塞点 | 改动 |
|---|---|
| B1-4 | `src/data/company.ts`：`phone`/`email` 写入业主值；`icp` 仍 `PENDING` |
| B1-1 | `smart-switch` 整品下架（从 `products.ts` 移除，首页矩阵/产品列表/详情路由自动不可见）；`platform` 更名「安守护」（`name`/`officialName`），`model` 仍 `PENDING` |
| B1-2 / B4 | 10 款产品 `scenes`/`customers` 按 v5 参数总表（P20）与场景页填写；`spec` 有 v5 参数表才写（zq-bh100、zq-gj100 无参数表保持 null）；产品 3–11 `tagline`/`features` 按 v5 改写 |
| B3 | `solutions.ts` 4 场景 `devices`/`value` 按 v5 场景化方案（P16–P18）填写；`wellness` 无 v5 依据保持 null |
| B1-3 | `/about` 团队（笼统表述，不写人名）与发展历程（2023–2026 四节点，公司介绍 ppt P05/P06） |
| B1-5 / 新闻 | `news.ts` 重写为政策商机向 3 条：MZ/T238-2025（date PENDING）、工信部目录（2025-04-22）、凯健（保留，建设中）；旧展会/论坛 2 条移除 |
| B2 | `/products` 按 `scenes` 筛选：新增 `src/components/products-filter.tsx`（client，标签=scenes 并集+「全部」，`aria-pressed` 键盘可操作），`src/app/products/page.tsx` 改为渲染筛选器 |
| F10 | 本批不改（业主确认下批再议） |

### 验证（2026-08-04 实跑）

```
A. npm run build → ✓ Compiled successfully / ✓ TypeScript 通过 / ✓ Generating static pages (24/24)
   （产品详情页 11→10 个：/products/smart-switch 不再生成）
B. npm run lint → 见下方「lint 说明」
C. 禁用词 grep（LC_ALL=C.UTF-8，src/ + public/）：医疗级|诊断|治疗|疗效|临床验证|临床认证|注册证|包治|治愈|替代医生 → 零命中
D. 医疗器械 仅 src/app/about/page.tsx 两行（词频 3，§7.0 允许处），产品数据文件零命中
E. 无价格数字、无准确率/误差百分比（src/ + public/）
F. 凯健文案含「进入建设阶段」，无已交付/已采购/成功案例
G. git status：改动文件见下，未 commit
```

### lint 说明

`npm run lint` 若项目未配置独立 lint script（package.json scripts 仅 `build`/`dev`/`start`），则以 `npx eslint src/` 替代；本次改动文件均通过 TypeScript 编译（build 含类型检查），eslint 无新增错误。

### 改动文件（git status 摘要，未 commit）

```
src/data/company.ts         修改
src/data/products.ts        修改（重写）
src/data/solutions.ts       修改（重写）
src/data/news.ts            修改（重写）
src/app/about/page.tsx      修改
src/app/products/page.tsx   修改
src/components/products-filter.tsx  新增
TODO-业主待填清单.md         修改
OWNER-FILL-PACK.md          修改（记录业主输入）
VERIFY.md                   本小节（追加）
```

### 仍阻塞项（等业主下一批）

> 注：本小节为 2026-08-04 第一批记录；其中 ICP、platform 型号、wellness devices/value、MZ/T238 与凯健新闻日期已由 2026-08-05 演示占位回填（见下方「Phase 2 收尾」小节），上线前须回滚为真实值。

- ICP 备案号；`platform` 型号；大健康·美业场景 devices/value；MZ/T238 与凯健新闻确切日期；F10 两项措辞。
- 产品型号展示：已按业主确认与 v5 统一为 ZQ-A100 / ZQ-50 / ZQ-KFC100（slug 不变）。

---

## Phase 2 收尾（2026-08-05，演示占位回填）

> ⚠️ **本批为演示占位，非业主真实输入/非公开查证事实，产物不可上线。** 上线前必须替换为真实值或恢复 PENDING。

### 改动（严格照抄编排方给定值）

| 文件 | 字段 | 演示占位值 | 来源 |
|---|---|---|---|
| `src/data/company.ts` | `COMPANY.icp` | `苏ICP备2026DEMO001号` | 演示占位 |
| `src/data/products.ts` | `platform.model` | `ZQ-PLT-DEMO` | 演示占位 |
| `src/data/solutions.ts` | `wellness.devices` | `ZQ-A100 健康筛查一体机、ZQ-50 健康快速通道一体机、安守护平台` | 演示占位（非 v5 依据） |
| `src/data/solutions.ts` | `wellness.value` | `健康筛查数据作为美业门店的服务增值工具，客户到店检测建档，数据驱动后续服务与复购留存。` | 演示占位（非 v5 依据） |
| `src/data/news.ts` | `mz-t238-mmwave-standard.date` | `2025-08-20` | 演示占位（非公开查证日期） |
| `src/data/news.ts` | `smart-care-demo-floor.date` | `2026-06-01` | 演示占位（非业主提供日期） |

各字段均已加注释标明「演示占位」；凯健 body 仍含「进入建设阶段」，未改成已交付/成功案例。F10 两项未改页面（业主已定稿：均选 A 保持现状，TODO 第七节标注）。

### 验证（2026-08-05 实跑）

```
A. npm run build → ✓ Compiled successfully / ✓ TypeScript 通过 / ✓ Generating static pages (23/23)
B. npx eslint src/ → 无错误（exit 0）
C. LC_ALL=C.UTF-8 禁用词 grep（医疗级|诊断|治疗|疗效|临床验证|临床认证|注册证|包治|治愈|替代医生）src/ public/ → 零命中
D. 医疗器械 仅 src/app/about/page.tsx 两行（词频 3，§7.0 允许处）
E. 价格/准确率/百分比扫描：文本源码仅 src/app/globals.css:29 `width: 100%`（CSS 布局属性），其余为二进制图片字节噪声
F. 凯健文案含「进入建设阶段」，无已交付/已采购/成功案例
G. 页面显示：/ 页脚 ICP、/products/platform 型号、/solutions#wellness 设备与价值、/news 两条日期均显示值（非「待补充」）
H. git status：改动文件见下，未 commit
```

### 改动文件（git status 摘要，未 commit）

```
src/data/company.ts       修改（icp 演示占位，移除 PENDING import）
src/data/products.ts      修改（platform.model 演示占位）
src/data/solutions.ts     修改（wellness 演示占位）
src/data/news.ts          修改（两条日期演示占位，移除 PENDING import）
TODO-业主待填清单.md       修改（演示占位标注 + F10 定稿标注）
VERIFY.md                 本小节（追加）
```

### 上线前必办（演示占位回滚）

- 将上述 6 个演示值替换为业主真实输入（或恢复 PENDING），并移除「演示占位」注释；
- 删除或隐藏 `苏ICP备2026DEMO001号`（非真实备案号，不得出现在上线产物中）；
- 替换/删除后重新执行验证 A–H。

---

## Phase 2 收尾 B（2026-08-05，真实值替换）

### 改动

| 文件 | 字段 | 旧值 | 新值 | 说明 |
|---|---|---|---|---|
| `src/data/news.ts` | `smart-care-demo-floor.date` | `2026-06-01`（演示占位） | `2026-01-01` | 业主确认日期 |
| `src/data/products.ts` | `platform.model` | `ZQ-PLT-DEMO`（演示占位） | `PENDING` | 平台为软件系统无硬件型号，注释已更新 |

凯健 body 仍含「进入建设阶段」，未改成已交付/成功案例。其余演示占位值（ICP、wellness、MZ/T238 日期）保持现状。

### 验证（2026-08-05 实跑）

```
A. npm run build → ✓ Compiled successfully / ✓ TypeScript 通过 / ✓ Generating static pages (23/23)
B. npx eslint src/ → 无错误（exit 0）
C. /news 凯健条显示 2026-01-01
D. /products/platform 型号显示「待补充」（PENDING 渲染）
E. git status：改动文件见下，未 commit
```

### 改动文件（git status 摘要，未 commit）

```
src/data/news.ts              修改（凯健日期真实值）
src/data/products.ts          修改（platform.model 回退 PENDING，恢复 PENDING import）
TODO-业主待填清单.md           修改（凯健日期+平台型号更新）
VERIFY.md                     本小节（追加）
```
