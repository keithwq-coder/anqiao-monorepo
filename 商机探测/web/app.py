"""FastAPI 应用"""

from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from db.session import init_db
from web.api import opportunities, crawler

app = FastAPI(title="商机探测", description="智慧养老商机爬虫系统")

# 静态文件
STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# 注册路由
app.include_router(opportunities.router)
app.include_router(crawler.router)


@app.on_event("startup")
def startup():
    init_db()
