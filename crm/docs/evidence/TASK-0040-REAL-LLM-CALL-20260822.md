# TASK-0040: 真实 LLM 调用验证证据（产品负责人指定端点，2026-08-22）

- Task: TASK-0040（机会商机外部集成 — 真实 LLM 调用腿）
- Spec: `SPEC-0003 v0.4.0`（R-013…R-017、AC-006…AC-008）
- Authorization: 产品负责人即时确认（DEC-0158 门 2）：「确认：读 docs + 发起真实调用」；随后确认「A：扩展 provider 支持 SSE 后重试」
- Execution owner: deepseek-v4-flash-0731
- Date: 2026-08-22
- Status: **真实 reason 生成成功（SSE 适配 + 新 key）**；端点/认证/格式/生成/R-013/审计全链路已验证；待独立评审

## 1. 产品负责人提供的接入信息（值不落盘）

| 项 | 值（记录） |
|---|---|
| Base URL | `http://129.146.135.219:3000/v1`（HTTP 明文，境外 IP 段，产品负责人已确认跨境风险） |
| 教程 | `http://129.146.135.219:8060/docs`（OpenAI 兼容教程页，可读） |
| Key | 运行时环境变量注入，**未写入仓库/证据/日志/审计**；旧 key 配额耗尽后产品负责人提供新 key（2026-08-22），调用成功；建议后续仍定期轮换 |
| Model | `glm-5.2`（`/v1/models` 另有 `deepseek-v4-flash`、`minimax-m3`） |

外发字段（白名单，不变）：`announcement_type, published_at, source_name, source_url, title`
（请求载荷键集合 = 白名单字段名，[VERIFIED] 无客户数据）。

## 2. 已执行的真实请求（时间序）

| # | 请求 | 结果 |
|---|---|---|
| 1 | `GET /v1/models`（Bearer key） | **200**，模型列表 `[deepseek-v4-flash, glm-5.2, minimax-m3]` |
| 2 | `GET /docs`（教程页） | **200**，确认 OpenAI 兼容、`stream=True` 示例 |
| 3 | `POST /v1/chat/completions` glm-5.2，白名单载荷，非流式，60s | ReadTimeout → `ProviderRequestError`（审计 1 条 failure） |
| 4 | 同上，非流式，180s | ReadTimeout → `ProviderRequestError`（审计 1 条 failure） |
| 5 | 非流式小请求 `max_tokens=10`（urllib，30s） | **200 3.1s**，响应体为 SSE 格式（`data: {...}`），非 JSON |
| 6 | 流式 `stream=True, max_tokens=50`（urllib） | **200 6.4s**，`[DONE]` 结束；`completion_tokens=50` 全为 `reasoning_tokens`，`delta.content` 为空 |
| 7 | 流式 `max_tokens=200` | **200**，107 chunks；delta 键 `[content, reasoning, reasoning_details, role]`，`content`/`reasoning` 均空 |
| 8 | 流式 `max_tokens=150`，采样 delta | `reasoning_details=[{"type":"reasoning.text","text":"…","format":"unknown","index":0}]`，文本位于 `reasoning_details[].text` |
| 9 | SSE 客户端重试（选项 A），白名单载荷，`max_tokens=1024` | 首次 10s 超时（provider timeout 未传）；修正后 **403 `call quota exhausted: used=100 limit=100`**（审计 failure） |
| 10 | 隔离诊断 | 确认 403 为**配额耗尽**；**不传 `stream=true` 时端点返回空 SSE（首行即 `[DONE]`）**——端点要求显式流式 |
| 11 | 修复 `SseStreamingHttpClient` 强制 `stream=True`（+max_tokens），新 key（产品负责人更换） | **200，reason 生成成功**：`degraded=False`，reason 1375 字符，R-013 `leak_findings=[]`，审计 1 条 success（模型标识+字段名，无值无 key） |

## 3. 结论（[VERIFIED] 实测）

1. **端点与认证正常**：旧 key 配额耗尽（100/100，403 `pre_consume_token_quota_failed`）；产品负责人更换新 key 后调用成功。
2. **响应格式**：该端点**始终返回 SSE 流**；`glm-5.2` 输出文本位于 `delta.content` 与 `reasoning_details[].text`（两者均需聚合）；**必须显式 `stream=true`，否则流为空**（VERIFIED）。
3. **已实现 SSE 适配**（产品负责人批准选项 A）：`src/crm/ai/provider.py` 新增 `SseStreamingHttpClient`——httpx 流式消费 SSE，请求体强制 `stream=True` + 可选 `max_tokens`，聚合 `delta.content` + `reasoning_details[].text` 为标准 chat-completion JSON；超时/HTTP 错误/空流均转可识别 `ProviderError`。夹具测试 5 项全绿；未改变 provider 既有解析语义、whitelist/leak scan/adjudication/body-size/redirect 语义。
4. **reason 生成成功（真实链路）**：[VERIFIED] 真实载荷（湖南省招标投标管理办法修改公告，白名单字段）→ GLM-5.2 生成 reason 1375 字符 → R-013 泄露扫描 `leak_findings=[]` → 审计 1 条 success（`{"model_identifier":"glm-5.2","outbound_field_names":[...]}`，无值无 key）。AC-006 成功路径触发。
5. **降级与审计正确**：ReadTimeout/403/空流均转可识别 `ProviderError`；每次真实调用写入 exactly one 审计（success/failure 真实）。

