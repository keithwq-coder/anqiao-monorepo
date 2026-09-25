# -*- coding: utf-8 -*-
"""
爬虫配置文件
中科安樵 - 养老行业数据采集
"""

# ============ 数据集 A：苏州及周边机构配置 ============

# 目标城市（苏州及周边）
TARGET_CITY = "苏州"
TARGET_DISTRICTS = ["姑苏区", "虎丘区", "吴中区", "相城区", "吴江区", "工业园区", "高新区"]
SURROUNDING_CITIES = ["昆山", "常熟", "太仓", "张家港"]

# 百度搜索关键词（多轮搜索）
SUZHOU_SEARCH_KEYWORDS = [
    # 核心关键词
    "苏州养老院", "苏州护理院", "苏州养老机构", "苏州养老服务中心",
    "苏州居家养老", "苏州适老化改造", "苏州长护险定点",
    # 周边城市
    "昆山养老院", "昆山护理院", "常熟养老院", "太仓养老院", "张家港养老院",
    "吴江养老院", "吴中养老院", "相城养老院", "姑苏区养老院",
    # 细分类型
    "苏州老年公寓", "苏州敬老院", "苏州日间照料中心",
    "苏州护理站", "苏州康复护理", "苏州医养结合",
    "苏州养老科技公司", "苏州智慧养老企业",
]

# Boss直聘搜索关键词
BOSS_SEARCH_KEYWORDS = [
    "养老院", "护理院", "养老机构", "居家养老",
    "适老化", "养老科技", "智慧养老", "长护险",
]

# 小红书搜索关键词
XHS_SEARCH_KEYWORDS = [
    "苏州养老院", "苏州护理院", "苏州养老",
    "苏州适老化改造", "苏州居家养老", "苏州长护险",
]

# 机构类型分类关键词
INSTITUTION_TYPE_KEYWORDS = {
    "养老机构": ["养老院", "敬老院", "养老公寓", "养老中心", "养老机构", "老年公寓"],
    "护理机构": ["护理院", "护理中心", "护理站", "护理机构"],
    "长护险机构": ["长护险", "长期护理", "护理保险"],
    "适老化改造": ["适老化", "适老改造", "无障碍改造", "居家改造"],
    "居家养老服务": ["居家养老", "日间照料", "养老服务", "为老服务"],
}

# ============ 数据集 B：招投标配置 ============

# 招标搜索关键词
BIDDING_KEYWORDS = [
    "适老化改造",
    "智能养老",
    "智慧养老",
    "居家养老",
    "养老设备",
    "养老信息化",
    "长护险",
    "护理设备",
    "健康监测",
    "紧急呼叫",
    "养老服务",
    "养老平台",
]

# 标讯有效天数（仅采集近 N 天内的公告）
BIDDING_VALID_DAYS = 90

# 每个关键词最大翻页数
MAX_PAGES_PER_KEYWORD = 5

# ============ 反爬配置 ============

# 请求间隔（秒），随机范围
REQUEST_DELAY_MIN = 2
REQUEST_DELAY_MAX = 5

# 最大重试次数
MAX_RETRIES = 3

# User-Agent
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

# Playwright 配置
HEADLESS = True  # 设为 False 可看到浏览器操作（调试用）
SLOW_MO = 100    # 操作间隔（毫秒），模拟人类行为

# ============ 输出配置 ============

OUTPUT_DIR = "output"

OUTPUT_FILES = {
    "suzhou_institutions": "苏州养老机构名录.xlsx",
    "bidding_announcements": "招标信息.xlsx",
    "winning_bids": "中标信息_中标单位线索.xlsx",
}

# ============ 数据源 URL ============

URLS = {
    # 中国政府采购网
    "ccgp_search": "http://search.ccgp.gov.cn/bxsearch",
    # 苏州市民政局
    "suzhou_civil_affairs": "http://mzj.suzhou.gov.cn",
    # 苏州市医保局
    "suzhou_medical_insurance": "http://ybj.suzhou.gov.cn",
    # 百度地图
    "baidu_map": "https://map.baidu.com",
}
