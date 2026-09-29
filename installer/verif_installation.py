"""
Diablo IV Assistant - Verification d'installation.

Outil pour les testeurs (non techniques) : verifie si Tampermonkey est
installe dans leurs navigateurs, et propose des boutons pour installer
Tampermonkey et/ou le script si besoin.

Ce que cet outil NE fait PAS (par choix, pour rester honnete) :
- il ne sait pas dire si LE SCRIPT Diablo IV Assistant est deja installe
  ou a jour (ca vit dans le stockage interne de l'extension, pas lisible
  de facon fiable depuis l'exterieur) - c'est Tampermonkey lui-meme qui
  affiche cette info quand on ouvre le lien d'installation du script,
  donc on le laisse faire ce travail.
"""

import configparser
import json
import os
import re
import tkinter as tk
import webbrowser
from tkinter import ttk

USERSCRIPT_URL = (
    "https://raw.githubusercontent.com/Tryne-graphik/diablo/master/"
    "userscript/diablo4-assistant.user.js"
)
CHROME_WEBSTORE_URL = (
    "https://chromewebstore.google.com/detail/tampermonkey/"
    "dhdgffkkebhmkfjojejmpbldmpobfkfo"
)
FIREFOX_ADDON_URL = "https://addons.mozilla.org/fr/firefox/addon/tampermonkey/"
# Opera a sa propre fiche sur son propre store (pas le Chrome Web Store) -
# meme si Opera est base sur Chromium, installer Tampermonkey depuis le
# Chrome Web Store y est plus fragile/demande une extension tierce. Verifie
# le 2026-09-26 : Tampermonkey y a un ID d'extension different de Chrome.
OPERA_ADDONS_URL = "https://addons.opera.com/en/extensions/details/tampermonkey-beta/"

# Chaque navigateur Chromium range son "User Data" a un endroit different,
# et Opera utilise %APPDATA% (Roaming) alors que Chrome/Edge/Brave utilisent
# %LOCALAPPDATA%.
CHROMIUM_BROWSERS = [
    {"name": "Google Chrome", "base_env": "LOCALAPPDATA", "rel_path": r"Google\Chrome\User Data", "install_url": CHROME_WEBSTORE_URL},
    {"name": "Microsoft Edge", "base_env": "LOCALAPPDATA", "rel_path": r"Microsoft\Edge\User Data", "install_url": CHROME_WEBSTORE_URL},
    {"name": "Brave", "base_env": "LOCALAPPDATA", "rel_path": r"BraveSoftware\Brave-Browser\User Data", "install_url": CHROME_WEBSTORE_URL},
    {"name": "Opera", "base_env": "APPDATA", "rel_path": r"Opera Software\Opera Stable", "install_url": OPERA_ADDONS_URL},
    {"name": "Opera GX", "base_env": "APPDATA", "rel_path": r"Opera Software\Opera GX Stable", "install_url": OPERA_ADDONS_URL},
]


def read_json_safe(path):
    try:
        with open(path, "r", encoding="utf-8-sig") as f:
            return json.load(f)
    except Exception:
        return None


def version_key(v):
    parts = re.split(r"[._]", v)
    key = []
    for p in parts:
        key.append(int(p)) if p.isdigit() else key.append(0)
    return key


def resolve_manifest_name(manifest, version_dir):
    name = manifest.get("name", "")
    if name.startswith("__MSG_") and name.endswith("__"):
        key = name[6:-2]
        default_locale = manifest.get("default_locale")
        if default_locale:
            messages = read_json_safe(
                os.path.join(version_dir, "_locales", default_locale, "messages.json")
            )
            if messages and key in messages:
                return messages[key].get("message", name)
    return name


def scan_chromium_extensions(profile_path):
    """Yields (name, version) for every extension found in one browser profile."""
    ext_root = os.path.join(profile_path, "Extensions")
    if not os.path.isdir(ext_root):
        return
    for ext_id in os.listdir(ext_root):
        ext_id_path = os.path.join(ext_root, ext_id)
        if not os.path.isdir(ext_id_path):
            continue
        versions = sorted(
            (v for v in os.listdir(ext_id_path) if os.path.isdir(os.path.join(ext_id_path, v))),
            key=version_key,
            reverse=True,
        )
        for version in versions:
            version_dir = os.path.join(ext_id_path, version)
            manifest = read_json_safe(os.path.join(version_dir, "manifest.json"))
            if manifest:
                yield resolve_manifest_name(manifest, version_dir), manifest.get("version", "?")
                break


def find_tampermonkey_in_chromium(base_path):
    """Scans every profile under one Chromium browser's User Data folder."""
    if not os.path.isdir(base_path):
        return None  # browser not installed on this machine
    found_version = False
    for entry in os.listdir(base_path):
        if entry != "Default" and not entry.startswith("Profile"):
            continue
        profile_path = os.path.join(base_path, entry)
        if not os.path.isdir(profile_path):
            continue
        for name, version in scan_chromium_extensions(profile_path):
            if "tampermonkey" in name.lower():
                found_version = version
    return found_version


