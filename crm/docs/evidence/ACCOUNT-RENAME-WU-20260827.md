# CEO 账号改名「吴」→「吴骐」— evidence (2026-08-27)

- Executor: reasonix（2026-08-26 会话，跨日完成验证 2026-08-27）
- Authorization: 产品负责人指令「改成吴骐」（2026-08-26 会话；wiki 用户名统一
  约定；登录问题根因 = 生产库 username 为「吴」，输入「吴骐」精确匹配失败）
  结构化确认：username 与 display_name 均改为「吴骐」。
- Scope: 生产 `anqiao_crm` 数据库（`crm.aibrain.wiki`，SSH `bri-server`）。

## 目标账号（唯一受影响行）

| 字段 | 变更前 | 变更后 |
|---|---|---|
| username（登录名） | 吴 | 吴骐 |
| display_name（显示名） | CEO 兼营销总监 | 吴骐 |
| user_id（稳定身份） | 9a4bcd51-e784-4f2e-8d25-3e4bd3033efc | 不变 |
| role | administrator | 不变 |
| status | enabled | 不变 |

- user_id 不变 → 审计历史、客户 owner 绑定、role_grants 全部保持原归属
  （SPEC-0002 R-001/R-002：稳定且唯一的内部用户身份）。

## 执行结果

1. **备份**：`/tmp/anqiao_crm-pre-rename-wu-20260827-111210.dump`（pg_dump -F c，
   104617 字节，`sudo -u postgres`）。
2. **UPDATE**（单事务）：`user_identities SET username='吴骐',
   display_name='吴骐', updated_at=now() WHERE username='吴'` → `UPDATE 1`；
   COMMIT 成功；SELECT 确认 `吴骐|吴骐|enabled`。
3. **HTTP 真实登录**（127.0.0.1:8200）：
   - 吴骐/123 → **HTTP 200**，`success=true`，`username=吴骐`，
     `role=administrator`（user_id 不变）；
   - 吴/123 → **HTTP 401** `Invalid credentials`（旧登录名已失效）。
4. 密码哈希未修改、未打印；测试登录响应中的短时会话 csrf_token 未落盘未入库。

## 登录问题根因（本次触发）

- 现象：产品负责人输入「吴骐」无法登录。
- 根因：`user_repository.find_by_username` 为精确匹配（casefold 后等值），
  生产库 username 实为「吴」，故「吴骐」查询不到 → 401。改名后根因消除。

## 附注：生产库账号现状与仓库文档差异（产品负责人已确认，无需处理）

生产库现有 10 个账号：admin（administrator）/ 吴骐（administrator）/
赵（manager）/ 武（manager）/ 何丹、张楠、周晶晶、王海燕、杜政隆、ceshi
（business_user）。差异：无 sa001–sa010、无「何」无「张」（DEC-0171/0176
建档与此不完全一致）；新增张楠/周晶晶/王海燕/杜政隆/ceshi 未在文档记录。
产品负责人 2026-08-26 确认：张楠/周晶晶/王海燕/杜政隆/ceshi/何丹 均为内部
销售；吴（吴骐）、赵、武为管理（吴全权限；赵/武为查询/报表老板界面 + 销售
功能——与 SPEC-0002 v0.5.0 shareholder+business_user 设计一致，角色变更待
实现任务执行）。

## Not verified

- 浏览器侧产品负责人实际登录体验（HTTP 已验证；浏览器视觉由产品负责人抽查）。
- 赵/武的角色变更（shareholder + business_user）为已批准 SPEC 的待实现项，
  未在本变更内执行。