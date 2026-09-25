# 编排协议 · 双角色 md 协同

## 角色分工

| 角色 | 模型 | 职责 | 产出物 |
|---|---|---|---|
| 架构师 | deepseek-v4-pro | 定口径、写 SPEC、拆 TASK、审核验收、记录决策 | `docs/specs/` `docs/decisions/` `docs/tasks/`、裁决 |
| 实现者 | v4-flash | 读 TASK 卡、按 SPEC 实现、写证据 | `channel/` `tests/` `migrations/`、`docs/evidence/` `docs/handoffs/` |

## 核心原则

1. **md 是唯一共享记忆**：聊天上下文、模型记忆不是事实来源；所有事实、决策、任务、证据都落 md。
2. **一个 task 同一时刻只有一个实现者**；文件归属在 TASK 卡中声明，避免并发写冲突。
3. **架构师只写规格与裁决，不替实现者写代码**（除非 TASK 卡显式授权架构师亲自实现）。
4. **审核独立复核**：不信任实现者自述"通过"，架构师自己跑验证命令看输出。

## 编排循环（每个 TASK）

```
架构师：SPEC 批准 → 写 TASK 卡（docs/tasks/active/，声明 SPEC/范围/归属文件/验收命令）
   ↓
实现者：读 AGENTS.md + 对应 SPEC + TASK 卡 → TDD 实现 → 写 evidence（docs/evidence/TASK-XXXX-*.md）
   ↓
架构师：读 evidence → 独立跑验证命令 → 写裁决（ACCEPTED / REVISE + 理由）进 DECISION-LOG 与 TASK 卡
   ↓
ACCEPTED → TASK 卡移入 docs/tasks/closed/；REVISE → 回实现者，同卡迭代
```

## 文档流转

| 状态 | 位置 | 谁写 | 谁读 |
|---|---|---|---|
| SPEC | 00-inbox → 10-draft → 20-review → 30-approved → 90-deprecated | 架构师 | 双方 |
| 决策 | DECISION-LOG | 架构师 | 双方 |
| 任务卡 | tasks/{proposed,active,closed} | 架构师 | 实现者 |
| 证据 | docs/evidence/ | 实现者 | 架构师 |
| 交接 | docs/handoffs/ | 实现者 | 下一实现者 |

## 审核通过标准

- 证据给出**可复现的验证命令 + 真实输出**；"通过" = 真跑过（静态检查 ≠ 测试 ≠ 生产验收）。
- 架构师复核后，在 DECISION-LOG 记 `DEC-XXXX` 写明 ACCEPTED 或 REVISE 及理由。
- 未验证项（需另一环境/人工）在 evidence 里显式列出，不算通过。

## 同会话 /model 切换（v4-pro ↔ v4-flash）

同一会话窗口内用 `/model` 切换模型时：

1. **切换前必须落盘**：结论写进 evidence / 更新 TASK 卡状态；未落盘的结论在切换后视为不存在。
2. **切换后先读盘**：读 `项目约束.md` + `AGENTS.md` + `docs/tasks/active/` 最新卡 + 最新 evidence，**不依赖聊天记忆**。
3. **每次切换 = 一次 mini-handoff**：给下一个模型一句明确的指向（"读 TASK-XXXX 卡并执行/审核"），不靠上下文续接。
4. 卡状态与证据以磁盘为准，聊天里说的与磁盘不一致时以磁盘为准。

## 批量编排 · 审计检查点 · 任务自检

1. **多编排**：架构师一次性排出整条 pipeline（多张 TASK 卡，proposed 状态），卡与卡之间用依赖关系连接，实现者不等卡。
2. **审计检查点**：pipeline 中标出"关键节点"（算钱 / 定 schema / 综合验收），实现者到点即停，架构师审计通过才把下一段转 active。
3. **任务自检**：每张卡内置"自检清单"（确切命令 + 金样本断言），实现者交证据前**必须自跑自检并附真实输出**；自检不过不许交。
4. **卡状态**：一次只激活一段（active），其余 proposed；审计点通过后架构师把下一段转 active。
