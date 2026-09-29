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

TARGETS_RAW = [
    ("247", 1), ("43", 1), ("41", 1), ("586", 1), ("589", 1), ("245", 15),
    ("675", 1), ("40", 15), ("67", 1), ("677", 1), ("29", 15), ("715", 1),
    ("718", 1), ("59", 1), ("27", 15), ("689", 1), ("690", 1), ("45", 3),
    ("23", 1), ("204", 1), ("632", 1), ("647", 1), ("633", 1), ("471", 1),
    ("55", 1),
]

save_requests = []

def log_request(req):
    if req.method == "PATCH" and "/api/builds/" in req.url:
        save_requests.append(req.post_data)

with sync_playwright() as p:
    context = p.chromium.launch_persistent_context(
        user_data_dir=str(PROFILE_DIR), headless=True, viewport={"width": 1400, "height": 1000},
    )
    page = context.pages[0] if context.pages else context.new_page()
    page.on("request", log_request)

    page.goto(EDIT_URL, wait_until="domcontentloaded")
    page.wait_for_timeout(2500)
    page.get_by_role("tab", name="Skills").click()
    page.wait_for_timeout(2000)
    page.locator('iframe[src*="tools.infinitybuilds.gg/en/skills"]').scroll_into_view_if_needed()
    page.wait_for_timeout(1500)

    fl = page.frame_locator('iframe[src*="tools.infinitybuilds.gg/en/skills"]')

    # remove stray Flurry test point if present from the diagnosis run
    page.mouse.click(586, 552)
    page.wait_for_timeout(500)
    name0, rank0, _ = get_tooltip_info(fl)
    if name0 == "Flurry":
        try:
            fl.locator("text=Remove point").first.click(timeout=2000)
            page.wait_for_timeout(400)
            print("Removed stray Flurry point")
        except Exception as e:
            print("couldn't remove stray point:", e)
    page.mouse.click(1050, 200)
    page.wait_for_timeout(300)

    zoom_out_btn = fl.locator('[title="Zoom out"]')
    for i in range(10):
        zoom_out_btn.click()
        page.wait_for_timeout(150)
    page.wait_for_timeout(600)

    ok_count = 0
    fail_list = []

    for nid, target_rank in TARGETS_RAW:
        node = rogue_nodes[nid]
        sx, sy = world_to_screen(node["x"], node["y"])
        page.mouse.click(sx, sy)
        page.wait_for_timeout(350)
        name, rank, ctx = get_tooltip_info(fl)

        if name != node["displayName"] and name in by_name:
            # local correction
            hit_candidates = by_name[name]
            hit_node = min(hit_candidates, key=lambda n: (world_to_screen(n["x"], n["y"])[0]-sx)**2 + (world_to_screen(n["x"], n["y"])[1]-sy)**2)
            dwx = node["x"] - hit_node["x"]
            dwy = node["y"] - hit_node["y"]
            try:
                fl.locator("text=Remove point").first.click(timeout=2000)
                page.wait_for_timeout(300)
            except Exception:
                pass
            corr_sx = sx + round(dwx * SCALE_X)
            corr_sy = sy + round(dwy * SCALE_Y)
            page.mouse.click(corr_sx, corr_sy)
            page.wait_for_timeout(350)
            name, rank, ctx = get_tooltip_info(fl)
            sx, sy = corr_sx, corr_sy

        if name != node["displayName"]:
            print(f"FAIL {node['displayName']} (id {nid}): got {name!r} ctx={ctx!r}")
            fail_list.append(nid)
            page.mouse.click(1050, 200)
            page.wait_for_timeout(300)
            continue

        # click remaining ranks (we've already clicked once = rank should be >=1)
        remaining = target_rank - (rank or 1)
        for _ in range(max(0, remaining)):
            page.mouse.click(sx, sy)
            page.wait_for_timeout(180)

        page.wait_for_timeout(250)
        name2, rank2, _ = get_tooltip_info(fl)
        status = "OK" if rank2 == target_rank else f"PARTIAL(got {rank2})"
        print(f"{status} {node['displayName']} (id {nid}) target={target_rank}")
        if rank2 == target_rank:
            ok_count += 1
        else:
            fail_list.append(nid)

        page.mouse.click(1050, 200)
        page.wait_for_timeout(250)

    print(f"=== SUMMARY: ok={ok_count} fail={len(fail_list)} fail_ids={fail_list}")

    page.wait_for_timeout(500)
    page.screenshot(path=str(OUT_DIR / "_final_alloc_result.png"), full_page=False)

    try:
        pts_text = fl.locator("text=SKILL POINTS").first.locator("xpath=..").inner_text(timeout=3000)
        print("Final points display:", pts_text.replace(chr(10), " / "))
    except Exception as e:
        print("read points failed:", e)

    save_requests.clear()
    try:
        page.get_by_role("button", name="Save", exact=True).click(timeout=8000)
        page.wait_for_timeout(2500)
        print("Save clicked, PATCH bodies captured:", len(save_requests))
        for b in save_requests:
            skills_idx = b.find('"skills":{"skills"')
            print("SAVE PAYLOAD SKILLS SNIPPET:", b[skills_idx:skills_idx+800] if skills_idx != -1 else "NOT FOUND IN PAYLOAD")
    except Exception as e:
        print("Save failed:", e)

    context.close()
