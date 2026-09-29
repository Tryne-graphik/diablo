from pathlib import Path
from playwright.sync_api import sync_playwright

PROFILE_DIR = Path(__file__).resolve().parent.parent / ".pw-profile-infinitybuilds"
OUT_DIR = Path(__file__).resolve().parent
EDIT_URL = "https://infinitybuilds.gg/en/me/builds/cmulue9q600000agm0xgh0ogv/edit"

UNIQUE_SLOTS = [
    ("Chest Armor", "Enigma"),
    ("Gloves", "Fist of the Iron Rose"),
    ("Pants", "Tibault's Will"),
    ("Main Hand", "The Maestro"),
    ("Off-Hand", "Asheara's Khanjar"),
]

LEGENDARY_SLOTS = [
    ("Boots", "Mending Obscurity"),
    ("Ranged", "Crushing"),
    ("Ring 1", "Imitated Imbuement"),
    ("Ring 2", "Malice"),
]

AMULET_SEARCH_CANDIDATES = ["Duelist", "Exploiter"]

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

def pick_unique(page, slot_text, search_text):
    try:
        page.click(f"text={slot_text}", timeout=8000)
        page.wait_for_timeout(900)
        page.fill('input[placeholder^="Search uniques"]', search_text, timeout=8000)
        page.wait_for_timeout(900)
        page.get_by_text(search_text, exact=False).first.click(timeout=4000)
        page.wait_for_timeout(600)
        page.get_by_role("button", name="Save").click(timeout=5000)
        page.wait_for_timeout(1000)
        log(f"OK unique {slot_text} = {search_text}")
        return True
    except Exception as e:
        log(f"FAIL unique {slot_text}={search_text}: {e}")
        safe_cancel(page)
        return False

def pick_legendary(page, slot_text, search_text):
    try:
        page.click(f"text={slot_text}", timeout=8000)
        page.wait_for_timeout(900)
        try:
            page.get_by_role("tab", name="Legendary").click(timeout=3000)
        except Exception:
            page.get_by_text("Legendary", exact=True).first.click(force=True, timeout=3000)
        page.wait_for_timeout(700)
        page.fill('input[placeholder^="Search legendary"]', search_text, timeout=8000)
        page.wait_for_timeout(900)
        page.get_by_text(search_text, exact=False).first.click(timeout=4000)
        page.wait_for_timeout(600)
        page.get_by_role("button", name="Save").click(timeout=5000)
        page.wait_for_timeout(1000)
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
    page.wait_for_timeout(2500)

    for slot_text, search_text in UNIQUE_SLOTS:
        pick_unique(page, slot_text, search_text)

    for slot_text, search_text in LEGENDARY_SLOTS:
        pick_legendary(page, slot_text, search_text)

    # Amulet: try candidate aspect search terms until one matches
    amulet_done = False
    try:
        page.click("text=Amulet", timeout=8000)
        page.wait_for_timeout(900)
        try:
            page.get_by_role("tab", name="Legendary").click(timeout=3000)
        except Exception:
            page.get_by_text("Legendary", exact=True).first.click(force=True, timeout=3000)
        page.wait_for_timeout(700)
        for cand in AMULET_SEARCH_CANDIDATES:
            page.fill('input[placeholder^="Search legendary"]', cand, timeout=8000)
            page.wait_for_timeout(900)
            page.screenshot(path=str(OUT_DIR / f"_amulet_search_{cand}.png"), full_page=True)
            results = page.locator("text=ASPECT")
            cnt = results.count()
            log(f"Amulet search '{cand}' -> {cnt} ASPECT card(s) visible")
            if cnt > 0:
                results.first.click(timeout=4000)
                page.wait_for_timeout(500)
                page.get_by_role("button", name="Save").click(timeout=5000)
                page.wait_for_timeout(1000)
                log(f"OK legendary Amulet = {cand}")
                amulet_done = True
                break
    except Exception as e:
        log(f"Amulet flow error: {e}")

    if not amulet_done:
        log("Amulet NOT resolved automatically, needs manual check")
        safe_cancel(page)

    page.screenshot(path=str(OUT_DIR / "_gear_fill_result.png"), full_page=True)

    try:
        page.get_by_role("button", name="Save", exact=True).click(timeout=8000)
        page.wait_for_timeout(2500)
        log("Top-level Save clicked")
    except Exception as e:
        log(f"Top-level Save failed: {e}")

    context.close()
