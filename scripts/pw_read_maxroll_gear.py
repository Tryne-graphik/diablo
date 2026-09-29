from pathlib import Path
from playwright.sync_api import sync_playwright

OUT_DIR = Path(__file__).resolve().parent
URL = "https://maxroll.gg/d4/build-guides/twisting-blades-rogue-guide"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 1200})
    page.goto(URL, wait_until="domcontentloaded")
    page.wait_for_timeout(3000)

    # Make sure the "Endgame" profile tab is selected
    try:
        page.get_by_text("Endgame", exact=True).first.click()
        page.wait_for_timeout(1500)
    except Exception as e:
        print("couldn't click Endgame tab:", e)

    page.screenshot(path=str(OUT_DIR / "_maxroll_gear_overview.png"), full_page=True)
    browser.close()
