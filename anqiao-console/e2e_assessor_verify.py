import os
import sys
import time
from playwright.sync_api import sync_playwright

ARTIFACT_DIR = r"C:\Users\K\.gemini\antigravity\brain\528ea810-8320-4f47-a1d8-1784e5149bac"
BASE_URL = "http://1.94.51.126/saas/#/console"

def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)

def main():
    log("Starting Playwright E2E verification for Assessor & Expert Committee Workbenches...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        # Step 1: Open Login Page
        log("1. Opening login page...")
        page.goto(BASE_URL)
        page.wait_for_timeout(2500)

        # Click on "失能评定与医学评审" category in login
        log("2. Clicking on '失能评定与医学评审' category...")
        assessor_tab = page.locator('button.cat-tab-btn:has-text("失能评定与医学评审")')
        if assessor_tab.count() > 0:
            assessor_tab.click()
            page.wait_for_timeout(1000)
            page.screenshot(path=os.path.join(ARTIFACT_DIR, "e2e_login_assessor_matrix.png"))
            log("   Saved: e2e_login_assessor_matrix.png")

        # Step 2: Login as suqian_assessor by clicking the card
        log("3. Logging in as suqian_assessor (许建强 评定师)...")
        assessor_card = page.locator('.role-card:has-text("许建强 评定师")')
        if assessor_card.count() > 0:
            assessor_card.click()
        else:
            page.fill('input#login-username', 'suqian_assessor')
            page.fill('input#login-password', os.environ.get('E2E_PASSWORD',''))
            page.click('button.btn-primary[type="submit"]')

        page.wait_for_timeout(3500)

        # We are now in assessor workspace
        # Capture Tab 1: Dashboard
        log("4. Capturing Tab 1: 评定运营态势与公信力大盘...")
        tab1_btn = page.locator('.tab-btn:has-text("评定运营态势与公信力大盘")')
        if tab1_btn.count() > 0:
            tab1_btn.click()
            page.wait_for_timeout(1500)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "e2e_assessor_tab1_dashboard.png"))
        log("   Saved: e2e_assessor_tab1_dashboard.png")

        # Click Tab 2: Tasks
        log("5. Capturing Tab 2: 失能评定任务与双人入户核验...")
        tab2_btn = page.locator('.tab-btn:has-text("失能评定任务与双人入户核验")')
        if tab2_btn.count() > 0:
            tab2_btn.click()
            page.wait_for_timeout(1500)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "e2e_assessor_tab2_tasks.png"))
        log("   Saved: e2e_assessor_tab2_tasks.png")

        # Click "双人现场量表评定" for 许丽 or 何家齐
        log("6. Opening Dual-Assessor On-Site Scoring Modal...")
        score_btn = page.locator('button.btn-success:has-text("双人现场量表评定")').first
        if score_btn.count() > 0:
            score_btn.click()
            page.wait_for_timeout(1500)
            page.screenshot(path=os.path.join(ARTIFACT_DIR, "e2e_assessor_tab2_scoring_modal.png"))
            log("   Saved: e2e_assessor_tab2_scoring_modal.png")
            # Close modal
            close_btn = page.locator('.modal-close').first
            if close_btn.count() > 0:
                close_btn.click()
                page.wait_for_timeout(800)

        # Click Tab 3: Snapshots & Insights
        log("7. Capturing Tab 3: 安守护客观监测数据包与AI洞察...")
        tab3_btn = page.locator('.tab-btn:has-text("安守护客观监测数据包与AI洞察")')
        if tab3_btn.count() > 0:
            tab3_btn.click()
            page.wait_for_timeout(1500)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "e2e_assessor_tab3_snapshots.png"))
        log("   Saved: e2e_assessor_tab3_snapshots.png")

        # Click Tab 4: Expert Review
        log("8. Capturing Tab 4: 评定专家委员会医学评审与结论签发...")
        tab4_btn = page.locator('.tab-btn:has-text("评定专家委员会医学评审与结论签发")')
        if tab4_btn.count() > 0:
            tab4_btn.click()
            page.wait_for_timeout(1500)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "e2e_assessor_tab4_expert_review.png"))
        log("   Saved: e2e_assessor_tab4_expert_review.png")

        # Open Expert Review Modal
        log("9. Opening Expert Medical Review Modal...")
        review_btn = page.locator('button.btn-purple:has-text("开展医学评审并签发")').first
        if review_btn.count() > 0:
            review_btn.click()
            page.wait_for_timeout(1500)
            page.screenshot(path=os.path.join(ARTIFACT_DIR, "e2e_assessor_tab4_review_modal.png"))
            log("   Saved: e2e_assessor_tab4_review_modal.png")
            close_btn = page.locator('.modal-close').first
            if close_btn.count() > 0:
                close_btn.click()
                page.wait_for_timeout(800)

        # Open Official Report Preview
        log("10. Opening Official Assessment Conclusion Report preview...")
        preview_btn = page.locator('button:has-text("预览官方结论报告")').first
        if preview_btn.count() == 0:
            preview_btn = page.locator('button:has-text("查看官方结论书")').first
        if preview_btn.count() > 0:
            preview_btn.click()
            page.wait_for_timeout(1500)
            page.screenshot(path=os.path.join(ARTIFACT_DIR, "e2e_assessor_tab4_official_report.png"))
            log("    Saved: e2e_assessor_tab4_official_report.png")
            close_btn = page.locator('.modal-close').first
            if close_btn.count() > 0:
                close_btn.click()
                page.wait_for_timeout(800)

        # Step 3: Switch to Moumou demo zone
        log("11. Switching to Moumou demo zone...")
        mm_btn = page.locator('button.pool-btn:has-text("某某市全业务演练区")')
        if mm_btn.count() > 0:
            mm_btn.click()
            page.wait_for_timeout(2000)
            page.screenshot(path=os.path.join(ARTIFACT_DIR, "e2e_assessor_demo_moumou_view.png"))
            log("    Saved: e2e_assessor_demo_moumou_view.png")

        browser.close()
        log("All E2E screenshots captured successfully!")

if __name__ == "__main__":
    main()
