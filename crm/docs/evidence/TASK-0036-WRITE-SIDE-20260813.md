# TASK-0036 执行证据（写侧：归档/转交无理由 + gm 点名分配）

- Task: TASK-0036（SPEC-0002 v0.4.0 R-008 写侧 / R-021 / R-026；SPEC-0001 v0.8.0 R-036）
- Executed by: DeepSeek-v4-flash（2026-08-13）
- Authority: `DEC-0153`（SPEC 批准）、`DEC-0154`（实现授权）
- Scope: 本地合成数据；不碰生产、不 commit
- Status: 写侧完成（进池 R-027 依赖 TASK-0037，另行实现）

## 变更内容

### 1. 管理员归档无理由（R-008 写侧 / R-036）
- `src/crm/persistence/models.py`：`institutions.archive_complete` 约束放宽——
  归档后 `archive_reason` 可为 NULL（原约束要求归档必有理由）。
- `src/crm/application/commands.py`：`ArchiveInstitutionCommand` 归一化空理由为
  `None`，`validate` 不再要求理由（路由层强制 administrator-only）。
- `src/crm/web/routes/institutions.py`：归档路由 `is_admin_exception` 改为仅角色
  判断（`Role.ADMINISTRATOR in roles`）；`ArchiveInstitutionRequest.archive_reason`
  改为可选。
- `migrations/versions/0009_archive_reason_optional.py`（新增）：upgrade 重建
  `ck_institutions_archive_complete` 允许归档无理由；downgrade 恢复严格约束。

### 2. 点名分配：gm 可分配（必填理由），admin 理由可选（R-021 / R-026）
- `src/crm/web/routes/admin.py`：新增 `_require_transfer_actor`（admin 或 gm 可分配，
  启用状态校验）与 `_ensure_transfer_reason`（gm 且非 admin 时必填理由）；单条与批量
  转交路由改用这两个辅助函数。
- `TransferOwnershipRequest` / `BatchTransferRequest`：`reason` 改为可选。
- `src/crm/application/management_commands.py`：`TransferOwnershipCommand` 归一化
  空理由为 `None`（admin 无理由分配时负责人历史 reason 为 NULL）。
- `src/crm/persistence/models.py`：`institution_owner_history.reason` 列改为可空、
  移除 `reason_not_blank` CHECK。
- `migrations/versions/0010_owner_history_reason_optional.py`（新增）：upgrade 将
  `reason` 列改为可空并删除 CHECK；downgrade 恢复。

## 测试变更

- `tests/test_task0014_core_semantic_security.py`：
  - `test_admin_archive_without_reason_denied` → `test_admin_archive_without_reason_succeeds_and_auto_traces`
    （管理员无理由归档成功，`archive_reason` 为 NULL，审计自动留痕）。
  - `test_admin_archive_blank_reason_denied` → `test_admin_archive_blank_reason_succeeds`。
- `tests/test_task0015_management.py`：新增
  - `test_gm_can_transfer_with_reason`（gm 可点名分配）；
  - `test_gm_transfer_without_reason_rejected`（gm 无理由分配 → 400）；
  - `test_admin_transfer_without_reason_succeeds_and_traces`（admin 无理由分配成功，
    历史 reason 为 NULL）。

## 验证结果（实际运行）

| Check | Result |
|---|---|
| `test_task0014` + `test_task0015` + `test_persistence_schema` + `test_migrations` | 58 passed, 1 skipped（PostgreSQL 门） |
| 全量本地 pytest | 见全量回归（后台运行后确认） |
| `python -m compileall -q src tests migrations` | exit 0 |
| `git diff --check` | exit 0 |
| `scripts/check-governance.ps1` | `[PASS]` |

## 边界

- 未 commit / push / reset。
- 未碰生产。
- 进池（R-027：owner 可空 + 在池 + 认领）依赖 TASK-0037 公池 schema，随 TASK-0037
  实现；gm 的「进池」写权限在 TASK-0037 落地。
- NOT SELF-ACCEPTED；待 DeepSeek-v4-pro 独立评审。
