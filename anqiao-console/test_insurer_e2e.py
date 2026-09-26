import asyncio
import os
import shutil
from playwright.async_api import async_playwright

ARTIFACTS_DIR = r"C:\Users\K\.gemini\antigravity\brain\528ea810-8320-4f47-a1d8-1784e5149bac"
BASE_URL = "http://1.94.51.126/saas/#/console/login"

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await context.new_page()

        print("[1/7] Visiting Login Page and checking Insurer Matrix...")
        await page.goto(BASE_URL, wait_until="networkidle")
        await asyncio.sleep(1)

        # Click the 3rd category tab: "受托商保经办"
        cat_btn = page.locator(".category-tabs .cat-tab-btn").nth(2)
        if await cat_btn.count() > 0:
            await cat_btn.click()
            await asyncio.sleep(0.5)

        login_shot = "e2e_login_insurer_matrix.png"
        await page.screenshot(path=login_shot)
        shutil.copy(login_shot, os.path.join(ARTIFACTS_DIR, login_shot))
        print(f"  -> Saved {login_shot}")

        # [2/7] Login as demo_insurer_director
        print("[2/7] Logging in as demo_insurer_director...")
        director_card = page.locator(".role-card:has(code:has-text('demo_insurer_director'))")
        if await director_card.count() > 0:
            await director_card.click()
        else:
            await page.fill("input[name='username']", "demo_insurer_director")
            await page.fill("input[name='password']", os.environ.get('E2E_PASSWORD',''))
            await page.click("button.btn-primary")
        
        await page.wait_for_selector(".insurer-operations", timeout=15000)
        await asyncio.sleep(2)

        tab1_shot = "e2e_insurer_tab1_dashboard.png"
        await page.screenshot(path=tab1_shot)
        shutil.copy(tab1_shot, os.path.join(ARTIFACTS_DIR, tab1_shot))
        print(f"  -> Saved {tab1_shot}")

        # [3/7] Tab 2: Intake & Avoidance Dispatch Desk
        print("[3/7] Testing Tab 2 (Intake & Avoidance Dispatch)...")
        await page.locator(".tab-nav .tab-btn").nth(1).click()
        await asyncio.sleep(1)

        # Open avoidance dispatch modal
        dispatch_btn = page.locator(".content-panel button.btn-primary").first
        if await dispatch_btn.count() > 0:
            await dispatch_btn.click()
            await asyncio.sleep(1)

        tab2_shot = "e2e_insurer_tab2_avoidance_modal.png"
        await page.screenshot(path=tab2_shot)
        shutil.copy(tab2_shot, os.path.join(ARTIFACTS_DIR, tab2_shot))
        print(f"  -> Saved {tab2_shot}")

        # Close modal
        close_btn = page.locator(".close-x")
        if await close_btn.count() > 0:
            await close_btn.first.click()
            await asyncio.sleep(0.5)

        # [4/7] Tab 3: IoT Smart Inspections & Fly-Checks Desk
        print("[4/7] Testing Tab 3 (Smart Inspections & Fly-Checks)...")
        await page.locator(".tab-nav .tab-btn").nth(2).click()
        await asyncio.sleep(1)

        # Open flycheck modal
        fly_btn = page.locator(".content-panel button.btn-primary").first
        if await fly_btn.count() > 0:
            await fly_btn.click()
            await asyncio.sleep(1)

        tab3_shot = "e2e_insurer_tab3_flycheck_modal.png"
        await page.screenshot(path=tab3_shot)
        shutil.copy(tab3_shot, os.path.join(ARTIFACTS_DIR, tab3_shot))
        print(f"  -> Saved {tab3_shot}")

        if await close_btn.count() > 0:
            await close_btn.first.click()
            await asyncio.sleep(0.5)

        # [5/7] Tab 4: Settlement Pre-Review Desk
        print("[5/7] Testing Tab 4 (Settlement Pre-Review)...")
        await page.locator(".tab-nav .tab-btn").nth(3).click()
        await asyncio.sleep(1)

        # Click view pre-review voucher or open pre-review modal
        voucher_btn = page.locator(".content-panel button.btn-primary, .content-panel button.btn-outline").first
        if await voucher_btn.count() > 0:
            await voucher_btn.click()
            await asyncio.sleep(1)

        tab4_shot = "e2e_insurer_tab4_pre_review_voucher.png"
        await page.screenshot(path=tab4_shot)
        shutil.copy(tab4_shot, os.path.join(ARTIFACTS_DIR, tab4_shot))
        print(f"  -> Saved {tab4_shot}")

        if await close_btn.count() > 0:
            await close_btn.first.click()
            await asyncio.sleep(0.5)

        # [6/7] Tab 5: Medical Bureau Supervision Feedback Desk
        print("[6/7] Testing Tab 5 (Supervision Feedback Desk)...")
        await page.locator(".tab-nav .tab-btn").nth(4).click()
        await asyncio.sleep(1)

        feedback_btn = page.locator(".content-panel button.btn-primary").first
        if await feedback_btn.count() > 0:
            await feedback_btn.click()
            await asyncio.sleep(1)

        tab5_shot = "e2e_insurer_tab5_supervision_feedback.png"
        await page.screenshot(path=tab5_shot)
        shutil.copy(tab5_shot, os.path.join(ARTIFACTS_DIR, tab5_shot))
        print(f"  -> Saved {tab5_shot}")

        if await close_btn.count() > 0:
            await close_btn.first.click()
            await asyncio.sleep(0.5)

        # [7/7] Login as suqian_insurer (太保宿迁长护经办专班)
        print("[7/7] Testing Suqian Pilot Seat (suqian_insurer)...")
        logout_btn = page.locator("button.logout-btn")
        if await logout_btn.count() > 0:
            await logout_btn.click()
        else:
            await page.evaluate("localStorage.clear()")
            await page.goto(BASE_URL, wait_until="networkidle")

        await page.wait_for_selector(".category-tabs", timeout=10000)
        await asyncio.sleep(1)

        # Click 3rd category tab
        cat_btn = page.locator(".category-tabs .cat-tab-btn").nth(2)
        if await cat_btn.count() > 0:
            await cat_btn.click()
            await asyncio.sleep(0.5)

        suqian_card = page.locator(".role-card:has(code:has-text('suqian_insurer'))")
        if await suqian_card.count() > 0:
            await suqian_card.click()
        else:
            await page.fill("input[name='username']", "suqian_insurer")
            await page.fill("input[name='password']", os.environ.get('E2E_PASSWORD',''))
            await page.click("button.btn-primary")

        await page.wait_for_selector(".insurer-operations", timeout=15000)
        await asyncio.sleep(2)

        suqian_shot = "e2e_insurer_suqian_view.png"
        await page.screenshot(path=suqian_shot)
        shutil.copy(suqian_shot, os.path.join(ARTIFACTS_DIR, suqian_shot))
        print(f"  -> Saved {suqian_shot}")

        await browser.close()
        print("[SUCCESS] All E2E Playwright verification steps completed!")

if __name__ == "__main__":
    asyncio.run(run())
