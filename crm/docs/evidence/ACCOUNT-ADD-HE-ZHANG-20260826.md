# 新增账号「何」「张」— evidence (2026-08-26)

- Executor: reasonix（2026-08-26 会话）
- Authorization: 产品负责人 2026-08-26 指令「增加2个用户名『何』和『张』，密码都一样」；
  结构化确认：用户名 = 单字「何」「张」；密码 = 沿用统一初始密码 123；
  角色 = business_user（销售）。
- Scope: 生产 `anqiao_crm` 数据库（`crm.aibrain.wiki`，SSH `bri-server`）。

## 目标账号

| 用户名 | 显示名 | 角色 | 权限说明 |
|---|---|---|---|
| 何 | 何 | business_user | 与何丹/sa001–sa010 相同：名下客户完整可见可写 + 认领公池 |
| 张 | 张 | business_user | 与何丹/sa001–sa010 相同：名下客户完整可见可写 + 认领公池 |

- 密码：统一初始密码 `123`（argon2id 哈希存储；不强制登录后改密，可提醒）。
- 角色-权限依据 `SPEC-0002 v0.4.1`（administrator / manager / business_user；
  本账号不涉及 manager scope 约束）。

## 执行结果

1. **备份**：`/tmp/anqiao_crm-pre-account-add-20260826-110741.dump`（pg_dump -F c，
   103129 字节）。
2. **插入**（单事务，失败即回滚）：`user_identities` 两行（`enabled`、
   `session_epoch=0`、argon2id 哈希）+ `role_grants` 两行
   （`business_user`，granted_by=admin，reason=「产品负责人 2026-08-26 指令：
   新增业务人员账号」）。用户名占用检查通过（此前无「何」「张」）。
3. **验证**：
   - DB 行：`何|何|enabled|business_user|admin`；`张|张|enabled|business_user|admin`；
   - 密码：`verify_password("123", hash)` 两账号均 True，哈希前缀 `argon2id`；
   - HTTP 真实登录（`127.0.0.1:8200`）：何/123 → `success=True role=business_user`；
     张/123 → `success=True role=business_user`；
   - 负例：张/wrong → HTTP 401。

## 安全说明

- 密码哈希 argon2id（`argon2.PasswordHasher`，与 `src/crm/web/auth.py` 一致）；
  明文/哈希未打印、未入日志/仓库/审计。
- 临时脚本 `/tmp/add_users_he_zhang.py` 已删除。
- 数据库备份保留于服务器 `/tmp/anqiao_crm-pre-account-add-20260826-110741.dump`。

## Not verified

- 新账号首次实际业务操作路径（登录已验证；业务页面操作待产品负责人抽查）。
