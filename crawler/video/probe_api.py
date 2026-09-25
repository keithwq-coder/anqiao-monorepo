# -*- coding: utf-8 -*-
"""纯 HTTP 探测 iesdouyin 公开榜单 API（无需浏览器、无需签名）"""
import json
import ssl
import urllib.request
import urllib.error
from pathlib import Path

OUT = Path(__file__).parent / "probe_out"
OUT.mkdir(exist_ok=True)

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

API = "https://www.iesdouyin.com/web/api/v2/hotsearch/billboard/{}/"
BOARDS = ["word", "aweme", "star", "music", "brand", "hotspot_challenge"]

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE


def get(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://www.iesdouyin.com/share/billboard/",
        "Accept-Language": "zh-CN,zh;q=0.9",
    })
    try:
        with urllib.request.urlopen(req, timeout=20, context=ctx) as r:
            return r.status, r.read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as e:
        return e.code, (e.read().decode("utf-8", "ignore") if e.fp else "")
    except Exception as e:
        return 0, f"{type(e).__name__}: {e}"


results = {}
for b in BOARDS:
    st, txt = get(API.format(b))
    print(f"\n{'='*60}\n[{b}] 状态={st} 长度={len(txt)}")
    ok = False
    if st == 200:
        try:
            d = json.loads(txt)
            results[b] = d
            ok = True
            items = d.get("word_list") or d.get("aweme_list") or d.get("user_list") \
                or d.get("music_list") or d.get("brand_list") or d.get("challenge_list") \
                or d.get("data") or []
            if isinstance(items, dict):
                items = list(items.values())
            print(f"  status_code={d.get('status_code')}  条目数={len(items)}")
            for it in items[:4]:
                keys = list(it.keys())[:14] if isinstance(it, dict) else []
                print(f"    - keys: {keys}")
                if isinstance(it, dict):
                    for k in ("word", "hot_value", "desc", "title", "nickname",
                              "author", "name", "aweme_id"):
                        if k in it:
                            v = it[k]
                            print(f"        {k} = {str(v)[:70]}")
            (OUT / f"api_{b}.json").write_text(txt, encoding="utf-8")
        except Exception as e:
            print(f"  JSON 解析失败: {e}")
            print(f"  原始: {txt[:200]}")
    else:
        print(f"  失败: {txt[:200]}")

print(f"\n{'='*60}\n可用榜单: {[b for b in results]}")
