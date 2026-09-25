# TASK-0040: 隔离外部集成（provider 适配器 + 外发白名单 + 爬虫适配器 + 审计）实施证据

- Task: TASK-0040（机会商机的外部集成，仅本地隔离范围）
- Spec: `SPEC-0003 v0.4.0`（R-013…R-017、AC-006…AC-010）
- Authorization: `DEC-0158`（OD-006a 解决 + TASK-0040 授权）、`DEC-0159`（执行者 deepseek-v4-flash-0731）
- Execution owner: deepseek-v4-flash-0731
- Review owner: **Codex 独立评审（未执行，本任务不自批）**
- Date: 2026-08-21
- Status: 本地实现与验证完成，**PARTIAL — 待 Codex 独立评审**

## 1. 治理前置（阶段 1）

| 检查 | 结果 | 证据 |
|---|---|---|
| `SPEC-0003-opportunity-discovery.approval.json` SHA-256 vs 当前 SPEC 文件 | `[VERIFIED]` 一致 | `93f92871…f011212`（python hashlib 实测） |
| `docs/specs/SPEC-BASELINE.md` | `[VERIFIED]` `Status: COMPLETE` | 文件第 3-4 行 |
| 基线 `pytest tests -q` | `[VERIFIED]` `356 passed, 28 skipped` | `.venv/Scripts/python.exe -m pytest tests -q` |
| `scripts/check-governance.ps1` | `[VERIFIED]` `[PASS]`（8 approved SPECs / 39 active tasks / 1 legacy manifest） | 脚本输出 |

基线 356 与 `docs/NOW.md` 记录的 395 之差（39 个）来自 `TASK-0039`（DEC-0157 已接受）移除的 legacy v0.3.0 提醒测试，非本次回归。

## 2. 运行时配置状态（不打印值）

- `[VERIFIED]` 本机设置了 `DEEPSEEK_BASE_URL`（https 前缀，24 字符）、`DEEPSEEK_MODEL`（deepseek 前缀，15 字符）、`DEEPSEEK_WIRE_API`（16 字符）。
- 以上仅记录存在性与长度，**值不写入本文件、日志或审计**。
- `[VERIFIED]` 本机 `ALL_PROXY=http://127.0.0.1:7897`；所有测试命令以 `env -u ALL_PROXY -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy` 运行，且**全程零真实网络请求**（无 provider 调用、无爬虫抓取）。

## 3. 实现设计（阶段 2/3/4）

### 3.1 外发白名单组装器 `src/crm/ai/whitelist.py`

- `OUTBOUND_ALLOWED_FIELDS`：`title / body / abstract / source_url / published_at / announcement_type / source_name / fetched_at / retained_until`。
- `assemble_outbound(raw, *, include_body=False)`：只复制白名单字段，其余**组装层即丢弃**；`body`/`abstract` 为分类专用，默认丢弃（`include_body=True` 才保留）。
- `outbound_field_names(payload)`：返回字段名清单（名称非值），供审计。
- `FORBIDDEN_FIELD_MARKERS`：客户名/电话/联系方式/跟进正文/CRM 备注/证据/凭据/API key/口令/令牌等字段名一旦出现即被丢弃（DEC-0158 point 4）。

### 3.2 DeepSeek provider 适配器 `src/crm/ai/provider.py`

- `DeepSeekProvider(base_url=, model=, api_key=, timeout_seconds=, http_client=, network_allowed=, on_outbound=)`：
  - endpoint/model/key **只从运行时环境变量读取**（`DEEPSEEK_BASE_URL`/`DEEPSEEK_MODEL`/`DEEPSEEK_API_KEY`，兼容本机 `DEEPSEEK_WIRE_API` 作为 key 回退）；显式参数优先（测试用）。
  - `is_configured`：三要素齐全才为 True；未配置时 `generate_reason` 返回 `ProviderResult(degraded=True)`，**绝不发起请求**。
  - `network_allowed` 默认 **False（失败关闭）**：即使配置齐全也不真实调用，除非显式打开 + 产品负责人执行时即时确认（DEC-0158 point 5）。
  - 可注入 `http_client`（测试用合成 fake；契约：`post(url, json=, headers=, timeout=)` → `status_code`/`text`）。
  - 超时 → `ProviderTimeoutError`；非 JSON/缺字段/超长（>64k 字符）→ `ProviderMalformedResponseError`；非 200 → `ProviderRequestError`；均为可识别异常，由服务层降级。
  - 请求体仅含白名单组装后的 payload（`assemble_outbound`），`Authorization: Bearer <key>` 只出现在发送时，永不落库/日志/审计。

