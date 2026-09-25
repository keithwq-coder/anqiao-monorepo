# TASK-0036: 废弃 agent 角色 + admin/gm 权限重定义 + 自助改密回退

- Task ID: TASK-0036
- Status: ACTIVE / ACCEPTED (local synthetic-data scope; `DEC-0155`)
- Formal acceptance: product owner accepted the Codex independent review on 2026-08-21.
- Task type: IMPLEMENTATION
- Approved SPEC: `docs/specs/30-approved/SPEC-0002-users-roles-ownership.md`
- Secondary SPEC: `docs/specs/30-approved/SPEC-0014-account-credentials-modification.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0002-users-roles-ownership.approval.json`
- Secondary approval metadata: `docs/specs/30-approved/SPEC-0014-account-credentials-modification.approval.json`
- Implementation authorized by: Product owner
- Authorization evidence: `DEC-0154`（产品负责人 2026-08-13 回复「授权」）
- Execution owner: DeepSeek-v4-flash（产品负责人切换后执行）
- Review/acceptance owner: DeepSeek-v4-pro（独立评审，不自批）
- Audit started at: 2026-08-13 Asia/Shanghai
- Depends on: `DEC-0149`（角色重定义）、`DEC-0152`（逾期督促清单去重）、`DEC-0153`（SPEC 批准）、`DEC-0154`（实现授权）

## Goal

实现 `SPEC-0002 v0.4.0`（废弃 agent 登录角色；admin 全局完整可见 + 无理由改自动
留痕；gm 全局脱敏只读 + 点名分配 + 进池）与 `SPEC-0014 v0.3.0`（自助改密操作主体
回退为 business_user / administrator，删除 agent）。

## Scope

- SPEC-0002 规则：R-008（admin 重定义）、R-021（gm 分配+进池）、R-024（删除 agent）、
  R-026（点名分配）、R-027（进池）；R-025（手机号）保留不变。
- SPEC-0014 规则：R-001~R-010（操作主体回退，删除 agent 相关表述）。
- 验收标准：SPEC-0002 AC-022~AC-026；SPEC-0014 AC-001~AC-010（AC-011 改为
  administrator，删除 agent 项）。

## Owned files

- `src/crm/domain/models.py`（Role 枚举移除 AGENT）
- `src/crm/persistence/models.py`（role CHECK 移除 agent）
- `src/crm/persistence/user_repository.py`
- `src/crm/policy/projection.py`（resolve_read_access：移除 agent 分支；admin 全局
  完整、gm 全局脱敏、gm 点名分配/进池写动作）
- `src/crm/web/routes/account.py`（`_require_credential_actor` 移除 agent）
- `src/crm/application/management_commands.py`（点名分配、进池命令）
- `migrations/versions/`（新迁移：从 role 枚举/CHECK 移除 agent）
- `tests/`（角色权限矩阵、admin/gm 行为、自助改密）

## Non-goals

- 不删除生产上的 zxx 账号、agent 角色授予或迁移 0007（需单独生产授权，见
  `DEC-0149`/`DEC-0150`）。
- 不 commit / push / reset / clean。
- 不改 SPEC-0001（客户类型/公池，属 TASK-0037）、SPEC-0003（商机，属 TASK-0038）。

## Assumptions and unknowns

- [VERIFIED] 当前代码已含 TASK-0034 引入的 agent 角色（`Role.AGENT`、role CHECK、
  projection、account 路由）；本任务是从既有代码**移除** agent，而非新增。
- [UNKNOWN] 生产 `role_grants` 中现有 agent 授予如何在不触碰生产的情况下本地复现；
  本地用合成数据验证即可。

## Prerequisites and completion gate

- 本地 pytest 通过。
- `python -m compileall` 通过。
- `git diff --check` 通过。
- `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` 通过。

## Risks and rollback

- 变更 role 枚举与 projection 会影响所有读路径；本地合成测试须覆盖四角色 + 未授权
  主体的脱敏矩阵，防止 admin/gm 变更意外扩大敏感字段可见范围（守 SPEC-0001 R-012）。
- 迁移只改本地/测试环境；生产迁移不在本任务。

## Evidence and result

- Status: COMPLETE（除 R-027 进池——其公池 schema 属 TASK-0037 范围，交叉引用实现）
- Commands actually run:
  - `pytest tests -q` → `375 passed, 28 skipped`
  - `python -m compileall -q src tests migrations` → exit 0
  - `git diff --check` → exit 0
  - `scripts/check-governance.ps1` → `[PASS]`
- Result artifacts:
  - `docs/evidence/TASK-0036-CORE-IMPLEMENTATION-20260813.md`（核心：agent 移除 + admin 读侧 + 自助改密）
  - `docs/evidence/TASK-0036-WRITE-SIDE-20260813.md`（写侧：归档/转交无理由 + gm 点名分配）
  - `migrations/versions/0008_deprecate_agent_role.py`
  - `migrations/versions/0009_archive_reason_optional.py`
  - `migrations/versions/0010_owner_history_reason_optional.py`
  - 改动：domain/models.py、persistence/models.py、policy/projection.py、
    application/{queries,management_commands,commands,discovery}.py、web/main.py、
    web/routes/{account,discovery,followups,institutions,admin}.py，
    以及 test_domain_models / test_persistence_schema / test_policy_projection /
    test_task0008_s2 / test_task0008_s3 / test_task0008_s4 / test_task0014 /
    test_task0015 / test_task0019 等测试文件
- Cross-reference: R-027 进池（owner 可空 + 在池 + 认领 + 脱敏投影）已在 TASK-0037
  （SPEC-0001 v0.8.0 公池 schema）实现，`docs/evidence/TASK-0037-IMPLEMENTATION-20260813.md`
  记录；TASK-0036 与 TASK-0037 均已关闭。
- Not verified: 生产迁移、独立评审（DeepSeek-v4-pro）
