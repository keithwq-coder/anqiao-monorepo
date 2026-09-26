import os
import sys
import time
from playwright.sync_api import sync_playwright

ARTIFACT_DIR = r"C:\Users\K\.gemini\antigravity\brain\528ea810-8320-4f47-a1d8-1784e5149bac"
BASE_URL = "http://1.94.51.126/saas/#/console"

def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        # Step 1: Login as suqian_expert to sign the review and view official report
        log("1. Opening login page...")
        page.goto(BASE_URL)
        page.wait_for_timeout(2500)

        expert_tab = page.locator('button.cat-tab-btn:has-text("失能评定与医学评审")')
        if expert_tab.count() > 0:
            expert_tab.click()
            page.wait_for_timeout(1000)

        log("2. Clicking card for 孙建国 主任医师 (suqian_expert)...")
        expert_card = page.locator('.role-card:has-text("孙建国 主任医师")')
        if expert_card.count() > 0:
            expert_card.click()
        page.wait_for_timeout(3500)

        # Go to Tab 4
        log("3. Navigating to Tab 4 (评定专家委员会医学评审与结论签发)...")
        tab4_btn = page.locator('.tab-btn:has-text("评定专家委员会医学评审与结论签发")')
        if tab4_btn.count() > 0:
            tab4_btn.click()
            page.wait_for_timeout(1500)

        # Click "开展医学评审并签发"
        log("4. Opening review modal...")
        review_btn = page.locator('button.btn-purple:has-text("开展医学评审并签发")').first
        if review_btn.count() > 0:
            review_btn.click()
            page.wait_for_timeout(1500)

            # Click the sign button in modal
            log("5. Submitting dual-expert review...")
            page.on("dialog", lambda dialog: dialog.accept())
            sign_btn = page.locator('button.btn-purple:has-text("双专家联名数字签署")').first
            if sign_btn.count() > 0:
                sign_btn.click()
                page.wait_for_timeout(2500)

        # Now the official report modal should be open!
        log("6. Capturing official assessment report with red seal...")
        page.wait_for_timeout(1500)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "e2e_assessor_tab4_official_report.png"))
        log("   Saved: e2e_assessor_tab4_official_report.png")

        # Step 2: Open Moumou demo zone with demo_assessor
        log("7. Logging in as demo_assessor (周海峰 评定师)...")
        page.goto(BASE_URL)
        page.wait_for_timeout(2500)

        assessor_tab = page.locator('button.cat-tab-btn:has-text("失能评定与医学评审")')
        if assessor_tab.count() > 0:
            assessor_tab.click()
            page.wait_for_timeout(1000)

        demo_card = page.locator('.role-card:has-text("周海峰 评定师")')
        if demo_card.count() > 0:
            demo_card.click()
        page.wait_for_timeout(3500)

        log("8. Capturing Moumou demo zone view...")
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "e2e_assessor_demo_moumou_view.png"))
        log("   Saved: e2e_assessor_demo_moumou_view.png")

        # Also capture demo_expert (钱德明)
        log("9. Logging in as demo_expert (钱德明 主任医师)...")
        page.goto(BASE_URL)
        page.wait_for_timeout(2500)

        assessor_tab = page.locator('button.cat-tab-btn:has-text("失能评定与医学评审")')
        if assessor_tab.count() > 0:
            assessor_tab.click()
            page.wait_for_timeout(1000)

        demo_exp_card = page.locator('.role-card:has-text("钱德明 主任医师")')
        if demo_exp_card.count() > 0:
            demo_exp_card.click()
        page.wait_for_timeout(3500)

        # Click Tab 4
        tab4_btn = page.locator('.tab-btn:has-text("评定专家委员会医学评审与结论签发")')
        if tab4_btn.count() > 0:
            tab4_btn.click()
            page.wait_for_timeout(1500)

        page.screenshot(path=os.path.join(ARTIFACT_DIR, "e2e_assessor_expert_moumou_review.png"))
        log("   Saved: e2e_assessor_expert_moumou_review.png")

        browser.close()
        log("Done step 2 captures!")

if __name__ == "__main__":
    main()
