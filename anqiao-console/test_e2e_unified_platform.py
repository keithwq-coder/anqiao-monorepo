import asyncio
import sys
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={'width': 1440, 'height': 900})

        console_errors = []
        page.on('console', lambda msg: console_errors.append(f'[{msg.type}] {msg.text}') if msg.type in ['error'] else None)
        page.on('pageerror', lambda err: console_errors.append(f'[PAGE ERROR] {err}'))

        output_lines = []
        def log(msg):
            output_lines.append(msg)
            print(msg)

        # -------------------------------------------------------------
        # TEST 1: station_master 居家养老站长登录与全部4个模块导航及直接刷新
        # -------------------------------------------------------------
        log("\n=======================================================")
        log("TEST 1: station_master 登录与4个居家工作台秒切与直达刷新")
        log("=======================================================")
        await page.goto('http://1.94.51.126/saas/')
        await page.wait_for_timeout(1500)

        # 点击演示角色列表中的 station_master (陆振东 站长)
        chips = await page.query_selector_all('.role-card')
        assert len(chips) > 0, "No role cards found on login page"
        await chips[0].click()
        await page.wait_for_timeout(2500)

        url_after_login = page.url
        log(f"登录后自动规范化 URL: {url_after_login}")
        assert '#/console/home_dispatch' in url_after_login, f"Expected #/console/home_dispatch, got {url_after_login}"

        body_len_0 = len(await page.inner_text('.shell-main-area'))
        log(f"模块 0 (居家调度与服务中心) 内容字符数: {body_len_0}")
        assert body_len_0 > 500, "Content too short, possible blank screen!"

        # 点击模块 1: 在管长者全景档案
        nav_buttons = await page.query_selector_all('.nav-item')
        log(f"侧边栏导航按钮数: {len(nav_buttons)}")
        await nav_buttons[1].click()
        await page.wait_for_timeout(1500)
        log(f"切换至模块 1 URL: {page.url}")
        assert '#/console/home_elderly_dossier' in page.url
        body_len_1 = len(await page.inner_text('.shell-main-area'))
        log(f"模块 1 (在管长者全景档案) 内容字符数: {body_len_1}")
        assert body_len_1 > 500, "Content too short on dossier!"

        # 在模块 1 直接刷新页面测试 URL 持久化
        await page.reload()
        await page.wait_for_timeout(1500)
        log(f"直接刷新后 URL: {page.url}")
        assert '#/console/home_elderly_dossier' in page.url
        body_len_1_reload = len(await page.inner_text('.shell-main-area'))
        log(f"直接刷新后内容字符数: {body_len_1_reload}")
        assert body_len_1_reload > 500

        # 点击模块 2: 居家设备监测情况
        nav_buttons = await page.query_selector_all('.nav-item')
        await nav_buttons[2].click()
        await page.wait_for_timeout(1500)
        log(f"切换至模块 2 URL: {page.url}")
        assert '#/console/home_device_monitoring' in page.url
        body_len_2 = len(await page.inner_text('.shell-main-area'))
        log(f"模块 2 (居家设备监测情况) 内容字符数: {body_len_2}")
        assert body_len_2 > 500

        # 点击模块 3: 服务与监管报告系统
        nav_buttons = await page.query_selector_all('.nav-item')
        await nav_buttons[3].click()
        await page.wait_for_timeout(1500)
        log(f"切换至模块 3 URL: {page.url}")
        assert '#/console/home_supervision_reports' in page.url
        body_len_3 = len(await page.inner_text('.shell-main-area'))
        log(f"模块 3 (服务与监管报告系统) 内容字符数: {body_len_3}")
        assert body_len_3 > 500

        # -------------------------------------------------------------
        # TEST 2: 退出登录并验证路由切回 #/login
        # -------------------------------------------------------------
        log("\n=======================================================")
        log("TEST 2: 退出登录与路由归位验证")
        log("=======================================================")
        logout_btn = await page.query_selector('.logout-btn')
        assert logout_btn is not None
        await logout_btn.click()
        await page.wait_for_timeout(1500)
        log(f"退出登录后 URL: {page.url}")
        assert '#/login' in page.url
        login_brand = await page.query_selector('.brand-tagline')
        assert login_brand is not None, "Login page not visible after logout"
        log("退出登录成功，登录中心正常渲染")

        # -------------------------------------------------------------
        # TEST 3: 脏路由自愈测试 (携带机构长者 hash #/console/patients/P00084 登录居家账号)
        # -------------------------------------------------------------
        log("\n=======================================================")
        log("TEST 3: 脏路由自动纠偏与自愈测试")
        log("=======================================================")
        await page.goto('http://1.94.51.126/saas/#/console/patients/P00084')
        await page.wait_for_timeout(1500)
        chips = await page.query_selector_all('.role-card')
        assert len(chips) > 0
        await chips[0].click() # station_master
        await page.wait_for_timeout(2500)
        log(f"自愈后 URL: {page.url}")
        # 路由应当自愈矫正为居家档案或调度，不可保留机构患者的死循环或白屏
        assert ('#/console/home_elderly_dossier' in page.url or '#/console/home_dispatch' in page.url)
        c3_len = len(await page.inner_text('.shell-main-area'))
        log(f"自愈后内容字符数: {c3_len}")
        assert c3_len > 500, "Dirty hash was not self-healed, blank screen detected!"
        log("脏路由自愈测试 [PASS]：成功纠偏并满屏渲染")

        # 退出当前
        logout_btn = await page.query_selector('.logout-btn')
        await logout_btn.click()
        await page.wait_for_timeout(1500)

        # -------------------------------------------------------------
        # TEST 4: 切换到其它板块角色登录（验证同一平台的多租户多角色展现）
        # -------------------------------------------------------------
        log("\n=======================================================")
        log("TEST 4: 多业务板块账号登录协同矩阵验证")
        log("=======================================================")

        # 4.1 医保长护监管员 (medical_suqian)
        tab_btns = await page.query_selector_all('.cat-tab-btn')
        # tab 2 is supervision
        await tab_btns[2].click()
        await page.wait_for_timeout(500)
        sup_cards = await page.query_selector_all('.role-card')
        await sup_cards[0].click() # medical_suqian
        await page.wait_for_timeout(2500)
        log(f"医保监管员登录后 URL: {page.url}")
        assert '#/console/medical_supervision' in page.url
        sup_len = len(await page.inner_text('.shell-main-area'))
        log(f"医保监管员工作台内容字符数: {sup_len}")
        assert sup_len > 500

        # 退出
        await (await page.query_selector('.logout-btn')).click()
        await page.wait_for_timeout(1500)

        # 4.2 凯健养老院长 (kaijian_admin)
        tab_btns = await page.query_selector_all('.cat-tab-btn')
        # tab 1 is institution
        await tab_btns[1].click()
        await page.wait_for_timeout(500)
        inst_cards = await page.query_selector_all('.role-card')
        await inst_cards[0].click() # kaijian_admin
        await page.wait_for_timeout(2500)
        log(f"养老院长登录后 URL: {page.url}")
        assert '#/console/nursing_home_admin' in page.url
        inst_len = len(await page.inner_text('.shell-main-area'))
        log(f"养老院长工作台内容字符数: {inst_len}")
        assert inst_len > 500

        log("\n=======================================================")
        log(f"全部测试通过！控制台报错统计: {len(console_errors)}")
        if console_errors:
            log("Console errors:")
            for e in console_errors:
                log(f"  {e}")
        log("=======================================================")

        with open('test_e2e_results.txt', 'w', encoding='utf-8') as f:
            f.write('\n'.join(output_lines))

        await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
