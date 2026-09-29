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
    page.wait_for_timeout(3500)

    ranged_locs = page.locator("text=Ranged")
    print("count of 'Ranged' text matches:", ranged_locs.count())
    for i in range(ranged_locs.count()):
        try:
            box = ranged_locs.nth(i).bounding_box()
            print(i, box)
        except Exception as e:
            print(i, "err", e)

    ranged_locs.first.click(timeout=10000)
    page.wait_for_timeout(1500)
    page.screenshot(path=str(OUT_DIR / "_ranged_debug.png"), full_page=True)

    context.close()
