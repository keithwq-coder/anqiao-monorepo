# TASK-0048 角色叠加 + shareholder + 双重管理 — evidence (2026-08-27)

- Executor: reasonix（2026-08-26/27 会话）
- Authorization: DEC-0179（2026-08-26 一次性授权 TASK-0048/0049/0050）
- Scope: SPEC-0002 v0.5.0 完整实现（本地代码 + 生产部署 + 角色变更）

## 实现内容

1. **数据模型**：迁移 0015（shareholder 角色约束 + custodian_user_id 列 +
   索引）；domain/persistence 模型同步更新。
2. **领域模型**：`Role.SHAREHOLDER` 枚举新增。
3. **策略层**：`projection.py` shareholder 全局可见 + `queries.py` 四处
   admin 检查扩展。
4. **命令层**：`CreateInstitutionCommand` 支持 custodian；新增
   `ChangeCustodianCommand`。
5. **API 端点**：`POST /api/institutions/{id}/change-custodian`；权限门
   全面扩展（institutions / followups / discovery / account / admin
   transfer_actor）。
6. **前端**：导航栏 + 报表入口 + 所有模板按钮 shareholder 条件；新增
   `is_shareholder` 变量。
7. **生产部署**：代码 tar+scp 同步 → systemd restart → health 200；
   DB 迁移 SQL 直接执行（约束扩展 + custodian 列）；赵/武角色变更
   （shareholder + business_user 授予）。
8. **测试**：本地 `517 passed, 28 skipped`（+13 从基线 504）。

## 生产变更

- 代码备份：`/tmp/anqiao-crm-code-backup-*.tar.gz`（未成功，用 scp 时间戳）
- DB 备份：`/tmp/anqiao_crm-pre-shareholder-role-20260827-115600.dump`
- 迁移：`ALTER TABLE role_grants` 约束扩展 + `institutions` 新增
  `custodian_user_id` 列 + 索引
- 角色：赵/武 `role_grants` 新增 shareholder + business_user（
  granted_by=admin，reason=DEC-0179）
- 验证：赵/武/吴骐 登录全部 200，roles 正确

## Not verified

- 浏览器端赵/武/吴骐的业务路径体验（HTTP 已验证；页面由产品负责人抽查）
- TASK-0049/0050 尚未开始实现