### 3.3 公开来源爬虫适配器 `src/crm/ai/crawler.py`

- `PublicProcurementCrawler(sources=, fetcher=, network_allowed=, retention_days=30, timeout_seconds=)`：
  - 只抓**公开招投标/采购公告**源；无认证/私有/客户/联系数据源（DEC-0158 point 2）。
  - 选定公开站点（实施边界内选定并记录，本次**不真实抓取**，未验证可达性）：
    - 全国公共资源交易平台 `https://www.ggzy.gov.cn`
    - 中国政府采购网 `https://www.ccgp.gov.cn`
    - 中国招标投标公共服务平台 `http://www.cebpubservice.com`
  - `fetch_announcements()` → `CrawlResult(announcements, degraded, degraded_reason)`：任一来源超时/传输失败/解析失败 → 该来源降级；全部失败 → 空结果 + 本地确定性理由（`timeout`/`parse failure`/`not allowed`），**不伪造来源**（R-017）。
  - `list_external_subjects()` 返回 `NormalizedAnnouncement`（鸭子类型兼容旧 dict fake，`to_subject_dict()` 提供 `name/category/region/source_reference` 投影）。
  - 规范化公告带 `fetched_at` + `retained_until = fetched_at + 30 天`（DEC-0152 / OD-001）。
  - `network_allowed` 默认 False；`fetcher` 可注入（测试用合成）。

### 3.4 审计 `src/crm/ai/audit.py`

- `record_ai_outbound(audit_repository, *, model_identifier, outbound_field_names, …)`：action `opportunity.ai_reason.outbound`，`reason` 为 JSON 摘要 `{"model_identifier": …, "outbound_field_names": […]}`（**字段名非值**；无 API key、无完整载荷，R-014/AC-008）。
- `record_crawler_fetch(...)`：action `opportunity.crawler.fetch`，仅来源名 + 降级状态（来源溯源，非伪造）。
- 单一可审计外发路径（R-016）：provider 的 `on_outbound` 回调在**请求发出前**触发审计。

### 3.5 接线 `src/crm/ai/wiring.py`

- `build_reason_generator(...)`：环境变量缺失/未配置 → 返回 `None`（全链路保持合成桩默认行为）；否则返回 `provider.generate_reason`，可选绑定审计 recorder。
- `build_crawler_source(...)`：`fetcher` 未注入且 `CRM_CRAWLER_ENABLED` 未开 → 返回 `None`；否则构造爬虫适配器（网络门默认关闭）。
- 路由 `_build_opportunity_service`（`src/crm/web/routes/discovery.py`）新增 `opportunity_crawler_reason_generator` 注入点（与既有 `reason_generator` 隔离），默认 `None` → 现有合成行为不变。

### 3.6 `OpportunityService`（`src/crm/application/opportunity.py`）

- 新增 `crawler_reason_generator` 注入点（真实 provider 路径；输入 `NormalizedAnnouncement` 或旧 dict）。
- 新增 `_apply_reason(...)`：统一 R-013 处理 —— 无 generator → 默认合成理由（ai_used=True, model=synthetic-stub）；generator 返回 str → 扫描；返回 `ProviderResult` → 降级则用默认合成理由，正常则扫描模型文本；**扫描命中（电话号形态/受保护值回显）→ 抑制 AI 文本、回退本地确定性理由（ai_used=False, model=None）**（AC-006）。
- crawler 分支同样过 R-013；30 天留存由 `expires_at = now + 30d` 保持。
- 人工裁定语义不变：不自动建客户、不自动进公池（R-003/AC-003）；采纳 crawler 新主体才进公池（R-008）。

## 4. 夹具测试（阶段 5）

新增两个测试文件：

