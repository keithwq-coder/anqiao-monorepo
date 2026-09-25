# TASK-0001 S6 gate dependencies verification (2026-08-02)

- Task: TASK-0001 (`docs/tasks/active/TASK-0001-manual-core-record-activity.md`)
- Scope this round: S4 收尾 + S6 依赖项（采集修复、`scripts/dev-test.ps1`、PostgreSQL 门控测试）
- Authorization: DEC-0046 (TASK-0001 implementation) + DEC-0067 (successor
  owner) + 产品负责人 2026-08-02 明确授权本次 S6 依赖项验证（SSH 转发 +
  crm_test 门控测试 + crm_test 内 seed 合成测试账号）
- Executor: Reasonix（bounded executor；runtime model identifier not exposed,
  按 DEC-0066 纪律自报且不作为门控条件）
- EXECUTOR_RUNTIME_ID: UNKNOWN - runtime identifier not exposed (Reasonix)
- Execution date: 2026-08-02

## 1. 结论

- `test_s6_integration.py` 采集失败已修复（本地全量 119 passed, 28 skipped,
  0 error；门控开启时 19 tests 正常收集）。
- `scripts/dev-test.ps1`（S6 门控要求的脚本）已创建并本地运行通过。
- S4 本地收尾：`test_policy_projection.py` + `test_s4_authentication.py`
  → 32 passed, 1 skipped（跳过项为 PostgreSQL 门控的 session-epoch 测试）。
- PostgreSQL 门控测试在 `crm_test`（经 SSH 本地转发 55434）全部通过：
  `test_task0007_postgresql_sessions.py` 5 passed +
  `test_s4_authentication.py::TestSecurityAuditLogging::test_session_epoch_during_production_use`
  1 passed + `test_s6_integration.py` 19 passed = **25 passed, 0 failed,
  0 error**。
- Governance check: `[PASS]`。

## 2. 修复的应用代码缺陷（S5-era 遗留，任务卡记录的 "pre-existing
   S5-era main.py breakage" 同类）

| 文件 | 缺陷 | 修复 |
|---|---|---|
| `src/crm/web/routes/institutions.py` | 三处 `Depends(lambda: request.app.state.query_service)` 引用未定义变量 `request` → 路由 500 | 新增模块级依赖函数 `_get_query_service(request)`，三处改用 `Depends(_get_query_service)` |
| 同上 | 三处调用 `QueryService` 时硬编码 `roles=frozenset()` / `management_scope_keys=frozenset()`，不传调用者真实角色 → policy default-deny | 改为 `frozenset(current_user.get("roles") or [])` 等 |
| `src/crm/application/commands.py` | 三处 `from crm.domain.identity import get_current_user`（模块不存在，import 在 try 之外）→ 任何 `validate(None)` 必崩 | 删除死代码块（认证由路由层 `Depends(get_current_user)` 强制；command 层仅校验数据字段与账号状态） |
| `src/crm/application/queries.py` | `InstitutionSummary.from_projection` / `InstitutionDetail.from_projection` 被调用但从未定义 → AttributeError | 补两个类方法，从 policy 投影数据构造 |

## 3. 测试校准（对照已批准 SPEC-0001/0002 与当前实现）

`tests/test_s6_integration.py`（S5-era 早期草稿，从未在真库运行过）：

- 顶层补 `CRM_ENVIRONMENT=test` + `SESSION_COOKIE_SECURE=false`（main.py
  fail-closed 默认 secure cookie，TestClient 走 http；与
  `test_task0007_auth_http.py` 同模式）。
- `app`/`settings` 全部改为 fixture/函数内延迟导入（采集阶段不构造
  `Settings()`）；顶层加 `pytestmark = skipif(CRM_RUN_POSTGRESQL_TESTS != "1")`。
- 写请求补 `X-CSRF-Token` 头（登录响应 body 的 `csrf_token`）。
- 角色断言 `"admin"` → `"administrator"`（SPEC-0002 角色模型，无 "admin"）。
- `test_institution_data` fixture 对齐 `InstitutionCreateRequest` 字段
  （name/source_description/category/region/source_kind/
  source_evidence_reference/idempotency_key）。
- `user_id == "admin-001"` → `is not None`（当前实现为 UUID）。
- `data["owner_id"]` → `data["owner_user_id"]`（InstitutionDetail 字段名）。
- 校验失败断言 400 → 422（FastAPI/pydantic body validation）。
- 删除 `test_delete_institution_admin_only`（DELETE 路由不在 SPEC-0001 范围，
  append-only 模型）。
- `test_multiple_users_different_roles` 改用 `UserRepository.create()` +
  role_grants 授权（`User` 类与 `save()` 方法不存在于当前实现）。
- 404 断言改为 FastAPI 实际行为（`Not Found`，无 Traceback/SQL）。
- 移除 `requests` mock（venv 未安装 requests，应用栈无外部 HTTP 客户端）；
  保留"创建不触发外部调用"意图断言。
