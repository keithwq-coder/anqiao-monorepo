"""商机探测系统 — 入口文件"""

import logging

import uvicorn

import config
from db.session import init_db
from scheduler.jobs import scheduler, setup_jobs

# 日志配置
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)


def main():
    # 初始化数据库
    init_db()
    logging.info("数据库初始化完成")

    # 启动定时调度
    setup_jobs()
    scheduler.start()
    logging.info("定时调度器已启动")

    # 启动 Web 服务
    logging.info(f"Web 服务启动: http://{config.WEB_HOST}:{config.WEB_PORT}")
    uvicorn.run(
        "web.app:app",
        host=config.WEB_HOST,
        port=config.WEB_PORT,
        log_level="info",
    )


if __name__ == "__main__":
    main()
