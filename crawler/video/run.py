# -*- coding: utf-8 -*-
"""
视频采集器 run.py（正式版）

数据源（实测结论，2026-09-03 探针定版）：
- 快手：搜索/信息流 GraphQL 可用；未登录可抓首页信息流，搜索建议带登录态
- 抖音：www.douyin.com 冷启动被风控(CONNECTION_CLOSED)；带登录态尝试；
        iesdouyin 榜单可用但只有热词无视频明细

产出标准记录字段（与飞书视频库字段模型对齐，交给 ingest.py 入库）：
标题/平台/来源链接/账号名称/发布时间/榜单排名/点赞数/评论数/转发数/收藏数/
发布文案/话题标签/作品ID/分析状态

用法：
  python run.py --platform 快手 --keyword 养老 --limit 20          # 快手搜索
  python run.py --platform 快手 --keyword 养老 --limit 20 --no-ingest  # 只抓不入库
  python run.py --platform 抖音 --keyword 养老 --limit 20          # 抖音搜索(需登录态)
"""
import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
from ingest import ingest  # noqa: E402

PROFILE = str(HERE / "browser_profile")
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
STEALTH = """
Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
window.chrome = {runtime: {}};
Object.defineProperty(navigator, 'languages', {get: () => ['zh-CN','zh']});
"""


# ---------- 计数解析："1.2万" → 12000 ----------
def parse_count(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return int(v)
    s = str(v).replace(",", "").replace("+", "").strip()
    if not s:
        return None
    m = re.match(r"^([\d.]+)\s*万$", s)
    if m:
        return int(float(m.group(1)) * 10000)
    m = re.match(r"^([\d.]+)\s*亿$", s)
    if m:
        return int(float(m.group(1)) * 100000000)
    try:
        return int(float(s))
    except ValueError:
        return None


def ms_to_str(ms):
    """毫秒时间戳 → 'YYYY-MM-DD HH:MM'；无效返回 None（不猜测）"""
    try:
        ms = int(ms)
        if ms <= 0:
            return None
        return datetime.fromtimestamp(ms / 1000).strftime("%Y-%m-%d %H:%M")
    except Exception:
        return None


def split_caption(caption):
    """快手 caption：'内容 #话题1 #话题2' → (标题, 话题串, 完整文案)"""
    if not caption:
        return None, None, None
    tags = re.findall(r"#([^\s#]+)", caption)
    title = re.sub(r"#[^\s#]+", "", caption).strip()
    tag_str = " ".join(f"#{t}" for t in tags) if tags else None
    return (title or None), tag_str, caption


# ---------- 拦截器基类 ----------
class GraphQLCollector:
    def __init__(self):
        self.payloads = []

    def make_handler(self, match_keys):
        def on_response(resp):
            try:
                if "graphql" not in resp.url and "search" not in resp.url:
                    return
                ct = (resp.headers or {}).get("content-type", "")
                if "json" not in ct:
                    return
                body = resp.text()
                if not body or len(body) < 100:
                    return
                d = json.loads(body)
                data = d.get("data") or {}
                for k in match_keys:
                    node = data.get(k)
                    if node and isinstance(node, dict) and node.get("feeds"):
                        self.payloads.extend(node["feeds"])
                    elif isinstance(node, list) and node:
                        self.payloads.extend(node)
            except Exception:
                pass
        return on_response


# ---------- 快手 ----------
KS_SEARCH_KEYS = ["visionSearchPhoto"]


def collect_kuaishou(ctx, keyword, limit):
    page = ctx.new_page()
    col = GraphQLCollector()
    page.on("response", col.make_handler(KS_SEARCH_KEYS))

    url = f"https://www.kuaishou.com/search/video?searchKey={keyword}"
    print(f"[快手] 打开搜索页: {url}")
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=45000)
    except Exception as e:
        print(f"  [警告] goto 异常(继续等接口): {type(e).__name__}")
    # 滚动触发加载
    seen = 0
    for i in range(12):
        page.mouse.wheel(0, 2400)
        page.wait_for_timeout(1600)
        seen = len(col.payloads)
        print(f"  滚动 {i+1}/12  捕获 feeds={seen}")
        if seen >= limit * 1.5:
            break

    # 登录墙检测：搜索页未登录时接口不回数据，自动降级到信息流模式
    if not col.payloads:
        body = ""
        try:
            body = page.inner_text("body") or ""
        except Exception:
            pass
        if "立即" in body and "登录" in body or "登录即可" in body:
            print("  [检测到登录墙] 搜索需登录态。本次降级为【信息流模式】")
            print("  （信息流无需登录，字段一样全；要按关键词搜，先跑 login_once.py）")
            page.close()
            return collect_kuaishou_feed(ctx, limit)
        print("  [搜索无结果且无登录墙信号] 可能关键词无匹配")
    page.close()
    return _ks_records(col.payloads, limit)


