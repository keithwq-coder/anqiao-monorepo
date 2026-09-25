import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Mobile viewport similar to user's phone screenshot
        context = await browser.new_context(viewport={'width': 375, 'height': 812})
        page = await context.new_page()

        console_logs = []
        page.on('console', lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
        page.on('pageerror', lambda err: console_logs.append(f"[PAGE ERROR] {err}"))

        await page.goto('http://1.94.51.126/saas/#/console')
        await page.wait_for_timeout(2000)

        # Check if already logged in or needs login
        inputs = await page.query_selector_all('input')
        if len(inputs) >= 2:
            await inputs[0].fill('ward_4f_station')
            await inputs[1].fill('2026')
            btn = await page.query_selector('button[type="submit"]')
            if not btn:
                btn = await page.query_selector('button')
            if btn:
                await btn.click()
            await page.wait_for_timeout(3000)

        body_text = await page.inner_text('body')
        with open('inspect_output.txt', 'w', encoding='utf-8') as f:
            f.write('=== AFTER LOGIN ===\n')
            f.write(f'Current URL: {page.url}\n')
            f.write('Body:\n' + body_text + '\n')
            f.write('\nConsole logs:\n' + '\n'.join(console_logs) + '\n')

        await page.screenshot(path='mobile_ward_4f.png')
        print('Mobile inspection saved to inspect_output.txt and mobile_ward_4f.png')

        # Now test desktop viewport
        page_pc = await (await browser.new_context(viewport={'width': 1280, 'height': 800})).new_page()
        await page_pc.goto('http://1.94.51.126/saas/#/console')
        await page_pc.wait_for_timeout(2000)
        inputs_pc = await page_pc.query_selector_all('input')
        if len(inputs_pc) >= 2:
            await inputs_pc[0].fill('ward_4f_station')
            await inputs_pc[1].fill('2026')
            btn = await page_pc.query_selector('button[type="submit"]') or await page_pc.query_selector('button')
            if btn:
                await btn.click()
            await page_pc.wait_for_timeout(3000)

        body_pc = await page_pc.inner_text('body')
        with open('inspect_output_pc.txt', 'w', encoding='utf-8') as f:
            f.write('=== PC VIEWPORT ===\n')
            f.write(f'Current URL: {page_pc.url}\n')
            f.write('Body:\n' + body_pc + '\n')
        await page_pc.screenshot(path='pc_ward_4f.png')
        print('PC inspection saved to inspect_output_pc.txt and pc_ward_4f.png')

        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
