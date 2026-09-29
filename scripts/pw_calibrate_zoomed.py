from pathlib import Path
from playwright.sync_api import sync_playwright

PROFILE_DIR = Path(__file__).resolve().parent.parent / ".pw-profile-infinitybuilds"
OUT_DIR = Path(__file__).resolve().parent

def get_tooltip_text(fl):
    try:
        body_text = fl.locator("body").inner_text(timeout=5000)
    except Exception as e:
        return f"ERR: {e}"
    idx = body_text.find("RANK")
    if idx == -1:
        return None
    start = max(0, idx - 60)
    return body_text[start:idx + 150].replace("\n", " | ")

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
    page.get_by_role("tab", name="Skills").click()
    page.wait_for_timeout(2000)
    page.locator('iframe[src*="tools.infinitybuilds.gg/en/skills"]').scroll_into_view_if_needed()
    page.wait_for_timeout(2000)

    fl = page.frame_locator('iframe[src*="tools.infinitybuilds.gg/en/skills"]')
    zoom_out_btn = fl.locator('[title="Zoom out"]')
    for i in range(10):
        zoom_out_btn.click()
        page.wait_for_timeout(150)
    page.wait_for_timeout(800)

    points = [(638, 420), (708, 420), (638, 845), (586, 552)]
    for (x, y) in points:
        page.mouse.click(x, y)
        page.wait_for_timeout(700)
        txt = get_tooltip_text(fl)
        print(f"CLICK ({x},{y}) ->", repr(txt)[:200])
        try:
            rp = fl.locator("text=Remove point").first
            if rp.count() > 0:
                rp.click(timeout=3000)
                page.wait_for_timeout(400)
        except Exception:
            pass
        page.mouse.click(1050, 200)
        page.wait_for_timeout(300)

    context.close()
