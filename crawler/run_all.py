# -*- coding: utf-8 -*-
"""
一键运行全部爬虫
中科安樵 - 养老行业数据采集

使用方法：
    python run_all.py           # 运行全部爬虫
    python run_all.py suzhou    # 仅运行苏州机构爬虫
    python run_all.py bidding   # 仅运行招投标爬虫
"""

import sys
import os
import asyncio
from datetime import datetime

# 添加当前目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import config
from scraper_suzhou import SuzhouInstitutionScraper
from scraper_bidding import BiddingScraper


def print_banner():
    """打印启动横幅"""
    print("""
╔══════════════════════════════════════════════════════════╗
║           中科安樵 - 养老行业数据采集系统                ║
╠══════════════════════════════════════════════════════════╣
║  数据集 A：苏州养老相关机构名录                          ║
║  数据集 B：全国养老相关招投标信息                        ║
╚══════════════════════════════════════════════════════════╝
    """)
    print(f"运行时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"输出目录：{os.path.abspath(config.OUTPUT_DIR)}")
    print()


async def run_suzhou_scraper():
    """运行苏州机构爬虫"""
    print("\n" + "=" * 60)
    print("【任务 A】苏州养老相关机构名录采集")
    print("=" * 60)
    
    scraper = SuzhouInstitutionScraper()
    await scraper.scrape_all()
    filepath = scraper.export()
    
    return filepath


async def run_bidding_scraper():
    """运行招投标爬虫"""
    print("\n" + "=" * 60)
    print("【任务 B】全国养老相关招投标信息采集")
    print("=" * 60)
    
    scraper = BiddingScraper()
    await scraper.scrape_all()
    scraper.export()
    
    return True


async def run_all():
    """运行全部爬虫"""
    results = {}
    
    # 任务 A：苏州机构
    try:
        results["suzhou"] = await run_suzhou_scraper()
    except Exception as e:
        print(f"\n苏州机构爬虫出错：{e}")
        results["suzhou"] = None
    
    # 任务 B：招投标
    try:
        results["bidding"] = await run_bidding_scraper()
    except Exception as e:
        print(f"\n招投标爬虫出错：{e}")
        results["bidding"] = None
    
    return results


def print_summary(results: dict):
    """打印运行摘要"""
    print("\n" + "=" * 60)
    print("【运行摘要】")
    print("=" * 60)
    
    output_dir = os.path.abspath(config.OUTPUT_DIR)
    
    # 检查输出文件
    for key, filename in config.OUTPUT_FILES.items():
        filepath = os.path.join(output_dir, filename)
        if os.path.exists(filepath):
            size = os.path.getsize(filepath)
            print(f"  ✓ {filename} ({size/1024:.1f} KB)")
        else:
            print(f"  ✗ {filename} (未生成)")
    
    print()
    print("完成时间：", datetime.now().strftime('%Y-%m-%d %H:%M:%S'))


def main():
    """主入口"""
    print_banner()
    
    # 解析命令行参数
    task = sys.argv[1] if len(sys.argv) > 1 else "all"
    
    if task == "suzhou":
        print("模式：仅运行苏州机构爬虫")
        asyncio.run(run_suzhou_scraper())
    elif task == "bidding":
        print("模式：仅运行招投标爬虫")
        asyncio.run(run_bidding_scraper())
    elif task == "all":
        print("模式：运行全部爬虫")
        results = asyncio.run(run_all())
        print_summary(results)
    else:
        print(f"未知任务：{task}")
        print("可用选项：all, suzhou, bidding")
        sys.exit(1)


if __name__ == "__main__":
    main()
