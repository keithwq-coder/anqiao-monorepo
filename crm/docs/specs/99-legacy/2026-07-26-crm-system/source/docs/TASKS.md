# CRM 系统任务交接登记簿
# 跨平台协同规则：每个 AI 工具开工前必须先读本文档，完工后必须更新本文档。

## 任务状态说明
- ⬜ 待开始
- 🔄 进行中
- ✅ 已完成
- ❌ 已取消

## Phase 2: Design

| 任务编号 | 任务名称 | 执行工具 | 输入文件 | 输出文件 | 状态 | 备注 |
|---------|---------|---------|---------|---------|------|------|
| 2.1 | 数据库 Schema 设计 | ZCode (GLM-5.1) | docs/PLAN.md | docs/schema.sql | ⬜ | 3NF + TimescaleDB 分区 + 索引 |
| 2.2 | API 接口规范 | ZCode (GLM-5.1) | docs/schema.sql | docs/API_SPEC.yaml | ⬜ | OpenAPI 3.0，覆盖三模块 |
| 2.3 | 前端页面结构 | Kimi CLI (k3) | docs/API_SPEC.yaml | docs/UI_STRUCTURE.md | ⬜ | AntD Pro 组件映射 |
| 2.4 | 架构图与数据流图 | Qoder (Qwen-3.5) | docs/PLAN.md | docs/ARCHITECTURE.md | ⬜ | Mermaid 格式 |
| 2.5 | 爬虫 PoC 验证 | OpenCode (Grok) | docs/PLAN.md | crawlers/poc/ | ⬜ | 7 渠道各爬 100 条 |

## Phase 3: Build

### Sprint 3.1 环境搭建

| 任务编号 | 任务名称 | 执行工具 | 输入文件 | 输出文件 | 状态 | 备注 |
|---------|---------|---------|---------|---------|------|------|
| 3.1.1 | 服务器初始化 | Qoder + 人工 | scripts/setup_server.sh | 服务器环境就绪 | ⬜ | Python/Node/PG/Redis/Nginx/Supervisor |
| 3.1.2 | 数据库建表 + 种子数据 | ZCode | docs/schema.sql | backend/migrations/ | ⬜ | Alembic 迁移 |
| 3.1.3 | _deploy.py 验证 | Qoder | _deploy.py | 部署成功日志 | ⬜ | 原生部署流程 |

### Sprint 3.2 商机采集中心

| 任务编号 | 任务名称 | 执行工具 | 输入文件 | 输出文件 | 状态 | 备注 |
|---------|---------|---------|---------|---------|------|------|
| 3.2.1 | 爬虫引擎核心 + 前 2 渠道 | OpenCode | docs/PLAN.md | crawlers/ | ⬜ | Scrapy + Playwright |
| 3.2.2 | 其余 5 渠道爬虫 | OpenCode | crawlers/ | crawlers/spiders/ | ⬜ | 按渠道再拆分 |
| 3.2.3 | 去重 + 商机评分算法 | ZCode | docs/schema.sql | backend/app/services/ | ⬜ | 文本相似度 + 权重因子 |
| 3.2.4 | 商机 UI + 飞书日报 | Kimi + ZCode | docs/UI_STRUCTURE.md | frontend/src/ | ⬜ | AntD Table + 飞书机器人 |

### Sprint 3.3 客户智能管理

| 任务编号 | 任务名称 | 执行工具 | 输入文件 | 输出文件 | 状态 | 备注 |
|---------|---------|---------|---------|---------|------|------|
| 3.3.1 | 艾森豪威尔评级引擎 | ZCode | docs/PLAN.md | backend/app/services/rating.py | ⬜ | A/B/C/D 四级 |
| 3.3.2 | 防撞单检测 + 归属锁定 | ZCode | docs/schema.sql | backend/app/services/collision.py | ⬜ | 状态机 |
| 3.3.3 | 分级提醒定时任务 | Qoder | docs/PLAN.md | backend/app/tasks/reminders.py | ⬜ | Celery Beat + 飞书 |
| 3.3.4 | 客户管理 UI | Kimi CLI | docs/UI_STRUCTURE.md | frontend/src/pages/ | ⬜ | 客户 360 + 时间轴 |

### Sprint 3.4 销售漏斗 BI

| 任务编号 | 任务名称 | 执行工具 | 输入文件 | 输出文件 | 状态 | 备注 |
|---------|---------|---------|---------|---------|------|------|
| 3.4.1 | DuckDB 预计算 + 物化视图 | ZCode | docs/schema.sql | analytics/ | ⬜ | 秒级查询 |
| 3.4.2 | 漏斗/趋势可视化 | Kimi CLI | docs/UI_STRUCTURE.md | frontend/src/components/ | ⬜ | AntV G2Plot |
| 3.4.3 | 销售预测原型 | OpenCode | analytics/ | analytics/predict.py | ⬜ | 时间序列 |

### Sprint 3.5 飞书集成

| 任务编号 | 任务名称 | 执行工具 | 输入文件 | 输出文件 | 状态 | 备注 |
|---------|---------|---------|---------|---------|------|------|
| 3.5.1 | 飞书 OAuth2 登录 | ZCode | docs/PLAN.md | backend/app/auth/ | ⬜ | 扫码登录 |
| 3.5.2 | 飞书 Base 每日备份 | Qoder | docs/PLAN.md | backend/app/tasks/feishu_sync.py | ⬜ | 异步 6h |
| 3.5.3 | 飞书消息通知封装 | Qoder | docs/PLAN.md | backend/app/services/notify.py | ⬜ | 统一接口 |

---

## 变更记录

| 日期 | 操作人 | 变更内容 |
|------|--------|---------|
| 2026-07-25 | Qoder | 初始化 TASKS.md，登记全部 Phase 2-3 任务 |
