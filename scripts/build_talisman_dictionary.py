"""Adds Talisman (Horadric Seal + Charm) EN<->FR name pairs to
app/data/fr_en_dictionary.json, same Maxroll game-data source and method as
build_unique_mythic_dictionary.py - see that file's docstring for why this
source is trusted (stable per-locale item id, Blizzard's own localization
text). Added 2026-09-21 after finding "Legendary Horadric Seal" and the
season 15 Rogue set charms ("... of Spellbound Steel") untranslated on a
real build - the earlier pass only covered `_Unique_` gear, not Talismans.

Key patterns: `Talisman_Seal_<rarity>` (the seal itself, e.g.
"Legendary Horadric Seal") and `Talisman_Charm_Set_<class-or-Small>_<set
number>_<charm number>` (the 5 charms of each class's seasonal charm set,
plus a few pre-Torment "Small" ones shared by every class).

Run with: .venv\\Scripts\\python.exe scripts\\build_talisman_dictionary.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import httpx

DICTIONARY_PATH = Path(__file__).parent.parent / "app" / "data" / "fr_en_dictionary.json"
DATA_URL = "https://assets-ng.maxroll.gg/d4-tools/game/data.{locale}.json"

TALISMAN_KEY_RE = re.compile(r"^Talisman_(Seal_[A-Za-z]+|Charm_Set_[A-Za-z0-9_]+)$")
GENDER_TAG_RE = re.compile(r"^\[(?:mp|fp|ms|fs|m|f)\]\s*")


def clean_fr_name(raw: str) -> str:
    return GENDER_TAG_RE.sub("", raw).strip().replace("’", "'")


def fetch_items(locale: str) -> dict:
    resp = httpx.get(DATA_URL.format(locale=locale), timeout=30)
    resp.raise_for_status()
    return resp.json()["items"]


def main() -> None:
    print("Fetching Maxroll game data (EN + FR)...")
    items_en = fetch_items("enus")
    items_fr = fetch_items("frfr")

    keys = [k for k in items_en if TALISMAN_KEY_RE.match(k)]
    print(f"{len(keys)} Talisman keys found")

    pairs: dict[str, str] = {}
    for key in keys:
        en_name = items_en[key].get("name", "").strip()
        fr_name = clean_fr_name(items_fr.get(key, {}).get("name", ""))
        if en_name and fr_name and en_name.lower() != fr_name.lower():
            pairs[en_name] = fr_name
    print(f"{len(pairs)} usable EN/FR pairs")

    existing = json.loads(DICTIONARY_PATH.read_text(encoding="utf-8"))
    entries = existing["entries"]
    by_en_lower: dict[str, dict] = {e["en"].lower(): e for e in entries}

    added = 0
    updated: list[tuple[str, str, str]] = []
    for en_name, fr_name in sorted(pairs.items()):
        existing_entry = by_en_lower.get(en_name.lower())
        if existing_entry is None:
            entry = {"fr": fr_name, "en": en_name, "kind": "talisman", "seen_in": 1, "source": "maxroll_gamedata"}
            entries.append(entry)
            by_en_lower[en_name.lower()] = entry
            added += 1
        elif existing_entry["fr"] != fr_name:
            updated.append((en_name, existing_entry["fr"], fr_name))
            existing_entry["fr"] = fr_name
            existing_entry["kind"] = "talisman"
            existing_entry["source"] = "maxroll_gamedata"

    existing["entries"] = entries
    DICTIONARY_PATH.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Added {added} new entries, corrected {len(updated)}, dictionary now has {len(entries)} total")

    if updated:
        print("\nCorrected (previous FR name -> canonical FR name):")
        for en_name, old_fr, new_fr in updated:
            print(f"  {en_name!r}: {old_fr!r} -> {new_fr!r}")


if __name__ == "__main__":
    main()
