# SPEC-0015: 客户基本信息编辑

- Spec ID: SPEC-0015
- Version: 0.1.0
- Status: DRAFT（10-draft）
- Product owner: User
- Prepared by: Reasonix（2026-08-25；DEC-0175 验收后经产品负责人授权启动）
- Last updated: 2026-08-25
- Supersedes: none
- 来源: DEC-0173 批次遗留问题（「客户编辑后端无 API，属单独 SPEC 问题」）、
  DEC-0175 验收后产品负责人授权「客户编辑功能」

## 1. Problem

客户基本信息（名称、来源说明、类别、地区、来源方式、来源证据）在创建后
无法更正。录入错字、区域调整、来源补充目前只能归档后重建客户，会丢失该
客户的联系人、跟进历史与审计链。需要一个**可审计的「编辑客户基本信息」
能力**：更正后保留原记录与历史，不丢失任何已有数据。

## 2. Verified context

- [VERIFIED] 后端目前**没有**「编辑客户基本信息」的 API 或命令：
  `src/crm/web/routes/institutions.py` 仅存在 create / list / get / archive /
  release-to-pool / claim / customer-type 端点（2026-08-25 只读核查）。
- [VERIFIED] 客户类型变更是唯一的信息变更能力，规则为 owner 或
  administrator（`routes/institutions.py:470`，R-039a），变更 auto-traced。
- [VERIFIED] 重复怀疑机制 R-035 已存在：创建客户/联系人时按规范化名称
  精确匹配（`src/crm/application/queries.py:detect_duplicate_institutions`）。
- [VERIFIED] 所有读路径（页面与 API）统一经 `project_record` 政策投影脱敏，
  编辑后的数据应沿用同一投影返回。
- [VERIFIED] 归档客户不可进行类型变更等写操作（`ChangeCustomerTypeCommand`
  对 archived 记录抛错），编辑应遵循同一限制。

## 3. Goal and success measure

客户负责人（owner）或系统管理员（administrator）可以更正客户的基本信息；
更正自动留痕（谁/何时/改了什么），不丢失联系人、跟进历史与审计链；非授权
角色（manager、其他 business_user）保持只读。非技术验收方式：登录后进入
客户详情页，owner/admin 可见「编辑客户」表单并成功提交，更正后的内容
显示在详情页，且审计日志可见变更前后。

## 4. Non-goals

- **不可编辑**：`owner_user_id`（归属变更走既有转移）、`in_pool`（公池状态
  走既有释放/认领）、`id`、`created_at`、`customer_type`（已有独立 API）。
- 不做批量编辑、客户合并、历史版本回滚 UI（编辑历史仅审计可见）。
- 不改变现有客户类型/归档/公池/转移行为。

## 5. Users and permissions

| 角色 | 可见 | 可编辑 |
|---|---|---|
| owner（客户负责人） | 自己的客户 | 基本信息编辑 |
| administrator | 全部（脱敏投影） | 任意客户基本信息编辑 |
| manager | 授权 scope（脱敏投影） | 只读 |
| 其他 business_user | 合作者视图（脱敏投影） | 只读 |

## 6. Required behavior

- R-001: 提供编辑客户基本信息的端点（如
  `POST /api/institutions/{id}/edit`），请求体为可编辑字段的子集：
  `name`、`source_description`、`category`、`region`、`source_kind`、
  `source_evidence_reference`；未提供的字段保持不变。
- R-002: 权限——owner 或 administrator；其他角色（含 manager、非 owner
  business_user）拒绝且不泄露存在性（遵循既有 404/403 惯例）。
- R-003: `name` 变更时执行 R-035 重复怀疑；命中且未显式确认 →
  `409`（与创建路径一致，不自动合并）。
- R-004: 审计——变更 auto-traced（actor / 时间 / before / after 字段名
  与值），不记录任何超出既有审计范围的敏感值。
- R-005: 编辑成功后在**同一事务内**经 `project_record` 政策投影返回更新后
  的详情（与创建路径一致），保证脱敏一致性。
- R-006: 归档客户不可编辑（遵循归档写限制）。
- R-007: 页面——客户详情页（`institution_detail.html`）为 owner/admin
  渲染「编辑客户」表单（CSRF token；提交走既有写路径），manager /
  其他 business_user 不显示。
- R-008: 编辑不改变 `owner_user_id`、`in_pool`、`id`、`created_at`、
  `customer_type`。

## 7. Acceptance criteria

1. owner 与 administrator 可编辑（API 200，返回投影字段一致）。
2. manager 与非 owner business_user 编辑 → 403/404（不泄露存在性）。
3. `name` 重复且未确认 → 409；确认后通过。
4. 审计事件含 before/after，无敏感值泄漏。
5. 页面表单带 CSRF；非 owner/admin 页面不渲染编辑控件。
6. 全量 `pytest tests -q` 不回退（基线 504 passed, 28 skipped 之上）。

## 8. Risks / open questions

- [UNKNOWN] 可编辑字段子集是否需要产品负责人进一步确认（草案默认六个
  字段均可改，`owner/customer_type/in_pool` 排除）。
- [UNKNOWN] 编辑端点方法（POST vs PATCH/PUT）属工程决策，实现任务内确定。
- 本草案为 DRAFT：**不授权实现**。需经 review → 30-approved（approval.json
  hash 匹配）→ 活动任务卡 → 单独实现授权（AGENTS.md §5）。
