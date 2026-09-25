const { chromium } = require("C:\\Users\\K\\.agents\\skills\\dashi-ppt\\project\\node_modules\\playwright-core");
const path = require("path");
const fs = require("fs");

(async () => {
  const outDir = path.join(__dirname, "../shots");
  const exe = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const browser = await chromium.launch({
    executablePath: fs.existsSync(exe) ? exe : undefined,
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1.25,
  });

  const page = await context.newPage();
  await page.goto("https://anqiao.aibrain.wiki/dash/", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  // Switch to anqiao org
  await page.click(".header-org-trigger");
  await page.waitForTimeout(500);
  const items = await page.$$(".header-org-menu-item");
  for (const item of items) {
    const name = await item.$eval(".item-name", el => el.innerText.trim());
    if (name.includes("中科安樵")) {
      await item.click();
      await page.waitForTimeout(1500);
      break;
    }
  }

  // Screen 1: 全域态势 (dock button 0)
  const dockButtons = await page.$$(".command-dock .dock-btn");
  if (dockButtons.length > 0) {
    await dockButtons[0].click();
    await page.waitForTimeout(2000);
  }

  const shotPath = path.join(outDir, "verify_05_overview_100pct.png");
  await page.screenshot({ path: shotPath, fullPage: true });
  console.log("Saved overview screenshot to:", shotPath);

  await browser.close();
})();
