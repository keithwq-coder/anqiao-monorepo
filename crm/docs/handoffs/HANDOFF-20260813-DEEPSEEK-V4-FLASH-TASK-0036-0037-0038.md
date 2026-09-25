# Handoff: DeepSeek-v4-flash 实现 TASK-0036 / TASK-0037 / TASK-0038

- From: DeepSeek-v4-pro（SPEC 撰写 + 任务拆解 + 授权记录）
- To: DeepSeek-v4-flash（实现执行）
- Date: 2026-08-13
- Authority: `DEC-0151`（分工）、`DEC-0153`（SPEC 批准）、`DEC-0154`（实现授权）

## 开始前必读（按顺序）

1. `AGENTS.md`（仓库契约，全文）。
2. `docs/NOW.md`、`docs/PROJECT.md`、`docs/specs/INDEX.md`、
   `docs/decisions/DECISION-LOG.md`（至少读 DEC-0149 到 DEC-0154）。
3. 三张任务卡（`docs/tasks/active/TASK-0036/0037/0038*.md`）及其引用的批准版
   SPEC（`docs/specs/30-approved/`）与批准元数据（`.approval.json`）。

不要凭交接摘要信任内容——实际以仓库文件和批准 SPEC 为准，先核对再动手。

## 要实现的 3 个任务（按依赖顺序）

| 顺序 | 任务 | 内容 |
|---|---|---|
| 1 | `TASK-0036` | 废弃 agent 角色 + admin/gm 权限重定义 + 自助改密回退（SPEC-0002 v0.4.0 + SPEC-0014 v0.3.0） |
| 2 | `TASK-0037` | 客户三类型 + 公池 + 术语统一「客户」（SPEC-0001 v0.8.0） |
| 3 | `TASK-0038` | 商机重定义 + 网络爬虫（SPEC-0003 v0.4.0） |

依赖：0036 → 0037 → 0038。上一任务验收门通过后再开始下一任务。

## 关键边界（务必遵守）

- 只做**本地合成数据**实现；**不 commit / push / reset / clean / checkout**。
- **不碰生产**：zxx 账号停用（DEC-0150）、迁移 0007 回退、agent 角色授予清理都是
  单独的未完成生产授权项，本批任务不执行。
- 真实爬虫抓取、外部模型调用、出境在单独授权前**硬禁用**，仅合成数据验证。
- 变更产品行为（SPEC 之外的新决定）→ 停下来问产品负责人（DEC-0151）；纯技术实现
  细节自己定。
- **不自批**：每个任务完成写报告 + 证据到 `docs/evidence/`，由 DeepSeek-v4-pro
  独立评审。

## 每个任务完成的验收门

- 本地 `pytest` 通过。
- `python -m compileall` 通过。
- `git diff --check` 通过。
- `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` 通过。
- 任务卡 `Evidence and result` 更新为实际结果。

## 背景提示（避免返工）

- 当前代码已含 TASK-0034 引入的 `agent` 角色（`Role.AGENT`、role CHECK、projection、
  account 路由）。TASK-0036 是**移除**这些 agent 内容，不是新增。
- 现有主记录是 `institutions`（owner 隐含 NOT NULL）；TASK-0037 改为 owner 可空 +
  显式「在池」。
- 现有 `discovery.py` 是 v0.3.0「本地规则 + AI 只写理由」模型；TASK-0038 要重构为
  「AI 给候选+理由、人裁定」。
