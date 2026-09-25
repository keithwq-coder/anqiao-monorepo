# DRAFT — TASK-0041: TASK-0040 生产落地（真实抓取 + 真实 LLM + 生产部署）

- 状态：**DRAFT — 未授权**（本文件为草稿，非正式任务卡）
- 经产品负责人授权后：转 `docs/tasks/active/TASK-0041-*.md` 并记入
  `DECISION-LOG.md` 为 `DEC-0162`
- 起草：zcode / GLM-5.2（2026-08-23），基于 TASK-0040 接受结论（DEC-0161）

## 1. 已验证事实（来源）

- `TASK-0040` 已接受（`DEC-0161`，2026-08-23）：本地隔离集成验证通过。
  新增 `src/crm/ai/{whitelist,provider,crawler,audit,wiring}.py` +
  `opportunity.py` 装配 + `discovery.py` 路由；**无新增迁移**；依赖仅
  `httpx==0.28.1`（本就在依赖表内）。
- 真实外部执行与生产部署仍属**未授权**（`DEC-0158`/`DEC-0159` 边界）；
  W5/G7/V1/R2 各自需独立授权。
- [VERIFIED — `NOW.md` / `TASK-0028B-PRODUCTION-RUNTIME-DEPENDENCY-INVENTORY`]
  生产运行时存在未解决的依赖不一致：`pip check` FAILED（确定性：
  `fastapi 0.141.0` 要求 `starlette>=0.46.0`，运行时为 `starlette 0.44.0`）；
  `python-multipart` NOT_FOUND。`TASK-0027` 曾在此前置条件上 fail-closed 阻断。
  => **部署新代码前必须先做依赖对账**（TASK-0028/0029 分析已完成，修复未授权）。
- `SPEC-0003 v0.4.0`（DEC-0153 批准）覆盖商机发现行为；`SPEC-0012 v0.2.0`
  （DEC-0042 批准）覆盖云部署，但"实际部署需构建应用 + 单独授权"。

## 2. 范围（建议，按相位独立授权）

| 相位 | 内容 | 是否触碰生产服务/库 | 前置 |
|---|---|---|---|
| P0 | 生产依赖对账（修复 starlette/fastapi 不一致 + 补 python-multipart） | 是（仅 venv/依赖，不做业务迁移） | 需单独授权；**禁止就地 venv 手术**（TASK-0028C 提议：隔离重建后切换） |
| P1 | 真实外部执行：真实站点抓取 + 真实 LLM reason | 否（受控环境，不碰生产服务/库） | OD-006a provider 选定；运行期环境变量密钥；执行前即时确认（DEC-0158 门2） |
| P2 | 生产部署：构建、传输、Alembic upgrade head、重启 anqiao-crm systemd | 是 | P0 完成；nginx/TLS/DNS 不变 |
| P3 | 验收：G7 正式签署 + V1 验证/端口收紧 + R2 产品负责人业务/视觉验收 | 否（验证） | P2 完成 |

## 3. 前置条件（当前均未授权）

- **P0 生产依赖对账**：修复 starlette/fastapi 不一致 + 补 python-multipart；
  按 TASK-0028C 的提议，在隔离环境重建可复现依赖后切换服务，不做就地 venv 手术。
- **OD-006a provider 选定**：真实 LLM 端点与密钥来源（产品负责人点名，或委托 AI 提议后由你定）。
- **密钥治理**：旋转后仅经运行期环境变量提供；零落盘（DEC-0158 / AGENTS.md §8）。

## 4. 验证

- P0：生产 `pip check` 退出 0；`import` 清单完整；无业务行为变更。
- P1：真实调用审计记录（模型标识 + 字段名，无值无 key）；R-013
  `leak_findings=[]`；超时/402/配额耗尽降级路径诚实落库。
- P2：服务 active、health 通过、HTTPS 可达；`compileall` 0、`git diff --check`
  干净、governance `[PASS]`；无新迁移或仅既有 `0012`/`0013` applied。
- P3：G7/V1/R2 各自验收证据齐备。

## 5. 边界（不改）

- 不出境敏感字段；无自动建客户 / 自动采纳；人裁定必须；密钥零落盘；
  无 commit / push 除非另行授权；真实调用遵守 DEC-0158 门2 即时确认。

## 6. 建议的 DEC-0162（草稿，待产品负责人逐条确认后由我正式记入 DECISION-LOG）

> 产品负责人授权 `TASK-0041`（TASK-0040 生产落地），按 P0→P1→P2→P3 相位
> 独立授权；P2 前置 P0 依赖对账完成；真实调用遵守 DEC-0158 门2 即时确认；
> OD-006a provider 由产品负责人选定；不打开 OD-006a 之外的 provider 商务；
> 无 commit / push 除非另行授权；G7/V1/R2 各自独立验收。

## 7. 风险与不确定性（如实）

- 生产运行时当前状态**未验证**为健康；P0 是真实阻断项，跳过会重演 TASK-0027 的
  fail-closed。
- 真实 provider 端点/密钥/费用：需产品负责人提供或确认；不替代你做商务决策。
- 本草稿不记录任何已发生决策；仅在你明确授权后我才写入 DECISION-LOG 与 active 任务卡。
