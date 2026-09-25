# -*- coding: utf-8 -*-
"""
登录一次：打开持久化浏览器，扫码登录抖音 + 快手，cookie 长期保存。
登录成功后脚本自动识别并关闭浏览器。
之后所有采集都复用这份登录态，无需再扫码。
"""
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

PROFILE = str(Path(__file__).parent / "browser_profile")
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

# 登录成功判定：存在以下 cookie 即认为已登录
LOGIN_MARK = {
    "抖音": {"domain_contains": "douyin", "names": {"sessionid", "sessionid_ss",
                                                  "sid_ucp_v1", "sid_tt"}},
    "快手": {"domain_contains": "kuaishou", "names": {"userId", "kuaishou.server.web_st",
                                                    "kuaishou.server.web_ph"}},
}
TARGETS = {
    "抖音": "https://www.douyin.com/",
    "快手": "https://www.kuaishou.com/",
}


def check_logins(ctx):
    try:
        cookies = ctx.cookies()
    except Exception:
        return {}
    state = {}
    for plat, cfg in LOGIN_MARK.items():
        hit = [c["name"] for c in cookies
               if cfg["domain_contains"] in (c.get("domain") or "")
               and c["name"] in cfg["names"]]
        state[plat] = hit
    return state


def main():
    timeout = int(sys.argv[1]) if len(sys.argv) > 1 else 600
    print("=" * 62)
    print("首次登录：请在弹出的浏览器里扫码登录 抖音 和 快手")
    print("登录完成后本窗口会自动关闭，cookie 保存在：")
    print(f"  {PROFILE}")
    print("=" * 62)

    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            PROFILE,
            executable_path=CHROME,
            headless=False,
            args=["--disable-blink-features=AutomationControlled",
                  "--no-first-run", "--no-default-browser-check",
                  "--start-maximized"],
            user_agent=UA,
            viewport={"width": 1440, "height": 900},
            locale="zh-CN",
            timezone_id="Asia/Shanghai",
            no_viewport=False,
        )
        ctx.add_init_script(
            "Object.defineProperty(navigator,'webdriver',{get:()=>undefined});"
            "window.chrome={runtime:{}};")

        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(TARGETS["抖音"], wait_until="domcontentloaded")
        ks = ctx.new_page()
        ks.goto(TARGETS["快手"], wait_until="domcontentloaded")

        start = time.time()
        done = set()
        while time.time() - start < timeout:
            time.sleep(3)
            try:
                if not ctx.pages:
                    print("\n[浏览器已关闭]")
                    break
            except Exception:
                break
            st = check_logins(ctx)
            for plat, hits in st.items():
                if hits and plat not in done:
                    done.add(plat)
                    print(f"  [✓] {plat} 登录成功  (cookie: {', '.join(hits[:3])})")
                elif not hits and plat in done:
                    done.discard(plat)
            if len(done) == len(LOGIN_MARK):
                print("\n两个平台均已登录，3 秒后自动关闭浏览器……")
                time.sleep(3)
                break
            left = int(timeout - (time.time() - start))
            if left % 30 < 3:
                todo = [x for x in LOGIN_MARK if x not in done]
                print(f"\r  等待登录: {'、'.join(todo)}   剩余 {left}s   ",
                      end="", flush=True)
        try:
            ctx.close()
        except Exception:
            pass

    print("\n登录态已保存。现在可以运行采集：")
    print("  python run.py --platform 抖音 --keyword 养老 --limit 30")


if __name__ == "__main__":
    main()
