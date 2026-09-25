# 下一条请你（人）原样复制给执行模型（DeepSeek）

> 编排方已写好。你只复制 `====` 之间全文，粘贴到 DeepSeek 新对话。  
> 它回复后，把**全文**原样带回给编排方（opencode），不要摘要。

====

【TO】B（执行 · DeepSeek）
【FROM】A（编排 · SPEC 守卫）
【PHASE】Phase 1 冻结确认 + Phase 2 闸门探测
【TASK】只做只读体检与闸门判定；不改业务代码；若缺回填包则按模板生成空的 `OWNER-FILL-PACK.md`（全部业务格留空或 `暂不填`）并写清「等人送业主答复」

## 工作目录

`D:\Project\中科安樵\WEB`（Windows / Git Bash）。已是 git 仓库。

## 必读（按序）

1. `PROMPT-RHYTHM.md`
2. `PROMPT-relay-protocol.md`
3. `SPEC.md` §2.1 §2.3 §7 §9 §10 与「附：不确定项」
4. `VERIFY.md` 文末「保留的待业主确认项」
5. `TODO-业主待填清单.md`
6. `OWNER-FILL-PACK.template.md`
7. `PROMPT-deepseek-phase2.md`（了解有包之后才做什么，本跳不要执行回填）

## 本跳动作（严格按序）

1. `git status` 与 `git log -5 --oneline`：工作区必须干净；记下 HEAD。
2. 探测：`OWNER-FILL-PACK.md` 是否存在。
3. `npm run build`：必须通过（Phase 1 冻结回归）。
4. 快速合规抽查（`LC_ALL=C.UTF-8`，范围 `src/` + `public/`）：
   - 禁用词：`医疗级|诊断|治疗|疗效|临床验证|临床认证|注册证|包治|治愈|替代医生` → 期望业务代码零命中（`注册证` 若仅出现在 TODO/说明性 md 则忽略 md）
   - `医疗器械` 仅允许 `src/app/about/page.tsx` 内 SPEC 允许的表述
5. **分支**：
   - **若已存在非空业务回填的 `OWNER-FILL-PACK.md`**（至少一格非空且非「暂不填」）：本跳**不要**开始回填代码；只在报告里写 `GATE=PACK_READY`，列出可解锁的 B1-x，等编排方下一跳发 Phase 2 实施提示词。
   - **若无包或包无有效值**：从 `OWNER-FILL-PACK.template.md` 复制生成 `OWNER-FILL-PACK.md`，顶部标注：
     - `状态: 空壳待业主`
     - `生成方: 执行模型 B`
     - `说明: 人运送本文件给业主填写后，再送回仓库`
     业务格全部留空或统一 `暂不填`。**禁止编造电话/卖点/日期等任何事实。**
6. 不要改 `src/**`、不要改 `SPEC.md`、不要 `git commit`。
7. 不要实现限速/验证码/部署（SPEC §10）。

## DONE 标准

- build 通过有输出摘录
- git 干净（除你新建的空壳 `OWNER-FILL-PACK.md` 若适用）
- 回传符合下方骨架
- 无编造业务字段

## 禁止

- 填写任何真实的假数据
- 实施 Phase 2 数据回填或 B2 筛选
- 部署相关代码
- git commit / push

## 回传（必须用此骨架，中文）

```
# RELAY-REPORT
## 状态：DONE / BLOCKED / NEED-OWNER
## HEAD：
## GATE：PACK_MISSING_SHELL_CREATED / PACK_READY / PACK_EMPTY / BUILD_FAIL
## 做了什么（文件路径列表）
## 命令与关键输出（摘录）
## 未做 / 阻塞原因
## 给编排方的事实（勿写提示词，只写事实）
## 建议下一跳（一句话）
```

====
