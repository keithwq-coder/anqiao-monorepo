const { chromium } = require("C:\\Users\\K\\.agents\\skills\\dashi-ppt\\project\\node_modules\\playwright-core");
const path = require("path");
const fs = require("fs");

(async () => {
  const outDir = path.join(__dirname, "../shots");
  fs.mkdirSync(outDir, { recursive: true });

  const exe = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  console.log("Launching Chrome for Multi-Org Screen 3 Verification...");
  const browser = await chromium.launch({
    executablePath: fs.existsSync(exe) ? exe : undefined,
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1.5,
  });

  const page = await context.newPage();
  console.log("Navigating to https://anqiao.aibrain.wiki/dash/...");
  await page.goto("https://anqiao.aibrain.wiki/dash/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // 切换到 Screen 3 (数字画像)
  console.log("Switching to Screen 3 (数字画像)...");
  const dockBtns = await page.$$(".command-dock .dock-btn");
  for (const btn of dockBtns) {
    const text = await btn.innerText();
    if (text.includes("数字画像") || text.includes("生命画像") || text.includes("画像")) {
      console.log("Found profile button:", text);
      await btn.click();
      break;
    }
  }
  await page.waitForTimeout(2000);

  // 机构切换为 HUD 下拉菜单（.header-org-trigger + .header-org-menu-item，按 .item-name 文本匹配）
  async function selectOrg(orgNameSub) {
    await page.click(".header-org-trigger");
    await page.waitForTimeout(400);
    const items = await page.$$(".header-org-menu-item");
    for (const item of items) {
      const name = await item.$eval(".item-name", el => el.innerText.trim());
      if (name.includes(orgNameSub)) {
        await item.click();
        await page.waitForTimeout(1200);
        return;
      }
    }
    console.error("Could not find org:", orgNameSub);
  }

  const orgs = [
    { id: "anqiao", name: "中科安樵", file: "screen3_01_anqiao.png" },
    { id: "kaijian", name: "凯健", file: "screen3_02_kaijian.png" },
  ];

  for (const org of orgs) {
    console.log(`--- Testing ${org.name} (${org.id}) ---`);
    await selectOrg(org.name);
    await page.waitForTimeout(1500);
    const shotPath = path.join(outDir, org.file);
    await page.screenshot({ path: shotPath, fullPage: true });
    console.log(`Saved screenshot: ${org.file}`);
  }

  await browser.close();
  console.log("All 2 orgs verified successfully!");
})();
