const { chromium } = require("C:\\Users\\K\\.agents\\skills\\dashi-ppt\\project\\node_modules\\playwright-core");

(async () => {
  const exe = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('[PAGE LOG]', msg.text()));
  page.on('requestfailed', req => console.log('[REQ FAILED]', req.url(), req.failure()?.errorText));
  page.on('response', async res => {
    if (res.url().includes('api')) {
      console.log('[API RESP]', res.status(), res.url());
      try {
        const text = await res.text();
        console.log('[API BODY]', text.slice(0, 200));
      } catch {}
    }
  });

  await page.goto("https://anqiao.aibrain.wiki/dash/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  const token = await page.evaluate(() => localStorage.getItem('anqiao_hw_token'));
  console.log('Stored HW Token:', token ? token.slice(0, 20) + '...' : 'NONE');

  await browser.close();
})();
