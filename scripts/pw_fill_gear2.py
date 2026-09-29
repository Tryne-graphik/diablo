from pathlib import Path
from playwright.sync_api import sync_playwright

PROFILE_DIR = Path(__file__).resolve().parent.parent / ".pw-profile-infinitybuilds"
OUT_DIR = Path(__file__).resolve().parent
EDIT_URL = "https://infinitybuilds.gg/en/me/builds/cmulue9q600000agm0xgh0ogv/edit"

def log(msg):
    print(msg, flush=True)

def safe_cancel(page):
    try:
        page.get_by_role("button", name="Cancel").click(timeout=2000)
        page.wait_for_timeout(400)
    except Exception:
        try:
            page.keyboard.press("Escape")
            page.wait_for_timeout(400)
        except Exception:
            pass

def pick_legendary(page, slot_text, search_text):
    try:
        page.click(f"text={slot_text}", timeout=10000)
        page.wait_for_timeout(1200)
        try:
            page.get_by_role("tab", name="Legendary").click(timeout=5000)
        except Exception:
            page.get_by_text("Legendary", exact=True).first.click(force=True, timeout=5000)
        page.wait_for_timeout(900)
        page.fill('input[placeholder^="Search legendary"]', search_text, timeout=10000)
        page.wait_for_timeout(1000)
        page.get_by_text(search_text, exact=False).first.click(timeout=6000)
        page.wait_for_timeout(700)
        page.get_by_role("button", name="Save").click(timeout=6000)
        page.wait_for_timeout(1200)
        log(f"OK legendary {slot_text} = {search_text}")
        return True
    except Exception as e:
        log(f"FAIL legendary {slot_text}={search_text}: {e}")
        safe_cancel(page)
        return False

with sync_playwright() as p:
    context = p.chromium.launch_persistent_context(
        user_data_dir=str(PROFILE_DIR), headless=True, viewport={"width": 1400, "height": 1000},
    )
    page = context.pages[0] if context.pages else context.new_page()
    page.goto(EDIT_URL, wait_until="domcontentloaded")
    page.wait_for_timeout(4500)

    pick_legendary(page, "Ranged", "Crushing")
    pick_legendary(page, "Amulet", "Exploiter")

    page.screenshot(path=str(OUT_DIR / "_gear_fill2_result.png"), full_page=True)

    try:
        page.get_by_role("button", name="Save", exact=True).click(timeout=8000)
        page.wait_for_timeout(2500)
        log("Top-level Save clicked")
    except Exception as e:
        log(f"Top-level Save failed: {e}")

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
