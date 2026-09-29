import re
from pathlib import Path
from playwright.sync_api import sync_playwright

PROFILE_DIR = Path(__file__).resolve().parent.parent / ".pw-profile-infinitybuilds"
OUT_DIR = Path(__file__).resolve().parent
EDIT_URL = "https://infinitybuilds.gg/en/me/builds/cmulue9q600000agm0xgh0ogv/edit"

SCALE_X = 0.02257
OFFSET_X = 673.83
SCALE_Y = 0.04338
OFFSET_Y = 720.22

def world_to_screen(wx, wy):
    return (round(wx * SCALE_X + OFFSET_X), round(wy * SCALE_Y + OFFSET_Y))

def get_points_counter(fl):
    try:
        txt = fl.locator("text=SKILL POINTS").first.locator("xpath=..").inner_text(timeout=3000)
        m = re.search(r"(\d+)\s*/\s*(\d+)", txt)
        return (int(m.group(1)), int(m.group(2))) if m else (None, None)
    except Exception:
        return (None, None)

def get_tooltip_info(fl):
    try:
        body_text = fl.locator("body").inner_text(timeout=5000)
    except Exception:
        return None, None
    idx = body_text.find("RANK")
    if idx == -1:
        return None, None
    before = body_text[:idx]
    lines = [s.strip() for s in before.split("\n") if s.strip()]
    name = lines[-1] if lines else None
    m = re.search(r"RANK\s+(\d+)\s*/\s*(\d+)", body_text[idx:idx + 20])
    return name, (int(m.group(1)) if m else None)

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

    spent, total = get_points_counter(fl)
    print("Points now:", spent, "/", total)

    if spent == 83:
        # remove the stray Flurry point via right-click (bypasses the broken tooltip button)
        page.mouse.click(586, 552, button="right")
        page.wait_for_timeout(600)
        spent, total = get_points_counter(fl)
        print("Points after right-click remove:", spent, "/", total)

    # allocate Cooldown (id 715)
    page.mouse.wheel(0, 120)
    page.wait_for_timeout(500)
    sx, sy = world_to_screen(-2415.5, 6560.4)
    sy_adj = sy - 120
    page.mouse.click(sx, sy_adj)
    page.wait_for_timeout(600)
    name, rank = get_tooltip_info(fl)
    print(f"Cooldown(715) click at ({sx},{sy_adj}) -> name={name} rank={rank}")

    page.mouse.move(1050, 200)
    page.wait_for_timeout(400)
    page.mouse.wheel(0, -120)
    page.wait_for_timeout(400)

    final_spent, final_total = get_points_counter(fl)
    print("FINAL points:", final_spent, "/", final_total)
    page.screenshot(path=str(OUT_DIR / "_finish_result.png"), full_page=False)

    try:
        page.get_by_role("button", name="Save", exact=True).click(timeout=8000)
        page.wait_for_timeout(2500)
        print("Save clicked")
    except Exception as e:
        print("Save failed:", e)

    context.close()

print("Verifying via fresh reload...")
with sync_playwright() as p:
    context = p.chromium.launch_persistent_context(
        user_data_dir=str(PROFILE_DIR), headless=True, viewport={"width": 1400, "height": 1000},
    )
    page = context.pages[0] if context.pages else context.new_page()
    page.goto(EDIT_URL, wait_until="domcontentloaded")
    page.wait_for_timeout(1500)
    data = page.evaluate("() => fetch('https://infinitybuilds.gg/api/builds/cmulue9q600000agm0xgh0ogv').then(r=>r.json())")
    skills = data["build"]["variants"][0]["skills"]["skills"]
    ids = sorted(int(k.split("-")[1]) for k in skills.keys())
    print("Saved node ids:", ids)
    print("Total points:", sum(skills.values()))
    context.close()
