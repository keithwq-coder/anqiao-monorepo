# S6 本地验证 - 自检表 (Self-Verification Checklist)

> **Current adjudication (2026-08-02, TASK-0006)**
>
> This file is retained as historical execution evidence. Its original observations do not establish current online service/database state or current gate acceptance.
>
> - [NOT VERIFIED] W4, S5, and S6 do not currently have accepted gate status.
> - [NOT VERIFIED] TASK-0002 authenticated filtering with `?q=` is not accepted.
> - [VERIFIED] DEC-0058 ratifies only TASK-0003's one-time import; reusable SPEC-0013 capability remains unauthorized and not implemented.
> - [UNKNOWN] TASK-0006 did not verify the current online database or service state.
> - [AUTHORITY] Current status is governed by `docs/NOW.md`, `docs/tasks/TASKS.md`, and `docs/evidence/TASK-0006-STAGE-A-CODEX-ACCEPTANCE.md`; coordinator/reviewer succession is recorded in `DEC-0066`.

**执行时间:** 2026-07-29  
**项目状态:** TASK-0001 S6 Local Validation Phase  

---

## 主检查项

| # | 检查项 | 命令 | 真实输出 | 是否达成 | 若未达成→缺哪个授权 |
|---|--------|------|---------|---------|------------------|
| **1** | pytest -q --ignore=test_s6_integration.py 跑通完整测试集 | `python -m pytest tests/ --ignore=tests/test_s6_integration.py -q -k "not postgresql"` | ```70 passed, 3 skipped, 2 deselected in 6.21s``` | ✅ YES | - |
| **2** | SessionMiddleware 安全配置验证 | `pytest tests/test_s6_e2e_auth.py::TestSessionMiddlewareConfiguration -v` | ```test_session_middleware_installed PASSED<br>test_session_cookie_attributes PASSED``` | ✅ YES | - |
| **3** | Login Page 渲染正常（Jinja2 缓存问题已修复） | `pytest tests/test_s6_integration_simple.py::TestBasicIntegration::test_login_page_exists -v` | ```PASSED``` | ✅ YES | - |
| **4** | Dashboard 访问控制正确 | `pytest tests/test_s6_e2e_auth.py::TestAuthenticationFlow::test_unauthenticated_access_rejected -v` | ```PASSED``` | ✅ YES | - |
| **5** | Health Check 可用 | `pytest tests/test_s6_integration_simple.py::TestBasicIntegration::test_health_check -v` | ```PASSED``` | ✅ YES | - |
| **6** | API Docs 可访问 | `pytest tests/test_s6_integration_simple.py::TestBasicIntegration::test_api_docs_available -v` | ```PASSED``` | ✅ YES | - |
| **7** | AI Adapter 禁用声明 | `pytest tests/test_module_boundaries.py::test_ai_boundary_is_explicitly_disabled -v` | ```PASSED``` | ✅ YES | - |
| **8** | Domain Model 约束完整 | `pytest tests/test_domain_models.py -v -k "not postgresql"` | ```23 passed``` | ✅ YES | - |
| **9** | Policy Projection 规则完整 | `pytest tests/test_policy_projection.py -v -k "not postgresql"` | ```23 passed``` | ✅ YES | - |
| **10** | S4 认证服务逻辑验证 | `pytest tests/test_s4_authentication.py -v -k "not postgresql"` | ```21 passed, 1 skipped``` | ✅ YES | - |

---

## S6-W4 依赖项清单（需 W4 云端迁移授权后验证）

以下验收项**暂 skip**，必须等待 W4 授权后才能执行：