- `tests/test_task0040_external_integration.py`（22 用例）
  - 白名单强制：禁止字段（客户名/电话/联系方式/跟进正文/CRM 备注/证据/api_key/凭据）在组装层被丢弃；body/abstract 默认丢弃、`include_body=True` 保留；字段名清单只含名称。
  - provider 失败关闭：未配置绝不调用；网络门关闭绝不调用；配置+门开只发送白名单载荷（请求体无电话值、无 key）；超时/非 JSON/超长 → 可识别异常。
  - 审计：只含模型标识 + 字段名清单（无值、无 key）；爬虫抓取审计仅来源溯源。
  - 爬虫：JSON 解析、畸形返回 None、30 天留存、门关降级空、超时降级、解析失败降级不伪造、成功规范化。
  - wiring：环境缺失 → `None`（合成桩保留）；配置但门关 → 降级不调用。
- `tests/test_task0040_service_integration.py`（4 用例）
  - 爬虫适配器 → 候选 30 天留存、状态「待处理」、运行不建客户。
  - AI 理由含电话号 → 抑制并回退本地确定性理由（AC-006，`ai_used=False`）。
  - provider 降级 → 合成默认理由（`ai_used=True, model=synthetic-stub`）。
  - 人工裁定语义不变：待处理 → 人「采纳」才进公池。

## 5. 全量验证结果

| 命令 | 结果 |
|---|---|
| `pytest tests -q`（聚焦新增 26 用例） | `[VERIFIED]` 26 passed |
| `pytest tests -q`（全量） | `[VERIFIED]` **`382 passed, 28 skipped`**（基线 356 + 新增 26，无回归；跳过项为 PostgreSQL 门控测试） |
| `python -m compileall -q src tests migrations` | `[VERIFIED]` exit 0 |
| `git diff --check` | `[VERIFIED]` exit 0（仅 LF/CRLF 警告，无空白错误） |
| `scripts/check-governance.ps1` | `[VERIFIED]` `[PASS]`（8 approved SPECs / 39 active tasks） |

## 6. 安全与边界确认

- **零真实外部调用**：本任务未发起任何 DeepSeek API 请求、未抓取任何公开站点；所有 HTTP/fetcher 均为合成 fake；`network_allowed` 默认关闭双重保证（`[VERIFIED]` 测试断言 fake 未被调用）。
- **密钥处理**：`DEEPSEEK_WIRE_API`/`DEEPSEEK_API_KEY` 值从未打印、从未写入仓库文件、日志或证据文档；provider 仅保留在实例内存并用于 Authorization 头。
- 未 commit、未 push、未部署、未迁移、未写入真实数据、无外部写入。
- 环境变量缺失时全链路保持现有合成桩默认行为（`[VERIFIED]`：`build_reason_generator()` → None、`build_crawler_source()` → None、现有 382 测试全绿含 `test_module_boundaries` 的 `AI_ENABLED is False`）。

## 7. 未验证 / 待办

- **Codex 独立评审**：未执行；本任务不自批，任务卡状态为 PARTIAL 待评审。
- 真实外部调用：未验证、未授权执行；需 (a) 产品负责人轮换已暴露的 DeepSeek API key 并以运行时环境变量提供新值；(b) 执行时即时确认；(c) Codex 独立评审；真实抓取还需爬虫 `network_allowed` 显式打开 + 站点可达性验证。
- 生产迁移/部署/真实数据变更：未授权、未执行。
- 爬虫站点可达性与解析质量（真实 HTML/JSON 形态）：本次仅合成夹具验证，未做真实站点验证。

## 8. 变更文件清单

新增：
- `src/crm/ai/whitelist.py`
- `src/crm/ai/provider.py`
- `src/crm/ai/crawler.py`
- `src/crm/ai/audit.py`
- `src/crm/ai/wiring.py`
- `tests/test_task0040_external_integration.py`
- `tests/test_task0040_service_integration.py`
- `docs/evidence/TASK-0040-EXTERNAL-INTEGRATION-20260821.md`（本文件）

修改：
- `src/crm/application/opportunity.py`（`crawler_reason_generator` 注入点 + `_apply_reason` 统一 R-013）
- `src/crm/web/routes/discovery.py`（装配 `opportunity_crawler_reason_generator`）
- `docs/tasks/active/TASK-0040-opportunity-external-integration.md`（状态 → PARTIAL）
- `docs/tasks/TASKS.md`（TASK-0040 行状态同步）
