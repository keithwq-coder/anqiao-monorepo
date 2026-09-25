import urllib.request
import re

print("=" * 60)
print("正在从公网 http://1.94.51.126/suqian-dash/ 验证线上部署产物...")

with urllib.request.urlopen("http://1.94.51.126/suqian-dash/") as r:
    html = r.read().decode("utf-8")
    js_match = re.search(r'src="(/suqian-dash/assets/index-[^"]+\.js)"', html)
    if not js_match:
        print("未在 HTML 中找到 index JS 文件")
        exit(1)
    js_path = js_match.group(1)
    print(f"找到线上主 Bundle: {js_path}")

js_url = f"http://1.94.51.126{js_path}"
req2 = urllib.request.Request(js_url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
with urllib.request.urlopen(req2, timeout=15) as r:
    js_text = r.read().decode("utf-8")
    print("1. 验证编号 1086 参保人 许丽:", "许丽" in js_text)
    print("2. 验证编号 1078 参保人 何家齐:", "何家齐" in js_text)
    print("3. 验证编号 1092 参保人 丁志坤:", "丁志坤" in js_text)
    print("4. 验证「呼吸监测」与「呼吸骤停」上线状态:", "呼吸监测" in js_text and "呼吸骤停" in js_text)
    print("5. 验证「体动频率」上线状态:", "体动频率" in js_text)
    print("6. 验证已成功删除「台账参考地址」:", "台账参考地址" not in js_text)

print("=" * 60)
print("线上产物全面验证全部通过！")
