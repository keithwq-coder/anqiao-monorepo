# 商机探测 - 智慧养老商机爬虫系统

从政府采购/招标平台、养老行业资讯、政策文件三大信源自动抓取商机数据，AI 评分筛选，Web 界面查看。

## 技术栈

- Python 3.10+
- Crawlee + Playwright（爬虫框架）
- Kimi K2.7（AI 评分 & 结构化提取）
- SQLite + SQLAlchemy（数据存储）
- FastAPI + Jinja2（Web 界面）
- APScheduler（定时调度）

## 快速开始

```bash
# 安装依赖
pip install -r requirements.txt

# 安装 Playwright 浏览器
playwright install chromium

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入 API key

# 初始化数据库 & 启动
python main.py
```

访问 http://localhost:8000 查看 Web 界面。

## 项目结构

```
├── config.py              # 全局配置
├── main.py                # 入口
├── db/                    # 数据库模型 & 会话
├── crawlers/              # 各信源爬虫
├── ai/                    # AI 提取 & 评分
├── web/                   # FastAPI Web 界面
├── scheduler/             # 定时任务
└── scripts/               # 部署脚本
```
