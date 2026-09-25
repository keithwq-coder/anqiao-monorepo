import asyncio
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
from playwright.async_api import async_playwright

BASE_URL = "http://1.94.51.126/saas/"

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1440, 'height': 900})
        page = await context.new_page()
        page.on('dialog', lambda d: asyncio.create_task(d.accept()))

        await page.goto(BASE_URL)
        await page.wait_for_timeout(1000)

        inputs = await page.query_selector_all('input')
        if len(inputs) >= 2:
            await inputs[0].fill('medical_suqian')
            await inputs[1].fill('2026')
            btn = await page.query_selector('button[type="submit"]')
            if btn:
                await btn.click()
            await page.wait_for_timeout(2000)

        tab4_btn = await page.query_selector('button:has-text("月度结算")')
        if tab4_btn:
            await tab4_btn.click()
            await page.wait_for_timeout(1000)

        # The settlement was already reviewed in previous step! So it has "调阅官方电子付款凭证" button.
        voucher_btn = await page.query_selector('button:has-text("调阅官方电子付款凭证")')
        if voucher_btn:
            print("Clicking 调阅官方电子付款凭证...")
            await voucher_btn.click()
            await page.wait_for_timeout(1500)
        else:
            review_btn = await page.query_selector('button:has-text("医保行政终审")')
            if review_btn:
                print("Clicking 医保行政终审...")
                await review_btn.click()
                await page.wait_for_timeout(2000)

        await page.screenshot(path="e2e_official_voucher_modal.png")
        print("Captured e2e_official_voucher_modal.png")
        await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
