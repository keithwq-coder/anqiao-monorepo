# -*- coding: utf-8 -*-
"""
抖音/快手 可达性探针（只读，不写任何数据）
目的：实测在不登录 / 已登录两种状态下，公开页面能拿到哪些字段。
"""
import sys
import json
import re
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(__file__).parent / "probe_out"
OUT.mkdir(exist_ok=True)

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

TARGETS = [
    ("douyin_hot", "https://www.douyin.com/hot"),
    ("douyin_search", "https://www.douyin.com/search/%E5%85%BB%E8%80%81"),
    ("kuaishou", "https://www.kuaishou.com/?isHome=1"),
]

STEALTH = """
Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
window.chrome = {runtime: {}};
Object.defineProperty(navigator, 'languages', {get: () => ['zh-CN','zh']});
Object.defineProperty(navigator, 'plugins', {get: () => [1,2,3,4,5]});
"""


def probe(ctx, page, name, url):
    print(f"\n{'='*60}\n[{name}] {url}")
    rec = {"name": name, "url": url, "api_hits": []}
    captured = []

    def on_response(resp):
        try:
            ct = (resp.headers or {}).get("content-type", "")
            if "json" not in ct:
                return
            u = resp.url
            if not any(k in u for k in ("douyin", "kuaishou", "iesdouyin", "amemv")):
                return
            body = resp.text()
            if not body or len(body) < 80:
                return
            captured.append({"url": u, "status": resp.status, "len": len(body), "sample": body[:1200]})
        except Exception:
            pass

    page.on("response", on_response)
    try:
        resp = page.goto(url, wait_until="domcontentloaded", timeout=45000)
        rec["status"] = resp.status if resp else None
        page.wait_for_timeout(9000)
        # 模拟滚动，触发懒加载
        for _ in range(3):
            page.mouse.wheel(0, 2200)
            page.wait_for_timeout(1800)
        rec["final_url"] = page.url
        rec["title"] = page.title()

        body = page.inner_text("body") or ""
        rec["body_len"] = len(body)
        rec["body_head"] = body[:1500]

        # 登录墙信号
        signals = {
            "need_login": bool(re.search(r"登录|扫码|验证|安全验证|滑动", body[:3000])),
            "has_hot_list": bool(re.search(r"热榜|热点榜|榜单", body)),
        }
        rec.update(signals)

        # 抓结构：视频卡片链接
        links = page.eval_on_selector_all(
            "a[href*='/video/'], a[href*='/short-video/']",
            "els => els.slice(0,25).map(e => e.getAttribute('href'))"
        )
        rec["video_links"] = links
        rec["video_link_count"] = len(links)

        print(f"  状态={rec['status']}  最终URL={rec['final_url']}")
        print(f"  标题={rec['title']}")
        print(f"  正文长度={rec['body_len']}  需登录信号={signals['need_login']}  有榜单信号={signals['has_hot_list']}")
        print(f"  视频链接数={rec['video_link_count']}")
        for l in rec["video_links"][:5]:
            print(f"    - {l}")
        print("  --- 正文前 400 字 ---")
        print("  " + body[:400].replace("\n", " | "))

        # 关键：截获的 API JSON
        print(f"\n  === 截获 JSON 接口 {len(captured)} 个 ===")
        seen = set()
        for c in captured:
            key = re.sub(r"[\d?=&_-]{6,}", "", c["url"])[:90]
            if key in seen:
                continue
            seen.add(key)
            print(f"  [{c['status']}] {c['len']:>7}B  {c['url'][:150]}")
        rec["api_hits"] = [
            {"url": c["url"], "status": c["status"], "len": c["len"], "sample": c["sample"]}
            for c in captured if c["len"] > 200
        ][:40]

    except Exception as e:
        rec["error"] = f"{type(e).__name__}: {e}"
        print(f"  [错误] {rec['error']}")

    try:
        page.screenshot(path=str(OUT / f"{name}.png"), full_page=False,
                        timeout=15000, animations="disabled")
    except Exception as se:
        print(f"  [截图跳过] {type(se).__name__}")
    page.remove_listener("response", on_response)
    return rec


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "cold"   # cold | login
    results = []
    with sync_playwright() as p:
        launch_kwargs = dict(
            executable_path=CHROME,
            headless=False,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-infobars",
                "--no-first-run",
                "--no-default-browser-check",
                "--start-maximized",
            ],
        )
        ctx_args = dict(
            user_agent=UA,
            viewport={"width": 1440, "height": 900},
            locale="zh-CN",
            timezone_id="Asia/Shanghai",
        )
        if mode == "login":
            # 持久化目录：扫码一次，后续复用
            prof = str(Path(__file__).parent / "browser_profile")
            ctx = p.chromium.launch_persistent_context(prof, **launch_kwargs, **ctx_args)
            print(f"[持久化登录模式] profile={prof}")
            print(">>> 如弹出登录页，请在浏览器里完成登录，然后回到终端按回车继续 <<<")
        else:
            browser = p.chromium.launch(**launch_kwargs)
            ctx = browser.new_context(**ctx_args)

        ctx.add_init_script(STEALTH)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()

        if mode == "login":
            page.goto("https://www.douyin.com/", wait_until="domcontentloaded")
            input(">>> 登录完成后按回车继续采集 ... ")

        for name, url in TARGETS:
            results.append(probe(ctx, page, name, url))

        ctx.close()

    (OUT / f"probe_{mode}.json").write_text(
        json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n已保存: {OUT / f'probe_{mode}.json'}")


if __name__ == "__main__":
    main()
