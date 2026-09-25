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

  const orgs = ['anqiao', 'kaijian'];
  for (const org of orgs) {
    console.log(`Navigating to org: ${org}...`);
    await page.goto(`https://anqiao.aibrain.wiki/dash/?org=${org}`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(2000);
    const shotPath = path.join(artifactDir, `verify_full_${org}.png`);
    await page.screenshot({ path: shotPath });
    console.log(`Saved: ${shotPath}`);
  }

  // Dropdown open test on anqiao
  console.log("Testing dropdown open on anqiao...");
  await page.goto("https://anqiao.aibrain.wiki/dash/?org=anqiao", { waitUntil: 'load', timeout: 15000 });
  await page.waitForTimeout(2000);
  await page.click(".header-org-trigger");
  await page.waitForTimeout(600);
  const shotDropdown = path.join(artifactDir, "verify_full_anqiao_dropdown.png");
  await page.screenshot({ path: shotDropdown });
  console.log(`Saved: ${shotDropdown}`);

  await browser.close();
  console.log("Completed capturing all org screenshots.");
})();
