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
    page.get_by_role("tab", name="Skills").click()
    page.wait_for_timeout(2000)
    page.locator('iframe[src*="tools.infinitybuilds.gg/en/skills"]').scroll_into_view_if_needed()
    page.wait_for_timeout(1500)

    fl = page.frame_locator('iframe[src*="tools.infinitybuilds.gg/en/skills"]')
    zoom_out_btn = fl.locator('[title="Zoom out"]')
    for i in range(10):
        zoom_out_btn.click()
        page.wait_for_timeout(150)
    page.wait_for_timeout(600)

    page.mouse.click(586, 552)
    page.wait_for_timeout(700)
    page.screenshot(path=str(OUT_DIR / "_flurry_tooltip_before_remove.png"), full_page=False)

    rp = fl.locator("text=Remove point").first
    box = rp.bounding_box()
    print("Remove point bounding box:", box)
    if box:
        cx = box["x"] + box["width"] / 2
        cy = box["y"] + box["height"] / 2
        print(f"Clicking directly at ({cx},{cy})")
        page.mouse.click(cx, cy)
        page.wait_for_timeout(700)
        page.screenshot(path=str(OUT_DIR / "_flurry_after_direct_click.png"), full_page=False)

    # re-check via clicking the same spot again
    page.mouse.click(1050, 200)
    page.wait_for_timeout(400)
    page.mouse.click(586, 552)
    page.wait_for_timeout(700)
    body = fl.locator("body").inner_text(timeout=5000)
    print("Re-check tooltip text:", repr(body[:300]))
    page.screenshot(path=str(OUT_DIR / "_flurry_recheck.png"), full_page=False)

    context.close()
