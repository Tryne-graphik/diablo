from pathlib import Path
from playwright.sync_api import sync_playwright

PROFILE_DIR = Path(__file__).resolve().parent.parent / ".pw-profile-infinitybuilds"
OUT_DIR = Path(__file__).resolve().parent

SCALE = 149 / 3122.88
OFFSET_X = 570 - (-1672.40 * SCALE)
OFFSET_Y = 428 - (-6681.25 * SCALE)

def world_to_screen(wx, wy):
    return (wx * SCALE + OFFSET_X, wy * SCALE + OFFSET_Y)

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

    targets = [
        ("Twisting Blades", -3733.5, -4754.1),
        ("Caltrops", 3836.6, -1776.2),
        ("Dark Shroud", -2736.6, -631.8),
    ]
    for name, wx, wy in targets:
        sx, sy = world_to_screen(wx, wy)
        sx, sy = round(sx), round(sy)
        page.mouse.click(sx, sy)
        page.wait_for_timeout(800)
        txt = get_tooltip_text(fl)
        print(f"{name} predicted=({sx},{sy}) ->", repr(txt)[:150])
        try:
            rp = fl.locator("text=Remove point").first
            if rp.count() > 0:
                rp.click(timeout=3000)
                page.wait_for_timeout(500)
        except Exception:
            pass
        page.mouse.click(1100, 200)
        page.wait_for_timeout(400)

    context.close()
