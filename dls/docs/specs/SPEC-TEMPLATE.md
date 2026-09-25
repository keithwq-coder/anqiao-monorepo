# SPEC 模板

```markdown
# SPEC-XXXX · 标题

- 版本：v0.1.0
- 状态：10-draft（本文件位置即状态，approval 后移入 30-approved）
- 日期：YYYY-MM-DD
- 授权：待批准

## 背景与目标
（为什么做、解决什么业务问题，引用 DEC 编号）

## 术语
（用 CONTEXT.md / 手册统一词汇）

## 范围
- 包含：…
- 不包含：…

## 需求（R-xxx）
- R-001 …
- R-002 …

## 验收标准（AC-xxx）
- AC-001 …（可验证的命令或断言）

## 技术要点（PROPOSAL，待确认则标注）

## 开放问题
（阻塞实现的产品决策，逐条列出）
```

**规则**：
1. 需求必须可验证；每个 R 至少对应一个 AC。
2. 状态流转：00-inbox → 10-draft → 20-review → 30-approved → 90-deprecated。
3. 30-approved 才授权代码；实现走 task。
