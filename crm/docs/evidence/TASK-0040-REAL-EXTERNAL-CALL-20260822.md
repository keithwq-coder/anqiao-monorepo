# TASK-0040: 真实外部调用验证证据（真实抓取 + 真实 DeepSeek 调用）

- Task: TASK-0040（机会商机外部集成 — 真实外部调用腿）
- Spec: `SPEC-0003 v0.4.0`（R-013…R-017、AC-006…AC-010）
- Authorization: `DEC-0158` 门 2 即时确认（2026-08-21/22 产品负责人即时确认）、`DEC-0159`
- Execution owner: deepseek-v4-flash-0731
- Review owner: **Codex 独立评审（未执行，本任务不自批）**
- Date: 2026-08-22
- Status: 真实外部调用已执行；**DeepSeek 调用返回 402 已如实降级**；待 Codex 评审

> 与本地实现证据（`TASK-0040-EXTERNAL-INTEGRATION-20260821.md`）分离：
> 本文件只记录**真实网络请求**腿，不混称本地测试成功。

## 1. 产品负责人即时确认记录（DEC-0158 门 2）

| 确认项 | 产品负责人决策 | 记录 |
|---|---|---|
| 站点范围 | 「不应该只针对于国家级，还有各个省市的反而更重要。不要采集商业网站，这些是收费的。我们只查公开站点。」「所有省级、地级市级别都需要」 | 会话即时确认，2026-08-21/22 |
| DeepSeek 端点 | 指定非官方端点 + 模型 + key：「不调用官方。sk-…，deepseek-v4-flash-0731，https://deepseek.yunjunet.cn/v1/chat/completions」 | 会话即时确认 |
| key 轮换 | 产品负责人提供新 key 并要求使用（其已在会话中提供） | 见 §5 安全边界 |

**外发字段（两腿均遵守）**：公告标题、摘要/正文（分类用）、来源 URL、发布时间、公告类型 + 审计元数据（来源名/抓取时间/留存期限）。**绝不外发**客户姓名、电话、联系方式、跟进正文、CRM 备注、证据、凭据。

## 2. 真实抓取验证（2026-08-22）

执行方式：`PublicProcurementCrawler(network_allowed=True, fetcher=make_httpx_fetcher())`
逐源 GET 1 次，超时 8s（直连重试 6s）；结果写入临时目录脱敏 JSON，不入仓库。

### 2.1 站点范围与筛选

- 产品负责人明确：只采**政府公开站点**（免费、免登录），**不采商业/收费聚合网站**。
- 因此从早期候选移除 `cebpubservice.com`（中国招标投标公共服务平台有限公司运营，含收费服务）。
- 省级候选按 `.gov.cn` 政府域名逐一**真实探测**，33 个候选 → 11 个可达（2 国家级 + 9 省级）。
- 不可达/反爬/解析失败候选**如实记录为降级**，不保留为默认源（R-017 不伪造来源）。
- 地级市站点：本机环境无权威地级市平台 URL 清单可枚举（全国 300+ 地级市），本阶段以
  省级全量探测验证适配器；地级市入口待后续按省级平台入口/官方清单扩展（记录为未完成项）。

### 2.2 可达站点（默认源保留，[VERIFIED] 2026-08-22 真实 GET）

| 站点 | URL | 解析公告数 | 备注 |
|---|---|---|---|
| 全国公共资源交易平台 | https://www.ggzy.gov.cn | 22 | 标题/日期/类型/详情 URL 均提取 |
| 中国政府采购网 | https://www.ccgp.gov.cn | 72 | 标题/URL 提取；列表页无显式日期 → `published_at=None`（不伪造） |
| 天津市公共资源交易平台 | https://ggzy.zwfwb.tj.gov.cn | 124 | 完整解析 |
| 内蒙古自治区公共资源交易网 | https://ggzyjy.nmg.gov.cn | 24 | 完整解析 |
| 江西省公共资源交易平台 | https://ggzy.jiangxi.gov.cn | 29 | 完整解析 |
| 山东省公共资源交易平台 | https://ggzyjy.shandong.gov.cn | 92 | 完整解析 |
| 湖南省公共资源交易平台 | https://ggzy.hunan.gov.cn | 21 | 完整解析 |
| 四川省公共资源交易平台 | https://ggzyjy.sc.gov.cn | 7 | 完整解析 |
| 贵州省公共资源交易平台 | https://ggzy.guizhou.gov.cn | 35 | 完整解析 |
| 陕西省公共资源交易平台 | https://ggzy.shaanxi.gov.cn | 24 | 标题/URL 提取 |
| 新疆维吾尔自治区公共资源交易平台 | https://ggzy.xinjiang.gov.cn | 208 | 完整解析 |

解析样本（湖南站真实公告）：
`title=湖南省招标投标管理办法修改内容公开征求意见的公告`，
`url=https://ggzy.hunan.gov.cn/ggzy/xxgk/xxgkml/gzdt/202607/t20260720_34029994.html`，
`published_at=2026-07-06`，`type=招标公告`。来源 URL 均来自页面真实 `<a href>`（urljoin 绝对化），无编造。

### 2.3 降级记录（22 个候选，如实降级、不伪造）

- ConnectionError（20）：北京/河北/山西/辽宁/吉林/上海/江苏/浙江/福建/河南/湖北/广东/
  广西/重庆/甘肃/青海/宁夏/黑龙江（首次走代理 ConnectionError，直连重试仍失败）等 —
  候选域名不可达或需浏览器环境，**记为不可达，不猜测替代域名**。
