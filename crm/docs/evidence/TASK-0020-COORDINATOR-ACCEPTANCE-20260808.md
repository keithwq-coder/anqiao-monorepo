# TASK-0020 协调员独立审计验收

- Date: 2026-08-08
- Task: TASK-0020 — 商机发现(主动发现与脱敏提醒)
- SPEC: SPEC-0003 v0.2.0(approved DEC-0022;hash 7170d728… 匹配)
- Authorization: DEC-0114(2026-08-08,本地合成范围)
- Auditor: 协调员(未采信执行者自报告,全部独立复现)
- Verdict: **ACCEPTED**(本地合成范围)

## 1. 授权链核验

- SPEC-0003 approval hash 匹配(`7170d728…`)。
- DEC-0114 激活记录存在;基线 COMPLETE。
- 迁移链一致:`0001 → 0002 → 0003 → 0004_opportunity_reminders`(head),
  down_revision 正确串接。

## 2. 独立复现的证据

1. TASK-0020 聚焦测试:`python -m pytest tests/test_task0020_opportunity_discovery.py -q`
   → `17 passed`(另含 schema 测试合计 19 项新增)。
2. 全量回归:`python -m pytest tests/ -q` → `319 passed, 28 skipped`
   (任务卡基线 302;+19 新增,0 退化)。与执行者报告一致。
3. 治理:`scripts/check-governance.ps1` → `[PASS]`(8 SPEC / 16 任务)。
4. 发现代码外部调用扫描:`discovery.py` / `routes/discovery.py` 中无
   socket/requests/urllib/httpx/联网模式。`run()` 显式返回
   `external_egress: False`、`method: local_deterministic_rule`。

## 3. 重点审查:执行者修改了测试断言(AC-006/AC-009)

执行者将 TASK-0020 测试中"业务用户读他人机构详情 = 404"的断言改为
"200 + `source_description is None`(脱敏 collaborator 视图)"。

**协调员独立查证结论:该修改合法,不是掏空测试。**

- 引用的已接受测试 `tests/test_task0008_s4_admin_exception.py::`
  `test_non_admin_with_reason_is_not_escalated` 经独立读取确认:非 owner
  业务用户读他人机构详情返回 **200 脱敏视图**(`source_description is None`,
  敏感来源/联系人/电话均不出现),这是已批准 SPEC-0001 行为。
- 因此原 404 断言与已批准行为冲突,是错误假设;修正后仍断言受保护字段
  隐藏,**保留了 AC-006/AC-009 的核心语义**(跨负责人可识别 + 受保护详情
  不经提醒泄露、仍走既有 owner/管理员例外路径)。
- 未触碰 `policy/projection.py` 或任何已批准策略代码。

## 4. 发现方法核验(OD-006 合规)

本地确定性规则 `same_region_and_category_cross_owner`:
- 簇规模 ≥ 3(`MIN_CLUSTER_SIZE`)才触发,否则抑制(AC-008/R-008 反推保护)。
- 簇内不同负责人 ≥ 2(`MIN_DISTINCT_OWNERS`),否则不算跨负责人可能。
- region/category 为空的记录被排除,避免 null 合并伪造关联(R-014/AC-013)。
- 展示给接收者的 `involved_records` 仅含 id/name/category/region;绝不含
  联系方式值、原始跟进正文、客户原话、证据、source_description(R-007/AC-007)。
- 接收者路由:owner enabled 且持 business/administrator 角色 → 发本人;
  否则(缺失/停用/无接收角色)→ 发 enabled 管理员并标 `routed_reason=unowned`
  (R-015/AC-014);无可用管理员时抑制而非泄露。
- 幂等:同 (接收者, 规则, 涉及机构 id 集合, 路由标记) 不重复(AC-012 未读消息语义)。
- 全程本地计算,零外部模型/联网/外传(R-012/AC-011)。

## 5. 分层与不可篡改核验

- 提醒仅持久化于 `opportunity_reminders`,不进机构/跟进记录,不入任何
  "已确认/预测/漏斗"视图(R-003/AC-003)。测试断言列表/详情/页面均不含
  discovery/possibility/reminder 泄露词及受保护字段。
- 无认领/升级/转正动作(claim/promote/convert → 404,AC-004)。
- 提醒即消息:无人处理保持未读、原始事实未篡改,无过期/特殊已忽略处理
  (R-013/AC-012)。

## 6. 非阻塞观察

1. 半成品接管:代码库原已存在测试、`OpportunityReminderModel`、迁移 0004
   (业务实现缺失,16 红灯)。本次补齐 persistence/application/web 三层。
   属正常接管,无越权。
2. `models.py` 四个 CheckConstraint 因 naming_convention 双重 `ck_` 前缀
   超 63 字节,已改短基名并与迁移 0004 最终名对齐——修复正确,静态核验一致。
3. should-fix 已由执行者自行修复:owner 需 enabled 且具业务/管理员角色,
   否则路由主管,避免死提醒。已补聚焦测试。

## 7. 未验证项(NOT VERIFIED)

- **真实 PostgreSQL**:本地 SQLite 合成验证;迁移链与约束名静态核验通过,
  但真实 PG `alembic upgrade head` + AC 重跑未执行(与既往已接受任务同一约束,
  28 个 gated PostgreSQL 测试 skip)。确切剩余检查:隔离本地 PG 上重跑。
- **浏览器视觉验收**:`/discovery` 页面仅 HTTP 200 + 无泄露检查,未浏览器渲染。

## 8. Decision

1. TASK-0020 在本地合成数据范围内 **ACCEPTED**。
2. OD-005(留存)与 OD-006(发现方法/模型/真实数据外传)仍为 OPEN 单独
   授权门;真实数据发现、外部模型调用、部署均单独受限。
3. 证据即本文件。
