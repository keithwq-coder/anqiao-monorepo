import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={'width': 1280, 'height': 800})
        console_logs = []
        page.on('console', lambda msg: console_logs.append(f'[{msg.type}] {msg.text}'))
        page.on('pageerror', lambda err: console_logs.append(f'[PAGE ERROR] {err}'))

        # Start from http://1.94.51.126/saas/ without hash
        await page.goto('http://1.94.51.126/saas/')
        await page.wait_for_timeout(1000)

        # Click the station_master role chip
        chips = await page.query_selector_all('.role-card')
        print('Found role cards:', len(chips))
        if chips:
            await chips[0].click()
            await page.wait_for_timeout(3000)
        else:
            inputs = await page.query_selector_all('input')
            if len(inputs) >= 2:
                await inputs[0].fill('station_master')
                await inputs[1].fill('2026')
                btn = await page.query_selector('button[type="submit"]')
                if btn:
                    await btn.click()
                await page.wait_for_timeout(3000)

        await page.screenshot(path='test_clean_url.png')
        with open('test_clean_url_log.txt', 'w', encoding='utf-8') as f:
            f.write(f'Current URL: {page.url}\n')
            f.write('Logs:\n' + '\n'.join(console_logs) + '\n')
            f.write('Body:\n' + await page.inner_text('body') + '\n')
        print('Done. Check test_clean_url_log.txt')
        await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
