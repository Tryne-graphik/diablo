"""Enregistre UNE page publique par scraper dans tests/fixtures/<site>/ (+ .meta.json).

Reseau : a lancer a la main, jamais par les tests. GET simples, 3 s entre appels,
aucun compte. Usage : python -m scripts.enregistrer_fixtures [site ...]
"""
import json
import sys
import time
from datetime import datetime
from pathlib import Path

import httpx

from app.config import CURRENT_SEASON
from app.scrapers import d4guides, kamilabs, maxroll, talion, d4builds, infinitybuilds

OUT = Path(__file__).resolve().parent.parent / "tests" / "fixtures"
SITES = {  # site -> (url, params, fichier, entetes)
    "maxroll": (maxroll.TIER_LIST_URL, None, "page.html", maxroll.HEADERS),
    "d4builds": (d4builds.HOMEPAGE_URL, None, "page.html", d4builds.HEADERS),
    "d4guides": (d4guides.API_URL, {"limit": 200, "offset": 0, "sort": "tier", "season": CURRENT_SEASON},
                 "api.json", d4guides.HEADERS),
    "kamilabs": (kamilabs.AJAX_URL, None, "api.json", kamilabs.HEADERS),
    "talion": (talion.API_URL, None, "api.json", talion.HEADERS),
}


def _meta(site, url, status, note=""):
    return {"site": site, "url": url, "date": datetime.now().isoformat(timespec="seconds"),
            "status": status, "note": note}


def _write(site, name, data, meta):
    d = OUT / site
    d.mkdir(parents=True, exist_ok=True)
    (d / name).write_bytes(data)
    (d / ".meta.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False), encoding="utf-8")


def record_infinitybuilds():
    # Page rendue cote client : on fige la liste brute extraite du DOM (meme JS que le scraper).
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch()  # headless, sans fenetre
        try:
            page = b.new_page()
            page.goto(infinitybuilds.TIER_LIST_URL, wait_until="load", timeout=45000)
            page.wait_for_selector("a[href*='/builds/']", timeout=15000)
            page.wait_for_timeout(1500)
            raw = page.eval_on_selector_all("a[href*='/builds/']:not([href='/en/builds/new'])",
                                            infinitybuilds._EXTRACT_JS)
        finally:
            b.close()
    _write("infinitybuilds", "dom_extract.json", json.dumps(raw, indent=1, ensure_ascii=False).encode(),
           _meta("infinitybuilds", infinitybuilds.TIER_LIST_URL, 200,
                 "sortie de eval_on_selector_all (page rendue par JS), pas du HTML brut"))


def main(only):
    for site, (url, params, name, headers) in SITES.items():
        if only and site not in only:
            continue
        try:
            r = httpx.get(url, params=params, headers=headers, timeout=30, follow_redirects=True)
            meta = _meta(site, str(r.url), r.status_code)
            if r.status_code == 200:
                _write(site, name, r.content, meta)
            else:
                _write(site, "BLOQUE.txt", b"", meta)
        except Exception as e:  # consigne, ne contourne rien
            _write(site, "BLOQUE.txt", b"", _meta(site, url, None, repr(e)))
        print(site, meta if "meta" in dir() else "")
        time.sleep(3)
    if not only or "infinitybuilds" in only:
        try:
            record_infinitybuilds()
        except Exception as e:
            _write("infinitybuilds", "BLOQUE.txt", b"", _meta("infinitybuilds", infinitybuilds.TIER_LIST_URL, None, repr(e)))
            print("infinitybuilds BLOQUE", e)


if __name__ == "__main__":
    main(set(sys.argv[1:]))
