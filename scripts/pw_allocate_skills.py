import json
from pathlib import Path
from playwright.sync_api import sync_playwright

PROFILE_DIR = Path(__file__).resolve().parent.parent / ".pw-profile-infinitybuilds"
OUT_DIR = Path(__file__).resolve().parent

SCALE_X = 0.02257
OFFSET_X = 673.83
SCALE_Y = 0.04338
OFFSET_Y = 720.22

def world_to_screen(wx, wy):
    return (round(wx * SCALE_X + OFFSET_X), round(wy * SCALE_Y + OFFSET_Y))

def get_tooltip_name(fl):
    try:
        body_text = fl.locator("body").inner_text(timeout=5000)
    except Exception:
        return None, ""
    idx = body_text.find("RANK")
    if idx == -1:
        return None, body_text[-200:]
    before = body_text[:idx]
    parts = [s.strip() for s in before.split("|") if s.strip()]
    name = parts[-1] if parts else None
    return name, body_text[max(0, idx - 80):idx + 40]

with open(OUT_DIR / "_skilltrees_raw.json", encoding="utf-8") as f:
    st = json.load(f)
rogue_nodes = {str(n["id"]): n for n in st["classes"]["rogue"]["nodes"]}
by_name = {}
for n in st["classes"]["rogue"]["nodes"]:
    by_name.setdefault(n["displayName"], []).append(n)

# (node_id, target_rank) pairs from the Maxroll Endgame Twisting Blades Poison profile
TARGETS_RAW = [
    ("247", 1), ("43", 1), ("41", 1), ("586", 1), ("589", 1), ("245", 15),
    ("675", 1), ("40", 15), ("67", 1), ("677", 1), ("29", 15), ("715", 1),
    ("718", 1), ("59", 1), ("27", 15), ("689", 1), ("690", 1), ("45", 3),
    ("23", 1), ("204", 1), ("632", 1), ("647", 1), ("633", 1), ("471", 1),
    ("55", 1),
]

targets = []
for nid, rank in TARGETS_RAW:
    node = rogue_nodes[nid]
    targets.append({"id": nid, "name": node["displayName"], "rank": rank, "wx": node["x"], "wy": node["y"]})

results = {"ok": [], "failed": []}

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

    try:
        title_input = page.locator('input[aria-label="Build title"]')
        title_input.fill("Twisting Blades Poison - Farm Parangon")
    except Exception as e:
        print("title fill failed:", e)

    # Gear: Leoric's Crown with Damnation + Pain splinters
    page.click("text=Helm")
    page.wait_for_timeout(1000)
    page.fill('input[placeholder^="Search uniques"]', "Leoric")
    page.wait_for_timeout(800)
    page.click("text=Leoric's Crown")
    page.wait_for_timeout(1000)
    page.locator("text=Empty Socket").first.click()
    page.wait_for_timeout(800)
    try:
        page.get_by_role("tab", name="Soul Splinter").click()
    except Exception:
        page.get_by_text("Soul Splinter", exact=True).last.click(force=True)
    page.wait_for_timeout(500)
    page.fill('input[placeholder^="Search"]', "Damnation")
    page.wait_for_timeout(800)
    page.get_by_text("GREATER SPLINTER OF DAMNATION", exact=False).click()
    page.wait_for_timeout(500)
    page.get_by_role("button", name="Save").click()
    page.wait_for_timeout(1000)

    page.click("text=Leoric's Crown")
    page.wait_for_timeout(1000)
    page.locator("text=Empty Socket").first.click()
    page.wait_for_timeout(800)
    try:
        page.get_by_role("tab", name="Soul Splinter").click()
    except Exception:
        page.get_by_text("Soul Splinter", exact=True).last.click(force=True)
    page.wait_for_timeout(500)
    page.fill('input[placeholder^="Search"]', "Pain")
    page.wait_for_timeout(800)
    page.get_by_text("GREATER SPLINTER OF PAIN", exact=False).click()
    page.wait_for_timeout(500)
    page.get_by_role("button", name="Save").click()
    page.wait_for_timeout(1000)
    print("Gear (Leoric's Crown + Damnation + Pain) done")

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

    def click_and_check(sx, sy, expected_name):
        page.mouse.click(sx, sy)
        page.wait_for_timeout(600)
        name, ctx = get_tooltip_name(fl)
        return name, ctx

    for t in targets:
        sx, sy = world_to_screen(t["wx"], t["wy"])
        name, ctx = click_and_check(sx, sy, t["name"])
        matched = name is not None and name.lower() == t["name"].lower()

        if not matched and name and name in by_name:
            # local correction using the actually-hit node's world coords
            hit_candidates = by_name[name]
            # pick the candidate whose predicted screen pos is closest to (sx,sy)
            hit_node = min(hit_candidates, key=lambda n: (world_to_screen(n["x"], n["y"])[0]-sx)**2 + (world_to_screen(n["x"], n["y"])[1]-sy)**2)
            dwx = t["wx"] - hit_node["x"]
            dwy = t["wy"] - hit_node["y"]
            corr_sx = sx + round(dwx * SCALE_X)
            corr_sy = sy + round(dwy * SCALE_Y)
            # undo the wrong click if it allocated a point
            try:
                rp = fl.locator("text=Remove point").first
                if rp.count() > 0:
                    rp.click(timeout=3000)
                    page.wait_for_timeout(400)
            except Exception:
                pass
            name2, ctx2 = click_and_check(corr_sx, corr_sy, t["name"])
            if name2 and name2.lower() == t["name"].lower():
                matched = True
                sx, sy = corr_sx, corr_sy
                name = name2
            else:
                results["failed"].append({"target": t, "tried": [(sx, sy, name), (corr_sx, corr_sy, name2)]})
                print(f"FAIL {t['name']} (id {t['id']}): got '{name}' then '{name2}'")
                continue
        elif not matched:
            results["failed"].append({"target": t, "tried": [(sx, sy, name)]})
            print(f"FAIL {t['name']} (id {t['id']}): got '{name}' ctx={ctx}")
            continue

        # matched: click remaining ranks
        for _ in range(t["rank"] - 1):
            page.mouse.click(sx, sy)
            page.wait_for_timeout(250)

        print(f"OK {t['name']} (id {t['id']}) rank={t['rank']} at ({sx},{sy})")
        results["ok"].append(t["id"])

    page.wait_for_timeout(500)
    page.screenshot(path=str(OUT_DIR / "_allocation_final.png"), full_page=False)

    # persist progress
    try:
        page.get_by_role("button", name="Save Draft").click(timeout=5000)
        page.wait_for_timeout(2000)
        print("Save Draft clicked")
    except Exception as e:
        print("Save Draft failed:", e)

    context.close()

print("SUMMARY: ok=%d failed=%d" % (len(results["ok"]), len(results["failed"])))
Path(OUT_DIR / "_allocation_results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
