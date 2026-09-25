# SPEC-0014: 账号用户名与密码自助修改

- Spec ID: SPEC-0014
- Version: 0.3.0
- Status: APPROVED
- Product owner: User
- Prepared by: DeepSeek-v4-pro（`DEC-0151`）
- Last updated: 2026-08-13
- Supersedes: 0.2.0（已归档至 `90-deprecated/`）
- 来源: `DEC-0149`（agent 登录角色废弃）

## 0. 版本说明（本草案对 0.2.0 的变更）

0.2.0 的增量是把 `agent` 角色纳入自助改密操作主体（对齐 `SPEC-0002 v0.3.0`
R-024）。`DEC-0149` 废弃了 agent 登录角色，本草案把操作主体**回退**到
`business_user` / `administrator`，删除 agent 相关内容。其余行为（前缀保护、
当前密码校验、改密后会话失效、审计不含明文、CSRF 保护）沿用 0.2.0。

## 1. Problem

`SPEC-0002` 定义了身份、角色、归属与停用/转交，但未定义已启用业务人员修改
本人登录凭据（用户名、密码）的行为。当前系统只能在数据库层直接改密/改名，
没有受控的应用层入口，也没有审计。

产品负责人要求：允许业务人员自助修改本人的用户名和密码，但以 `sa`、`dl`
开头的用户名属于受保护前缀，不允许通过该入口修改用户名（防止误改销售/代理
渠道的命名约定）。密码可改。

本 SPEC 只定义凭据修改的最小行为合同，不定义身份供应商、SSO、密码强度策略
或生产账号开通流程。

## 2. Verified context

- [VERIFIED] `SPEC-0002` R-004 定义三态；R-005 要求角色授予/撤销、启用/停用
  必须留痕；R-014 要求改密后旧会话失效。
- [VERIFIED] 密码以 argon2id 存储，校验用 `argon2.PasswordHasher().verify()`。
- [VERIFIED] 产品负责人 2026-08-05 明确要求：允许改用户名和密码，但 `sa`/`dl`
  前缀用户名不可改。
- [VERIFIED] `DEC-0149`（2026-08-13）废弃 agent 登录角色；`SPEC-0002 v0.4.0`
  删除 R-024。因此本 v0.3.0 的操作主体回退为 `business_user`/`administrator`。
- [UNKNOWN] 是否需要管理员代改他人凭据的能力——本 SPEC 不定义。

## 3. Goal and success measure

已启用的业务人员/管理员可通过应用内入口修改本人登录用户名和密码；修改成功后
旧会话失效、必须用新凭据重新登录；修改行为留痕（不含密码明文）。`sa`、`dl`
前缀的用户名被系统拒绝修改（仅密码可改）。

非技术人员判断成功：用 `wq` 登录后能在页面上改自己的密码，改完用新密码重新
登录成功；尝试把 `sa1` 改成别的名字时系统拒绝并提示该前缀受保护。

## 4. Non-goals

本版本不定义：

- 管理员代改他人用户名/密码（只支持本人改本人）；
- 密码强度策略、过期强制改密、历史密码不复用规则；
- 身份供应商、SSO、飞书 OAuth 集成；
- 用户名修改后的冷却期、修改频率限制；
- 受保护前缀列表的运行时管理界面（前缀列表是 SPEC 级常量）；
- 忘记密码的自助重置流程；
- `display_name` 的修改（修改入口不在本 SPEC 范围）。

## 5. Users and permissions

- **操作主体**：仅限 `status = enabled` 且角色含 `business_user` 或
  `administrator` 的本人。管理员不能通过本入口改他人凭据。
- **作用对象**：仅限操作者本人的 `user_identities` 行。
- **前置校验**：修改密码/用户名前必须验证当前密码正确（用户名修改是高风险
  操作，需二次确认身份）。
- **前缀保护**：当前用户名以 `sa` 或 `dl` 开头（大小写不敏感，按
  `lower(username)` 判断）时，用户名修改请求被拒绝；密码修改不受影响。
- **状态保护**：`pending`/`disabled` 状态的账号不能使用本入口；未登录身份不能
  访问。

## 6. Required behavior

- R-001: 修改密码必须先通过 `verify_password(current_password, stored_hash)`
  校验当前密码；校验失败拒绝且不透露目标记录是否存在。
- R-002: 新密码经 `hash_password()` 生成 argon2id 哈希后写入
  `user_identities.password_hash`；明文密码不落日志、不落审计、不进会话。
- R-003: 修改用户名必须先校验当前密码（同 R-001）。
- R-004: 若当前用户名（`lower(username)`）以 `sa` 或 `dl` 开头，用户名修改请求
  被拒绝；密码修改不受影响。
- R-005: 新用户名必须满足 `SPEC-0002` 既有约束（唯一、非空、长度上限 64）；
  冲突时拒绝，不自动追加后缀。
- R-006: 用户名或密码修改成功后，立即调用 `bump_session_epoch(user_id)` 使该
  用户所有已有会话失效（对齐 `SPEC-0002` R-014）。
