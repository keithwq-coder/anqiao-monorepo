import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        page = await context.new_page()

        await page.goto('http://1.94.51.126/saas/#/console')
        await page.wait_for_timeout(2000)
        inputs = await page.query_selector_all('input')
        if len(inputs) >= 2:
            await inputs[0].fill('ward_4f_station')
            await inputs[1].fill('2026')
            btn = await page.query_selector('button[type="submit"]') or await page.query_selector('button')
            if btn:
                await btn.click()
            await page.wait_for_timeout(3000)

        # 1. Click 刘建国
        liu_btn = await page.query_selector('button:has-text("刘建国")')
        if liu_btn:
            print('Clicking 刘建国...')
            await liu_btn.click()
            await page.wait_for_timeout(2000)
            text = await page.inner_text('body')
            with open('click_liu.txt', 'w', encoding='utf-8') as f:
                f.write(text)
            await page.screenshot(path='click_liu.png')
            print('Saved click_liu.txt and click_liu.png')

        # 2. Click 设备监测情况
        dev_btn = await page.query_selector('button:has-text("设备监测情况")')
        if dev_btn:
            print('Clicking 设备监测情况...')
            await dev_btn.click()
            await page.wait_for_timeout(2000)
            text = await page.inner_text('body')
            with open('click_dev.txt', 'w', encoding='utf-8') as f:
                f.write(text)
            await page.screenshot(path='click_dev.png')
            print('Saved click_dev.txt and click_dev.png')

        # 3. Click 监测与报告系统
        rep_btn = await page.query_selector('button:has-text("监测与报告系统")')
        if rep_btn:
            print('Clicking 监测与报告系统...')
            await rep_btn.click()
            await page.wait_for_timeout(2000)
            text = await page.inner_text('body')
            with open('click_rep.txt', 'w', encoding='utf-8') as f:
                f.write(text)
            await page.screenshot(path='click_rep.png')
            print('Saved click_rep.txt and click_rep.png')

        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
