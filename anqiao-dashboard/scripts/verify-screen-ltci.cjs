const { chromium } = require("C:\\Users\\K\\.agents\\skills\\dashi-ppt\\project\\node_modules\\playwright-core");
const path = require("path");
const fs = require("fs");

(async () => {
  const outDir = path.join(__dirname, "../shots");
  fs.mkdirSync(outDir, { recursive: true });

  const exe = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const browser = await chromium.launch({
    executablePath: fs.existsSync(exe) ? exe : undefined,
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1.5,
  });

  const page = await context.newPage();
  await page.goto("http://localhost:5173/?screen=ltci", { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(outDir, "ltci_01_screen.png"), fullPage: true });
  console.log("saved ltci_01_screen.png");

  const overflow = await page.evaluate(() => {
    const el = document.getElementById("screen-5");
    if (!el) return "no screen-5";
    return { scrollH: el.scrollHeight, clientH: el.clientHeight, scrollW: el.scrollWidth, clientW: el.clientWidth };
  });
  console.log("screen-5 box:", JSON.stringify(overflow));

  await browser.close();
})();
