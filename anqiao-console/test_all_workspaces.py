import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={'width': 1280, 'height': 800})
        console_logs = []
        page.on('console', lambda msg: console_logs.append(f'[{msg.type}] {msg.text}'))
        page.on('pageerror', lambda err: console_logs.append(f'[PAGE ERROR] {err}'))

        await page.goto('http://1.94.51.126/saas/')
        await page.wait_for_timeout(1000)

        # Login as station_master
        chips = await page.query_selector_all('.role-card')
        if chips:
            await chips[0].click()
            await page.wait_for_timeout(2000)

        nav_items = await page.query_selector_all('.nav-item')
        with open('test_all_ws_log.txt', 'w', encoding='utf-8') as f:
            f.write(f'Found nav items: {len(nav_items)}\n')
            for i, item in enumerate(nav_items):
                text = (await item.inner_text()).strip()
                f.write(f'Nav item {i}: {text}\n')

            # Test switching to each workspace by clicking the sidebar buttons!
            for i in range(len(nav_items)):
                items = await page.query_selector_all('.nav-item')
                if i < len(items):
                    item_text = (await items[i].inner_text()).strip()
                    f.write(f'Clicking nav item {i}: {item_text}\n')
                    await items[i].click()
                    await page.wait_for_timeout(1500)
                    body_text = await page.inner_text('body')
                    f.write(f'Body length after click {i}: {len(body_text)}\n')
                    await page.screenshot(path=f'nav_click_{i}.png')

            f.write('\nConsole logs:\n' + '\n'.join(console_logs) + '\n')
        print('All workspaces tested. See test_all_ws_log.txt')
        await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
