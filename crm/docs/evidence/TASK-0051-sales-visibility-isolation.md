# TASK-0051 验证证据：销售可见性隔离

- Task: TASK-0051（SPEC-0001 v0.9.0 销售可见性隔离）
- Date: 2026-08-27
- Executor: Reasonix（用户体验馆）

## 变更

1. `src/crm/policy/projection.py` `resolve_read_access`：business_user 分支改为
   - `owner_user_id == 本人` → `OWNER`（完整，沿用 R-013）；
   - `in_pool == true` → `COLLABORATOR`（公池脱敏，沿用 R-042/R-045）；
   - 其余 → `raise PolicyDenied("record access denied")`。
   - shareholder 全局分支（在 business_user 之前）不变：赵/武（shareholder+
     business_user）仍全局可见（SPEC-0002 R-008）。

2. `tests/test_policy_projection.py`：拆分/新增测试
   - `test_other_business_user_is_denied_for_other_business_users_record`（deny）；
   - `test_business_user_receives_masked_projection_for_pool_record`（公池脱敏）；
   - `test_shareholder_reads_full_detail_despite_business_isolation`（shareholder 全局）；
   - 新增 `pool_record()` helper。

3. `tests/test_task0010_search_security.py`：2 个测试断言更新为隔离语义
   - `test_other_user_search_returns_masked_results` → 改名 `…_returns_no_results_after_isolation`，断言 0 条；
   - `test_page_and_api_search_same_results` → 改用 owner 账号，断言仅见本人 1 条。

## 验证（已运行）

`python -m pytest tests/test_policy_projection.py tests/test_task0037_customer_type_pool.py "tests/test_task0010_search_security.py::test_other_user_search_returns_no_results_after_isolation" -q --no-header -p no:cacheprovider`
→ **25 passed, 1 warning in 5.79s**

覆盖：business_user 对他人非公池客户拒绝；公池脱敏可见；shareholder 全局可见；
隔离后搜索他人客户返回 0 条；公池进池/认领/脱敏投影不回退。

## 未验证（环境限制）

- 全量 `python -m pytest tests -q` 未完整运行：本地 PostgreSQL（localhost:5432）未启动，
  依赖真实 PostgreSQL 的测试（如 `test_page_and_api_search_same_results` 的页面路由
  `SessionLocal` 路径、`test_migrations`、`test_task0007_postgresql_sessions` 等）会
  ConnectionTimeout。核心策略层测试（上述 25 项）已通过。
- `git diff --check` 已通过（无 whitespace 错误）。
