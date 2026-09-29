from pathlib import Path
from playwright.sync_api import sync_playwright

PROFILE_DIR = Path(__file__).resolve().parent.parent / ".pw-profile-infinitybuilds"
OUT_DIR = Path(__file__).resolve().parent

with sync_playwright() as p:
    context = p.chromium.launch_persistent_context(
        user_data_dir=str(PROFILE_DIR), headless=True, viewport={"width": 1400, "height": 1000},
    )
    page = context.pages[0] if context.pages else context.new_page()
    page.goto("https://infinitybuilds.gg/en/builds/new", wait_until="domcontentloaded")
    page.wait_for_timeout(2000)
    page.click("text=Barbarian")
    page.wait_for_timeout(500)
    page.click("text=Rogue")
    page.wait_for_timeout(1500)

    try:
        page.get_by_role("tab", name="Skills").click()
    except Exception as e:
        print("role tab failed:", e)
        page.get_by_text("SKILLS", exact=True).first.click()
    page.wait_for_timeout(1500)
    page.screenshot(path=str(OUT_DIR / "_skills_tab.png"), full_page=True)

    context.close()
