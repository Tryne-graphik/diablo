import re
from pathlib import Path
from playwright.sync_api import sync_playwright

PROFILE_DIR = Path(__file__).resolve().parent.parent / ".pw-profile-infinitybuilds"
OUT_DIR = Path(__file__).resolve().parent
EDIT_URL = "https://infinitybuilds.gg/en/me/builds/cmulue9q600000agm0xgh0ogv/edit"

def get_points_counter(fl):
    try:
        txt = fl.locator("text=SKILL POINTS").first.locator("xpath=..").inner_text(timeout=3000)
        m = re.search(r"(\d+)\s*/\s*(\d+)", txt)
        return (int(m.group(1)), int(m.group(2))) if m else (None, None)
    except Exception:
        return (None, None)

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

    print("Points before:", get_points_counter(fl))

    page.mouse.click(586, 552)
    page.wait_for_timeout(600)

    rp = fl.locator("text=Remove point").first
    print("elementFromPoint check:", rp.evaluate("""el => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width/2, cy = r.top + r.height/2;
        const top = document.elementFromPoint(cx, cy);
        return {topTag: top.tagName, topClass: top.className, isSelfOrChild: el.contains(top)};
    }"""))

    # Try a native DOM click via evaluate (bypasses hit-testing entirely)
    rp.evaluate("el => el.click()")
    page.wait_for_timeout(700)
    print("Points after el.click():", get_points_counter(fl))

    context.close()