- R-007: 每次成功的用户名/密码修改必须写 `audit_events`，记录操作者、目标用户、
  动作类型（`user.username_change` / `user.password_change`）、时间、结果；审计
  内容不含新旧密码、不含新用户名明文。
- R-008: 审计写入失败时，凭据修改不得显示成功。
- R-009: 页面和 API 使用同一身份与校验规则，不得存在绕过前缀保护或二次确认的
  替代路径。
- R-010: CSRF 保护同其他写操作（`DEC-0044`）；表单提交需带 CSRF token。

## 7. Data and integrations

### 受影响表

- `user_identities`：更新 `username` 和/或 `password_hash`、`updated_at`。
- `audit_events`：插入一条审计记录。
- `server_sessions`：通过 `bump_session_epoch` 使旧会话失效。

### 受保护前缀常量

受保护用户名前缀列表为 SPEC 级常量：`["sa", "dl"]`。实现以
`lower(username).startswith(prefix)` 判断。该列表不是运行时配置，变更需修订本
SPEC。

### 不变的数据关系

- 修改用户名不改变 `user_identities.id`（稳定内部身份，对齐 `SPEC-0002` R-001）。
- 修改用户名/密码不改变 `role_grants`、`customers.owner_user_id`（原
  `institutions.owner_user_id`）、`follow_up_activities.recorded_by_user_id` 等
  任何归属关系——这些按 `id` 引用，与 `username` 无关。

## 8. Failure and edge behavior

- 当前密码错误：拒绝，不透露账号是否存在，不写审计。
- 新用户名冲突：拒绝，提示已被占用，不修改。
- 当前用户名受前缀保护但尝试改用户名：拒绝，提示前缀受保护。
- 账号在操作过程中被管理员停用：写入前再次校验 `status = enabled`，失败则拒绝。
- 审计写入失败：凭据修改回滚，不显示成功。
- 新密码与旧密码相同：允许（本 SPEC 不引入密码历史策略），但提示"新密码与当前
  密码相同"。
- 用户名为空或超长：按 `SPEC-0002` 既有约束拒绝。

## 9. Acceptance criteria

- AC-001: Given 已启用业务人员 `wq`，when 提交正确当前密码与新密码，then 密码
  更新成功、旧会话失效、新密码可登录、审计写入。
- AC-002: Given 已启用业务人员 `wq`，when 提交错误当前密码，then 拒绝且不写
  审计、不泄露账号信息。
- AC-003: Given 已启用业务人员 `sa1`，when 尝试改用户名为 `sa1new`，then 拒绝
  并提示前缀受保护。
- AC-004: Given 已启用业务人员 `wq`，when 提交正确当前密码与新用户名 `wq2`，
  then 用户名更新成功、旧会话失效、`wq2` 可登录、`id` 不变、归属不变。
- AC-005: Given 新用户名与另一现有用户名冲突，when 提交，then 拒绝并提示占用。
- AC-006: Given 未登录或 `disabled`/`pending` 账号，when 访问修改入口，then 拒绝。
- AC-007: Given `sa1` 修改密码（用户名不改），when 当前密码正确，then 密码修改
  成功（前缀保护只限制用户名，不限制密码）。
- AC-008: Given 审计写入失败，when 凭据修改已执行，then 事务回滚、不显示成功。
- AC-009: Given API 与页面两条路径，when 同一用户修改凭据，then 前缀保护、二次
  确认、会话失效行为一致。
- AC-010: Given 密码修改成功，when 旧会话访问受保护资源，then 会话已失效、拒绝。
- AC-011: Given 一个 `administrator` 账号自助修改本人密码，when 当前密码正确，
  then 成功、旧会话失效、审计写入。

## 10. Safety limitations

- 本 SPEC 不授权真实业务数据的外部传输、外部模型调用或部署。
- 本 SPEC 不引入密码强度策略；如未来需要，必须单独 SPEC。
- 受保护前缀列表变更必须修订本 SPEC，不得通过运行时配置绕过。
- 本 SPEC 不授权管理员代改他人凭据；如未来需要，必须单独 SPEC 定义审计与授权
  边界。
- 实施仍需 `AGENTS.md` §5 全部 gate：本 SPEC 批准 + active task + 产品负责人
  明确授权。

## 11. Open decisions

- OD-001: 是否需要"修改用户名后 N 天内不可再改"的冷却期？当前默认不需要。
- OD-002: 受保护前缀是否需要扩展到 `admin` 前缀？当前 `admin` 用户名是管理员
  账号，其修改属管理员账号管理范畴，不在本 SPEC 定义。
- OD-003: 是否需要管理员代改他人密码的能力？当前默认不需要。

## 12. Approval

`APPROVED by DEC-0153 on 2026-08-13`

产品负责人批准 `SPEC-0014 v0.3.0`（自助改密操作主体回退，删除 agent）。
本批准不授权实现；实现由后续 active task 经产品负责人单独授权后另行进行。
