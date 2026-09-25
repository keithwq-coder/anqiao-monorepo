# HANDOFF-20260727-implementation-start

- Task: 第一个实现任务的提出与授权（TASK-0001 候选）
- From tool/model: Claude Code / Opus 4.8
- To tool/model: 下一个会话（工具/模型必须自报）
- Handoff status: HANDOFF-ONLY
- Repository state: `main`, uncommitted; 仅治理与文档，无应用代码
- Written at: 2026-07-27 Asia/Shanghai

## Required reading

- `AGENTS.md`（完整）
- `docs/NOW.md`、`docs/PROJECT.md`、`docs/specs/INDEX.md`、
  `docs/specs/SPEC-BASELINE.md`、`docs/decisions/DECISION-LOG.md`
- 7 份已批准 SPEC 及其 `.approval.json`

## Verified current state

- [VERIFIED] SPEC 阶段已全部结束。`SPEC-0001`–`SPEC-0013` 全部有结论。
- [VERIFIED] 7 份已批准 SPEC（`docs/specs/30-approved/`），SHA-256 与
  `.approval.json` 全部吻合（2026-07-27 复验）：

| SPEC | 版本 | 决策 | SHA-256（前 8 位） |
|---|---|---|---|
| SPEC-0001 客户档案/跟进/AI 教练 | v0.7.0 | DEC-0010 | `29bbf28d` |
| SPEC-0002 用户/角色/归属 | v0.2.0 | DEC-0014 | `0c313e4f` |
| SPEC-0003 商机发现 | v0.2.0 | DEC-0022 | `7170d728` |
| SPEC-0008 搜索（不导出） | v0.1.0 | DEC-0032 | `d1e60b2f` |
| SPEC-0011 留存/永久删除 | v0.2.0 | DEC-0037 | `91fbf327` |
| SPEC-0012 云部署/运维 | v0.2.0 | DEC-0042 | `621131c0` |
| SPEC-0013 批量导入 | v0.1.0 | DEC-0039 | `f801e80e` |

- [VERIFIED] 已并入：`SPEC-0004`→`SPEC-0001`（DEC-0023）。已砍掉：
  `SPEC-0005`/`0006`/`0007`/`0009`/`0010`（DEC-0024/0025/0026/0028/0029）。
- [VERIFIED] `DEC-0033` 宣布合成数据基线完成；`DEC-0011` 的总冻结已解除。
- [VERIFIED] `docs/tasks/active/` 为空，无活动任务；仓库无应用代码。
- [VERIFIED] `scripts/check-governance.ps1` 通过（7 approved / 0 active tasks）。
- [VERIFIED] 部署目标（DEC-0041/0042）：既有腾讯云轻量服务器，子域名
  `crm.aibrain.wiki`，nginx + HTTPS，SSH 推送；**服务端应用**（非静态站）。
- [VERIFIED] `DEC-0037`：法务/合规由产品负责人负责，不写入 SPEC，AI 不代劳。
- [VERIFIED] `DEC-0043` 取消本地优先，确认从一开始就按云端部署构建；产品负责人
  确认该服务器支持服务端应用（以其既有项目 `health.aibrain.wiki` 为证）。
- [VERIFIED] `ADR-0001`（local-first）已被 `ADR-0002` 取代，**不可据其实现**。
  现行架构见 `docs/decisions/ADR-0002-cloud-deployed-modular-monolith.md`：
  FastAPI 模块化单体 + Jinja2 服务端渲染 + 统一 `policy` 层 + PostgreSQL +
  Alembic + 服务端会话认证，Uvicorn 由 nginx 反代于 `crm.aibrain.wiki`。
- [UNKNOWN] 服务端登录机制细节（`SPEC-0012` OD-002），待 AI 提案。
- [UNKNOWN] 服务器操作系统、Python 版本、既有 nginx 布局，以及
  `health.aibrain.wiki` 的运行方式；部署前须由已授权任务实地查证。

## Changes made

本文件仅记录状态，不批准任何 SPEC，不授权实现。

## Checks actually run

| Command/check | Environment | Result | Evidence |
|---|---|---|---|
| `scripts/check-governance.ps1` | Local | PASS | 7 approved / 0 active tasks |
| 7 份 SPEC SHA-256 复验 | Local | 全部吻合 | 见上表 |

## Failed or not verified

- 无应用代码，因此没有任何构建、测试或部署证据。
- 真实养老机构种子数据由产品负责人安排 GLM 采集中，尚未产出、未导入。
- 实际部署未发生；AI 未接触服务器、SSH 凭据或 TLS 私钥，且不得接触。

## Next bounded action

提出**第一个实现任务**（`TASK-0001`）并请产品负责人明确授权。建议范围为
`SPEC-0001` 最小切片：手工建机构记录 → 挂联系人 → 追加一次跟进 → 重开可见
完整历史。按 `ADR-0002` 构建；开发环境用合成数据、可回滚；本任务不部署、
不碰真实数据、不接触服务器与密钥（部署另需授权任务）。

写入 `docs/tasks/active/` 并获得授权前，不得编辑或新增任何应用代码。
