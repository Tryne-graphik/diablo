"""Adds every Unique and Mythic Unique gear item's EN<->FR name pair to
app/data/fr_en_dictionary.json, sourced from Maxroll's own game-data dump
(https://assets-ng.maxroll.gg/d4-tools/game/data.<locale>.json) rather than
from builds we happen to have scraped - this is Blizzard's own localization
text, keyed by a stable internal item id shared across locales, so it's a
complete list (every Unique/Mythic that exists, not just ones seen in a
build guide so far) and doesn't depend on positional pairing like the
build-scraping extractors do.

Item keys look like "<Slot>_Unique_<Class|Generic>_<number>"
(e.g. "Chest_Unique_Generic_127" -> Tyrael's Might). Mythic Uniques use the
exact same naming scheme in this dataset (Maxroll's dump has no separate
rarity flag) - filtering on "_Unique_" already covers both, no separate
Mythic pass needed. French names carry a leading grammatical-gender tag
Blizzard's localization team adds for article agreement ("[mp]Poings du
destin" = masculin pluriel) - stripped before use.

Run with: .venv\\Scripts\\python.exe scripts\\build_unique_mythic_dictionary.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import httpx

DICTIONARY_PATH = Path(__file__).parent.parent / "app" / "data" / "fr_en_dictionary.json"

DATA_URL = "https://assets-ng.maxroll.gg/d4-tools/game/data.{locale}.json"

# Matches base item template keys only - excludes season-prefixed variants
# ("S14_Ring_Unique_Generic_104") and Talisman-charm duplicates
# ("Talisman_Charm_Unique_..."), which point at the same item under a
# different key and would otherwise produce redundant/duplicate pairs.
UNIQUE_KEY_RE = re.compile(r"^[A-Za-z0-9]+_Unique_[A-Za-z]+_\d+$")

GENDER_TAG_RE = re.compile(r"^\[(?:mp|fp|ms|fs|m|f)\]\s*")


def clean_fr_name(raw: str) -> str:
    name = GENDER_TAG_RE.sub("", raw).strip()
    return name.replace("’", "'")  # curly apostrophe -> straight, matches rest of dictionary


def fetch_items(locale: str) -> dict:
    resp = httpx.get(DATA_URL.format(locale=locale), timeout=30)
    resp.raise_for_status()
    return resp.json()["items"]


def main() -> None:
    print("Fetching Maxroll game data (EN + FR)...")
    items_en = fetch_items("enus")
    items_fr = fetch_items("frfr")

    keys = [k for k in items_en if UNIQUE_KEY_RE.match(k)]
    print(f"{len(keys)} unique/mythic item keys found")

    pairs: dict[str, str] = {}
    for key in keys:
        en_name = items_en[key].get("name", "").strip()
        fr_name = clean_fr_name(items_fr.get(key, {}).get("name", ""))
        if en_name and fr_name and en_name.lower() != fr_name.lower():
            pairs[en_name] = fr_name
    print(f"{len(pairs)} usable EN/FR pairs (excludes items with no FR translation on file)")

    existing = json.loads(DICTIONARY_PATH.read_text(encoding="utf-8"))
    entries = existing["entries"]
    by_en_lower: dict[str, dict] = {e["en"].lower(): e for e in entries}

    added = 0
    updated: list[tuple[str, str, str]] = []
    for en_name, fr_name in sorted(pairs.items()):
        existing_entry = by_en_lower.get(en_name.lower())
        if existing_entry is None:
            entry = {"fr": fr_name, "en": en_name, "kind": "unique_item", "seen_in": 1, "source": "maxroll_gamedata"}
            entries.append(entry)
            by_en_lower[en_name.lower()] = entry
            added += 1
        elif existing_entry["fr"] != fr_name:
            # Maxroll's game-data dump is Blizzard's own localization text
            # (keyed by internal item id), more authoritative than a name
            # picked up incidentally from a community build guide - treat
            # it as canonical and correct the existing entry.
            updated.append((en_name, existing_entry["fr"], fr_name))
            existing_entry["fr"] = fr_name
            existing_entry["kind"] = "unique_item"
            existing_entry["source"] = "maxroll_gamedata"

    existing["entries"] = entries
    DICTIONARY_PATH.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Added {added} new entries, corrected {len(updated)} existing ones, dictionary now has {len(entries)} total")

    if updated:
        print("\nCorrected (previous FR name -> canonical FR name):")
        for en_name, old_fr, new_fr in updated:
            print(f"  {en_name!r}: {old_fr!r} -> {new_fr!r}")


if __name__ == "__main__":
    main()
