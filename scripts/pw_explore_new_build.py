"""
Exploration (lecture seule) du flux de creation de build sur InfinityBuilds,
pour comprendre la structure avant d'automatiser le remplissage.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

PROFILE_DIR = Path(__file__).resolve().parent.parent / ".pw-profile-infinitybuilds"
OUT_DIR = Path(__file__).resolve().parent

with sync_playwright() as p:
    context = p.chromium.launch_persistent_context(
        user_data_dir=str(PROFILE_DIR),
        headless=True,
        viewport={"width": 1400, "height": 900},
    )
    page = context.pages[0] if context.pages else context.new_page()
    page.goto("https://infinitybuilds.gg/en/builds/new", wait_until="domcontentloaded")
    page.wait_for_timeout(2000)

    page.click("text=Barbarian")
    page.wait_for_timeout(500)
    page.click("text=Rogue")
    page.wait_for_timeout(1500)

    page.click("text=Helm")
    page.wait_for_timeout(1500)
    page.screenshot(path=str(OUT_DIR / "_debug_modal.png"), full_page=True)
    inputs = page.locator("input").all()
    for i, inp in enumerate(inputs):
        try:
            print(i, "placeholder=", inp.get_attribute("placeholder"))
        except Exception as e:
            print(i, "err", e)

    page.fill('input[placeholder^="Search uniques"]', "Leoric")
    page.wait_for_timeout(1000)
    page.screenshot(path=str(OUT_DIR / "_helm_search_leoric.png"), full_page=True)

    # Click the first result card
    page.click("text=Leoric's Crown")
    page.wait_for_timeout(1500)
    page.screenshot(path=str(OUT_DIR / "_helm_leoric_selected.png"), full_page=True)

    # Click the first Empty Socket to pick a Soul Splinter
    page.locator("text=Empty Socket").first.click()
    page.wait_for_timeout(1500)

    try:
        page.get_by_role("tab", name="Soul Splinter").click()
    except Exception as e:
        print("role=tab failed:", e)
        page.get_by_text("Soul Splinter", exact=True).last.click(force=True)
    page.wait_for_timeout(800)
    page.fill('input[placeholder^="Search"]', "Damnation")
    page.wait_for_timeout(1000)
    page.get_by_text("GREATER SPLINTER OF DAMNATION", exact=False).click()
    page.wait_for_timeout(500)
    page.get_by_role("button", name="Save").click()
    page.wait_for_timeout(1000)
    page.screenshot(path=str(OUT_DIR / "_after_damnation_saved.png"), full_page=True)

    # Second empty socket -> Pain
    page.locator("text=Empty Socket").first.click()
    page.wait_for_timeout(1000)
    try:
        page.get_by_role("tab", name="Soul Splinter").click()
    except Exception:
        page.get_by_text("Soul Splinter", exact=True).last.click(force=True)
    page.wait_for_timeout(500)
    page.fill('input[placeholder^="Search"]', "Pain")
    page.wait_for_timeout(1000)
    page.screenshot(path=str(OUT_DIR / "_splinter_search_pain.png"), full_page=True)

    context.close()
