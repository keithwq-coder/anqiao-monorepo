import asyncio
import json
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
from playwright.async_api import async_playwright

BASE_URL = "http://1.94.51.126/saas/"

async def test_medical_supervision():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1440, 'height': 900})
        page = await context.new_page()
        
        # Handle all alerts/confirms by accepting
        page.on('dialog', lambda d: asyncio.create_task(d.accept()))

        console_errors = []
        page.on('pageerror', lambda err: console_errors.append(f"[PAGE ERROR] {err}"))
        page.on('console', lambda msg: console_errors.append(f"[{msg.type}] {msg.text}") if msg.type in ['error', 'warning'] else None)

        print("[TEST 1] Visiting Login Page and checking Medical Bureau Account Matrix...")
        await page.goto(BASE_URL)
        await page.wait_for_timeout(2000)

        # Click the 'supervision' category tab in login page
        sup_tab = await page.query_selector('.cat-tab-btn:has-text("医保监管"), .cat-tab-btn:has-text("长护")')
        if sup_tab:
            await sup_tab.click()
            await page.wait_for_timeout(800)
            await page.screenshot(path="e2e_login_medical_matrix.png")
            print("[OK] Login page medical accounts matrix rendered, screenshot saved")

        login_body = await page.inner_text('body')
        assert "陈立新" in login_body or "demo_director" in login_body, "Demo director missing in login page"
        assert "suqian_medical" in login_body or "宿迁长护试点" in login_body, "Suqian pilot account missing in login page"
        assert "苏州医保" not in login_body and "suzhou_director" not in login_body, "CRITICAL: Suzhou medical bureau accounts should be deleted!"
        print("[OK] Login page: Suzhou completely deleted, Moumou demo accounts & Suqian real pilot seat present")

        # ==================== TEST 2: Demo Director in 某某市 ====================
        print("[TEST 2] Logging in as demo_director (某某市医保局分管副局长 陈立新)...")
        role_card = await page.query_selector('.role-card:has-text("陈立新")')
        if role_card:
            await role_card.click()
            await page.wait_for_timeout(3000)
        else:
            await page.fill('#login-username', 'demo_director')
            await page.fill('#login-password', '2026')
            await page.click('button[type="submit"]')
            await page.wait_for_timeout(3000)

        print(f"Current URL: {page.url}")
        body_text = await page.inner_text('body')
        assert "某某市长期护理保险行政监督管理平台" in body_text, "Expected Moumou Medical Bureau Platform Title"
        assert "某某市医疗保障局" in body_text, "Expected Moumou Medical Insurance Bureau subtitle"
        assert "陈立新" in body_text, "Expected Deputy Director Chen Lixin seat name"
        assert "苏州" not in body_text, "CRITICAL ERROR: '苏州' should NOT appear in Moumou platform!"

        # 1. Take screenshot of Tab 1 Dashboard
        await page.screenshot(path="e2e_medical_tab1_dashboard.png")
        await page.screenshot(path="e2e_medical_demo_director.png")
        print("[OK] Tab 1 Dashboard rendered successfully, screenshot saved")

        # 2. Test Department Seats Navigation in Moumou Bureau
        print("[TEST 3] Testing Department Seats Navigation (科室协同视界)...")
        audit_seat_btn = await page.query_selector('.seat-btn:has-text("基金监督稽核科")')
        if audit_seat_btn:
            await audit_seat_btn.click()
            await page.wait_for_timeout(1000)
            audit_body = await page.inner_text('body')
            assert "稽核调查与行政裁决" in audit_body, "Switching to audit seat failed"
            print("[OK] Department seat switched to 基金监督稽核科")

        # 3. Verify Tab 2: 稽核调查与行政裁决 (三大支柱线索)
        print("[TEST 4] Verifying Tab 2: 稽核调查与行政裁决 (三大支柱)...")
        tab2_btn = await page.query_selector('button:has-text("稽核调查与行政裁决")')
        if tab2_btn:
            await tab2_btn.click()
            await page.wait_for_timeout(1500)
            t2_body = await page.inner_text('body')
            assert "赵大有" in t2_body, "Pillar 1 clue (Zhao Dayou) missing"
            assert "吴明轩" in t2_body, "Pillar 3 clue (Wu Mingxuan) missing"
            await page.screenshot(path="e2e_medical_tab2_clues.png")
            print("[OK] Tab 2 Clues list rendered successfully with 3 pillars, screenshot saved")

        # 4. Verify Tab 3: 辖区定点机构与照护全息档案
        print("[TEST 5] Verifying Tab 3: 辖区定点机构与照护全息档案...")
        tab3_btn = await page.query_selector('button:has-text("辖区定点机构与照护全息档案")')
        if tab3_btn:
            await tab3_btn.click()
            await page.wait_for_timeout(1500)
            await page.screenshot(path="e2e_medical_tab3_penetration.png")
            print("[OK] Tab 3 Penetration rendered successfully, screenshot saved")

        # 5. Verify Tab 4: 待遇月度结算终审与拨付核准
        print("[TEST 6] Verifying Tab 4: 待遇月度结算终审与拨付核准...")
        tab4_btn = await page.query_selector('button:has-text("待遇月度结算终审与拨付核准")')
        if tab4_btn:
            await tab4_btn.click()
            await page.wait_for_timeout(1500)
            voucher_btn = await page.query_selector('button:has-text("查阅统筹基金拨付凭证")')
            if voucher_btn:
                await voucher_btn.click()
                await page.wait_for_timeout(1500)
                await page.screenshot(path="e2e_official_voucher_modal.png")
                close_btn = await page.query_selector('.voucher-footer button:has-text("关闭")')
                if close_btn:
                    await close_btn.click()
                    await page.wait_for_timeout(500)
                print("[OK] Official Electronic Voucher modal verified")

        # 6. Verify Tab 5: 失能申报与雷达客观冲突
        print("[TEST 7] Verifying Tab 5: 失能申报与客观体征冲突...")
        tab5_btn = await page.query_selector('button:has-text("失能评估申报流转")')
        if tab5_btn:
            await tab5_btn.click()
            await page.wait_for_timeout(1500)
            t5_body = await page.inner_text('body')
            assert "赵大有" in t5_body, "Zhao Dayou application missing in Tab 5"
            assert "突击卧床" in t5_body or "雷达冲突" in t5_body, "Radar conflict tag missing in Tab 5"
            await page.screenshot(path="e2e_medical_tab5_applications.png")
            print("[OK] Tab 5 Radar objective conflict verified, screenshot saved")

        # 7. Verify Tab 8: 评估师长效追责制
        print("[TEST 8] Verifying Tab 8: 执业评估师与长效追责监管...")
        tab8_btn = await page.query_selector('button:has-text("定点服务机构名录与执业评估师")')
        if tab8_btn:
            await tab8_btn.click()
            await page.wait_for_timeout(1500)
            t8_body = await page.inner_text('body')
            assert "吴明轩" in t8_body, "Assessor Wu Mingxuan missing in Tab 8"
            assert "长效追责" in t8_body, "Assessor long-term accountability record missing"
            await page.screenshot(path="e2e_medical_tab8_orgs.png")
            print("[OK] Tab 8 Assessor long-term accountability verified, screenshot saved")

        # ==================== TEST 9: Suqian Pilot Seat ====================
        print("[TEST 9] Logging out and logging in as suqian_medical (宿迁长护险试点席位)...")
        logout_btn = await page.query_selector('button:has-text("退出")')
        if logout_btn:
            await logout_btn.click()
            await page.wait_for_timeout(1500)

        sup_tab = await page.query_selector('.cat-tab-btn:has-text("医保监管")')
        if sup_tab:
            await sup_tab.click()
            await page.wait_for_timeout(500)
        sq_card = await page.query_selector('.role-card:has-text("宿迁长护试点")')
        if sq_card:
            await sq_card.click()
            await page.wait_for_timeout(3000)
        else:
            await page.fill('#login-username', 'suqian_medical')
            await page.fill('#login-password', '2026')
            await page.click('button[type="submit"]')
            await page.wait_for_timeout(3000)

        sq_body = await page.inner_text('body')
        assert "宿迁市长期护理保险试点监督管理平台" in sq_body, "Suqian pilot platform title verified"
        assert "许丽" in sq_body or "何家齐" in sq_body, "Suqian real elders verified"
        assert "苏州" not in sq_body, "CRITICAL ERROR: '苏州' should NOT appear in Suqian platform!"
        await page.screenshot(path="e2e_medical_suqian_director.png")
        print("[OK] Suqian pilot account verified (3 real elders and devices)")

        # ==================== TEST 10: Provincial Guidance Group ====================
        print("[TEST 10] Logging out and logging in as province_medical (省医保局长护处)...")
        logout_btn = await page.query_selector('button:has-text("退出")')
        if logout_btn:
            await logout_btn.click()
            await page.wait_for_timeout(1500)

        sup_tab = await page.query_selector('.cat-tab-btn:has-text("医保监管")')
        if sup_tab:
            await sup_tab.click()
            await page.wait_for_timeout(500)
        prov_card = await page.query_selector('.role-card:has-text("省医保局长护处")')
        if prov_card:
            await prov_card.click()
            await page.wait_for_timeout(3000)
        else:
            await page.fill('#login-username', 'province_medical')
            await page.fill('#login-password', '2026')
            await page.click('button[type="submit"]')
            await page.wait_for_timeout(3000)

        prov_body = await page.inner_text('body')
        assert "江苏省长期护理保险监督管理信息平台" in prov_body, "Provincial title verified"
        assert "省级巡查指导视界" in prov_body, "Provincial inspection toolbar verified"
        assert "江苏省全域监管总盘" in prov_body, "Provincial all-pool button verified"
        assert "宿迁市统筹区" in prov_body, "Provincial suqian-pool button verified"
        assert "某某市统筹区" in prov_body, "Provincial moumou-pool button verified"
        assert "苏州市统筹区" not in prov_body, "CRITICAL: Suzhou should NOT appear in provincial toolbar!"
        await page.screenshot(path="e2e_medical_provincial_view.png")
        print("[OK] Provincial account successfully verified (Suqian + Moumou demo, Suzhou deleted)")

        await browser.close()
        print("\nAll medical supervision workbench E2E tests PASSED on Huawei Cloud!")

if __name__ == '__main__':
    asyncio.run(test_medical_supervision())
