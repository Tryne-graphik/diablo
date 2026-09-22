"""Fetches wowhead.com's Diablo 4 skills database (both locales) and joins
them by Wowhead's internal numeric skill id to get FR<->EN name pairs -
merged into app/data/fr_en_dictionary.json.

2026-09-22: user-provided source, specifically to close the skills
translation gap (still only 57% after kami-labs + d4base.fr, neither of
which cover active skills at all). Wowhead's `/diablo-4/skills` (EN) and
`/diablo-4/fr/skills` (FR) listview pages each embed ALL 282 skills as one
JSON array directly in the page HTML (pagination shown to the user is
purely client-side - no per-page fetch needed), each entry keyed by a
stable Wowhead internal `id` (e.g. 165023 = Fireball/Boule de feu on both
locales) - join by that id instead of position or name matching. Includes
mercenary/companion abilities alongside player class skills (Wowhead
doesn't distinguish in this listview) - kept as kind "skill" like the rest,
harmless for the dictionary's substring-scan lookup either way.

Needs a real browser (Playwright) - the array is injected by a client-side
script after the initial HTML loads (confirmed: a plain httpx GET does NOT
contain it), unlike d4base.fr/kami-labs's server-rendered pages.

Run manually:
    .venv\\Scripts\\python.exe -m app.fr_en.build_dictionary_wowhead
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

OUTPUT_PATH = Path(__file__).parent.parent / "data" / "fr_en_dictionary_wowhead.json"
URLS = {
    "en": "https://www.wowhead.com/diablo-4/skills",
    "fr": "https://www.wowhead.com/diablo-4/fr/skills",
}


def _fetch_skill_names(page, url: str) -> dict[int, str]:
    page.goto(url, wait_until="networkidle", timeout=45000)
    page.wait_for_timeout(2000)
    html = page.content()
    idx = html.find('"playerClassName"')
    if idx == -1:
        return {}
    start = html.rfind("[", 0, idx)
    decoder = json.JSONDecoder()
    array, _ = decoder.raw_decode(html, start)
    return {s["id"]: s["name"] for s in array if s.get("id") is not None and s.get("name")}


def build() -> dict:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            page = browser.new_page()
            by_locale = {locale: _fetch_skill_names(page, url) for locale, url in URLS.items()}
        finally:
            browser.close()

    en_by_id, fr_by_id = by_locale["en"], by_locale["fr"]
    common_ids = set(en_by_id) & set(fr_by_id)

    seen: set[tuple[str, str]] = set()
    entries = []
    for skill_id in common_ids:
        en, fr = en_by_id[skill_id].strip(), fr_by_id[skill_id].strip()
        if not en or not fr or en == fr:
            continue
        key = (fr.lower(), en.lower())
        if key in seen:
            continue
        seen.add(key)
        entries.append({"fr": fr, "en": en, "kind": "skill", "seen_in": 1, "source": "wowhead.com"})

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "skills_fetched": {locale: len(d) for locale, d in by_locale.items()},
        "entries": entries,
    }


def main() -> None:
    data = build()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(data['entries'])} entries from {data['skills_fetched']} -> {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
