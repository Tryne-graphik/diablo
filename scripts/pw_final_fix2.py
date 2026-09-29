import json, re
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

def get_tooltip_info(fl):
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
    rank_match = re.search(r"RANK\s+(\d+)\s*/\s*(\d+)", body_text[idx:idx + 20])
    current_rank = int(rank_match.group(1)) if rank_match else None
    return name, current_rank, body_text[max(0, idx - 60):idx + 40]

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

    print("Points before anything:", get_points_counter(fl))

    # open Flurry tooltip (should NOT add since at cap)
    page.mouse.click(586, 552)
    page.wait_for_timeout(600)
    name, rank, ctx = get_tooltip_info(fl)
    print("Flurry tooltip:", name, rank)

    rp = fl.locator("text=Remove point").first
    box = rp.bounding_box()
    cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    page.mouse.click(cx, cy)
    page.wait_for_timeout(700)

    # read the points counter WITHOUT clicking the node again
    spent, total = get_points_counter(fl)
    print("Points after remove click (no re-click on node):", spent, "/", total)

    # move mouse elsewhere to close whatever overlay is left, without touching the tree
    page.mouse.move(1050, 200)
    page.wait_for_timeout(500)
    spent2, total2 = get_points_counter(fl)
    print("Points after moving mouse away:", spent2, "/", total2)

    page.screenshot(path=str(OUT_DIR / "_fix2_after_remove.png"), full_page=False)

    if spent2 is not None and spent2 < 83:
        # now allocate Cooldown (id 715) - there should be room now
        page.mouse.wheel(0, 120)
        page.wait_for_timeout(500)
        sx, sy = world_to_screen(-2415.5, 6560.4)
        sy_adj = sy - 120
        page.mouse.click(sx, sy_adj)
        page.wait_for_timeout(600)
        name2, rank2, ctx2 = get_tooltip_info(fl)
        print(f"Cooldown(715) click at ({sx},{sy_adj}) ->", name2, rank2)
        page.mouse.move(1050, 200)
        page.wait_for_timeout(400)
        page.mouse.wheel(0, -120)
        page.wait_for_timeout(400)
        final_spent, final_total = get_points_counter(fl)
        print("FINAL points:", final_spent, "/", final_total)

    page.screenshot(path=str(OUT_DIR / "_fix2_final.png"), full_page=False)

    try:
        page.get_by_role("button", name="Save", exact=True).click(timeout=8000)
        page.wait_for_timeout(2500)
        print("Save clicked")
    except Exception as e:
        print("Save failed:", e)

    context.close()
