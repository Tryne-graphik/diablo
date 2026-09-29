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

def add_splinter(page, slot_text, splinter_search, tier_label):
    try:
        page.click(f"text={slot_text}", timeout=10000)
        page.wait_for_timeout(1000)
        page.locator("text=Empty Socket").first.click(timeout=6000)
        page.wait_for_timeout(800)
        try:
            page.get_by_role("tab", name="Soul Splinter").click(timeout=4000)
        except Exception:
            page.get_by_text("Soul Splinter", exact=True).last.click(force=True, timeout=4000)
        page.wait_for_timeout(600)
        page.fill('input[placeholder^="Search"]', splinter_search, timeout=8000)
        page.wait_for_timeout(900)
        page.get_by_text(tier_label, exact=False).first.click(timeout=6000)
        page.wait_for_timeout(600)
        page.get_by_role("button", name="Save").click(timeout=6000)
        page.wait_for_timeout(1200)
        log(f"OK splinter {slot_text} = {tier_label} {splinter_search}")
        return True
    except Exception as e:
        log(f"FAIL splinter {slot_text}={splinter_search}: {e}")
        safe_cancel(page)
        return False

with sync_playwright() as p:
    context = p.chromium.launch_persistent_context(
        user_data_dir=str(PROFILE_DIR), headless=True, viewport={"width": 1400, "height": 1000},
    )
    page = context.pages[0] if context.pages else context.new_page()
    page.goto(EDIT_URL, wait_until="domcontentloaded")
    page.wait_for_timeout(3500)

    try:
        page.get_by_role("button", name="Discard draft").click(timeout=3000)
        page.wait_for_timeout(1000)
        log("Discarded stale draft banner")
    except Exception:
        pass

    # Specialization: click the SKILLS tab, scroll to specialization section, click Preparation
    try:
        page.get_by_role("tab", name="Skills").click(timeout=8000)
        page.wait_for_timeout(1500)
        spec_el = page.get_by_text("PREPARATION", exact=False).first
        spec_el.scroll_into_view_if_needed(timeout=6000)
        page.wait_for_timeout(500)
        spec_el.click(timeout=6000)
        page.wait_for_timeout(800)
        log("OK specialization = Preparation")
    except Exception as e:
        log(f"FAIL specialization: {e}")
        page.screenshot(path=str(OUT_DIR / "_spec_fail_debug.png"), full_page=True)

    # switch back to GEAR tab before touching jewelry slots
    try:
        page.get_by_role("tab", name="Gear").click(timeout=8000)
        page.wait_for_timeout(1200)
    except Exception as e:
        log(f"FAIL switching to Gear tab: {e}")

    # Soul Splinters on Ring1/Ring2/Amulet
    add_splinter(page, "Ring 1", "Pain", "GREATER SPLINTER OF PAIN")
    add_splinter(page, "Ring 2", "Black Soulstone", "GREATER SPLINTER OF THE BLACK SOULSTONE")
    add_splinter(page, "Amulet", "Hellfire", "GREATER SPLINTER OF HELLFIRE")

    page.screenshot(path=str(OUT_DIR / "_finish_extras_result.png"), full_page=True)

    try:
        page.get_by_role("button", name="Save", exact=True).click(timeout=8000)
        page.wait_for_timeout(2500)
        log("Top-level Save clicked")
    except Exception as e:
        log(f"Top-level Save failed: {e}")

    context.close()