- timeout（1）：黑龙江（直连重试超时）。
- parse failure（4）：安徽/海南/云南/西藏 — 页面可达但无符合公告特征的链接（动态页/导航页），
  如实降级（R-015/AC-007）。
- 未绕过登录、未破解验证码、未伪造数据。

## 3. 真实 DeepSeek 调用验证（2026-08-22）

- 端点：`https://deepseek.yunjunet.cn/v1/chat/completions`（产品负责人指定，非官方）
- 模型：`deepseek-v4-flash-0731`（产品负责人指定）
- 载荷：白名单组装（`assemble_outbound`），实际外发字段名：
  `announcement_type, published_at, source_name, source_url, title`（无 body——分类不需要）
- 调用结果：**HTTP 402**（`ProviderRequestError: provider returned status 402`）
- 降级路径验证：`ProviderRequestError` 由服务层 `_apply_reason` 捕获 → 回退本地确定性理由
  （`ai_used=False`），发现流程不被阻塞（R-015/AC-007）。本次仅验证 provider 适配层，
  未产生模型文本 → 泄露扫描无输入（`leak_scan_findings=[]`）。
- 审计记录（R-014/AC-008，真实生成 1 条）：
  `action=opportunity.ai_reason.outbound`，
  `reason={"model_identifier": "deepseek-v4-flash-0731", "outbound_field_names": ["announcement_type", "published_at", "source_name", "source_url", "title"]}`
  — 仅模型标识 + 字段名，无值、无 key、无完整载荷。

### 3.1 402 后续处理（待产品负责人决策）

402（Payment Required）通常表示付费/配额/账户状态问题。产品负责人需确认该端点的
计费/配额状态或更换有效凭据后，方可重试真实调用。**未确认前不再自动重试。**

## 4. 代码变更（本腿）

- `src/crm/ai/crawler.py`：
  - 新增 `parse_announcement_list_payload(raw, source_url)` — HTML 列表页/JSON 数组/对象/
    纯文本 → 公告 dict 列表；无可解析项返回 None（调用方降级）。
  - 新增 `_AnnouncementLinkParser`（stdlib `html.parser`，无新依赖）、`_is_announcement_link`
    （公告关键词 + 导航排除）、`_extract_date`（多种日期格式，缺省不伪造）、
    `_infer_announcement_type`（标题关键词 → 类型）。
  - 新增 `make_httpx_fetcher()` — 真实 httpx 抓取（重定向/超时/HTTP 错误识别 + GBK/GB2312
    回退解码）。
  - `fetch_announcements` 改为逐条消费列表解析结果（每条独立 `source_url`/30 天留存）。
  - `DEFAULT_PUBLIC_SOURCES` 收敛为「真实探测可达」的 11 个政府公开站点。
- `tests/test_task0040_html_parser.py`（新增 13 用例，全部本地合成夹具，零真实网络）。
- 本腿所有真实请求的输出仅存于系统临时目录（`C:/Users/Public/task0040_real/`，非仓库），
  证据文档只含脱敏摘要。

## 5. 安全边界确认

- **API key 处理**：产品负责人 2026-08-22 在会话中直接提供 key。执行者仅以运行时环境变量
  注入验证进程，**未打印、未写入仓库/证据/日志/审计**；证据文档不含 key 值。
- **建议**：该 key 已出现在会话文本中，**请产品负责人再次轮换**后再用于后续调用。
- 白名单不变：外发仅公告字段；客户姓名/电话/联系方式/跟进正文/CRM 备注/证据/凭据零外发
  （[VERIFIED] 请求载荷键集合 = 白名单字段名）。
- 未 commit、未 push、未部署、未迁移、未写入真实数据、未自动建档、未自动采纳候选。
- 本机代理（7897）可用（Clash 运行中）；省级探测首次经代理，失败项直连重试已做，
  两轮结果均已记录。

## 6. 本地全量验证（代码变更后）

| 命令 | 结果 |
|---|---|
| `pytest tests -q` | [VERIFIED] `396 passed, 28 skipped`（含新增 HTML 解析 13 用例；基线 382 + 14） |
| `python -m compileall -q src tests migrations` | [VERIFIED] exit 0 |
| `git diff --check` | [VERIFIED] exit 0（仅既有 LF/CRLF 警告） |
| `scripts/check-governance.ps1` | [VERIFIED] `[PASS]`（8 approved SPECs / 39 active tasks） |

## 7. 未验证 / 待办

- **Codex 独立评审**：未执行；任务不自批。
- **DeepSeek 真实 reason 生成**：未成功（402），R-013 对真实模型文本的扫描、审计成功路径
  仅本地夹具验证过（`test_task0040_*`）；真实成功路径待端点计费状态恢复后重试。
- **地级市站点清单**：本机无可枚举权威清单，未覆盖；待官方入口清单/后续扩展。
- 部分省级站点（安徽/海南/云南/西藏）页面可达但非标准公告列表，需针对性适配（后续）。
- 生产部署/迁移/真实数据变更：未授权、未执行。

## 8. 真实请求摘要（脱敏结构）

- 抓取：33 个省级候选 URL 各 1 次 GET（8s 超时）+ 22 个失败项直连重试 1 次（6s 超时）；
  共约 55 次 GET，全部为政府 `.gov.cn` 公开页面，无登录、无付费、无跨境数据外发。
- DeepSeek：1 次 POST 至 `deepseek.yunjunet.cn`（付费端点，产品负责人指定）；外发字段
  5 个白名单字段名；返回 402；审计 1 条（模型标识 + 字段名）。
