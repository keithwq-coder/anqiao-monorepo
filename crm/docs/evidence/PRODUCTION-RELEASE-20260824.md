# 正式发布到生产 — evidence (2026-08-24)

- Executor: reasonix（2026-08-24 会话）
- Authorization: 产品负责人 2026-08-24 对话「正式发布到生产」「直接发布到服务器，
  不走远程仓库」；AI 理由模式选择「付费真实版」（真实 AI 模型生成商机推荐理由）。
- Scope: 生产 `crm.aibrain.wiki`（`/opt/anqiao-crm`，SSH `bri-server`）。
- 结果: **发布成功；真实 AI（glm-5.2）理由生成已启用并验证通过。**

## 发布前发现的漂移与修复

1. **main.py 反向漂移**：仓库 `httpx.Client(timeout=30.0)` vs 生产热修复
   `120.0`（TASK-0041 P1 修复未入库）。本地改为 `120.0` 并提交（`ecee7fa`）。
2. **真实超时根因（本次发布验证发现）**：`AiReasonProvider` 默认
   `DEFAULT_TIMEOUT_SECONDS=10.0`，provider 请求级 timeout 覆盖了
   `httpx.Client(timeout=120.0)`；网关完整生成需要 >10s（短探针 7.8s）。
   `build_reason_generator` 新增 `timeout_seconds` 参数，生产接线传 `120.0`
   （提交 `fb8a113`）。发布验证中前 2 次尝试因此超时并被审计如实记为
   `failure`（R-014 真实性保持）。

## 发布执行步骤（实际运行）

| # | 动作 | 结果 |
|---|---|---|
| 1 | 服务器备份 | `/tmp/anqiao-crm-pre-release-20260824-233412.tar.gz`（src/migrations/templates/deploy） |
| 2 | 同步代码 | `git archive HEAD src/crm migrations templates deploy/start.sh` 解压到 `/opt/anqiao-crm`；`config.py` 现为 `allow_enabled_ai`、`main.py` timeout=120、`start.sh` 含 ai.env 加载 |
| 3 | 启用真实 AI | `ai.env` 追加 `AI_ENABLED=true`（备份 `/tmp/ai.env.bak-release-20260824`）；ai.env 现有 7 个变量名，权限 600 保持 |
| 4 | 环境核对 | `pip check` → No broken requirements；DB `alembic_version` = `0013_drop_legacy_opportunity_reminders`（head，无需新迁移）；重启后 PID 环境含 `AI_ENABLED` + `CRM_AI_REASON_*` + `CRM_CRAWLER_*` |
| 5 | 重启 + 健康 | `sudo systemctl restart anqiao-crm` → `active`；`/health` → HTTP 200 |
| 6 | 真实 AI 调用验证 | `build_reason_generator`（真实环境 + 120s）→ `degraded=False`、`model_identifier=glm-5.2`、返回 379 字中文推荐理由；审计行 `outcome=success`、`reason={"model_identifier":"glm-5.2","outbound_field_names":["published_at","source_url","title"]}`（无内容、无密钥） |

## 安全与合规

- 审计 `audit_events` 只含模型 ID + 出站字段名列表（R-014/R-016）；密钥
  `CRM_AI_REASON_API_KEY` 仅存在于 `shared/ai.env`（600）与运行 PID 环境，
  未进入仓库/日志/证据/审计。
- SSRF 白名单（`.gov.cn` only）+ `is_government_public_url` 前检不变；
  `CRM_CRAWLER_ENABLED=true` / `CRM_CRAWLER_NETWORK_ALLOWED=true` 使公开
  招投标爬虫保持真实抓取（与 TASK-0041 P1 验证一致）。
- 回滚：文件 `/tmp/anqiao-crm-pre-release-20260824-233412.tar.gz`、
  ai.env `/tmp/ai.env.bak-release-20260824`、DB 未变更（无迁移）。

## Not verified

- 付费计费情况（真实 API 调用按量计费，由产品负责人/平台侧确认）。
- 后续每次商机候选生成的真实调用质量（本次验证 1 次 success）。
- G7/V1/R2 门仍为产品负责人验收事项（本次为发布执行，非正式验收门）。
