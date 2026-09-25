# TASK-0036 执行证据（核心部分完成，写侧剩余）

- Task: TASK-0036（废弃 agent 角色 + admin/gm 权限重定义 + 自助改密回退）
- Executed by: DeepSeek-v4-flash（2026-08-13）
- Authority: `DEC-0149`（角色重定义）、`DEC-0152`（逾期清单去重）、`DEC-0153`（SPEC 批准）、`DEC-0154`（实现授权）
- Scope: 本地合成数据；不碰生产、不 commit
- Status: **PARTIAL** —— 读侧核心已完成并验证；写侧（归档/转交"无理由"、gm 点名分配、进池）剩余

## 已完成（验证通过）

### 1. 废弃 agent 登录角色（SPEC-0002 v0.4.0 R-024）
- `src/crm/domain/models.py`：`Role` 枚举删除 `AGENT = "agent"`。
- `src/crm/persistence/models.py`：`role_grants` 的 role CHECK 移除 `'agent'`。
- `migrations/versions/0008_deprecate_agent_role.py`（新增）：upgrade 重建 CHECK 不含
  agent；downgrade 恢复含 agent。
- 全代码库移除 `Role.AGENT` 分支：
  - `src/crm/policy/projection.py`（resolve_read_access）
  - `src/crm/web/main.py` ×2、`src/crm/web/routes/discovery.py`、`followups.py`、
    `institutions.py`（业务角色检查）
  - `src/crm/application/queries.py`、`management_commands.py`、`discovery.py`
- 测试：`test_domain_models.py` 删除 agent 角色测试；`test_persistence_schema.py`
  改为断言 CHECK 拒绝 agent；`test_policy_projection.py` 删除两个 agent 投影测试。

### 2. admin 读侧重定义（SPEC-0002 v0.4.0 R-008 读侧）
- `src/crm/policy/projection.py`：`resolve_read_access` 中 admin 无条件返回完整可见
  （ADMINISTRATOR_EXCEPTION 级别 + audit_history），不再要求例外理由。
- `src/crm/application/queries.py`：admin 恒 `include_withdrawn`、恒可搜索
  source_description/source_kind（去掉 reason 前置条件）。
- 路由层保留「管理员主动填理由时写可选 `admin.exception_read` 审计轨迹」（可选轨迹，
  非强制）。
- 测试：`test_policy_projection.py` 两个 admin 测试重写为「无理由完整可见」；
  `test_task0008_s4_admin_exception.py` 整体重写为 R-008 模型（无理由完整可见 +
  无审计；主动填理由才写可选轨迹）；`test_task0014` 三个 dual-role 白空格 reason 测试
  改为「admin 恒见撤回活动」；`test_task0008_s3` 不可见主体改为无角色主体。

### 3. 自助改密操作主体回退（SPEC-0014 v0.3.0）
- `src/crm/web/routes/account.py`：`_require_credential_actor` 移除 agent，
  仅 business_user / administrator。
- 测试：`test_task0019_account_credentials.py` 删除 agent fixture，AC-011 改为
  administrator 自助改密。

## 验证结果（实际运行）

| Check | Result |
|---|---|
| 全量本地 pytest | `372 passed, 28 skipped`（基线 375 少 3 = 删除的 agent 测试） |
| `python -m compileall -q src tests migrations` | exit 0 |
| `git diff --check` | exit 0 |
| `scripts/check-governance.ps1` | `[PASS]`（8 approved SPECs, 37 active tasks） |

## 剩余工作（写侧，下轮继续）

1. **R-008 写侧 / R-036**：管理员归档无需理由。需：`institutions.archive_complete`
   约束放宽 + 迁移 0009 + `ArchiveInstitutionCommand.validate` 允许空理由（admin）+
   路由 `is_admin_exception` 改为仅角色判断 + `ArchiveInstitutionRequest.archive_reason`
   可选 + 更新 `test_admin_archive_without_reason_denied` /
   `test_admin_archive_blank_reason_denied`。
2. **R-021/R-026 点名分配**：转交路由允许 admin + gm；gm 必填理由，admin 理由可选。
   需：`admin.py` 转交路由角色放宽 + `TransferOwnershipRequest.reason` 可选 +
   `institution_owner_history.reason` 约束放宽 + 迁移 + 测试。
3. **R-027 进池**：依赖 TASK-0037 的公池 schema（owner 可空 + 在池状态），
   随 TASK-0037 实现。

## 边界确认

- 未 commit / push / reset。
- 未碰生产（zxx 账号、迁移 0007 回退仍属未完成的生产授权项）。
- 迁移 0008 仅作用于本地/测试 schema。
- NOT SELF-ACCEPTED；待 DeepSeek-v4-pro 独立评审。
