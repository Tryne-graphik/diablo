"""Reads every cached kami-labs build page (app/data/kamilabs_cache/, filled
by scripts/crawl_kamilabs_icons.py) and extracts every (English icon
filename, French alt text) pair it can find - covers items, skills AND
Paragon glyphs/boards across all 8 classes at once, since kami-labs writes
the same <img alt="..." src=".../d4-icons/Name.webp"> pattern everywhere.

Merges new pairs into app/data/fr_en_dictionary.json (deduped against
what's already there) and prints out anything that looks like a Paragon
glyph/board name specifically, since those need to be hand-copied into
userscript/diablo4-assistant.user.js's PARAGON_DICTIONARY (kept separate
there on purpose - see that file's comment - so this script never writes
to the userscript directly).

Run with: .venv\\Scripts\\python.exe scripts\\extract_kamilabs_icons.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from bs4 import BeautifulSoup

CACHE_DIR = Path(__file__).parent.parent / "app" / "data" / "kamilabs_cache"
DICTIONARY_PATH = Path(__file__).parent.parent / "app" / "data" / "fr_en_dictionary.json"

# Known Paragon glyph/board names (as of Season 15) - anything we harvest
# matching one of these is flagged separately in the report below, since
# PARAGON_DICTIONARY in the userscript is a small, hand-maintained table
# (kept out of the bulk FR_EN_DICTIONARY on purpose - short common English
# words like "Control"/"Combat" are too risky to substring-replace
# page-wide). This list is just for the report; it doesn't limit what
# else gets merged into fr_en_dictionary.json.
KNOWN_GLYPH_NAMES = {
    "versatility", "control", "canny", "devious", "bane", "combat", "efficacy",
    "tracker", "exploitation", "vulnerability", "elements", "ambush",
    "provocation", "domination", "adaptability", "control", "swiftness",
}


def filename_to_en(fname: str) -> str:
    name = fname.rsplit(".", 1)[0]
    name = re.sub(r"_s_", "'s ", name)
    name = name.replace("_", " ")
    words = []
    for w in name.split(" "):
        if w and w[0].islower():
            w = w[0].upper() + w[1:]
        words.append(w)
    return " ".join(words).strip()


def main() -> None:
    cached_files = sorted(CACHE_DIR.glob("*.html"))
    print(f"{len(cached_files)} cached pages to scan")

    pairs: dict[str, str] = {}
    for path in cached_files:
        soup = BeautifulSoup(path.read_text(encoding="utf-8"), "html.parser")
        for img in soup.find_all("img"):
            src = img.get("src") or ""
            alt = (img.get("alt") or "").strip()
            if "d4-icons" not in src or not alt:
                continue
            fname = src.rsplit("/", 1)[-1]
            en = filename_to_en(fname)
            if en and en.lower() != alt.lower():
                pairs.setdefault(en, alt)

    print(f"{len(pairs)} unique EN/FR pairs extracted")

    existing = json.loads(DICTIONARY_PATH.read_text(encoding="utf-8"))
    entries = existing["entries"]
    existing_en = {e["en"].lower() for e in entries}

    added = 0
    glyph_like: list[tuple[str, str]] = []
    for en, fr in sorted(pairs.items()):
        if en.strip().isdigit():
            continue  # junk asset-id filenames, not real names
        if en.lower() in existing_en:
            continue
        entries.append({"fr": fr, "en": en, "kind": "unknown", "seen_in": 1, "source": "kamilabs"})
        added += 1
        if en.lower() in KNOWN_GLYPH_NAMES:
            glyph_like.append((en, fr))

    existing["entries"] = entries
    DICTIONARY_PATH.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Merged {added} new entries, dictionary now has {len(entries)} total")

    if glyph_like:
        print("\nParagon-glyph-like names found (copy into PARAGON_DICTIONARY by hand if new):")
        for en, fr in glyph_like:
            print(f"  {en!r} -> {fr!r}")


if __name__ == "__main__":
    main()
