import asyncio
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
from playwright.async_api import async_playwright

BASE_URL = "http://1.94.51.126/saas/"

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Fresh incognito context
        context = await browser.new_context(viewport={'width': 1440, 'height': 900})
        page = await context.new_page()

        await page.goto(BASE_URL)
        await page.wait_for_timeout(1000)

        inputs = await page.query_selector_all('input')
        if len(inputs) >= 2:
            await inputs[0].fill('medical01')
            await inputs[1].fill('2026')
            btn = await page.query_selector('button[type="submit"]')
            if btn:
                await btn.click()
            await page.wait_for_timeout(2500)

        print("Current URL:", page.url)
        body = await page.inner_text('body')
        print("Page Title/Role:", "医疗保障" in body or "长护险" in body)
        await page.screenshot(path="e2e_medical01_global.png")
        print("Saved e2e_medical01_global.png")
        await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