def collect_kuaishou_feed(ctx, limit):
    """快手信息流模式（无需登录）：首页→同城 tab，sameCityData feeds 字段最全"""
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    feeds = []

    def on_response(resp):
        try:
            if "graphql" not in resp.url:
                return
            if "json" not in (resp.headers or {}).get("content-type", ""):
                return
            d = json.loads(resp.text())
            v = (d.get("data") or {}).get("sameCityData")
            if isinstance(v, dict) and isinstance(v.get("feeds"), list):
                feeds.extend(v["feeds"])
        except Exception:
            pass

    page.on("response", on_response)
    print("[快手·信息流] 打开首页")
    try:
        page.goto("https://www.kuaishou.com/?isHome=1",
                  wait_until="domcontentloaded", timeout=45000)
    except Exception as e:
        print(f"  [警告] goto 异常: {type(e).__name__}")
    for i in range(10):
        page.mouse.wheel(0, 2600)
        page.wait_for_timeout(1800)
        n = len([f for f in feeds if (f.get("photo") or {}).get("id")])
        print(f"  滚动 {i+1}/10  有效 feeds={n}")
        if n >= limit * 1.5:
            break
    page.remove_listener("response", on_response)
    page.close()
    return _ks_records(feeds, limit)


def _ks_records(feeds, limit):
    records, seen_ids = [], set()
    for f in feeds:
        photo = f.get("photo") or f
        author = f.get("author") or {}
        pid = photo.get("id") or photo.get("photoId")
        if not pid or pid in seen_ids:
            continue
        seen_ids.add(pid)
        title, tags, caption = split_caption(photo.get("caption"))
        rec = {
            "平台": "快手",
            "作品ID": str(pid),
            "来源链接": f"https://www.kuaishou.com/short-video/{pid}",
            "标题": title,
            "发布文案": caption,
            "话题标签": tags,
            "账号名称": author.get("name") or author.get("userName"),
            "发布时间": ms_to_str(photo.get("timestamp") or photo.get("createTime")),
            "点赞数": parse_count(photo.get("realLikeCount") or photo.get("likeCount")),
            "评论数": parse_count(photo.get("commentCount")),
            "转发数": parse_count(photo.get("shareCount")),
            "收藏数": parse_count(photo.get("collectCount")),
            "榜单排名": len(records) + 1,
            "分析状态": "待分析",
        }
        records.append(rec)
        if len(records) >= limit:
            break
    print(f"[快手] 解析出 {len(records)} 条有效记录")
    return records


# ---------- 抖音 ----------
DY_SEARCH_KEYS = ["data"]


