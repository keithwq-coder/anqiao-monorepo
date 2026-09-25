const { chromium } = require("C:\\Users\\K\\.agents\\skills\\dashi-ppt\\project\\node_modules\\playwright-core");
const path = require("path");
const fs = require("fs");

(async () => {
  const artifactDir = "C:\\Users\\K\\.gemini\\antigravity\\brain\\59486fcd-062a-41dc-8214-24f37076aa64";
  const exe = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

  console.log("Launching headless Chrome...");
  const browser = await chromium.launch({
    executablePath: fs.existsSync(exe) ? exe : undefined,
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();
  
  // Test Anqiao (longest title)
  console.log("Navigating to https://anqiao.aibrain.wiki/dash/?org=anqiao...");
  await page.goto("https://anqiao.aibrain.wiki/dash/?org=anqiao", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  // Full screen shot
  const shotPath1 = path.join(artifactDir, "verify_header_anqiao_full.png");
  await page.screenshot({ path: shotPath1 });
  console.log("Saved:", shotPath1);

  // Crop header bridge area (x: 0, y: 0, width: 1920, height: 120)
  const headerElem = await page.$(".header-bridge");
  if (headerElem) {
    const shotPathHeader = path.join(artifactDir, "verify_header_anqiao_crop.png");
    await headerElem.screenshot({ path: shotPathHeader });
    console.log("Saved header crop:", shotPathHeader);
  }

  // Also test dropdown open state
  const trigger = await page.$(".header-org-trigger");
  if (trigger) {
    await trigger.click();
    await page.waitForTimeout(500);
    const shotPathDropdown = path.join(artifactDir, "verify_header_dropdown_crop.png");
    await headerElem.screenshot({ path: shotPathDropdown });
    console.log("Saved header dropdown crop:", shotPathDropdown);
  }

  // Test Kaijian
  console.log("Navigating to https://anqiao.aibrain.wiki/dash/?org=kaijian...");
  await page.goto("https://anqiao.aibrain.wiki/dash/?org=kaijian", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const headerElemKaijian = await page.$(".header-bridge");
  if (headerElemKaijian) {
    const shotPathKaijian = path.join(artifactDir, "verify_header_kaijian_crop.png");
    await headerElemKaijian.screenshot({ path: shotPathKaijian });
    console.log("Saved header kaijian crop:", shotPathKaijian);
  }

  await browser.close();
  console.log("All header verification screenshots captured successfully!");
})();
