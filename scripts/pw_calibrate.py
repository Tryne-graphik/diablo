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

    points = [(570, 428), (536, 678), (645, 483), (719, 414)]
    for (x, y) in points:
        page.mouse.click(x, y)
        page.wait_for_timeout(800)
        txt_frame = get_tooltip_text(fl)
        print(f"CLICK ({x},{y}) -> frame:", repr(txt_frame)[:250])
        try:
            rp = fl.locator("text=Remove point").first
            if rp.count() > 0:
                rp.click(timeout=3000)
                page.wait_for_timeout(500)
        except Exception as e:
            print("remove failed:", e)
        page.mouse.click(1100, 200)
        page.wait_for_timeout(400)

    context.close()
