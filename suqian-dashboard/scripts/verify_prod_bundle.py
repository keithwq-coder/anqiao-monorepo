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
    print('  has /hardware-api:', '/hardware-api' in data)
    print('  has admin:', 'admin' in data)
    print('  has 123456:', '123456' in data)
    # 验收口径：生产构建不得包含历史硬编码凭据（INTEGRATION-SPEC §6-1）