## 4. 待办

- **Codex/Qwen3.8-max 独立评审**（未执行，NOT SELF-ACCEPTED）。
- 服务层端到端（`OpportunityService.run()` 接入真实 provider）未在本腿验证（真实调用验证聚焦 provider 适配层）；如需可后续在授权下验证候选持久化 + 展示。
- 生产部署/迁移/真实数据写入未授权、未执行。

## 5. 安全与边界

- key 仅运行时注入，零落盘；本文件不含 key 值。
- 未 commit、未 push、未部署、未迁移、未写真实数据、未自动建档。
- 白名单外发不变；客户数据零外发。
- 未绕过登录、未破解、未伪造。
- 待独立评审，NOT SELF-ACCEPTED。

## 6. 省市站点扩展（2026-08-23，产品负责人指令：「全国各省、地级市招投标网站都必须列入，合法合规采集」）

产品负责人确认：站点范围覆盖全国省级 + 地级市政府公开招投标网站，且必须合法合规采集（DEC-0158 门 2 即时确认：清单来源选项 A「从公开导航页发现并验证」+ 合规采集方式确认）。

### 6.1 方法（不编造 URL，R-017）

1. 抓取**官方导航页**（全国公共资源交易平台 `www.ggzy.gov.cn` 首页 + 可达省级平台首页/导航），正则提取其中 `.gov.cn` 域名 —— 全部为政府官方页面中真实存在的链接，非猜测。
2. 过滤非交易平台（部委官网 `www.mof.gov.cn` 等 106 个厅局站、`www.gov.cn` 门户、备案/统计站），保留交易/采购特征域名（`ggzy`/`ccgp`/`zfcg`/`jyzx`/`jyg`）。
3. 对候选逐一真实抓取验证：`PublicProcurementCrawler(network_allowed=True, fetcher=make_httpx_fetcher())`，8s/6s 超时，低频（间隔 0.8–1.5s）、标识 UA，合规采集。
4. 只保留「可达且解析出公告」的站点列入 `DEFAULT_PUBLIC_SOURCES`。

### 6.2 结果

- 官方导航页发现省级候选 33 → 验证 15 省级 + 2 国家级可达。
- 地级市候选 287（从省级平台页面发现）→ 142 可达 → 过滤非交易平台后 **36 个交易/采购平台可达**。
- 最终 `DEFAULT_PUBLIC_SOURCES`：**38 个站点** = 2 国家级 + 14 省级（含新疆生产建设兵团）+ 22 地市级（合肥/太原/运城/大同/晋中/长治/晋城/贵阳/遵义/毕节/安顺/六盘水/绵阳/阿勒泰/和田/伊犁 + 天津/湖北/陕西/宁波/宁夏政府采购网 + 山东地市入口 + 兵团交易管理）。
- **纠正了此前凭记忆猜测的错误 URL**（真实域名来自官方导航，如：山西 `prec.sxzwfw.gov.cn`、青海 `www.qhggzyjy.gov.cn`、黑龙江 `ggzyjyw.hlj.gov.cn`、宁夏 `ggzyjy.fzggw.nx.gov.cn`、河北 `szj.hebei.gov.cn`、浙江 `ggzy.zj.gov.cn`、兵团 `ggzy.xjbt.gov.cn`）。
- 未达省份（北京/辽宁/吉林/江苏/安徽/福建/江西/河南/湖北/湖南/广东/广西/海南/重庆/云南/西藏/陕西/甘肃）本轮实测不可达或未出现在官方导航页——**如实降级记录，不列入、不编造**（部分站点第一轮曾可达、本轮网络状态变化，如江西/湖南/陕西；北京两轮均 ConnectionError）。

### 6.3 验证

- 新增 `TestDefaultSourcesCompliance`（2 用例）：全部默认源必须通过 `is_government_public_url()`（政府 `.gov.cn`）+ 数量 ≥30 + 含国家级/省级/地市样本。
- 全量 `pytest tests -q`：**`459 passed, 28 skipped`**；compileall exit 0；`git diff --check` exit 0（仅既有 LF/CRLF 警告）；未跟踪文件 whitespace 检查干净；governance `[PASS]`（8 approved SPECs / 39 active tasks）。

### 6.4 边界与待办

- 地级市覆盖依赖官方导航页暴露的入口；未出现在导航页或不可达的省市平台待后续（可提供清单后验证）。
- 真实抓取仅验证可达性与解析质量（低频、合规）；生产调度/频率控制/robots 遵守属部署阶段事项（未授权）。
- 待独立评审，NOT SELF-ACCEPTED。
