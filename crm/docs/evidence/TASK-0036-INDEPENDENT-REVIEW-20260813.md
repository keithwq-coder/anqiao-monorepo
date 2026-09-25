# TASK-0036 独立评审证据（DeepSeek-v4-pro）

- 评审身份：DeepSeek-v4-pro（`deepseek-v4-pro-0813`），独立评审角色，非本任务实现者。
- 评审依据：AGENTS.md §7（评审只报告证据与发现，不修改实现、不自我验收）。
- 评审对象：`docs/tasks/active/TASK-0036-deprecate-agent-admin-gm-roles.md`（卡片状态 COMPLETE）
  对 `SPEC-0002 v0.4.0` 的实现一致性。
- 评审日期：2026-08-13（与执行证据同窗期）。

## 结论

**PASS（本地合成数据范围内）**

代码与测试与 `SPEC-0002 v0.4.0` 一致：`agent` 角色已在角色模型、鉴权入口与
数据库约束三处同步移除；admin「全局完整可见 + 无理由修改（自动留痕）」与 gm
「脱敏只读 + 点名分配 + 进池」在投影与路由层均已落地。残留项为生产迁移（本次
评审范围外、未授权）与本评审自身。

## 证据明细

### 1. agent 角色废弃（R-024/R-025）

- `[VERIFIED]` `src/crm/domain/models.py:19-23` `Role(StrEnum)` 仅含
  `business_user / administrator / general_manager / manager` 四值，无 `agent`。
- `[VERIFIED]` `src/crm/web/routes/account.py` 中 `_require_credential_actor`
  仅接受 `business_user / administrator`，`agent` 已被移出凭证修改主体
  （对齐 SPEC-0014 v0.3.0 将凭证主体回退为业务/管理员）。
- `[VERIFIED]` `migrations/versions/0008_deprecate_agent_role.py` 将
  `role_grants` 的 `ck_role_grants_role_value` 约束从含 `agent` 收紧为四角色；
  迁移文档明确「0007 新增的 `user_identities.phone` 保留」（R-025）。
- `[INFERENCE]` `agent` 在角色模型、凭证鉴权、持久化 CHECK 三处已一致移除，无
  遗漏入口（未见任何代码仍引用 `Role.AGENT` 或字符串 `"agent"`）。

### 2. admin 全局完整可见 + 无理由修改（R-008）

- `[VERIFIED]` `src/crm/policy/projection.py:150-160` admin 直接返回
  `RecordViewLevel.ADMINISTRATOR_EXCEPTION`，`access_reason` 为可选值（不再要求
  例外理由）；`_detailed_projection` 含 `source_description / source_kind /
  source_evidence_reference` 等完整字段。
- `[VERIFIED]` `src/crm/application/queries.py:254` admin 的
  `include_withdrawn=True`（完整详情含撤回活动）；`:260-264` admin 可搜索
  `source_description / source_kind`（完整可见的搜索面）。
- `[VERIFIED]` `src/crm/web/routes/institutions.py` 列表/详情路由仅在
  `administrator_reason` 非空时写 `admin.exception_read` 审计（`:224-226`、
  `:289-291`），无理由读取仍返回完整详情——即读侧不强制理由，自动留痕针对写操作。
- `[VERIFIED]` `migrations/versions/0009_archive_reason_optional.py` 将归档
  CHECK 放宽为「已归档即可，reason 可空」，对应 R-008 无理由修改自动留痕。
- `[INFERENCE]` R-008 的「自动留痕」落在写侧审计（`audit_events` 记录
  who/when/what），读侧自愿理由为可选留痕；与 SPEC 文本「无理由修改业务记录
  （自动留痕）」一致。

### 3. gm 脱敏只读（R-021）

- `[VERIFIED]` `src/crm/policy/projection.py:175-180` `GENERAL_MANAGER` 统一
  → `RecordViewLevel.COLLABORATOR`（脱敏投影）。
- `[VERIFIED]` `_collaborator_projection`（`:245-259`）联系人姓名掩码为 `***`、
  来源只给 `source_category`（不含原文 `source_description`），符合脱敏只读。

### 4. 点名分配（R-026）

- `[VERIFIED]` `src/crm/web/routes/admin.py:84-96` `_require_transfer_actor`
  仅 `ADMINISTRATOR / GENERAL_MANAGER`；`_ensure_transfer_reason` 对 gm 要求
  非空理由、admin 可选（`TransferOwnershipRequest.reason` 默认空串、max 1000）。
- `[VERIFIED]` `migrations/versions/0010_owner_history_reason_optional.py`
  将 `institution_owner_history.reason` 置为可空并删除非空 CHECK，支撑 admin
  无理由分配。

### 5. 进池（R-027）——跨卡归属说明

- `[VERIFIED]` 进池/认领路由（`/release-to-pool`、`/claim`）落在
  `src/crm/web/routes/institutions.py` 与 `src/crm/application/management_commands.py`，
  由 **TASK-0037**（SPEC-0001 v0.8.0 公池）实现并测试。本卡 R-027 的一致性证据
  见 `docs/evidence/TASK-0037-INDEPENDENT-REVIEW-20260813.md`。

## 验证命令与结果（本次评审实际执行）

- `python -m pytest tests -q` → **395 passed, 28 skipped, 2 warnings**（exit 0，111.75s）。
  28 条 skip 均为 PostgreSQL 隔离库/W4 迁移门控，符合 DEC-0154 本地合成范围。
- `python -m compileall -q src tests migrations` → OK（全量字节码编译通过）。
- `git diff --check` → clean（仅 CRLF 归一化提示，非空白错误）。
- `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1` →
  `[PASS] Governance structure and gates are consistent`。

## 发现 / 风险

- `[VERIFIED]` 读侧 admin 无理由读取不逐条留审计（仅自愿理由时留痕）。SPEC R-008
  的「自动留痕」针对写操作，读侧此行为与文本一致，但若产品后续要求「admin 全部
  读取留痕」，需回 SPEC-0002 补充规则——非本卡缺陷，仅提示。
- `[UNKNOWN]` SPEC-0002 OD-002（gm 点名分配理由下拉选项）、OD-003（manager 范围
  数据源）仍为开放项，不属 TASK-0036 实现范围，不影响本卡 PASS 结论。

## 未验证项（非本次授权范围）

- 生产数据库迁移执行（`0008..0012` 仅在本地/SQLite 合成环境验证；未对共享/生产库
  执行任何迁移）。
- 生产环境 agent 角色残留数据清理（迁移 0007 回滚 / agent 生产清理）——仍属
  未授权事项。

## 待决策项

- 无（本卡范围内无需新决策）。OD-002 / OD-003 为既有开放项，不阻塞本卡验收。

## 评审边界声明

本文件只记录证据与发现，不将 `TASK-0036` 翻转为 ACCEPTED；卡片验收由产品负责人
在其验收流程中作出。
