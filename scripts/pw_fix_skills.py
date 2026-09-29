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

with open(OUT_DIR / "_skilltrees_raw.json", encoding="utf-8") as f:
    st = json.load(f)
rogue_nodes = {str(n["id"]): n for n in st["classes"]["rogue"]["nodes"]}
by_name = {}
for n in st["classes"]["rogue"]["nodes"]:
    by_name.setdefault(n["displayName"], []).append(n)

# id: (target_rank, already_has_from_prior_run)
NEEDS_MORE = {
    "245": (15, 1),   # Concealment
    "40":  (15, 1),   # Twisting Blades
    "29":  (15, 1),   # Dark Shroud
    "27":  (15, 1),   # Poison Imbuement
    "45":  (3, 1),    # Dash
    "715": (1, 0),    # Cooldown (previously failed to hit at all)
}

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
    page.wait_for_timeout(2000)

    fl = page.frame_locator('iframe[src*="tools.infinitybuilds.gg/en/skills"]')
    zoom_out_btn = fl.locator('[title="Zoom out"]')
    for i in range(10):
        zoom_out_btn.click()
        page.wait_for_timeout(150)
    page.wait_for_timeout(800)

    for nid, (target_rank, had) in NEEDS_MORE.items():
        node = rogue_nodes[nid]
        sx, sy = world_to_screen(node["x"], node["y"])
        remaining = target_rank - had
        print(f"--- {node['displayName']} (id {nid}) target={target_rank} had={had} remaining={remaining} at ({sx},{sy})")
        for i in range(remaining):
            page.mouse.click(sx, sy)
            page.wait_for_timeout(220)
        page.wait_for_timeout(300)
        name, rank, ctx = get_tooltip_info(fl)
        print(f"    after clicks -> name={name!r} rank={rank}")
        if name is None or name != node["displayName"] or (rank is not None and rank < target_rank):
            print(f"    !! MISMATCH, ctx={ctx!r}")
        # move mouse away to close tooltip before next node
        page.mouse.click(1050, 200)
        page.wait_for_timeout(300)

    page.wait_for_timeout(500)
    page.screenshot(path=str(OUT_DIR / "_fix_final.png"), full_page=False)

    try:
        page.get_by_role("button", name="Save Draft").click(timeout=5000)
        page.wait_for_timeout(2000)
        print("Save Draft clicked")
    except Exception as e:
        print("Save Draft failed:", e)

    context.close()
