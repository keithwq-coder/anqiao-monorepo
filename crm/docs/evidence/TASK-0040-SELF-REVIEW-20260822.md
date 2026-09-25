# TASK-0040: 执行者自查评审记录（2026-08-22）

- Task: TASK-0040（真实外部调用腿）
- 评审性质：**执行者自查评审**（deepseek-v4-flash-0731 + 隔离只读 review/security_review 子代理）。
  非正式独立评审；DEC-0159 规定正式评审 owner 为 Codex，本记录不替代。
- Date: 2026-08-22
- 结论：**warn — 有 P1 合规缺口，不建议直接合入**；无密钥泄漏、白名单外发有效、R-017 不伪造来源达标。

## 复核方法

- 隔离子代理 `review`（正确性/合规/测试覆盖）与 `security_review`（注入/密钥/SSRF）各跑一轮。
- 执行者独立复核：grep 全 src 树调用点、逐行读取涉事文件（provider.py:209-231、
  crawler.py:408-429、wiring.py:87-104、opportunity.py:208、whitelist.py:49）。

## P1（合入前应修）

1. **`src/crm/ai/audit.py:57` — crawler egress 零审计**
   `record_crawler_fetch` 在 src 全树无调用点（仅测试引用）；`PublicProcurementCrawler`
   无 audit_repository 注入。真实抓取不落审计，与 R-016 单一可审计出口及 audit.py
   docstring 自相矛盾。
2. **`src/crm/ai/wiring.py:87-104` — 真实抓取在应用层永远无法启用**
   `build_crawler_source` 不注入 `make_httpx_fetcher()`：即使
   `CRM_CRAWLER_ENABLED`/`CRM_CRAWLER_NETWORK_ALLOWED` 全开，返回的 crawler 仍
   `fetcher=None`，恒降级 "crawler fetcher unavailable"。`build_crawler_source`/
   `build_reason_generator`/`make_httpx_fetcher` 在 src 内均无调用点，
   `app.state.opportunity_crawler_source` 从未被赋值（discovery.py:38 只读取）。
   真实抓取 leg 只在验证脚本中显式构造过，未接入装配链。

## P2

3. **`src/crm/ai/crawler.py:427`** — JSON 数组分支 `source_url` 不做 urljoin/scheme
   校验（HTML 分支已校验），异常 JSON 源可把 `javascript:` 等非 http URL 带入
   `external_subject.source_reference` 落库。
4. **`src/crm/application/opportunity.py:208`** — `run()` 硬编码 `"synthetic": True`，
   crawler `degraded`/`degraded_reason` 不透传；真实数据路径下状态不真实（AC-007）。
5. **`src/crm/ai/crawler.py:311`（_AnnouncementLinkParser）** — 链接后文本全归上一个
   链接；日期在链接之前的列表页会把 `published_at` 错配到上一公告（R-017 关联错误
   风险）。测试仅覆盖日期在链接后的形态。
6. **`src/crm/ai/provider.py:170`** — 审计回调在请求发出前触发且 `record_ai_outbound`
   默认 `outcome="success"`：402 失败/transport 缺失的出站也记 success，审计不真实
   （R-014）。真实调用验证已观察到：402 但 audit outcome=success。
7. **`src/crm/ai/whitelist.py:49`** — `FORBIDDEN_FIELD_MARKERS` 全树无使用点，死代码
   且误导为双重防护；正向白名单本身有效。

## MEDIUM（安全加固）

8. **`src/crm/ai/crawler.py:484-502（make_httpx_fetcher）`** — URL 无 scheme/host 校验，
   `follow_redirects=True` 可跟随重定向到任意主机（内网/元数据），响应体无大小上限
   （SSRF 风险）。当前暴露面小（默认清单硬编码、网络门默认关、装配链未接），但任何
   未来调用点传入可控 URL 即成风险。修复：host 限 `.gov.cn` 白名单；手动逐跳校验
   重定向；限制响应体大小。

## LOW

9. **`src/crm/ai/provider.py:221-224`** — `content` 未做 `isinstance(str)` 校验；
   畸形 chat 响应（content 为 dict/list）会让下游 `leak_scan` → `re.search` 抛未捕获
   TypeError（500 而非降级）。修复：非 str 抛 `ProviderMalformedResponseError`。

## 已核实正面项

- 密钥零落盘：grep `sk-[A-Za-z0-9_-]{16,}` 全库无命中；证据只记长度不记值。
- 白名单外发有效：真实 POST 载荷键集 = 白名单字段名（announcement_type, published_at,
  source_name, source_url, title）。
- R-017：无日期不伪造、不可达源如实降级并移出默认源、33 候选→11 保留有据。
- 测试：13 新用例（HTML 多条目/类型推断/日期格式/导航过滤/JSON 兼容/降级）零网络。
- HTML 无注入出口（模板 autoescape 开启，无 `|safe`）。
- 网络门 fail-closed；httpx 超时被错归 transport failure 但保持降级、无重试放大。

## 处理状态

- 产品负责人 2026-08-22 授权「修复全部发现」；执行者 deepseek-v4-flash-0731 已修复
  全部 9 项（P1×2、P2×5、MED×1、LOW×1）。
- 修复验证：`pytest tests -q` → **`421 passed, 28 skipped`**（修复前 396 + 新增修复测试
  25）；`python -m compileall -q src tests migrations` exit 0；`git diff --check` exit 0；
  `scripts/check-governance.ps1` `[PASS]`。
- 修复文件：`src/crm/ai/crawler.py`（审计接线、JSON URL 校验、日期最近锚点归属、
  SSRF 加固）、`src/crm/ai/provider.py`（审计 outcome 真实性、content 类型校验）、
  `src/crm/ai/wiring.py`（真实 fetcher 注入、outcome 透传）、`src/crm/ai/audit.py`
  （outcome 语义）、`src/crm/ai/whitelist.py`（死代码删除）、
  `src/crm/application/opportunity.py`（synthetic/degraded 如实上报）、
  `src/crm/web/main.py`（装配三件套）；新增 `tests/test_task0040_fixes.py`（19 用例）、
  `tests/test_task0040_service_integration.py`（+3 用例）。
- 正式独立评审仍待 Codex（DEC-0159），不自批。
