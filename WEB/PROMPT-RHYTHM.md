# SPEC-first 提示词节奏（编排索引）

> 给人看的项目推进图。执行时只把对应 `PROMPT-*.md` 里 `====` 之间的内容贴给目标模型。  
> **唯一业务依据始终是 `SPEC.md`。** 提示词不得扩大 §10「明确不做」。

## 当前闸门

| 项 | 状态 |
|---|---|
| Phase 1 实施（§4–§5 + §9） | ✅ 已闭合 · baseline `e547e0a` |
| 独立审阅 F1–F10 + R1/R2 | ✅ 已闭合 |
| **Phase 2 入口：业主回填包** | ⏳ **当前闸门** · 缺 `OWNER-FILL-PACK.md` |
| Phase 2 回填 + B2 筛选等解锁 | ⏸ 等回填包 |
| 部署前必办（限速/验证码） | ⏸ 公网部署前另开阶段 · **非** Phase 2（见 SPEC §2.1/§2.3/§10） |

## 提示词链路（按序）

```
① PROMPT-for-deepseek.md / PROMPT-deepseek-implement.md
   → Phase 1 从零实施（已完成，勿重跑）

② PROMPT-opus5-review.md
   → 对抗式审阅（已完成）

③ PROMPT-gpt5.6sol-review.md
   → F1–F10 定点复核（已完成）

④ PROMPT-owner-fill-pack.md          ← 【现在贴这个】
   → 产出根目录 OWNER-FILL-PACK.md（可分批、可留空）
   → 模板骨架：OWNER-FILL-PACK.template.md（复制改名填写亦可）

⑤ PROMPT-deepseek-phase2.md
   → 输入：OWNER-FILL-PACK.md
   → 只回填有值字段；B1-2 有 scenes 后才做 §5.2 筛选
   → 无回填包则只出阻塞报告、零代码

⑥ （可选）复用 ② 精简版做 Phase 2 回归审阅
```

## 推进规则

1. **闸门未开不写业务代码**：无 `OWNER-FILL-PACK.md`（或包内全是「暂不填」）时，禁止改 `src/data/*` 业务字段。
2. **回填包字段 ⊆ TODO 清单**：不得增加 SPEC 未列字段。
3. **空值合法**：业主写 `暂不填` / 删行 / 留模板默认空 = 保持 `PENDING`，不算失败。
4. **解锁对照**（来自计划阻塞点）：

| 回填包有内容时 | 执行方动作 |
|---|---|
| B1-1 model/officialName | 写 products 10/11 |
| B1-2 scenes / devices | 写对应字段；**并**可开工 B2 筛选 |
| B1-3 团队可公开文案 | 改 about 团队区 |
| B1-4 电话邮箱 ICP | 写 company.ts |
| B1-5 新闻 date/body | 写 news.ts（凯健红线） |
| B3 value | 写 solutions value |
| B4 customers 等 | 写或按业主「本期不做」删区块 |
| F10 两项口径 | 仅业主二选一后改文案 |

5. **git**：执行方不 commit；编排方在阶段闭合后提交。

## 你（编排方）此刻要做的事

1. 把 **`PROMPT-owner-fill-pack.md`** 的 `====` 段交给：业主本人，或「只负责问询、禁止编造」的助手会话。  
2. 得到 `OWNER-FILL-PACK.md` 后，连同 **`PROMPT-deepseek-phase2.md`** 开新窗口给 DeepSeek。  
3. Phase 2 验证通过后再考虑公网部署阶段（新 SPEC/新提示词，不在本文件 Phase 2 内）。
