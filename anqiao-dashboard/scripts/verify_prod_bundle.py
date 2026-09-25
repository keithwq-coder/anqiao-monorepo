import urllib.request, ssl, re

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

resp = urllib.request.urlopen('https://anqiao.aibrain.wiki/dash/index.html', context=ctx)
html = resp.read().decode('utf-8')
js_files = re.findall(r'src=["\']([^"\']+\.js)["\']', html)
print('JS files:', js_files)
import urllib.parse
for js in js_files:
    url = urllib.parse.urljoin('https://anqiao.aibrain.wiki/', js)
    data = urllib.request.urlopen(url, context=ctx).read().decode('utf-8')
    print(f'{js}: size={len(data)}')
    # 阶段四：生产构建禁止浏览器直连硬件云与硬编码凭据（INTEGRATION-SPEC §6-1 / API-CONTRACT §3.5）
    print('  has /hardware-api:', '/hardware-api' in data)
    print('  has health-track host:', 'api.health-track.anqiaokj.com' in data)
    print('  has VITE_HW leftover:', 'VITE_HW_' in data)
    print('  has admin:', 'admin' in data)
    print('  has 123456:', '123456' in data)
    # 验收口径：生产构建不得包含历史硬编码凭据（INTEGRATION-SPEC §6-1）
    assert '/hardware-api' not in data, '生产包仍含 /hardware-api 直连代理'
    assert 'VITE_HW_' not in data, '生产包仍含 VITE_HW_* 凭据引用'
    assert '123456' not in data, '生产包仍含历史明文口令 123456'
print('OK: no browser hardware credentials in prod bundle')
