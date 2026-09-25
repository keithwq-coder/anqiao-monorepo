# HANDOFF-20260821-DEEPSEEK-V4-FLASH-0731-TASK-0040-REAL-EXTERNAL

- Task: TASK-0040 — 真实外部调用阶段（public-source crawl + DeepSeek real call）
- From tool/model: deepseek-v4-pro（编排）
- To tool/model: deepseek-v4-flash-0731（新会话，执行）
- Handoff status: HANDOFF-ONLY
- Repository state: `uncommitted` worktree（zero-commit 惯例）
- Written at: 2026-08-21 local time (UTC+8)

## 给新会话的提示词（整段复制给 deepseek-v4-flash）

你是 deepseek-v4-flash-0731，中科安樵 CRM 项目 TASK-0040 的执行者（DEC-0159）。
本阶段由 deepseek-v4-pro 编排，你负责**真实外部调用阶段的实现与验证**。
独立评审仍是 Codex，你不自批。

项目位置：D:\Project\中科安樵\crm

## 必读启动序列（按顺序读完再动手）

1. `AGENTS.md`
2. `docs/NOW.md`、`docs/PROJECT.md`、`docs/specs/INDEX.md`、`docs/specs/SPEC-BASELINE.md`
3. `docs/decisions/DECISION-LOG.md`（DEC-0158 授权与边界、DEC-0159 执行者任命）
4. `docs/tasks/active/TASK-0040-opportunity-external-integration.md`
5. `docs/evidence/TASK-0040-EXTERNAL-INTEGRATION-20260821.md`（本地实现证据）
6. 现有代码：`src/crm/ai/{whitelist,provider,crawler,audit,wiring}.py`、`src/crm/application/opportunity.py`

## 当前状态（已由评审确认）

本地隔离实现已完成并通过独立复核：白名单、provider 失败关闭、审计只记字段名、
爬虫降级、30 天留存、人工裁定、密钥零落盘，全量 `383 passed, 28 skipped`。
已修复 provider 异常在 `_apply_reason` 层的降级缺口。

## 本阶段任务：真实外部调用（产品负责人已授权进入，但仍守下面的即时确认门）

1. **真实站点解析适配器（新增实现）**：现有 `crawler.parse_announcement_payload`
   只支持 JSON 或「首行即标题」纯文本；真实政府招投标站点返回 HTML。为已记录
   的公开站点实现 HTML/列表页解析（提取 `title/abstract/published_at/
   announcement_type/source_url`），保持解析失败降级、不伪造来源（R-017）。
   站点：全国公共资源交易平台 ggzy.gov.cn、中国政府采购网 ccgp.gov.cn、
   中国招标投标公共服务平台 cebpubservice.com（都是公开、免登录公告页）。
2. **真实抓取验证**：用 `network_allowed=True` 的 crawler 抓取选定站点，验证
   解析质量与可达性；外发字段仍走白名单（只发公告标题/摘要/URL/时间/类型/
   审计元数据）。
3. **真实 DeepSeek 调用验证**：用 `network_allowed=True` 的 provider 发起一次
   真实调用，验证 reason 生成 → R-013 泄露扫描 → 审计记录（只记模型标识 +
   字段名清单）。
4. **证据记录**：写 `docs/evidence/TASK-0040-REAL-EXTERNAL-CALL-2026MMDD.md`，
   记录真实请求/响应的**脱敏结构**（不存 key、不存完整敏感载荷、不存客户数据）。

## 硬门（违反任何一条即执行失败，立即停下报告）

- **即时确认门（DEC-0158 门 2，不可绕过）**：在你准备发出每一次真实网络请求
  （DeepSeek 调用或站点抓取）之前，先停下来向产品负责人做一次即时确认，明确
  说明：将向哪个端点/站点发送、外发哪些字段、是否付费/跨境。得到「确认」后才
  发。不要一次性把所有真实请求连续发完，至少第一次调用要先确认。
- **key 轮换确认**：发真实 DeepSeek 请求前，向产品负责人确认其已轮换暴露的
  key，且新 key 在运行时环境变量 `DEEPSEEK_API_KEY`（或回退
  `DEEPSEEK_WIRE_API`）中。你绝不打印、不写入仓库/日志/证据。
- 白名单不变：绝不外发客户姓名、电话、联系方式、跟进正文、CRM 备注、证据、
  凭据。
- 失败/超时/反爬/动态页/验证码：一律降级并记录，**不绕过登录、不破解验证码、
  不伪造数据**（R-015/R-017）。
- 不 commit、不 push、不做生产部署/迁移/真实数据写入；不自动建档。
- 本机 `ALL_PROXY` 指向 7897：联网前先确认该代理是否可用；不可用则
  `unset ALL_PROXY HTTP_PROXY HTTPS_PROXY http_proxy https_proxy` 直连。
- 不自批：完成后标注「待 Codex 独立评审」。

## 验证与收尾

- 本地新增/改动代码后跑：`pytest tests -q`、`python -m compileall -q src tests
  migrations`、`git diff --check`、`scripts/check-governance.ps1`。
- 真实调用结果单独作为「真实外部调用」证据腿记录，与本地测试成功分开，不得混称。
- 更新任务卡与 TASKS.md 的 TASK-0040 状态；若真实调用未获确认或失败，如实记录
  为降级/未执行，不得假装成功。
