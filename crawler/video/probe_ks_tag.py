# -*- coding: utf-8 -*-
"""快手话题/发现页探针：验证"按主题拿视频列表"是否免登录"""
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(__file__).parent / "probe_out"
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
STEALTH = """
Object.defineProperty(navigator,'webdriver',{get:()=>undefined});
window.chrome={runtime:{}};
"""

TARGETS = [
    ("ks_tag", "https://www.kuaishou.com/tag/%E5%85%BB%E8%80%81"),
    ("ks_discover", "https://www.kuaishou.com/bring"),
    ("ks_profile_r", "https://www.kuaishou.com/?isHome=1&category=1"),
]

res = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=False,
                          args=["--disable-blink-features=AutomationControlled",
                                "--no-first-run"])
    ctx = b.new_context(user_agent=UA, viewport={"width": 1440, "height": 900},
                        locale="zh-CN", timezone_id="Asia/Shanghai")
    ctx.add_init_script(STEALTH)
    page = ctx.new_page()
    for name, url in TARGETS:
        print(f"\n{'='*60}\n[{name}] {url}")
        rec = {"name": name, "url": url}
        try:
            r = page.goto(url, wait_until="domcontentloaded", timeout=35000)
            page.wait_for_timeout(6000)
            for _ in range(2):
                page.mouse.wheel(0, 2500)
                page.wait_for_timeout(1500)
            body = page.inner_text("body") or ""
            links = page.eval_on_selector_all(
                "a[href*='/short-video/']", "e=>e.slice(0,30).map(x=>x.getAttribute('href'))")
            rec.update(status=r.status if r else None, final=page.url,
                       body_len=len(body), links=list(dict.fromkeys(links)))
            print(f"  状态={rec['status']} 最终={rec['final']} 正文={len(body)}字 "
                  f"视频链接={len(rec['links'])}")
            for l in rec["links"][:5]:
                print(f"    - {l}")
            print("  正文前300: " + body[:300].replace("\n", " | "))
        except Exception as e:
            rec["error"] = f"{type(e).__name__}: {str(e)[:120]}"
            print(f"  [错误] {rec['error']}")
        res.append(rec)
    ctx.close(); b.close()

(OUT / "probe4.json").write_text(json.dumps(res, ensure_ascii=False, indent=2),
                                 encoding="utf-8")
print(f"\n已保存 {OUT/'probe4.json'}")
