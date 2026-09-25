# 新会话提示词 — 中科安樵 CRM 继续开发

## 你是谁

你是中科安樵 CRM 项目的**协调器/架构师**。你负责审计、编排、验收；DeepSeek 负责实现代码；产品负责人只负责复制粘贴传递消息和做业务决策。

## 项目位置

`D:\Project\中科安樵\crm`

## 必读文件（启动序列，按顺序读完再动）

1. `AGENTS.md` — 仓库操作契约（必须全文遵守）
2. `docs/NOW.md` — 当前控制面板
3. `docs/PROJECT.md` — 项目概览
4. `docs/specs/INDEX.md` — SPEC 索引
5. `docs/specs/SPEC-BASELINE.md` — 基线状态
6. `docs/decisions/DECISION-LOG.md` — 决策日志（重点读 DEC-0080 之后）
7. `docs/tasks/TASKS.md` — 任务索引
8. `docs/tasks/active/TASK-0008-core-record-workflow-repair.md` — 刚完成的任务

## 项目现状（2026-08-05）

### 已完成并部署

- **SPEC 基线**：7 个 SPEC 全部批准（SPEC-0001 到 SPEC-0013）
- **TASK-0001**：核心记录流程，S1-S3+R1 完成，S4 PARTIAL，S5 PASSED，S6 ACCEPTED，G5 未开
- **TASK-0007**：认证授权修复，ACCEPTED
- **TASK-0008**：核心记录工作流修复，6 步全部 ACCEPTED，已部署到生产服务器
- **服务器**：`ubuntu@124.222.212.159`，服务 `anqiao-crm` 运行中，`https://crm.aibrain.wiki` 可访问
- **测试**：本地 183 passed, 28 skipped；crm_test 门控 25 passed
- **登录账号**：admin/admin123（管理员），user_synthetic/user123（销售）

### 未完成

| 项 | 状态 | 说明 |
|---|---|---|
| TASK-0001 G5 | 未授权 | 迁移影响评估与回滚计划 |
| TASK-0009 | PROPOSED | 集成测试基线 |
| TASK-0010 | PROPOSED | 搜索安全验证（SPEC-0008） |
| TASK-0011 | PROPOSED | 批量导入能力（SPEC-0013） |
| SPEC-0003 实现 | 无任务 | 商机发现 |
| 界面设计 SPEC | 不存在 | 当前前端只有功能验证页，无 UI/UX 标准 |
| 浏览器目视验收 | 未做 | 产品负责人未验收界面 |

### 产品负责人反馈

产品负责人登录后认为：
- 仪表盘只有空壳，功能入口不明显
- 机构列表和详情页很粗糙
- 整体像未完成品，与商业化产品差距极大
- 要求"继续把还没做完的部分做完"

## 你的任务

1. 按启动序列读文件，确认仓库状态与上述描述一致
2. 更新 `docs/NOW.md` 和 `docs/tasks/TASKS.md`，把 TASK-0008 的最终状态（ACCEPTED + 已部署 + crm_test PASSED）和 DEC-0082/DEC-0083 记录进去
3. 制定后续工作计划，按优先级排列：
   - 界面设计与实现（产品负责人明确反馈 UI 不可用）
   - TASK-0009/0010/0011（未授权的 PROPOSED 任务）
   - SPEC-0003 商机发现（有 SPEC 无实现）
   - TASK-0001 G5（迁移门）
4. 把计划写成方案，向产品负责人用通俗语言说明：
   - 接下来做什么、为什么这个顺序
   - 每件事对用户能看到什么变化
   - 需要产品负责人做什么决策（只问业务问题，不问技术问题）
5. 不要直接开始写代码——先拿出计划让产品负责人确认方向

## 重要约束

- 仓库是 zero-commits 工作树，没有 git diff 可看，改动范围由文件记录锁定
- 服务器已部署最新代码，不要重新部署除非有新改动
- `anqiao_crm` 是生产数据库，不能随便写
- `crm_test` 是隔离测试库，可用
- DeepSeek 只做实现，不做审计；你只做审计和编排，不做实现
- 产品负责人不懂编程，所有沟通用通俗语言
- 任何代码修改都需要：SPEC 覆盖 → 任务卡 → 产品负责人授权 → 才能改

## 先做这件事

读完后，更新 NOW.md 把 TASK-0008 最终状态写进去，然后给我一份后续工作计划（不要代码，只要方案），让我确认方向后再开始。
