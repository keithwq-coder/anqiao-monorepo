# TASK-0049 AI 商机触发源分离 + 定时任务 — evidence (2026-08-27)

- Executor: reasonix（2026-08-27 会话）
- Authorization: DEC-0179（2026-08-26 一次性授权）
- Scope: SPEC-0003 v0.5.0 实现（触发源分离 + 定时任务改造 + 部署）

## 实现内容

1. **opportunity.py 拆分**：`run()` → `run_personal(user_id)` + `run_crawler(actor_id)`
   + `_persist_candidates()` 公共持久化；`run()` 保留为向后兼容 wrapper。
2. **discovery 路由**：`POST /candidates/run` 新增 `?trigger=personal|crawler` 参数；
   crawler 仅 admin 可触发；personal 默认。
3. **crawl 脚本**：`scripts/crawl_opportunities.py` 改为调用 `run_crawler(admin_id)`
   （不再调用混合 `run()`）。
4. **测试适配**：`_trigger_crawl` 支持 trigger 参数；crawler 测试用 admin_client；
   leaky_reason 测试适配单个 Institution 对象。
5. **生产部署**：代码 tar+scp 同步 → systemd restart → health 200；API 验证：
   何丹 personal → `{"status":"started","trigger":"personal"}`；吴骐 personal →
   触发成功（117 客户后台处理中）。

## 测试结果

- 本地：**517 passed, 28 skipped**（基线 504，+13 从 TASK-0048；TASK-0049 无回归）
- 编译：`python -m compileall -q src/ scripts/` exit 0

## 生产验证

- 服务：active, health 200
- 何丹 personal 触发：`{"status": "started", "trigger": "personal"}`
- 吴骐 personal 触发：`{"status": "started", "trigger": "personal"}`
  （117 客户处理中，后台线程性能待后续优化）
- 候选列表 API：正常响应（200）

## Not verified

- 后台线程持久化性能（117 客户处理时间较长，可能需优化 `_persist_candidates`
  批量提交或 `reason_generator` 调用）
- Crawler 触发（需要 `CRM_CRAWLER_ENABLED` 等环境变量配置）
- Systemd timer 生产启用状态（deploy timer 文件存在但未确认 enabled）
- TASK-0050 尚未开始