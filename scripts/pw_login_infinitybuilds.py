"""
Ouvre un navigateur visible avec un profil persistant dédié à InfinityBuilds
pour que l'utilisateur se connecte manuellement une seule fois. Les cookies
de session sont sauvegardés dans le dossier de profil et réutilisés par les
futurs scripts d'automatisation (pas de compte centralisé, session perso).

Usage: .venv/Scripts/python.exe scripts/pw_login_infinitybuilds.py
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

PROFILE_DIR = Path(__file__).resolve().parent.parent / ".pw-profile-infinitybuilds"

with sync_playwright() as p:
    context = p.chromium.launch_persistent_context(
        user_data_dir=str(PROFILE_DIR),
        headless=False,
        viewport={"width": 1400, "height": 900},
    )
    page = context.pages[0] if context.pages else context.new_page()
    page.goto("https://infinitybuilds.gg/en/builds")
    print("Connecte-toi a ton compte InfinityBuilds dans la fenetre ouverte.")
    print("Ferme simplement la fenetre du navigateur une fois connecte - la session sera sauvegardee automatiquement.")
    try:
        page.wait_for_event("close", timeout=0)
    except Exception:
        pass
    try:
        context.close()
    except Exception:
        pass
    print("Session sauvegardee.")
