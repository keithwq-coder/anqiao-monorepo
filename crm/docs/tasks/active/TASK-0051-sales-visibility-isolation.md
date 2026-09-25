# TASK-0051: 销售可见性隔离实现（SPEC-0001 v0.9.0）

- Task ID: TASK-0051
- Status: **AUTHORIZED（DEC-0182，2026-08-27 授权）**
- Task type: IMPLEMENTATION（策略层权限变更）
- Approved SPEC: `docs/specs/30-approved/SPEC-0001-core-record-activity.md` (v0.9.0)
- Approval metadata: `docs/specs/30-approved/SPEC-0001-core-record-activity.approval.json`
- Authorization: `DEC-0182`（2026-08-27，产品负责人「批准，授权」）
- Execution owner: Reasonix（用户体验馆）
- Depends on: SPEC-0001 v0.9.0 批准（DEC-0181）

## Goal

按 SPEC-0001 v0.9.0 R-014/R-046 实现「销售可见性完全隔离」：business_user 对
非本人（owner≠本人）且非公池（in_pool=false）的客户记录，由「脱敏可见
（COLLABORATOR）」改为「拒绝（PolicyDenied）」。

## Scope

- `src/crm/policy/projection.py` `resolve_read_access`：business_user 分支，在
  `owner==本人 → OWNER` 之后，仅当 `record.institution.in_pool == True` 时返回
  COLLABORATOR（公池脱敏）；否则 raise `PolicyDenied`。
- shareholder 全局可见分支（在 business_user 之前）不变：赵/武（shareholder+
  business_user）仍全局可见（SPEC-0002 R-008）。
- manager 授权范围分支不变。

## Owned files

- `src/crm/policy/projection.py`
- `tests/`（新增/适应测试）

## Out of scope

- 生产部署、commit、push。
- 前端搜索/筛选增强与销售仪表盘统计修正（可用性审查 P0-2/P0-3，属后续任务）。
- 报表/商机/股东分配等（其他 SPEC/任务）。

## Completion gate

1. `python -m pytest tests -q`（新增隔离测试通过，基线不回退）。
2. `git diff --check` clean。
3. 新测试覆盖：business_user 看不到他人非公池客户；能看到本人客户 + 公池客户；
   shareholder 仍全局可见。
4. 证据文件 `docs/evidence/TASK-0051-*.md`。
