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

    # 1) remove stray Flurry point
    page.mouse.click(586, 552)
    page.wait_for_timeout(600)
    name0, rank0, ctx0 = get_tooltip_info(fl)
    print("Clicked Flurry spot, got:", name0, rank0)
    if name0 == "Flurry":
        rp = fl.locator("text=Remove point").first
        print("Remove point button count:", rp.count())
        rp.click(timeout=3000, force=True)
        page.wait_for_timeout(600)
        name0b, rank0b, _ = get_tooltip_info(fl)
        print("After remove click, tooltip now:", name0b, rank0b)
    page.mouse.click(1050, 200)
    page.wait_for_timeout(400)

    # 2) add missing Cooldown (id 715) - predicted position is near the bottom edge, scroll extra
    page.mouse.wheel(0, 120)
    page.wait_for_timeout(500)
    sx, sy = world_to_screen(-2415.5, 6560.4)
    sy_adj = sy - 120
    print(f"Clicking Cooldown(715) at adjusted ({sx},{sy_adj}) [raw predicted was ({sx},{sy})]")
    page.mouse.click(sx, sy_adj)
    page.wait_for_timeout(600)
    name1, rank1, ctx1 = get_tooltip_info(fl)
    print("Result:", name1, rank1, "ctx=", ctx1)

    if name1 != "Cooldown":
        # try a small grid search around the adjusted point
        found = False
        for dx in (-15, 0, 15, -30, 30):
            for dy in (-15, 0, 15, -30, 30):
                if dx == 0 and dy == 0:
                    continue
                tx, ty = sx + dx, sy_adj + dy
                page.mouse.click(tx, ty)
                page.wait_for_timeout(400)
                n, r, c = get_tooltip_info(fl)
                if n == "Cooldown":
                    print(f"Found Cooldown at offset ({dx},{dy}) -> ({tx},{ty})")
                    found = True
                    break
                elif n:
                    # wrong node hit, remove any accidental point
                    try:
                        rp2 = fl.locator("text=Remove point").first
                        if rp2.count() > 0:
                            rp2.click(timeout=1500, force=True)
                            page.wait_for_timeout(300)
                    except Exception:
                        pass
            if found:
                break
        if not found:
            print("STILL COULD NOT FIND Cooldown node 715")

    page.mouse.click(1050, 200)
    page.wait_for_timeout(400)
    page.mouse.wheel(0, -120)
    page.wait_for_timeout(400)

    page.screenshot(path=str(OUT_DIR / "_cleanup_result.png"), full_page=False)

    try:
        page.get_by_role("button", name="Save", exact=True).click(timeout=8000)
        page.wait_for_timeout(2500)
        print("Save clicked")
    except Exception as e:
        print("Save failed:", e)

    context.close()
