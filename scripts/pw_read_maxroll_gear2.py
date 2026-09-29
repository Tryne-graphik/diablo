from pathlib import Path
from playwright.sync_api import sync_playwright

OUT_DIR = Path(__file__).resolve().parent
URL = "https://maxroll.gg/d4/build-guides/twisting-blades-rogue-guide"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 1200})
    page.goto(URL, wait_until="domcontentloaded")
    page.wait_for_timeout(3000)

    # dismiss privacy popup if present
    try:
        page.get_by_role("button", name="Accept").click(timeout=3000)
        page.wait_for_timeout(500)
    except Exception:
        pass

    try:
        page.get_by_text("Endgame", exact=True).first.click()
        page.wait_for_timeout(1500)
    except Exception as e:
        print("endgame tab click failed:", e)

    equip_heading = page.get_by_text("Equipment", exact=True).first
    equip_heading.scroll_into_view_if_needed()
    page.mouse.wheel(0, 750)
    page.wait_for_timeout(1000)
    page.screenshot(path=str(OUT_DIR / "_maxroll_gear_zoom2.png"), full_page=False)

    browser.close()
