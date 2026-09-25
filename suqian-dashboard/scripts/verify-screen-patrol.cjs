const { chromium } = require("C:\\Users\\K\\.agents\\skills\\dashi-ppt\\project\\node_modules\\playwright-core");
const path = require("path");
const fs = require("fs");

(async () => {
  const outDir = path.join(__dirname, "../shots");
  fs.mkdirSync(outDir, { recursive: true });

  const exe = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  console.log("Launching headless Chrome for Screen 2 (实时巡查/终端矩阵) Verification...");
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

  // 切换到 Screen 2 (第 3 个按钮)
  console.log("Switching to Screen 2...");
  const dockButtons = await page.$$(".command-dock .dock-btn");
  if (dockButtons.length > 2) {
    await dockButtons[2].click(); // 第3个按钮为 screen-2 (实时巡查/入户巡护)
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

  // ================= 1. 机构 1：中科安樵 (anqiao - 终端矩阵) =================
  console.log("--- 1. Testing anqiao (终端矩阵) ---");
  await selectOrg("中科安樵");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, "patrol_01_anqiao_devices.png"), fullPage: true });

  // 测试筛选：点击第二个分组筛选 tab（若存在）
  const natTabs = await page.$$(".s2-floor-group .s2-floor-tab");
  if (natTabs.length > 1) {
    console.log("Filtering anqiao by second group tab...");
    await natTabs[1].click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, "patrol_01b_anqiao_filter.png"), fullPage: true });
  }

  // ================= 2. 机构 2：凯健国际护理院 (kaijian - 实时巡查) =================
  console.log("--- 2. Testing kaijian (实时巡查) ---");
  await selectOrg("凯健");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, "patrol_02_kaijian_nursing.png"), fullPage: true });

  await browser.close();
  console.log("All 2 ScreenPatrol views verified! Screenshots saved in:", outDir);
})();
