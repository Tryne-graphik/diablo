from pathlib import Path
from playwright.sync_api import sync_playwright

PROFILE_DIR = Path(__file__).resolve().parent.parent / ".pw-profile-infinitybuilds"
OUT_DIR = Path(__file__).resolve().parent
EDIT_URL = "https://infinitybuilds.gg/en/me/builds/cmulue9q600000agm0xgh0ogv/edit"

with sync_playwright() as p:
    context = p.chromium.launch_persistent_context(
        user_data_dir=str(PROFILE_DIR), headless=True, viewport={"width": 1400, "height": 1000},
    )
    page = context.pages[0] if context.pages else context.new_page()
    page.goto(EDIT_URL, wait_until="domcontentloaded")
    page.wait_for_timeout(2500)

    page.click("text=Boots")
    page.wait_for_timeout(1200)
    page.screenshot(path=str(OUT_DIR / "_boots_picker.png"), full_page=True)

    try:
        page.get_by_role("tab", name="Legendary").click()
    except Exception as e:
        print("role tab Legendary failed:", e)
        page.get_by_text("Legendary", exact=True).first.click(force=True)
    page.wait_for_timeout(1000)
    page.screenshot(path=str(OUT_DIR / "_boots_legendary_tab.png"), full_page=True)

    context.close()
