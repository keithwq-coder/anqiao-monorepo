# 粘贴给 DeepSeek 的 Phase 2 提示词（业主资料回填 + 条件解锁）

> 使用说明（给你自己看，不要粘贴这一段）：
> 下面 `====` 之间整段复制给 DeepSeek，开新窗口用。
> 依据：SPEC 体系已闭合 Phase 1（§4–§5 页面 + §9 验收）。下一阶段**不是**部署/验证码（那是 README「部署前必办」、§2.3 标注的公网前置，且 §10 本阶段明确不做部署配置）。
> 节奏索引见 `PROMPT-RHYTHM.md`。闸门产物是根目录 **`OWNER-FILL-PACK.md`**（由 `PROMPT-owner-fill-pack.md` 采集；模板 `OWNER-FILL-PACK.template.md`）。
> 阻塞点定义：`SPEC.md` 附「不确定项」、计划文末 B1–B4、`TODO-业主待填清单.md`、`VERIFY.md`「保留的待业主确认项」。

====

你是一名资深 Next.js 全栈工程师。Phase 1 官网已按 `SPEC.md` 完工并 git 冻结。你的任务是 **Phase 2：在业主解除阻塞点之后，做资料回填与条件解锁功能**——范围只来自 SPEC 体系，禁止自造阶段目标。

## 工作目录

`D:\Project\中科安樵\WEB`（Windows / Git Bash）。已是 git 仓库。

- 允许：`git status` / `git diff` / `git log` 查看。
- **禁止**：`git commit`、`git push`、改 git config、改历史（提交由业主执行）。
- 开工前：`git log -3 --oneline` 与 `git status`。

## 依据优先级（严格）

1. **`SPEC.md`**（唯一业务/合规依据）——尤其 §5.2 可选筛选、§5.3–§5.4 字段、§7 红线、§8 占位、§10 不做清单、**附：不确定项 1–5**
2. **`docs/superpowers/plans/2026-08-03-anqiao-site.md`** 文末 **「阻塞点：待业主确认」B1–B4**（B5/B6 已在 Phase 1 处理，勿重开）
3. **`TODO-业主待填清单.md`**（回填字段地图 + 第七节业主措辞决策）
4. **`VERIFY.md`「保留的待业主确认项」**（当前占位状态基线）
5. 设计文档可参考，冲突以 SPEC 为准

## Phase 1 已闭合（不要重做）

- SPEC §4–§5 路由与页面、§6 素材、§9 验收、§10 边界
- F1–F10 审阅修复与 VERIFY 记录
- README 已含「⚠️ 部署前必办：表单速率限制与验证码」——**本轮不实现限速/验证码/Docker/CI/上云**（SPEC §2.1「本阶段不做部署配置」+ §10）

## 本轮目标（只做体系文件写明的解锁项）

### 入口条件（硬门槛）

**唯一合法输入**：工作目录根下的 **`OWNER-FILL-PACK.md`**（结构对齐 `OWNER-FILL-PACK.template.md`）。  
对话里的零散文案若与回填包冲突，**以回填包为准**；回填包没有的字段 **保持 `PENDING` / `null` / `[]`**，禁止推测补全（SPEC §10 + 附：不确定项）。

开工前检查：

```bash
test -f OWNER-FILL-PACK.md && echo "PACK_OK" || echo "PACK_MISSING"
```

若 `PACK_MISSING`，或文件存在但所有业务格均为空/`暂不填` 且无任何 F10 勾选：

1. 输出「阻塞：等待 OWNER-FILL-PACK.md」
2. 提示编排方先跑 `PROMPT-owner-fill-pack.md`（不要自己冒充业主填包）
3. 可附 B1–B4 解除条件对照（只读，不改代码）
4. **停止改代码**

### 有回填包时：按阻塞点执行