def collect_douyin(ctx, keyword, limit):
    page = ctx.new_page()
    items = []

    def on_response(resp):
        try:
            u = resp.url
            if "search" not in u or ("aweme" not in u and "item" not in u):
                return
            ct = (resp.headers or {}).get("content-type", "")
            if "json" not in ct:
                return
            body = resp.text()
            d = json.loads(body)
            # /aweme/v1/web/search/item/ 结构: data.data[] 或 data.aweme_list[]
            dd = d.get("data") or {}
            lst = dd.get("data") or dd.get("aweme_list") or []
            if isinstance(lst, list):
                items.extend([x for x in lst if isinstance(x, dict) and x.get("aweme_id")])
        except Exception:
            pass

    page.on("response", on_response)
    from urllib.parse import quote
    url = f"https://www.douyin.com/search/{quote(keyword)}"
    print(f"[抖音] 打开搜索页: {url}")
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=45000)
    except Exception as e:
        print(f"  [抖音被拦截] {type(e).__name__}: {str(e)[:100]}")
        print("  抖音主站风控严格，本次抖音 0 条。建议：先跑 login_once.py 登录后重试，")
        print("  或改用快手数据（字段完全一致）。")
        page.close()
        return []

    for i in range(10):
        page.mouse.wheel(0, 2400)
        page.wait_for_timeout(1800)
        print(f"  滚动 {i+1}/10  捕获 items={len(items)}")
        if len(items) >= limit * 1.5:
            break

    records, seen = [], set()
    for it in items:
        aid = it.get("aweme_id")
        if not aid or aid in seen:
            continue
        seen.add(aid)
        stat = it.get("statistics") or {}
        author = it.get("author") or {}
        caption = it.get("desc")
        title, tags, cap = split_caption(caption)
        ts = it.get("create_time")
        rec = {
            "平台": "抖音",
            "作品ID": str(aid),
            "来源链接": f"https://www.douyin.com/video/{aid}",
            "标题": title,
            "发布文案": cap,
            "话题标签": tags,
            "账号名称": author.get("nickname"),
            "发布时间": ms_to_str(ts * 1000) if ts else None,
            "点赞数": parse_count(stat.get("digg_count")),
            "评论数": parse_count(stat.get("comment_count")),
            "转发数": parse_count(stat.get("share_count")),
            "收藏数": parse_count(stat.get("collect_count")),
            "榜单排名": len(records) + 1,
            "分析状态": "待分析",
        }
        records.append(rec)
        if len(records) >= limit:
            break
    print(f"[抖音] 解析出 {len(records)} 条有效记录")
    page.close()
    return records


# ---------- 主流程 ----------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--platform", required=True, choices=["快手", "抖音"])
    ap.add_argument("--keyword", required=True, help="搜索关键词")
    ap.add_argument("--limit", type=int, default=20)
    ap.add_argument("--no-ingest", action="store_true", help="只抓取，不入库")
    ap.add_argument("--out", default=None, help="原始记录另存 JSON")
    ap.add_argument("--headless", action="store_true",
                    help="无窗口运行（定时任务用）；注意：抖音大概率仍需有头")
    a = ap.parse_args()

    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            PROFILE,
            executable_path=CHROME,
            headless=a.headless,
            args=["--disable-blink-features=AutomationControlled",
                  "--no-first-run", "--no-default-browser-check"],
            user_agent=UA,
            viewport={"width": 1440, "height": 900},
            locale="zh-CN", timezone_id="Asia/Shanghai",
        )
        ctx.add_init_script(STEALTH)
        if a.platform == "快手":
            records = collect_kuaishou(ctx, a.keyword, a.limit)
        else:
            records = collect_douyin(ctx, a.keyword, a.limit)
        ctx.close()

    if a.out:
        Path(a.out).write_text(json.dumps(records, ensure_ascii=False, indent=2),
                               encoding="utf-8")
        print(f"原始记录已另存: {a.out}")

    if not records:
        print("未采集到任何记录，结束。")
        return

    if a.no_ingest:
        print(json.dumps(records[:3], ensure_ascii=False, indent=2))
        print(f"…… 共 {len(records)} 条（--no-ingest 模式，未写飞书）")
        return

    print("\n===== 入库飞书视频库 =====")
    ingest(records)


if __name__ == "__main__":
    main()