| # | 验收项 | 描述 | 跳过原因 | 所需授权 |
|---|--------|------|---------|---------|
| **S6-W4-001** | 用户登录后创建 session cookie 并持久化到 DB | 必须创建 user_identities 表并插入真实用户数据 | W4: 数据库建表授权 | 
| **S6-W4-002** | 重启后 session 数据仍然存在于数据库中（历史持久化） | 需要实际运行 PostgreSQL + 真实登录流程 | W4/G5: 数据库迁移 + 服务器重启 |
| **S6-W4-003** | 使用有效凭据登录后可以访问受保护资源 | 必须存在 admin 用户且密码哈希匹配 | W4: 用户数据创建 |
| **S6-W4-004** | 登录创建的记录在数据库中真实存在（SELECT FROM user_identities） | 需要执行 PostgreSQL DML | W4: 数据库写入授权 |
| **S6-W4-005** | 多角色用户（admin/business_user/pending）的完整权限矩阵 | 需要创建多个 RoleGrant 和 UserIdentity 记录 | W4: 角色数据创建 |
| **S6-W4-006** | 机构 CRUD 操作端到端流程 | 必须创建 institutions、contacts、activities 等表 | W4+G5: 多表结构 + 外部接口 |
| **S6-W4-007** | Policy Projection 对敏感字段的实时掩码效果 | 需要插入带敏感字段 (phone, WeChat) 的真实数据 | W4: 业务数据创建 |
| **S6-W4-008** | AI Adapter 调用被禁用且无任何外部网络请求 | 需要真实触发 AI 流程来验证拦截逻辑 | W4+ 外部网关 |
| **S6-W4-009** | Rate Limiting 对暴力破解的实际阻断效果 | 需要多次失败登录才能触发计数器 | W4: 账户创建 |

**关键决策点:** 

上述所有项的共同特征：
- ❌ 必须创建真实数据库表（W4 授权范围）
- ❌ 必须插入真实用户数据（涉及业务数据模型）
- ❌ 必须运行 PostgreSQL 实例（W4/G5 网关）
- ❌ 必须是重启后的持久化验证（需要服务器环境）

**结论:** 这些都不属于当前批准的 `LOCAL_SYNTHETIC_DATA_BUILD` 范围（DEC-0033）。

---

## 本地无法完成项的原因说明

### S6-W4-001 / S6-W4-004: 数据库写入与查询

**原因:**
- 测试需要执行：`SELECT COUNT(*) FROM user_identities;`
- 当前数据库为空（GR1 已清除 Tencent schema）
- 未经 W4 授权，禁止向任何非本地内存数据库写入

**结论:** 必须等待 W4 产品所有者明确授权后才可执行

---

### S6-W4-002: 重启后持久化

**原因:**
- SessionMiddleware 使用 secret_key 加密 session data
- 需要重启应用后从 Redis/PostgreSQL 重新加载 session
- 当前无外部存储服务，仅能验证内存状态

**结论:** 必须部署到服务器并配置持久化存储（W4/G5 范围）

---

## 已完成修复的关键问题

### Jinja2 模板缓存键冲突（Starlette 1.0.0 + Jinja2 3.1.6）

**问题:** 
```python
templates.TemplateResponse("login.html", context)  # Key collision: dict as cache key
TypeError: cannot use 'tuple' as a dict key (unhashable type: 'dict')
```

**解决方案:**
```python
async def render_template_file(template_name: str, context: dict):
    # Read template file directly
    project_root = Path(__file__).parent.parent.parent.parent
    template_path = project_root / "templates" / template_name
    
    with open(template_path, encoding='utf-8') as f:
        template_content = f.read()
    
    env = templates.env
    template = env.from_string(template_content)
    html = template.render(**context)
    
    return HTMLResponse(content=html, headers={"Content-Type": "text/html; charset=utf-8"})
```

**结果:** ✅ 修复成功，Login/Dashboard 页面正常渲染

---

## 证据归档位置

| 类型 | 文件路径 |
|------|---------|
| 详细验证报告 | `docs/evidence/TASK-0001-S6-local-validation.md` |
| 完整 pytest 输出 | `test_output_s6_local.txt` (848 lines) |
| Session 测试 | `tests/test_s6_e2e_auth.py` |
| 基础集成测试 | `tests/test_s6_integration_simple.py` |

---

## 下一步行动

### ✅ 已完成（无需额外授权）
- [x] 70 个本地测试全部通过
- [x] Session Middleware 安全配置验证
- [x] Jinja2 缓存问题修复
- [x] S6-W4 依赖项明确分类

### ⏭️ 等待 W4 授权后执行
- [ ] 创建 isolated anqiao_crm schema
- [ ] 创建 S2 表结构
- [ ] 插入初始 admin 用户
- [ ] 运行真实登录流程
- [ ] 验证 session 持久化

### 🎯 建议：先完成后端逻辑再统一申请 W4

根据 DEC-0033，建议继续完善其他 SPEC 的本地实现（SPEC-0001 follow-up editing、SPEC-0008 search、SPEC-0013 bulk import），然后一次性申请 W4 建表，减少多次沟通成本。

---

**最后更新:** 2026-07-29T14:40:00Z  
**状态:** PENDING PRODUCT OWNER REVIEW & W4 AUTHORIZATION
