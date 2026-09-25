# TASK-0040: Qwen3.8-max 独立评审报告（2026-08-22）

- Task: TASK-0040（商机外部集成：本地实现 + 真实外部调用腿 + 自查评审 9 项修复）
- 评审性质：**正式独立评审**（评审 owner：Qwen3.8-max，per `DEC-0160`，产品负责人
  「改由你评审」）。注意：评审者与执行者同模型世系（DEC-0160 已记录），独立性降低
  已向产品负责人披露并被接受。
- 评审方法：隔离只读 `review` + `security_review` 子代理各一轮；评审者亲自复核关键
  发现（逐行读取涉事文件）；全量测试复跑。
- Date: 2026-08-22
- **结论：CONDITIONAL — 9 项已修发现全部验证通过、无回归；但发现 1 项 HIGH
  越权缺陷（候选裁决无归属人校验），修复后方可通过；另有 2 MEDIUM / 2 LOW / 4 P2
  建议修复。**

## 1. 评审范围与证据

| 检查 | 结果 | 证据 |
|---|---|---|
| 上轮 9 项修复是否真实落地 | [VERIFIED] 9/9 通过 | 隔离子代理逐文件:行核对 + 评审者亲自复核（见 §2） |
| 全量测试 | [VERIFIED] `421 passed, 28 skipped` | 评审者复跑 `pytest tests -q`（93.94s；跳过项为 PostgreSQL 门控测试） |
| 白名单外发 | [VERIFIED] 唯一出口为正向白名单；死代码已删 | `whitelist.py`；grep 无 `FORBIDDEN_FIELD_MARKERS` |
| 密钥零落盘 | [VERIFIED] src/ 无 `sk-` 匹配；Authorization 头仅发送时构造 | 子代理 grep + 评审者复核 provider.py |
| fail-closed 无回归 | [VERIFIED] env 未设 → builder 返回 None，合成桩保留 | `wiring.py:85-87/108-123`；`test_module_boundaries` 通过 |
| HTML 注入 | [VERIFIED] templates 无 `|safe`/`Markup`，Jinja2 autoescape 开启 | 子代理 grep templates/ |
| 治理 | [VERIFIED] `[PASS]`（8 SPECs / 39 tasks） | 上轮 + 本轮 `check-governance.ps1` |

## 2. 上轮 9 项修复逐项确认（评审者复核）

1. **P1-1 crawler 审计接线** ✅ `crawler.py:135/176-233` `_audit_fetch` 每源一记录；
   `main.py:188` 传 audit_repository；`test_task0040_fixes.py:86-116` 覆盖成功/失败两路。
2. **P1-2 装配链** ✅ `wiring.py:108-123` 启用时挂 `make_httpx_fetcher()`；
   `main.py:188-196` 三件套装配；`discovery.py:38-42` 全部消费。
3. **P2-3 JSON source_url 校验** ✅ `crawler.py:505-510` 仅 http(s) 放行，否则 None 回退。
4. **P2-4 run() 如实上报** ✅ `opportunity.py:217-230` 动态 synthetic + degraded 透传；
   集成测试 3 条覆盖。
5. **P2-5 日期归属** ✅ `crawler.py:391-425` 最近锚点距离取胜；双布局测试通过。
6. **P2-6 审计 outcome 真实** ✅ `provider.py:186-239` 六类失败分支 audit failure；
   成功路径 attempt 后 audit success。
7. **P2-7 死代码删除** ✅ `whitelist.py` 无该常量。
8. **MED-8 SSRF 加固** ✅ `crawler.py:576-618` scheme+host 后缀校验、手动逐跳重定向、
   2MB 上限、GBK/GB2312 解码；`evil.gov.cn.com` 等变体被拒。
9. **LOW-9 content 类型** ✅ `provider.py:231-232` isinstance(str)。

## 3. 新发现

### HIGH（阻塞）

- **H-1 `opportunity.py:283-317` — `adjudicate()` 无归属人校验（越权裁决）**
  [VERIFIED 评审者亲自复核] `adjudicate()` 只校验候选存在与状态，**不校验
  `candidate.recipient_user_id == actor_user_id`**；`get_candidate()`（第 277 行）
  有该校验而裁决路径没有；`discovery.py:127-133` 路由也只做角色/启用检查。任何启用
  业务用户可对他人候选执行「采纳/忽略」：采纳 crawler 候选会把外部主体注入公共池、
  忽略可销毁他人待处理候选。违反 SPEC-0003 R-012 接收者边界与最小权限原则。
  注：该缺陷由 TASK-0038 引入（TASK-0040 保持 adjudication 语义不变，未引入但未
  覆盖此边界），在 TASK-0040 评审范围内必须修复。

### MEDIUM

- **M-1 `crawler.py:609`（同 `provider.py:225`）— 响应体上限为事后检查**
  httpx 非流式在检查前已全量读入内存，2MB/64k 上限防不住内存放大；建议流式截断。
- **M-2 `discovery.py:46` — `/candidates/run` 无速率限制**
  业务用户可重复触发对 11 个 `.gov.cn` 源的出站抓取（流量放大）；建议加限流。

### LOW

- **L-1 `opportunity.py:229` — `crawler_degraded_reason` 原样回传内部异常类名/被拒
  主机名**（verbose error，建议对客户端泛化）。
- **L-2 `provider.py:205` — `except ProviderError: raise` 分支不写审计**
  （注入客户端抛 ProviderError 子类时 attempt 无记录；真实 httpx 不受影响）。

### P2（非阻塞建议）

- **P-1 审计回调无异常隔离**：`provider.py:209`/`crawler.py:212` 审计写入失败会在
  except 块内替换原始 ProviderError → `_apply_reason` 降级失配（500 而非 R-015 降级）；
  爬虫成功路径也会被审计故障打断。
- **P-2 `audit.py:31` outcome 默认 `"success"`**：建议删除默认、强制显式声明。
- **P-3 `opportunity.py` 降级时 `model_identifier` 落库 None** 而非 `synthetic-stub`
  （`dict.get` 键存在时值为 None 不取默认），与 `ai_used=False` 语义略不一致。
- **P-4 `crawler.py:576` 允许 http 明文与任意端口**：默认源全 https，建议收紧。

## 4. 结论

- 上轮 9 项修复全部真实且正确，无回归（421 passed 复验）。
- **正式评审裁定：CONDITIONAL — 须修复 H-1 后方可通过**；M/L/P2 建议同轮修复
  （待产品负责人授权）。
- 真实外部调用腿状态不变：爬虫真实抓取已验证；DeepSeek 真实 reason 生成受 402
  阻塞（端点计费/配额问题，待产品负责人决策），未假装成功。
- 本报告不自批之外无其他限制：评审者为产品负责人指定的 TASK-0040 评审 owner
  （DEC-0160）。
