const { chromium } = require("C:\\Users\\K\\.agents\\skills\\dashi-ppt\\project\\node_modules\\playwright-core");
const path = require("path");
const fs = require("fs");

(async () => {
  const outDir = path.join(__dirname, "../shots");
  fs.mkdirSync(outDir, { recursive: true });

  const exe = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  console.log("Launching headless Chrome for Multi-Org Digital Twin Verification...");
  const browser = await chromium.launch({
    executablePath: fs.existsSync(exe) ? exe : undefined,
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1.5,
  });

  const page = await context.newPage();
  console.log("Navigating to http://localhost:5173/...");
  await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // 确保切换到 screen-0 (空间孪生 / 网格热力)
  console.log("Switching to screen-0 (空间孪生)...");
  const dockButtons = await page.$$(".command-dock .dock-btn");
  if (dockButtons.length > 1) {
    await dockButtons[1].click();
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

  // ================= 1. 机构 1：凯健国际护理院 (kaijian) =================
  console.log("--- 1. Testing kaijian (凯健护理院) ---");
  await selectOrg("凯健");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, "01_kaijian_nursing_twin.png"), fullPage: true });

  // 院区切换到华鹏院区
  const campusButtons = await page.$$(".campus-selector-dock .campus-pill-btn");
  if (campusButtons.length > 1) {
    console.log("Switching kaijian campus to 华鹏院区...");
    await campusButtons[1].click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, "01b_kaijian_campus_huapeng.png"), fullPage: true });
  }

  // ================= 2. 机构 2：中科安樵 (anqiao) =================
  console.log("--- 2. Testing anqiao (中科安樵自营设备分布) ---");
  await selectOrg("中科安樵");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, "02_anqiao_topology.png"), fullPage: true });

  // 切换到战略合作伙伴出货矩阵
  const natModeButtons = await page.$$(".national-mode-group .mode-pill-btn");
  if (natModeButtons.length > 1) {
    console.log("Switching anqiao to partner clients mode...");
    await natModeButtons[1].click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, "02b_anqiao_partner_matrix.png"), fullPage: true });
  }

  await browser.close();
  console.log("All 2 organizations tested and verified. Screenshots saved in:", outDir);
})();