def find_tampermonkey_in_firefox():
    appdata = os.environ.get("APPDATA", "")
    firefox_root = os.path.join(appdata, "Mozilla", "Firefox")
    profiles_ini = os.path.join(firefox_root, "profiles.ini")
    if not os.path.isfile(profiles_ini):
        return None  # Firefox not installed (or not in the default location)

    cfg = configparser.ConfigParser()
    try:
        cfg.read(profiles_ini, encoding="utf-8")
    except Exception:
        return False

    found_version = False
    for section in cfg.sections():
        if not cfg.has_option(section, "Path"):
            continue
        is_relative = cfg.getboolean(section, "IsRelative", fallback=True)
        path = cfg.get(section, "Path")
        profile_path = os.path.join(firefox_root, path) if is_relative else path
        data = read_json_safe(os.path.join(profile_path, "extensions.json"))
        if not data:
            continue
        for addon in data.get("addons", []):
            addon_id = (addon.get("id") or "").lower()
            addon_name = ((addon.get("defaultLocale") or {}).get("name") or "").lower()
            if "tampermonkey" in addon_id or "tampermonkey" in addon_name:
                found_version = addon.get("version", "?")
    return found_version


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Diablo IV Assistant - Verification de l'installation")
        self.geometry("580x480")
        self.resizable(False, True)

        header = ttk.Label(
            self,
            text="Diablo IV Assistant",
            font=("Segoe UI", 14, "bold"),
        )
        header.pack(pady=(16, 0))
        sub = ttk.Label(self, text="Verification de l'installation de Tampermonkey")
        sub.pack(pady=(0, 12))

        self.results_frame = ttk.Frame(self)
        self.results_frame.pack(fill="both", expand=True, padx=20)

        button_bar = ttk.Frame(self)
        button_bar.pack(pady=(4, 8))
        ttk.Button(button_bar, text="Rafraichir", command=self.refresh).pack(side="left", padx=4)
        ttk.Button(
            button_bar,
            text="Installer / mettre a jour le script",
            command=lambda: webbrowser.open(USERSCRIPT_URL),
        ).pack(side="left", padx=4)

        note = ttk.Label(
            self,
            text=(
                "Le bouton ci-dessus ouvre la page d'installation du script.\n"
                "Si Tampermonkey est installe, il te dira lui-meme si le script\n"
                "est deja installe, deja a jour, ou a installer."
            ),
            justify="center",
            foreground="#555555",
        )
        note.pack(pady=(0, 12))

        self.refresh()

    def refresh(self):
        for widget in self.results_frame.winfo_children():
            widget.destroy()

        any_found = False
        any_browser_installed = False
        # url -> liste de navigateurs installes sans Tampermonkey (pour ne
        # montrer qu'un seul bouton par lien d'installation, meme si
        # plusieurs navigateurs partagent le meme, ex. Chrome+Edge+Brave)
        missing_by_url = {}

        for browser in CHROMIUM_BROWSERS:
            base = os.path.join(os.environ.get(browser["base_env"], ""), browser["rel_path"])
            result = find_tampermonkey_in_chromium(base)
            if result is None:
                continue  # navigateur non installe, on ne l'affiche pas
            any_browser_installed = True
            self._add_row(browser["name"], result)
            if result:
                any_found = True
            else:
                missing_by_url.setdefault(browser["install_url"], []).append(browser["name"])

        firefox_result = find_tampermonkey_in_firefox()
        if firefox_result is not None:
            any_browser_installed = True
            self._add_row("Firefox", firefox_result)
            if firefox_result:
                any_found = True
            else:
                missing_by_url.setdefault(FIREFOX_ADDON_URL, []).append("Firefox")

        if not any_browser_installed:
            ttk.Label(
                self.results_frame,
                text="Aucun navigateur courant (Chrome / Edge / Brave / Opera / Firefox) detecte.",
                foreground="#b00000",
            ).pack(anchor="w", pady=4)

        if not any_found and missing_by_url:
            warn = ttk.Label(
                self.results_frame,
                text="Tampermonkey n'est detecte dans aucun navigateur.",
                foreground="#b00000",
                font=("Segoe UI", 10, "bold"),
            )
            warn.pack(anchor="w", pady=(12, 4))

            for url, browser_names in missing_by_url.items():
                ttk.Button(
                    self.results_frame,
                    text=f"Installer Tampermonkey ({' / '.join(browser_names)})",
                    command=lambda u=url: webbrowser.open(u),
                ).pack(anchor="w", pady=2)

    def _add_row(self, browser_name, result):
        row = ttk.Frame(self.results_frame)
        row.pack(fill="x", pady=3)
        if result:
            text = f"[OK] {browser_name} : Tampermonkey installe (v{result})"
            color = "#1a7a1a"
        else:
            text = f"[X] {browser_name} : Tampermonkey non detecte"
            color = "#b00000"
        ttk.Label(row, text=text, foreground=color).pack(anchor="w")


if __name__ == "__main__":
    App().mainloop()
