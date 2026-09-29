from pathlib import Path
from playwright.sync_api import sync_playwright

PROFILE_DIR = Path(__file__).resolve().parent.parent / ".pw-profile-infinitybuilds"
OUT_DIR = Path(__file__).resolve().parent
EDIT_URL = "https://infinitybuilds.gg/en/me/builds/cmulue9q600000agm0xgh0ogv/edit"

with sync_playwright() as p:
    context = p.chromium.launch_persistent_context(
        user_data_dir=str(PROFILE_DIR), headless=True, viewport={"width": 1400, "height": 1000},
    )
    page = context.pages[0] if context.pages else context.new_page()
    page.goto(EDIT_URL, wait_until="domcontentloaded")
    page.wait_for_timeout(3500)

    try:
        page.get_by_role("button", name="Discard draft").click(timeout=4000)
        page.wait_for_timeout(1500)
        print("Discarded stale draft banner")
    except Exception as e:
        print("No draft banner or discard failed:", e)

    page.click("text=Ranged", timeout=10000)
    page.wait_for_timeout(1200)
    page.screenshot(path=str(OUT_DIR / "_ranged_before_legendary_tab.png"), full_page=True)
    try:
        page.get_by_role("tab", name="Legendary").click(timeout=5000)
        print("clicked Legendary via role=tab")
    except Exception as e1:
        print("role tab click failed:", e1)
        try:
            page.get_by_text("Legendary", exact=True).first.click(force=True, timeout=5000)
            print("clicked Legendary via get_by_text force")
        except Exception as e2:
            print("get_by_text force click also failed:", e2)
    page.wait_for_timeout(900)
    page.screenshot(path=str(OUT_DIR / "_ranged_after_legendary_tab.png"), full_page=True)
    page.get_by_text("Crossbow", exact=True).click(timeout=5000)
    page.wait_for_timeout(700)
    page.fill('input[placeholder^="Search legendary"]', "Crushing", timeout=10000)
    page.wait_for_timeout(1000)
    page.screenshot(path=str(OUT_DIR / "_ranged_crushing_search.png"), full_page=True)
    page.get_by_text("Crushing", exact=False).first.click(timeout=6000)
    page.wait_for_timeout(700)
    page.get_by_role("button", name="Save").click(timeout=6000)
    page.wait_for_timeout(1200)
    print("Ranged = Crushing saved")

    try:
        page.get_by_role("button", name="Save", exact=True).click(timeout=8000)
        page.wait_for_timeout(2500)
        print("Top-level Save clicked")
    except Exception as e:
        print("Top-level Save failed:", e)

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
    gear = data["build"]["variants"][0]["gear"]
    for g in gear:
        print(g.get("slot"), "->", g.get("itemName") or g.get("itemId"))
    context.close()
