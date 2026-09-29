"""
Verifie (sans fenetre visible) que le profil persistant .pw-profile-infinitybuilds
contient bien une session connectee a InfinityBuilds.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

PROFILE_DIR = Path(__file__).resolve().parent.parent / ".pw-profile-infinitybuilds"

with sync_playwright() as p:
    context = p.chromium.launch_persistent_context(
        user_data_dir=str(PROFILE_DIR),
        headless=True,
        viewport={"width": 1400, "height": 900},
    )
    page = context.pages[0] if context.pages else context.new_page()
    page.goto("https://infinitybuilds.gg/en/builds", wait_until="domcontentloaded")
    page.wait_for_timeout(4000)

    cookies = context.cookies("https://infinitybuilds.gg")
    cookie_names = [c["name"] for c in cookies]
    print("Cookies presents:", cookie_names)

    # Cherche des signes visuels de connexion : avatar/menu utilisateur vs bouton "Login"/"Sign in"
    body_text = page.inner_text("body")
    has_login_button = ("Sign in" in body_text) or ("Log in" in body_text) or ("Connexion" in body_text)
    print("Texte contient un bouton de connexion visible ?", has_login_button)

    page.screenshot(path=str(Path(__file__).resolve().parent.parent / "scripts" / "_login_check.png"), full_page=False)
    print("Screenshot: scripts/_login_check.png")

    context.close()
