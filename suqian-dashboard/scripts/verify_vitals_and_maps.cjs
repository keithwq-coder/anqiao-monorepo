const { chromium } = require("C:\\Users\\K\\.agents\\skills\\dashi-ppt\\project\\node_modules\\playwright-core");
const path = require("path");
const fs = require("fs");

(async () => {
  const outDir = path.join(__dirname, "../shots");
  fs.mkdirSync(outDir, { recursive: true });

  const exe = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  console.log("Launching headless Chrome for verification...");
  const browser = await chromium.launch({
    executablePath: fs.existsSync(exe) ? exe : undefined,
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  // 1. Verify ScreenPatrol (巡查屏)
  console.log("\n=== 1. Checking ScreenPatrol (巡查屏三生理指标示波) ===");
  await page.goto("http://localhost:4174/#/patrol", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const cards = await page.$$(".telemetry-pod");
  console.log("Telemetry cards count:", cards.length);

  const legends = await page.$$eval(".pod-ecg-legend .leg-item", els => els.map(e => e.innerText.trim()));
  console.log("ECG Legend items found:", legends);

  const vitalsText = await page.$$eval(".pod-vitals-line", els => els.map(e => e.innerText.trim()));
  console.log("First card vitals text:", vitalsText[0]);

  await page.screenshot({ path: path.join(outDir, "patrol_3_vitals.png"), fullPage: true });
  console.log("Saved: shots/patrol_3_vitals.png");

  // 2. Verify ScreenTwin (点位孪生)
  console.log("\n=== 2. Checking ScreenTwin (点位孪生) ===");
  await page.goto("http://localhost:4174/#/twin", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const twinBadge = await page.$eval(".hud-badge", el => el.innerText.trim()).catch(() => "");
  console.log("Twin top badge:", twinBadge);

  const deviceMetas = await page.$$eval(".dsc-meta", els => els.map(e => e.innerText.trim()));
  console.log("Device status card metas:", deviceMetas.slice(0, 8));

  await page.screenshot({ path: path.join(outDir, "twin_devices_displayed.png"), fullPage: true });
  console.log("Saved: shots/twin_devices_displayed.png");

  // 3. Verify ScreenNation (全国态势)
  console.log("\n=== 3. Checking ScreenNation (全国态势) ===");
  await page.goto("http://localhost:4174/#/nation", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const nationBadge = await page.$eval(".hud-badge", el => el.innerText.trim()).catch(() => "");
  console.log("Nation badge:", nationBadge);

  const assetRows = await page.$$eval(".nation-rank-row", els => els.map(e => e.innerText.trim().replace(/\n/g, ' | ')));
  console.log("Nation asset rows count:", assetRows.length);
  console.log("First asset row:", assetRows[0]);

  await page.screenshot({ path: path.join(outDir, "nation_devices_displayed.png"), fullPage: true });
  console.log("Saved: shots/nation_devices_displayed.png");

  await browser.close();
  console.log("\nVerification completed successfully!");
})();
