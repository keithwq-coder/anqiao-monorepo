import os
from playwright.sync_api import sync_playwright

ARTIFACT_DIR = r"C:\Users\K\.gemini\antigravity\brain\528ea810-8320-4f47-a1d8-1784e5149bac"
BASE_URL = "http://1.94.51.126/saas/#/console"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    page = context.new_page()

    page.goto(BASE_URL)
    page.wait_for_timeout(2000)

    # Click cat tab
    page.locator('button.cat-tab-btn:has-text("失能评定与医学评审")').click()
    page.wait_for_timeout(1000)

    # Click 周海峰 (demo_assessor)
    page.locator('.role-card:has-text("周海峰 评定师")').click()
    page.wait_for_timeout(3500)

    # Capture Moumou demo zone
    page.screenshot(path=os.path.join(ARTIFACT_DIR, "e2e_assessor_demo_moumou_view.png"))
    print("Saved clean e2e_assessor_demo_moumou_view.png")

    # Also click Tab 2: tasks in Moumou to show 赵大有 with conflict tag
    page.locator('.tab-btn:has-text("失能评定任务与双人入户核验")').click()
    page.wait_for_timeout(1500)
    page.screenshot(path=os.path.join(ARTIFACT_DIR, "e2e_assessor_demo_moumou_tasks.png"))
    print("Saved e2e_assessor_demo_moumou_tasks.png")

    browser.close()
