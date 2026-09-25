# TASK-0019: SPEC-0014 账号用户名与密码自助修改

- Task ID: TASK-0019
- Status: **ACCEPTED** (`DEC-0113`, 2026-08-08, local synthetic scope; coordinator independent audit — 302 passed/28 skipped reproduced, 25 focused tests reproduced, governance [PASS], AC-002/008/010 verified as effective behavior assertions; evidence: `docs/evidence/TASK-0019-COORDINATOR-ACCEPTANCE-20260808.md`)
- Task type: IMPLEMENTATION
- Approved SPEC: `docs/specs/30-approved/SPEC-0014-account-credentials-modification.md`
- Approval metadata: `docs/specs/30-approved/SPEC-0014-account-credentials-modification.approval.json`
  (hash verified 2026-08-08: `433b020f78f4bcbefd23b4536e1402e80e35546c65db07c795fd11be1589b133`)
- Implementation authorized by: `DEC-0111` (2026-08-08)
- Implementation owner: GLM (常设指令；sole executor)
- Coordinator/auditor: 当前协调员
- Depends on: TASK-0015 (ACCEPTED, DEC-0103), TASK-0017 (ACCEPTED, DEC-0107)

## Goal

实现已启用业务人员通过应用内入口自助修改本人登录用户名和密码：
修改前必须验证当前密码；`sa`/`dl` 前缀的用户名受保护不可修改；
修改成功后旧会话立即失效；操作留审计（不含密码明文）。

## Owned paths（激活后独占）

- `src/crm/application/commands.py`（新增凭据修改命令）
- `src/crm/application/queries.py`（如有查询需要）
- `src/crm/web/routes/account.py`（新建账号自改路由）
- `src/crm/web/main.py`（路由挂载）
- `templates/`（账号设置页面，仅限本任务）
- `tests/test_task0019_account_credentials.py`（新建）
- `docs/evidence/TASK-0019-*` 和本任务卡片

不得修改的路径：已批准 SPEC 文件、其他任务的证据文件、迁移文件
（除非 SPEC 明确要求新增 Alembic 迁移）。

## Prerequisites and completion gate

- 前置：DEC-0111；TASK-0015 和 TASK-0017 均已 ACCEPTED。均满足。
- 完成门控：SPEC-0014 所有 AC-001…AC-010 通过专项合成测试；
  `pytest tests/ -q` 全量回归无退化（基线 277 passed, 28 skipped）；
  governance `[PASS]`；协调员独立审计接受。
  不包含真实数据写入、远程数据库或生产部署。

## Required acceptance (AC-001…AC-010)

- AC-001: 正确当前密码 → 新密码保存、旧会话失效、新密码可登录、审计写入
- AC-002: 错误当前密码 → 拒绝、无审计、不泄露账号信息
- AC-003: `sa1` 尝试改用户名 → 拒绝、提示前缀受保护
- AC-004: 普通用户改用户名成功 → 旧会话失效、新用户名可登录、id/归属不变
- AC-005: 新用户名与现有用户名冲突 → 拒绝、提示已被占用
- AC-006: 未登录/disabled/pending → 拒绝
- AC-007: `sa1` 改密码（不改用户名）→ 成功（前缀保护只限用户名）
- AC-008: 审计写入失败 → 事务回滚、不显示成功
- AC-009: API 与页面两路径行为一致（前缀保护、会话失效）
- AC-010: 改密后旧会话访问受保护资源 → 拒绝

## Ordered steps

| Step | Prerequisite | AI action | Output | Verification | Status |
|---|---|---|---|---|---|
| 1 | Task authorized | 确认 SPEC-0014 合同与现有代码事实 | 合同映射无 UNKNOWN | 无行为变更的 UNKNOWN | DONE |
| 2 | Step 1 | 实现命令层：密码校验、哈希写入、session epoch bump | 命令服务 | 单元测试 | DONE |
| 3 | Step 2 | 实现路由+页面：密码改、用户名改，CSRF 保护 | 路由文件 + 模板 | AC 测试 | DONE |
| 4 | Step 3 | 全量回归+治理检查 | 证据文件 | 302 passed, governance PASS | DONE |
| 5 | Step 4 | 协调员独立审计 | 验收证据 | 全部 AC pass；无未解决 P0/P1 | PENDING |
