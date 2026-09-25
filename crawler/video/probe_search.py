# -*- coding: utf-8 -*-
"""
第三轮探针：关键词搜索页（决定性验证）
只读，不写数据。
"""
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
Object.defineProperty(navigator,'webdriver',{get:()=>undefined});
window.chrome={runtime:{}};
Object.defineProperty(navigator,'languages',{get:()=>['zh-CN','zh']});
"""

TARGETS = [
    ("ks_search", "https://www.kuaishou.com/search/video?searchKey=%E5%85%BB%E8%80%81"),
    ("dy_billboard_video", "https://www.iesdouyin.com/share/billboard/video/"),
    ("dy_billboard_hot", "https://www.iesdouyin.com/share/billboard/"),
]


def run():
    res = []
    with sync_playwright() as p:
        b = p.chromium.launch(
            executable_path=CHROME, headless=False,
            args=["--disable-blink-features=AutomationControlled",
                  "--no-first-run", "--no-default-browser-check"])
        ctx = b.new_context(user_agent=UA, viewport={"width": 1440, "height": 900},
                            locale="zh-CN", timezone_id="Asia/Shanghai")
        ctx.add_init_script(STEALTH)
        page = ctx.new_page()

        for name, url in TARGETS:
            print(f"\n{'='*62}\n[{name}] {url}")
            rec = {"name": name, "url": url, "jsons": []}
            caps = []

            def on_resp(r, _c=caps):
                try:
                    if "json" not in (r.headers or {}).get("content-type", ""):
                        return
                    t = r.text()
                    if t and len(t) > 200:
                        _c.append({"url": r.url, "len": len(t), "head": t[:300]})
                except Exception:
                    pass

            page.on("response", on_resp)
            try:
                r = page.goto(url, wait_until="domcontentloaded", timeout=40000)
                page.wait_for_timeout(6000)
                for _ in range(3):
                    page.mouse.wheel(0, 2500)
                    page.wait_for_timeout(1800)
                body = page.inner_text("body") or ""
                rec.update(status=r.status if r else None,
                           final=page.url, title=page.title(),
                           body_len=len(body), body_head=body[:900])
                links = page.eval_on_selector_all(
                    "a[href*='/short-video/'], a[href*='/video/']",
                    "e=>e.slice(0,30).map(x=>x.getAttribute('href'))")
                rec["links"] = list(dict.fromkeys(links))
                print(f"  状态={rec['status']} 标题={rec['title']} 正文={len(body)}字")
                print(f"  视频链接 {len(rec['links'])} 个")
                for l in rec["links"][:6]:
                    print(f"    - {l}")
                print("  --- 正文前 600 字 ---")
                print("  " + body[:600].replace("\n", " | "))
                print(f"\n  === JSON 接口 {len(caps)} 个 ===")
                seen = set()
                for c in caps:
                    k = re.sub(r"[\d?=&_-]{6,}", "", c["url"])[:80]
                    if k in seen:
                        continue
                    seen.add(k)
                    print(f"  [{c['len']:>7}B] {c['url'][:130]}")
                rec["jsons"] = caps[:25]
            except Exception as e:
                rec["error"] = f"{type(e).__name__}: {str(e)[:150]}"
                print(f"  [错误] {rec['error']}")
            page.remove_listener("response", on_resp)
            try:
                page.screenshot(path=str(OUT / f"{name}.png"), timeout=15000,
                                animations="disabled")
            except Exception:
                pass
            res.append(rec)

        ctx.close()
        b.close()
    (OUT / "probe3.json").write_text(
        json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n已保存 {OUT/'probe3.json'}")


if __name__ == "__main__":
    run()
