# TASK-0021 协调员验收证据

- Status: ACCEPTED（本地合成范围）
- Date: 2026-08-10
- Approved SPEC: `SPEC-0003 v0.3.0`
- Authorization: `DEC-0117`
- Acceptance record: `DEC-0118`
- Original implementation owner: DeepSeek
- Remaining P1-1/P2 repair owner: GLM5.2（WorkBuddy）
- Coordinator/auditor: 当前协调员

## 1. 验收范围

本次独立验收覆盖 TASK-0021 的本地合成实现，以及审计发现后的两个剩余问题：

1. P1-1：所有非空受保护值统一使用完整值的子串匹配；短受保护值嵌入长句时同样抑制 AI 文本。
2. P2：纠正旧 evidence 中“短值阈值”和旧测试计数造成的证据偏差。

未修改批准 SPEC、脱敏投影、生产配置，也未调用真实 AI provider、远程数据库或部署流程。

## 2. 独立代码核验

- `src/crm/application/discovery_ai.py` 中不存在 `MIN_PROTECTED_OVERLAP`。
- `LeakageScanner.scan()` 对所有非空 `normalized_value` 执行
  `normalized_value in normalized_text`。
- `test_p1_short_protected_value_embedded_in_long_text_suppressed` 覆盖
  “依据甲乙丙丁判断存在机会”场景。
- `test_p1_short_protected_value_2char_embedded_suppressed` 覆盖 2 字符短值嵌入。
- `test_ac016_short_common_word_not_false_positive` 保留：受保护值为完整的
  `east source B`，AI 文本只含局部前缀 `east`，不会被误判为完整值复述。

## 3. 实际执行证据

```text
python -m pytest tests/test_task0021_discovery_ai_reasoning.py -q
22 passed

python -m pytest tests/test_task0020_opportunity_discovery.py \
  tests/test_task0021_discovery_ai_reasoning.py \
  tests/test_persistence_schema.py -q
45 passed

python -m pytest tests/ -q
341 passed, 28 skipped, 1 warning

python -m py_compile src/crm/application/discovery_ai.py \
  tests/test_task0021_discovery_ai_reasoning.py
passed

alembic heads
0005_opportunity_reminders_ai_reasoning (head)

powershell -ExecutionPolicy Bypass -File scripts/check-governance.ps1
[PASS] Governance structure and gates are consistent.
```

SPEC approval hash recheck:

```text
computed=d53f9d4d8b6616145071f36ca9cb3acd50b419515dab41a668c9ecea19d73cb0
stored=d53f9d4d8b6616145071f36ca9cb3acd50b419515dab41a668c9ecea19d73cb0
match=True
```

## 4. 验收结论

TASK-0021 在 DEC-0117 授权的本地合成范围内通过协调员独立验收。
R-018/AC-016 的短受保护值泄露边界已闭合，TASK-0020 回归与全量套件未出现失败。

## 5. 未验证与非阻塞边界

- 真实 PostgreSQL：NOT VERIFIED；需要独立测试数据库或生产变更授权。
- 真实 AI provider：NOT VERIFIED；OD-006a 仍为独立产品决策。
- 浏览器视觉验收：NOT VERIFIED；不属于本次本地合成验收门。
- 提交级 diff：NOT VERIFIED；当前仓库目标文件为未跟踪状态，无法从 Git HEAD
  形成可靠差异基线。

以上项目不在 TASK-0021 的本地合成完成门内，不阻塞本次 ACCEPTED；它们不得被描述为已通过。

## 6. 后续决策

OD-006a（真实模型/provider）与 OD-005（留存期限）继续保持 OPEN。任何真实数据外发、
数据库迁移、部署或生产配置修改仍需单独明确授权。
