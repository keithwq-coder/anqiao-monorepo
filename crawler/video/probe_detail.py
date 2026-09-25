# -*- coding: utf-8 -*-
"""
第二轮探针：
1) 抖音重试（确认是否被风控 / 是否需要登录）
2) 快手详情页字段提取（标题/作者/时间/点赞/评论/收藏/文案/话题）
只读，不写任何数据。
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
STEALTH = """
Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
window.chrome = {runtime: {}};
Object.defineProperty(navigator, 'languages', {get: () => ['zh-CN','zh']});
"""


def new_ctx(p, persistent=None):
    kw = dict(executable_path=CHROME, headless=False,
              args=["--disable-blink-features=AutomationControlled",
                    "--no-first-run", "--no-default-browser-check"])
    ca = dict(user_agent=UA, viewport={"width": 1440, "height": 900},
              locale="zh-CN", timezone_id="Asia/Shanghai")
    if persistent:
        return p.chromium.launch_persistent_context(persistent, **kw, **ca)
    b = p.chromium.launch(**kw)
    return b.new_context(**ca)


def try_douyin(ctx):
    print(f"\n{'='*62}\n[A] 抖音重试")
    page = ctx.new_page()
    for url in ["https://www.douyin.com/hot",
                "https://www.douyin.com/",
                "https://www.iesdouyin.com/share/billboard/"]:
        try:
            r = page.goto(url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)
            body = page.inner_text("body") or ""
            print(f"  {url}")
            print(f"    状态={r.status if r else '?'}  正文长度={len(body)}")
            print(f"    前200字: {body[:200].replace(chr(10),' | ')}")
        except Exception as e:
            print(f"  {url}")
            print(f"    [失败] {type(e).__name__}: {str(e)[:120]}")
        page.wait_for_timeout(3000)
    page.close()


def ks_detail(ctx, url):
    print(f"\n{'='*62}\n[B] 快手详情页字段提取\n  {url}")
    page = ctx.new_page()
    out = {"url": url}
    try:
        r = page.goto(url, wait_until="domcontentloaded", timeout=40000)
        page.wait_for_timeout(7000)
        out["status"] = r.status if r else None
        out["final_url"] = page.url
        out["title"] = page.title()
        body = page.inner_text("body") or ""
        out["body_len"] = len(body)

        # 常见字段定位
        sel_map = {
            "视频标题": ["h1", ".video-title", "[class*='title']"],
            "作者名": [".user-name", "[class*='userName']", "[class*='author']"],
            "点赞": ["[class*='like']", "[class*='Like']"],
            "评论": ["[class*='comment']", "[class*='Comment']"],
            "收藏": ["[class*='collect']", "[class*='Collect']"],
            "分享": ["[class*='share']", "[class*='Share']"],
            "时间": ["[class*='time']", "[class*='date']", "time"],
        }
        print(f"  状态={out['status']}  标题={out['title']}  正文长度={len(body)}")
        found = {}
        for label, sels in sel_map.items():
            vals = []
            for s in sels:
                try:
                    els = page.query_selector_all(s)
                    for e in els[:3]:
                        t = (e.inner_text() or "").strip()
                        if t and len(t) < 60 and t not in vals:
                            vals.append(t)
                except Exception:
                    pass
                if vals:
                    break
            found[label] = vals
            print(f"    {label}: {vals}")

        # 页面内嵌 JSON（快手通常有 __INITIAL_STATE__）
        init = page.evaluate("""() => {
            for (const k of ['__INITIAL_STATE__','__NUXT__','__APP_DATA__']) {
                if (window[k]) return {key:k, len: JSON.stringify(window[k]).length,
                                       sample: JSON.stringify(window[k]).slice(0,1500)};
            }
            return null;
        }""")
        out["init_state"] = init
        print(f"    内嵌状态: {init['key'] if init else '无'} "
              f"({init['len'] if init else 0} 字符)")
        if init:
            print(f"    样本: {init['sample'][:400]}")

        out["found"] = found
        out["body_head"] = body[:1200]
        print("  --- 正文前 500 字 ---")
        print("  " + body[:500].replace("\n", " | "))
    except Exception as e:
        out["error"] = f"{type(e).__name__}: {e}"
        print(f"  [错误] {out['error']}")
    try:
        page.screenshot(path=str(OUT / "ks_detail.png"), timeout=15000,
                        animations="disabled")
    except Exception:
        pass
    page.close()
    return out


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "cold"
    ks_url = (sys.argv[2] if len(sys.argv) > 2
              else "https://www.kuaishou.com/short-video/3xv4ut2na8devku")
    res = {}
    with sync_playwright() as p:
        if mode == "login":
            prof = str(Path(__file__).parent / "browser_profile")
            ctx = new_ctx(p, prof)
            print(f"[持久化登录模式] {prof}")
            ctx.add_init_script(STEALTH)
            pg = ctx.pages[0] if ctx.pages else ctx.new_page()
            pg.goto("https://www.douyin.com/", wait_until="domcontentloaded")
            input(">>> 登录完成后按回车继续 ... ")
        else:
            ctx = new_ctx(p)
            ctx.add_init_script(STEALTH)
        res["douyin"] = try_douyin(ctx) if mode != "skipdy" else "skipped"
        res["ks_detail"] = ks_detail(ctx, ks_url)
        ctx.close()
    (OUT / f"probe2_{mode}.json").write_text(
        json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n已保存: {OUT / f'probe2_{mode}.json'}")


if __name__ == "__main__":
    main()
