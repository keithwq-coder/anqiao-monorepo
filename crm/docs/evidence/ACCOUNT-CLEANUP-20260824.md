# 账号体系清理与重建 — evidence (2026-08-24)

- Executor: reasonix（2026-08-24 会话）
- Authorization: 产品负责人 2026-08-24 指令「最后要求清理用户名和密码」；
  四类用户 + 统一初始密码 123（不强制登录后修改，可提醒）。
- Scope: 生产 `anqiao_crm` 数据库（`crm.aibrain.wiki`）。

## 目标账号体系（用户-角色-权限）

| 用户名 | 显示名 | 角色 | 权限说明 |
|---|---|---|---|
| admin | 管理员 | administrator | 系统管理员：全局完整可见 + 管账号/角色/停用 + 分配/进池/归档 |
| 赵 | 董事长 | general_manager | 全局脱敏只读 + 督办（点名分配、进池） |
| 武 | 总经理 | general_manager | 全局脱敏只读 + 督办（点名分配、进池） |
| 吴 | CEO 兼营销总监 | administrator | 全局完整可见 + 分配/收回（转交）+ 管账号 |
| 何丹 | 销售 | business_user | 名下客户完整可见可写 + 认领公池 |
| sa001–sa010 | 合作伙伴 | business_user | 与内部销售相同（用户确认：合作伙伴本身即销售角色，不额外增减权限） |

- 初始密码：全部 `123`（argon2id 哈希存储；不强制登录后改密，登录后可提醒）。
- 角色-权限依据 `SPEC-0002 v0.4.0`（administrator / general_manager /
  business_user / manager 四角色；agent 已废弃）。

## 执行结果

1. **备份**：`/tmp/anqiao_crm-pre-account-cleanup-20260824.dump`（pg_dump -F c）。
2. **清理旧账号（28 个删除）**：dl0001–dl0010、admin@example.com、
   admin_synthetic、gm、hedan、sa1–sa9、testuser_real、user_synthetic、
   wq、zhoujingjing、zxx（张先侠，已停用）。删除前：
   - 业务引用（institutions.owner/created、contacts.created、
     follow_up_activities、institution_owner_history、import_batches、
     opportunity_candidates 等 15 列）**转交给 admin**（62 行）；
   - `audit_events.actor_user_id` **置空**（审计行保留，操作者匿名化）；
   - role_grants（26 行）、server_sessions（19 行）先行清理；
   - 全部在单事务内完成，失败即回滚（首次尝试因参数化语法失败已回滚验证安全）。
3. **建立目标账号（15 个）**：admin 重置密码 123；新建 赵/武/吴/何丹/
   sa001–sa010（13 个新账号 + admin = 15 个登录账号），各自授予角色，
   全部 `enabled`。
4. **验证**：
   - 15 个账号 `verify_password("123", hash)` 全部 OK；
   - HTTP 真实登录：admin/123 → 200 administrator；赵/123 → 200
     general_manager；吴/123 → 200 administrator；sa001/123 → 200
     business_user（含中文用户名登录正常）。

## 后续调整（产品负责人 2026-08-24 追加：「赵/武不分配」）

- 赵（董事长）、武（总经理）调整为**纯只读董事角色**（`manager`，
  scope=「苏州」），不再有总经理的分配/进池能力；其原有
  `general_manager` 授予已撤销（留痕）。
- 为支持纯只读可见性，给现有 **117 条客户补 `region='苏州'`**（此前
  region 为空；客户为苏州适老化服务商导入数据）。
- 验证：赵/123 登录 → 角色 `manager`；客户列表可见（脱敏，分页首页 50 条）；
  吴仍为 `administrator`（分配/收回/管团队不变）。
- 提醒：此后**新客户需标注 region='苏州'**（或赵/武授权范围内的区域），
  否则两位董事不可见；此提醒已记入 NOW.md。

## 安全说明

- 密码哈希 argon2id；明文/哈希未打印、未入日志/仓库/审计。
- `123` 为弱密码，产品负责人明确指定且接受风险；系统不强制改密（可提醒）。
- 数据库备份保留于服务器 `/tmp/anqiao_crm-pre-account-cleanup-20260824.dump`。
- 旧账号删除导致的审计 actor 匿名化已如实记录（审计行本身未删除）。

## Not verified

- 各账号首次实际业务操作路径（登录已验证；业务页面操作待产品负责人抽查）。
- 合作伙伴 sa001–sa010 实际协作流程（按用户设定与内部销售同权限）。
