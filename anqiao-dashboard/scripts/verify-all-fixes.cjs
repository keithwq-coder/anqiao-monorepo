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
  console.log("Navigating to https://anqiao.aibrain.wiki/dash/...");
  await page.goto("https://anqiao.aibrain.wiki/dash/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // 1. Verify Header & Dropdown
  console.log("\n=== 1. Checking Header & Org Dropdown ===");
  const legacyNav = await page.$(".header-org-nav");
  console.log("Legacy flat nav (.header-org-nav) exists?", legacyNav !== null ? "YES (FAIL)" : "NO (PASS)");

  const trigger = await page.$(".header-org-trigger");
  console.log("Custom HUD dropdown trigger exists?", trigger !== null ? "YES (PASS)" : "NO (FAIL)");

  if (trigger) {
    await trigger.click();
    await page.waitForTimeout(500);
    const menuItems = await page.$$(".header-org-menu-item");
    console.log("Menu items count:", menuItems.length);
    const itemNames = [];
    for (const item of menuItems) {
      const name = await item.$eval(".item-name", el => el.innerText.trim());
      itemNames.push(name);
    }
    console.log("Org options found:", itemNames.join(", "));
    const hasSonghe = itemNames.some(n => n.includes("松鹤"));
    console.log("Songhe present in list?", hasSonghe ? "YES (FAIL)" : "NO (PASS)");

    // Take screenshot of header dropdown
    await page.screenshot({ path: path.join(outDir, "verify_01_header_dropdown.png") });
    console.log("Saved: verify_01_header_dropdown.png");

    // Close menu by clicking trigger again
    await trigger.click();
    await page.waitForTimeout(300);
  }

  // Helper function to switch org via custom HUD dropdown
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

  // Helper function to click dock button
  async function clickDock(btnTextSub) {
    const dockBtns = await page.$$(".command-dock .dock-btn");
    for (const btn of dockBtns) {
      const txt = await btn.innerText();
      if (txt.includes(btnTextSub)) {
        await btn.click();
        await page.waitForTimeout(1200);
        return;
      }
    }
    console.error("Could not find dock button:", btnTextSub);
  }

  // 2. Verify Dock Button Labels
  console.log("\n=== 2. Checking Dock Button Labels ===");
  const dockBtns = await page.$$(".command-dock .dock-btn");
  const dockTexts = [];
  for (const b of dockBtns) {
    dockTexts.push(await b.innerText());
  }
  console.log("Dock buttons:", dockTexts.map(t => t.trim()).join(" | "));
  const hasPatrol = dockTexts.some(t => t.includes("管理巡查"));
  console.log("Dock has strictly '管理巡查'?", hasPatrol ? "YES (PASS)" : "NO (FAIL)");

  // 3. Verify Screen 2 (管理巡查) Grid Layout 3*3 across orgs
  console.log("\n=== 3. Checking Screen 2 (管理巡查) 3*3 Grid ===");
  await clickDock("管理巡查");

  const orgsToTest = [
    { name: "中科安樵", id: "anqiao", shot: "verify_02_patrol_anqiao.png" },
    { name: "凯健", id: "kaijian", shot: "verify_02_patrol_kaijian.png" },
  ];

  for (const o of orgsToTest) {
    await selectOrg(o.name);
    await page.waitForTimeout(1000);

    // Check grid columns
    const gridCols = await page.$eval(".telemetry-pod-grid", el => window.getComputedStyle(el).gridTemplateColumns).catch(() => "none");
    const colCount = gridCols.split(" ").length;
    console.log(`${o.name} Screen 2 grid columns count: ${colCount} (${colCount === 3 ? "PASS: 3*3" : "FAIL"})`);

    await page.screenshot({ path: path.join(outDir, o.shot) });
    console.log(`Saved: ${o.shot}`);
  }

  // 4. Verify Screen 3 (数字画像) 体动情况 card
  console.log("\n=== 4. Checking Screen 3 (数字画像) 体动情况 Card ===");
  await clickDock("数字画像");

  for (const o of orgsToTest) {
    await selectOrg(o.name);
    await page.waitForTimeout(1000);

    const centerTopCard = await page.$(".s3-center-top-card");
    let cardTitle = "";
    if (centerTopCard) {
      cardTitle = await centerTopCard.$eval(".s3-card-title", el => el.innerText.trim()).catch(() => "");
    }
    console.log(`${o.name} Screen 3 center-top card: ${centerTopCard ? "EXISTS" : "MISSING"} (${cardTitle}) -> ${cardTitle.includes("体动") ? "PASS" : "FAIL"}`);

    await page.screenshot({ path: path.join(outDir, `verify_03_profile_${o.id}.png`) });
    console.log(`Saved: verify_03_profile_${o.id}.png`);
  }

  await browser.close();
  console.log("\nAll verification tasks completed!");
})();
