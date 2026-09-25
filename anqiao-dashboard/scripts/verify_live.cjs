const { chromium } = require("C:\\Users\\K\\.agents\\skills\\dashi-ppt\\project\\node_modules\\playwright-core");
const path = require("path");
const fs = require("fs");

(async () => {
  const outDir = path.join(__dirname, "../shots");
  fs.mkdirSync(outDir, { recursive: true });

  const exe = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  console.log("Launching headless Chrome to inspect https://anqiao.aibrain.wiki/dash/#/patrol?org=anqiao ...");
  const browser = await chromium.launch({
    executablePath: fs.existsSync(exe) ? exe : undefined,
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1.25,
  });

  const page = await context.newPage();

  page.on('console', msg => console.log('[CONSOLE]', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('[PAGE ERROR]', err.message));
  page.on('requestfailed', req => console.log('[REQ FAILED]', req.url(), req.failure()?.errorText));

  console.log("Navigating to https://anqiao.aibrain.wiki/dash/#/patrol?org=anqiao ...");
  await page.goto("https://anqiao.aibrain.wiki/dash/#/patrol?org=anqiao", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000); // Wait 6s for login and poll

  // Get status tabs
  const tabs = await page.$$eval(".cyber-tab", els => els.map(e => e.innerText.trim()));
  console.log("Screen 2 Status tabs:", tabs);

  // Counter echo text
  const counterEcho = await page.$eval(".s2-counter-echo", el => el.innerText.trim()).catch(() => "");
  console.log("Counter echo:", counterEcho);

  // Get telemetry cards
  const cards = await page.$$eval(".telemetry-pod", pods => {
    return pods.map(p => {
      const code = p.querySelector(".pod-bed-num")?.innerText.trim();
      const name = p.querySelector(".name-row .name")?.innerText.trim();
      const presence = p.querySelector(".pod-presence")?.innerText.trim();
      const footer = p.querySelector(".pod-footer")?.innerText.trim();
      return { code, name, presence, footer };
    });
  });

  console.log(`Total telemetry cards rendered: ${cards.length}`);

  const d1038 = cards.find(c => c.code?.includes("1038") || c.name?.includes("1038"));
  const d1021 = cards.find(c => c.code?.includes("1021") || c.name?.includes("1021"));
  const d1146 = cards.find(c => c.code?.includes("1146") || c.name?.includes("1146"));
  const d10002 = cards.find(c => c.code?.includes("10002") || c.name?.includes("10002"));
  const d1006 = cards.find(c => c.code?.includes("1006") || c.name?.includes("1006"));

  console.log("Device 1038:", d1038);
  console.log("Device 1021:", d1021);
  console.log("Device 1146:", d1146);
  console.log("Device 10002:", d10002);
  console.log("Device 1006:", d1006);

  const shotPath = path.join(outDir, "verify_04_live_1038_1021.png");
  await page.screenshot({ path: shotPath, fullPage: true });
  console.log("Saved screenshot to:", shotPath);

  await browser.close();
})();
