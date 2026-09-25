# HANDOFF: TASK-0019 账号凭据自助修改

- Date: 2026-08-08
- From: Coordinator (Claude Code / Opus 4.8)
- To: GLM（实施所有者）
- Task: TASK-0019
- Authorization: DEC-0111

## 必读文件（按顺序）

1. `AGENTS.md` — 仓库合同，全部读完
2. `docs/NOW.md` — 当前状态
3. `docs/specs/30-approved/SPEC-0014-account-credentials-modification.md`
4. `docs/specs/30-approved/SPEC-0014-account-credentials-modification.approval.json`
5. `docs/tasks/active/TASK-0019-account-credentials-modification.md`

## 当前代码基线

- 全量测试：`277 passed, 28 skipped`（含 TASK-0011 修复后）
- `src/crm/web/auth.py`：含 `hash_password()`、`verify_password()`、
  `AuthenticationService.bump_session_epoch()`
- `src/crm/persistence/repositories.py`：含 `UserRepository`
- 现有路由：`src/crm/web/routes/auth.py`（login/logout/session，无修改凭据入口）
- 当前无 `src/crm/web/routes/account.py`

## 实施约束

- 本地合成数据范围，不触及生产数据库/服务器/SSH
- 每步完成后运行 `python -m pytest tests/ -q`；最终基线须 ≥ 277 passed
- 完成后运行 `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1`
- 审计写入失败时事务必须回滚（SPEC-0014 R-008）
- `sa`/`dl` 前缀判断：`lower(username).startswith(prefix)`，大小写不敏感
- 改密/改名均需先验证当前密码（R-001/R-003）
- 修改成功后必须调用 `bump_session_epoch(user_id)`（R-006）
- CSRF 保护同其他写操作（R-010）

## 完成后必须提交的证据

`docs/evidence/TASK-0019-IMPLEMENTATION-{日期}.md`，包含：
- 实际运行的命令及输出
- 每条 AC-001…AC-010 覆盖情况
- 全量测试计数（passed/skipped）
- governance 检查结果 `[PASS]`
- 未验证项（如有）

然后更新 `docs/tasks/active/TASK-0019-account-credentials-modification.md`
状态为 "IMPLEMENTATION COMPLETE — awaiting coordinator audit"。