- 响应时间阈值 0.5s → 5s（经 SSH 公网转发的 RTT 主导；SPEC-0001 无
  response-time SLA）。

## 4. crm_test 测试数据（仅在 crm_test 内，未触碰任何生产对象）

- 合成 admin 账号（username `admin`，密码 `admin123`，仅测试用途）经
  `UserRepository.create` 创建；角色授权 `administrator` + `business_user`
  经 role_grants 写入（`business_user` 使 admin 可作为记录负责人查看自己
  创建的记录，符合 SPEC-0002 R-003/R-008 语义）。
- 测试运行产生的机构/用户/会话/审计数据保留在 crm_test（隔离测试库，
  保留/删除由产品负责人后续决定，DEC-0068 点 6）。

## 5. COMMANDS_RUN（凭证值未出现在任何命令行或输出）

1. `powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1`
   → `[PASS]`（多次）。
2. `.venv/Scripts/python.exe -m pytest tests/ -q` → 119 passed, 28 skipped
   （修复后本地回归）。
3. `powershell -ExecutionPolicy Bypass -File scripts/dev-test.ps1` →
   119 passed, 28 skipped。
4. `.venv/Scripts/python.exe -m pytest tests/test_policy_projection.py
   tests/test_s4_authentication.py -q` → 32 passed, 1 skipped。
5. `ssh -N ... -L 55434:127.0.0.1:5432 ubuntu@124.222.212.159`（后台转发，
   完成后终止）。
6. `. ./.env.crm_test_local` + `DATABASE_HOST=127.0.0.1
   DATABASE_PORT=55434` + `Settings()` + `SELECT current_database()` →
   `crm_test`；`SELECT version_num FROM alembic_version` →
   `0001_initial_schema`。
7. seed admin + role_grants（Python，经 `UserRepository`/ORM；仅 crm_test）。
8. `CRM_RUN_POSTGRESQL_TESTS=1 ... pytest tests/test_s6_integration.py -q`
   → 19 passed（修复后）。
9. `CRM_RUN_POSTGRESQL_TESTS=1 ... pytest tests/test_task0007_postgresql_sessions.py
   "tests/test_s4_authentication.py::TestSecurityAuditLogging::test_session_epoch_during_production_use" -q`
   → 6 passed（修复后重跑确认）。

## 6. TEST_TOTALS

- 本地全量（无门控）：119 passed, 28 skipped, 0 failed, 0 error。
- PostgreSQL 门控（crm_test）：25 passed, 0 failed, 0 error
  （test_s6_integration 19 + test_task0007_postgresql_sessions 5 +
  test_s4_authentication session-epoch 1）。

## 7. CURRENT_DATABASE_PROOF

- 每次写入/测试前通过 SSH 转发连接执行 `SELECT current_database()` 均返回
  `crm_test`；任何写操作前确认；未连接 `anqiao_crm` 或任何其他数据库。

## 8. NOT_VERIFIED（仍需后续环境或人工确认）

1. S5 门控（Jinja2 页面与 JSON API 一致性、four-step flow）——单独下一步。
2. S6 门控正式 PASSED 的剩余要素：应用进程重启后数据保持与确定性历史顺序
   （restart-persistence 验证需 uvicorn 启动/停止/重启，本次范围外）。
3. `main.py` 的 `__main__` 启动块引用不存在的 `settings.debug_mode` /
   `settings.production_mode` / `settings.database_url[:50]`（直接
   `python main.py` 会 AttributeError/TypeError）——运行路径缺陷，
   不在测试路径上，本次未修改，记录待 S5/运行验证处理。
4. W4 正式验收、G5 迁移授权、release/nginx/TLS/DNS/cutover——未授权。
5. 在线生产库/服务当前状态——UNKNOWN（本次未访问网络服务）。
6. 人工业务/视觉验收——按 AGENTS.md 永远不由自动化测试推断。

## 9. 边界合规

- 未读取/写入生产库 `anqiao_crm`；未读取
  `/opt/anqiao-crm/shared/database.env`；未打印/存储任何凭证值。
- SSH 承载操作限于 DEC-0069 点 3 的端口转发 + 只读隔离检查；本次额外
  操作（seed/测试写入 crm_test）经产品负责人 2026-08-02 明确授权。
- 未执行手动 DELETE 清理（DEC-0068/69 未授权此类语句）；测试自带清理。
- 未 git commit/push；未安装/移除依赖；未重启服务；未改
  postgresql.conf/pg_hba.conf/systemd/防火墙/nginx/TLS/DNS。
- 修改文件：`tests/test_s6_integration.py`、`scripts/dev-test.ps1`（新建）、
  `src/crm/web/routes/institutions.py`、`src/crm/application/commands.py`、
  `src/crm/application/queries.py`——均在 TASK-0001 owned files 范围内。
