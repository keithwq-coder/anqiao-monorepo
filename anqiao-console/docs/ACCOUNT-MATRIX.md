# 账号矩阵（新体系）

> 取代旧演示账号体系（`nurse01` / `ops01` / `hq01` 已移除）。账号矩阵同时作为前端登录身份与后端授权基线。
> 数据源：`server/seed.js` 的 `ACCOUNTS`（登录用）、`server/ltc.js` 的 `ROLES`/`ROLE_PERMISSIONS`/`ORGS`（角色与组织）。
>
> **体验域角色群账号于系统验收后统一制作（PRD §2.3.3）。**
>
> **初始密码：由部署环境变量 `SEED_ACCOUNT_PASSWORD` 注入（仓库不保存明文），仅用于首次部署后登录，上线后必须立即修改。**

## 1. 账号表

| 账号 | 角色（role） | 姓名 | 组织（org） | tenant_id=org_id | data_scope |
|---|---|---|---|---|---|
| `su01` | `su` 超级管理员 | 超级管理员 | 系统组织（platform） | platform | global |
| `admin01` | `admin` 机构管理员 | 中科安樵管理员 | 中科安樵组织（anqiao） | anqiao | org |
| `user01` | `user` 机构普通用户 | 设备监控用户 | 中科安樵组织（anqiao） | anqiao | org |
| `medical01` | `medical_insurance_staff` 医保局监管人员 | 医保局监管人员 | 医保局组织（bureau） | bureau | pool |
| `insurer01` | `insurer_staff` 太平洋保险经办人员 | 太平洋保险经办人员 | 太平洋保险组织（insurer） | insurer | pool |
| `assessor01` | `assessor` 长护险评估人员 | 长护险评估人员 | 评估机构 / 太平洋保险关联组织（assessor_org） | assessor_org | task |
| `family_demo` | `family_contact` 家属（阶段 D 可登录） | 许丽家属 | bureau | bureau | applicant |
| `assessor_liming` | `assessor` 上门失能评估师 | 李明 | 姑苏失能评估服务中心 (`assessor_org`) | assessor_org | task |

- **`family_contact` 自阶段 D 起支持可登录账号形态**（LTC-WORKBENCH-SPEC §0.3/§4.4）：种子 `family_demo` 已创建；绑定+本人/监护人授权有效后进入 `family_workspace`。data_scope 为 `applicant`。非登录联系人实体仍可用于档案展示。
- 一个账号且仅属于一个组织（`tenant_id == org_id`）；`su` 直属系统组织（platform）。

## 2. 登录返回字段

`POST /v1/auth/login` 成功后返回 `data`：

```jsonc
{
  "token": "...",
  "staff": { "name": "中科安樵管理员", "role": "admin" },
  "tenant": { "tenant_id": "anqiao", "name": "中科安樵·自营运营中心", "kind": "vendor" },
  "principal": { "account_id": "admin01", "username": "admin01", "name": "中科安樵管理员",
                 "role": "admin", "tenant_id": "anqiao", "org_id": "anqiao",
                 "org_name": "中科安樵·自营运营中心", "org_kind": "vendor" },
  "permissions": ["application:create", "application:submit", "..."],
  "data_scope": "org"
}
```

- `principal`：账号主体（含组织归属）；`permissions`：该角色全部能力；`data_scope`：数据可见范围（`global`/`org`/`pool`/`task`/`applicant`）。
- 跨组织数据访问一律按角色收敛：读他人越权数据返回 `404`，无权限操作返回 `403`。

## 3. 权限与数据范围

### 3.1 data_scope 一览

| role | data_scope | 含义 |
|---|---|---|
| su | global | 全量 |
| admin | org | 本组织 |
| user | org | 本组织 |
| medical_insurance_staff | pool | 统筹区全量（跨机构只读监管） |
| insurer_staff | pool | 统筹区全量（本统筹区经办） |
| assessor | task | 仅本人评估任务 |
| family_contact | applicant | 仅本绑定长者 |

### 3.2 角色能力（permissions，`server/ltc.js` `ROLE_PERMISSIONS`）

- `su`：`['*']`
- `admin`：申请创建/提交/读取、派单、任务/证据/监测/结果读取、报告生成/读取、监管读取
- `user`：申请创建/提交/读取、任务/证据/监测读取、报告生成/读取（本人）
- `medical_insurance_staff`：申请/任务/结果/证据/监测读取、报告、监管创建/读取
- `insurer_staff`：申请创建/提交/读取、派单、任务/结果读取、结果审核通过/退回、报告、监管读取
- `assessor`：任务操作/读取、结果提交、证据录入、报告读取
- `family_contact`：申请创建/提交/读取、证据读取、报告、申诉

## 4. 登录与越权规则

- **旧账号一律失败**：`nurse01` / `ops01` / `hq01` 已从 `ACCOUNTS` 移除，登录返回 `401 用户名或密码错误`。
- **无跨租户切换**：已移除旧 `allowed_tenants` 白名单，`POST /v1/auth/switch` 仅允许切换到账号所属组织（实际为无操作），长护险/机构角色无权切换到护理院/厂商租户，杜绝越权。
- 设备监测数据（`anqiao` 厂商租户）仅 `su/admin/user` 组织可经 `/v1/overview`、`/v1/alerts`、`/v1/geo/*` 读取；`medical01/insurer01/assessor01` 为长护险角色，其登录令牌的 `tenant_id` 为各自组织，访问照护/设备接口返回 `404`（无该租户数据），无串租户泄漏。

## 5. 上线要求

1. 部署后**立即修改所有演示账号初始密码**（由 `SEED_ACCOUNT_PASSWORD` 注入，仓库不保存明文）。
2. 生产环境必须通过 `env TOKEN_SECRET` 注入令牌密钥（已在 systemd 配置，勿覆盖）。
3. 生产应将内存态/固定 salt 迁移为数据库 + argon2id + 随机 salt（见 README 生产化待办）。
