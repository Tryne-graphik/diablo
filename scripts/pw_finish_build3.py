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

def get_tooltip_full(fl):
    try:
        body_text = fl.locator("body").inner_text(timeout=5000)
    except Exception:
        return None, None, ""
    idx = body_text.find("RANK")
    if idx == -1:
        return None, None, body_text[-200:]
    before = body_text[:idx]
    lines = [s.strip() for s in before.split("\n") if s.strip()]
    name = lines[-1] if lines else None
    m = re.search(r"RANK\s+(\d+)\s*/\s*(\d+)", body_text[idx:idx + 20])
    rank = int(m.group(1)) if m else None
    after = body_text[idx:idx + 100]
    return name, rank, after

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

    print("Points at start:", get_points_counter(fl))

    # remove wrong node 697
    sx697, sy697 = world_to_screen(-2498.7, 2353.1)
    page.mouse.click(sx697, sy697, button="right")
    page.wait_for_timeout(600)
    print("After removing 697:", get_points_counter(fl))

    # sanity check Flurry unaffected
    page.mouse.click(586, 552)
    page.wait_for_timeout(500)
    n0, r0, _ = get_tooltip_full(fl)
    print("Flurry sanity check:", n0, r0)
    page.mouse.move(1050, 200)
    page.wait_for_timeout(300)

    # drag-pan the canvas up to reveal the bottom area, using an actual mouse drag (not wheel)
    page.mouse.move(700, 700)
    page.mouse.down()
    page.mouse.move(700, 600, steps=10)
    page.mouse.up()
    page.wait_for_timeout(600)

    # re-verify Flurry's NEW position after pan by testing a small area around the old spot
    # (a drag up by 100 typically shifts content up by ~100, so Flurry should now be near y=552-100=452)
    page.mouse.click(586, 452)
    page.wait_for_timeout(500)
    n1, r1, ctx1 = get_tooltip_full(fl)
    print("Flurry after pan, tested at (586,452):", n1, r1, ctx1[:60])

    pan_dy = None
    if n1 == "Flurry":
        pan_dy = 452 - 552  # -100
    else:
        print("Pan calibration uncertain, aborting pan-based approach")

    if pan_dy is not None:
        sx715, sy715 = world_to_screen(-2415.5, 6560.4)
        target_y = sy715 + pan_dy
        print(f"Clicking Cooldown(715) at panned position ({sx715},{target_y})")
        page.mouse.click(sx715, target_y)
        page.wait_for_timeout(600)
        name, rank, ctx = get_tooltip_full(fl)
        print("Result:", name, rank, "ctx:", ctx)

    page.wait_for_timeout(400)
    final_spent, final_total = get_points_counter(fl)
    print("FINAL:", final_spent, "/", final_total)
    page.screenshot(path=str(OUT_DIR / "_finish3_result.png"), full_page=False)

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