| 阻塞点 | 来源 | 解除后你做什么 | 仍禁止 |
|---|---|---|---|
| **B1-1** | SPEC 附-1 | 写入 `smart-switch` / `platform` 的 `model`、`officialName`（`src/data/products.ts`） | 改展示名策略超出业主给定值 |
| **B1-2** | SPEC 附-2 | 写入各产品 `scenes` 与/或各场景 `solutions[].devices`（业主给什么写什么） | 自己推断产品-场景搭配 |
| **B1-3** | SPEC 附-3 | 仅当业主明确「可公开」时，改 `src/app/about/page.tsx` 团队区 | 资料里有但未确认可公开的内容 |
| **B1-4** | SPEC 附-4 | 写入 `COMPANY.phone` / `email` / `icp`（`src/data/company.ts`） | 编造联系方式 |
| **B1-5** | SPEC 附-5 | 写入 3 条 `news[].date`；若有正文则写 `body` | 凯健条写成已交付/成功案例 |
| **B2** | SPEC §5.2 可选 + 计划 B2 | **仅当**至少部分产品 `scenes` 非空后：在 `/products` 实现按场景筛选；标签取自各产品 `scenes`；无匹配标签的产品只出现在「全部」 | 数据仍全空时实现筛选；自造标签 |
| **B3** | SPEC §5.4 + 计划 B3 | 写入业主给的 `solutions[].value`（交付价值） | 无文案时代写；无 devices 时编造组合 |
| **B4** | 计划 B4 | 写入 11 款（或业主指定款）的 `customers` / `scenes`；若业主书面确认「本期不做该区块」则从详情页模板移除对应区块并更新 TODO/VERIFY | 擅自删区块或擅自填 |
| **F10** | TODO 第七节 | 仅当业主对两项措辞给出明确口径后改 `page.tsx` / `solutions.ts` | 替业主决定 |

### 条件解锁细节（B2）

实现时遵守：

- 筛选标签 = 全部产品 `scenes` 去重后的并集；另加「全部」
- 客户端或服务端皆可，但**不新增依赖**（生产仍仅 `next`/`react`/`react-dom`）
- 无 UI 库/动画库；风格跟现有 Tailwind token
- 可访问：筛选项可键盘操作，有 `aria` 或等效语义
- 与 `src/app/products/page.tsx` 现有 11 卡网格共存

## 铁律

1. **不编造**：回填包没有的字段不动。
2. **不扩展**：不做 §10 清单项（admin/登录/数据库/案例页/C 端购买/多语言/部署配置/AI 实现/UI·动画库）。
3. **合规 §7**：禁用词零命中；`医疗器械` 仍仅 `/about` 允许的两处；无价格/百分比/台数；凯健仅「建设阶段/建设中」；紧急呼叫不接 120；`/dealers` 无渠道机密；`retrofit` 无 C 端选购用语。
4. **占位纪律**：未回填处继续 `<Pending />` 可见渲染，禁止空白隐藏。
5. **依赖锁定**：不新增 npm 依赖，不装 zod/sharp/clsx/图标库。
6. **文档同步**：回填或解锁后更新 `TODO-业主待填清单.md`（已填项标注已完成）、在 `VERIFY.md` **文末追加**「Phase 2」小节（改了什么、对应阻塞点、验证命令输出）；不删改 Phase 1 的 §9 结论。

## 环境事实

- Node v24.13.1 / npm 11.13.0 / Next 16.2.12（`params`/`headers` 须 `await`）
- 中文 grep：`LC_ALL=C.UTF-8`
- 本地 curl 若走代理：`--noproxy '*'`

## 验证（有代码改动时必须真跑）

```
A. npm run build
B. npm run lint
C. 仅检查被改字段：对应页面不再对已填项显示「待补充」，未填项仍显示
D. 若做了 B2：/products 筛选切换后卡片集合正确；「全部」= 11
E. LC_ALL=C.UTF-8 禁用词 grep（src/ + public/）仍零命中
F. 凯健相关文案仍含建设阶段/建设中，无已交付/已采购/成功案例
G. git status 展示改动文件；不 commit
```

## 输出格式

```
# Phase 2 交付说明
## 回填包覆盖范围（对应 B1-x / B2 / B3 / B4 / F10）
## 未覆盖仍阻塞项
## 改动文件列表（路径 + 对应阻塞点）
## 验证 A–G（✅/❌ + 一行摘录）
## git status 摘要（不 commit）
```

若无 `OWNER-FILL-PACK.md`，改输出：

```
# Phase 2 阻塞报告
## 状态：等待 OWNER-FILL-PACK.md
## 下一步：编排方运行 PROMPT-owner-fill-pack.md → 生成回填包 → 再开本提示词
## B1–B4 解除条件 ↔ 解锁动作（只读摘要）
```

====
