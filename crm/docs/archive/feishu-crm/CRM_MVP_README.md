#飞书 CRM AI 系统 - 快速开始指南

本项目基于个人飞书账号构建客户商机扫描 MVP 系统

📋 技术架构
─────────────────────────────
│  表现层：飞书多维表格（个人版）    │
│  业务层：Python FastAPI + Playwright  │
│  数据源：国家企业信用信息公示系统   │
└─────────────────────────────

📦 依赖安装
─────────────────────────────
pip install fastapi uvicorn python-dotenv httpx playwright aiohttp

首次运行 playwright：
playwright install chromium

🔧 环境配置
─────────────────────────────
1. 复制 .env.example 为.env
2. 填写你的飞书凭证：
   - FEISHU_APP_ID
   - FEISHU_APP_SECRET  
   - FEISHU_BASE_ID
   - FEISHU_TABLE_ID
3. 填入首批测试客户名单（customers.csv）

🚀 运行服务
─────────────────────────────
uvicorn main:app --reload
访问 http://localhost:8000/docs 查看 API

✅ 验收标准
─────────────────────────────
- [ ] 服务可正常启动
- [ ] GET /api/check_connection 返回成功
- [ ] GET /api/customers/list 返回客户列表
- [ ] 能成功爬取单个企业工商信息
