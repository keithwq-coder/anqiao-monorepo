"""全局配置 — 从 .env 读取，提供默认值"""

import os
from pathlib import Path
from dotenv import load_dotenv

# 加载 .env
load_dotenv()

# 项目根目录
BASE_DIR = Path(__file__).resolve().parent

# ── 数据库 ──
DB_PATH = Path(os.getenv("DB_PATH", str(BASE_DIR / "data" / "opportunities.db")))
DB_URL = f"sqlite:///{DB_PATH}"

# ── Kimi API ──
MOONSHOT_API_KEY = os.getenv("MOONSHOT_API_KEY", "")
MOONSHOT_BASE_URL = "https://api.moonshot.cn/v1"
MOONSHOT_MODEL = "kimi-k2.7-code-highspeed"

# ── Web 服务 ──
WEB_HOST = os.getenv("WEB_HOST", "0.0.0.0")
WEB_PORT = int(os.getenv("WEB_PORT", "8000"))

# ── 爬虫参数 ──
CRAWL_DELAY_MIN = int(os.getenv("CRAWL_DELAY_MIN", "3"))
CRAWL_DELAY_MAX = int(os.getenv("CRAWL_DELAY_MAX", "5"))

# ── AI 参数 ──
AI_CONCURRENCY = int(os.getenv("AI_CONCURRENCY", "3"))
RELEVANCE_THRESHOLD = int(os.getenv("RELEVANCE_THRESHOLD", "5"))
# 爬虫入库后是否自动触发 Kimi 三档分类（关闭可加快爬取测试）
AI_GRADE_ON_SAVE = os.getenv("AI_GRADE_ON_SAVE", "true").lower() in ("1", "true", "yes")
# AI 单条正文输入字符上限（控成本）
AI_CONTENT_MAX_CHARS = int(os.getenv("AI_CONTENT_MAX_CHARS", "2000"))

# ── 搜索爬虫参数 ──
SEARCH_MAX_PAGES = int(os.getenv("SEARCH_MAX_PAGES", "2"))  # 每个关键词最多抓取页数
SEARCH_DETAIL_LIMIT = int(os.getenv("SEARCH_DETAIL_LIMIT", "10"))  # 最多抓取详情页数

# ── 搜索引擎 ──
# 注：百度对裸 httpx 返回空页；Bing Web Search API 已于 2025-08 退役。
# 选 cn.bing.com HTML（httpx 可用，结果含真实 URL，无重定向包裹）。
BING_SEARCH_URL = "https://cn.bing.com/search"

# ── 行业资讯站（静态 HTML，选择器已验证）──
CNSF99_SMART_ELDERCARE_URL = "http://www.cnsf99.com/News/index.html?id=527"  # 中国养老网·智慧养老专栏
YANGLAO_ARTICLE_URL = "http://www.yanglao.com/article"  # 养老网·文章

# ── 政策站（静态 HTML，选择器已验证；分页未验证→只抓第1页）──
MCA_NOTICE_URL = "https://www.mca.gov.cn/n152/n165/index.html"  # 民政部·通知公告
CNCAPRC_POLICY_URL = "http://www.cncaprc.gov.cn/xxzcfg.jhtml"  # 中国老龄协会·政策法规

# ── 搜索关键词 ──
SEARCH_KEYWORDS = [
    "智慧养老",
    "智能看护",
    "毫米波雷达",
    "养老监测",
    "康养设备",
    "适老化改造",
    "养老院智能化",
    "居家养老",
    "健康守护",
    "跌倒检测",
]

# ── 政府采购网分类 ──
CCGP_CATEGORIES = {
    # (分支, 分类代码, 分类名称)
    ("dfgg", "gkzb"): "公开招标公告",
    ("dfgg", "zbgg"): "中标公告",
    ("dfgg", "jzxcs"): "竞争性磋商",
    ("dfgg", "jzxtb"): "竞争性谈判",
    ("zygg", "gkzb"): "中央公开招标",
    ("zygg", "zbgg"): "中央中标公告",
}

# ── 安樵产品信息（用于 AI 评分 prompt）──
ANQIAO_PRODUCT_INFO = """
中科安樵核心产品：AI健康守护仪ZQ-SH100
- 60GHz毫米波雷达 + AI行为识别
- 无摄像头、无穿戴、无感隔空监测
- 1-3米距离实时监测心率、呼吸、睡眠质量、跌倒风险
- 心率误差<2次/分，医疗级精度
- 配套：跌倒报警器、SOS呼叫器、健康大屏
- 目标场景：养老院、社区养老、居家养老、医院
- 关键词：智慧养老、智能看护、健康监测、跌倒检测、无感监测、毫米波
"""
