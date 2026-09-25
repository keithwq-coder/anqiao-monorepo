# TASK-0034: 代理角色 + 用户手机号字段实现

- Task ID: TASK-0034
- Status: ACTIVE / **EXECUTED 2026-08-13 — 本地实现 + 生产部署/迁移/建账号完成（DEC-0146）—— 待独立评审（NOT SELF-ACCEPTED）**
- Task type: IMPLEMENTATION
- Approved SPEC: `docs/specs/30-approved/SPEC-0002-users-roles-ownership.md`
- Secondary SPEC: `docs/specs/30-approved/SPEC-0014-account-credentials-modification.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0002-users-roles-ownership.approval.json`
- Secondary approval metadata: `docs/specs/30-approved/SPEC-0014-account-credentials-modification.approval.json`
- Implementation authorized by: Product owner
- Authorization evidence: `DEC-0145`（本地实现授权）、`DEC-0146`（生产部署/迁移/建账号授权）
- Execution owner: Codex (PI)，当前会话
- Review/acceptance owner: 待独立评审
- Started: 2026-08-13 Asia/Shanghai
- Repository state: `main`, intentionally dirty; preserve all existing work
- Depends on: `DEC-0144`（范围决定）、`DEC-0145`（规格批准 + 实现授权）、`DEC-0146`（生产授权）

## Goal

实现 `SPEC-0002 v0.3.0` 的「代理（agent）」角色与 `user_identities.phone`
手机号字段，以及 `SPEC-0014 v0.2.0` 将 `agent` 纳入自助凭据修改操作主体；
并在 `DEC-0146` 下完成生产部署、迁移 0007 与 `zxx` 账号创建。

## Scope（已实现）

1. `src/crm/domain/models.py`：`Role` 枚举新增 `AGENT = "agent"`；
   `UserIdentity` 新增 `phone: str | None = None`。
2. `src/crm/persistence/models.py`：`RoleGrantModel` 的 role CHECK 约束加入
   `agent`；`UserIdentityModel` 新增 `phone` 列（`sa.String(80)`，可空）。
3. `src/crm/persistence/user_repository.py`：`domain_user_from_model` 与
   `create` 携带 `phone`。
4. `src/crm/policy/projection.py`：`resolve_read_access` 将 `agent` 视为与
   `business_user` 同等（OWNER/COLLABORATOR），不扩大任何敏感字段可见范围。
5. `src/crm/web/routes/account.py`：`_require_credential_actor` 允许 `agent`。
6. `migrations/versions/0007_agent_role_and_user_phone.py`：`user_identities`
   加 `phone`；`role_grants` 重建 role CHECK 约束以包含 `agent`。
7. 测试：代理角色权限矩阵、手机号字段、代理自助改密（对齐 SPEC AC-018~021、
   SPEC-0014 AC-011）。

## Hard boundaries

- 不 commit / push / reset / clean / checkout。
- 不动 `0006_operation_records` 及任何未授权路径（生产排除 TASK-0018 的
  `OperationRecordModel` / `0006`）。
- 不打印或存储任何秘密；数据库密码仅以非回显方式消费。

## Prerequisites and completion gate

- 本地测试通过（pytest）。
- `python -m compileall` 通过。
- `git diff --check` 通过。
- `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` 通过。
- 迁移 `alembic upgrade head` 在本地合成/测试环境可运行（如可用）。

## 生产后续（本任务不执行，另行授权）

- 在服务器运行 `alembic upgrade` 至 `0007`。
- 创建账号 `zxx`（display_name 张先侠，角色 `agent`，手机号
  `15805243456`，临时密码 `123`，状态 enabled）。

## Execution record (2026-08-13, Codex in PI)

- 预检：身份 `ubuntu@VM-0-17-ubuntu`；服务 active；`127.0.0.1:8200/login` 200；
  DB 版本 `0005`；`role_grants` CHECK 约束名 `ck_role_grants_ck_role_grants_role_value`。
- 迁移 `0007` 从 `0006` 改基到 `0005`（因 `0006` 被生产排除；0006 与 0007
  成为从 0005 分叉的兄弟 head）；`alembic upgrade 0007` 生产成功（加 `phone`
  列 + role CHECK 加入 `agent`）。
- 备份：`/opt/anqiao-crm/backup/pre-agent-20260813/{anqiao_crm.dump, src-backup.tgz}`。
- 部署：13 个源码/模板文件 + 迁移 `0007`（`models.py` 仅含 phone+agent 两处变更，
  不含 `OperationRecordModel`）；服务重启后 active，健康 200。
- 建账号：`zxx` / 张先侠 / `agent` / phone `15805243456` / 状态 enabled；
  id `490a09ef-be6c-48f0-b5ae-73d1ee5cf356`。
- 验证：登录 `zxx` 200 success；`GET /institutions`、`/discovery`、
  `/account/settings` 均 200（代理角色端到端可用）；HTTPS `crm.aibrain.wiki/login` 200。
- 本地：`375 passed, 28 skipped`；governance `[PASS]`；`git diff --check` 退出 0。
  **NOT SELF-ACCEPTED**；待独立评审。
