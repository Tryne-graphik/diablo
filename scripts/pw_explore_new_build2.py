"""
Suite de l'exploration : reouvrir le detail du Helm (Leoric's Crown deja
selectionne au run precedent, mais le profil ne persiste pas le brouillon
non sauvegarde -> on part d'un nouveau New Build et on refait tout, en gardant
la page ouverte pour explorer le 2e socket et la suite (Skills/Paragon/Talisman).
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
    page.wait_for_timeout(1000)
    page.fill('input[placeholder^="Search uniques"]', "Leoric")
    page.wait_for_timeout(800)
    page.click("text=Leoric's Crown")
    page.wait_for_timeout(1000)

    # First socket -> Damnation
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
    page.screenshot(path=str(OUT_DIR / "_before_first_save.png"), full_page=True)
    page.get_by_role("button", name="Save").click()
    page.wait_for_timeout(1000)
    page.screenshot(path=str(OUT_DIR / "_after_first_save.png"), full_page=True)

    # Reopen Leoric's Crown to add the 2nd splinter
    page.click("text=Leoric's Crown")
    page.wait_for_timeout(1000)
    page.screenshot(path=str(OUT_DIR / "_reopened_crown.png"), full_page=True)

    page.locator("text=Empty Socket").first.click()
    page.wait_for_timeout(800)
    try:
        page.get_by_role("tab", name="Soul Splinter").click()
    except Exception:
        page.get_by_text("Soul Splinter", exact=True).last.click(force=True)
    page.wait_for_timeout(500)
    page.fill('input[placeholder^="Search"]', "Pain")
    page.wait_for_timeout(800)
    page.screenshot(path=str(OUT_DIR / "_pain_search.png"), full_page=True)
    page.get_by_text("GREATER SPLINTER OF PAIN", exact=False).click()
    page.wait_for_timeout(500)
    page.get_by_role("button", name="Save").click()
    page.wait_for_timeout(1000)
    page.screenshot(path=str(OUT_DIR / "_after_second_save.png"), full_page=True)

    # Reopen once more to confirm both sockets filled
    page.click("text=Leoric's Crown")
    page.wait_for_timeout(1000)
    page.screenshot(path=str(OUT_DIR / "_crown_final_check.png"), full_page=True)

    context.close()
