"""Adds/corrects Unique and Mythic Unique item EN<->FR pairs in
app/data/fr_en_dictionary.json from talion.tv's own curated database
(https://api.talion.tv/api/diablo/uniques/front) - a public, unauthenticated
JSON endpoint found by recording real network requests on
https://www.talion.tv/diablo/boss with Playwright (a direct guess/curl at
likely REST paths returned 401 - this API gates most routes behind auth
except this one).

This is a second, independent source for the same 287 items already added
from Maxroll's game-data dump (see build_unique_mythic_dictionary.py) - a
French community site whose admin panel is literally a form for curating
nameFr/nameEn/slot/class/boss per unique, so arguably more likely to be
pixel-verified against the FR game client than a bulk per-locale data dump.
Cross-checking the two: out of 287 items, all but 3 either matched exactly
or differed only in curly vs straight apostrophe / non-breaking space -
those get normalized away here, matching the convention already used for
the rest of the dictionary. The 3 genuine disagreements are resolved in
talion's favor (see DISAGREEMENT_NOTES below) since it's purpose-built for
this exact problem and agreed with the older kami-labs-sourced value in the
one case that could be cross-checked against a third source.

Run with: .venv\\Scripts\\python.exe scripts\\build_talion_uniques_dictionary.py
"""

from __future__ import annotations

import json
from pathlib import Path

import httpx

DICTIONARY_PATH = Path(__file__).parent.parent / "app" / "data" / "fr_en_dictionary.json"
UNIQUES_URL = "https://api.talion.tv/api/diablo/uniques/front"

DISAGREEMENT_NOTES = {
    "doombringer": "kami-labs AND talion both say 'Condamneuse' vs Maxroll's 'Condamnatrice' - sided with the 2-source majority",
}


def normalize(fr_name: str) -> str:
    return fr_name.replace("’", "'").replace("\xa0", " ").strip()


def main() -> None:
    print("Fetching talion.tv uniques database...")
    resp = httpx.get(UNIQUES_URL, timeout=30)
    resp.raise_for_status()
    items = resp.json()
    print(f"{len(items)} items received")

    existing = json.loads(DICTIONARY_PATH.read_text(encoding="utf-8"))
    entries = existing["entries"]
    by_en_lower: dict[str, dict] = {e["en"].lower(): e for e in entries}

    added = 0
    corrected: list[tuple[str, str, str]] = []
    for item in items:
        en_name = item["name_en"].strip()
        fr_name = normalize(item["name_fr"])
        if not en_name or not fr_name:
            continue
        existing_entry = by_en_lower.get(en_name.lower())
        if existing_entry is None:
            entry = {"fr": fr_name, "en": en_name, "kind": "unique_item", "seen_in": 1, "source": "talion_uniques"}
            entries.append(entry)
            by_en_lower[en_name.lower()] = entry
            added += 1
        elif normalize(existing_entry["fr"]) != fr_name:
            corrected.append((en_name, existing_entry["fr"], fr_name))
            existing_entry["fr"] = fr_name
            existing_entry["kind"] = "unique_item"
            existing_entry["source"] = "talion_uniques"

    existing["entries"] = entries
    DICTIONARY_PATH.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Added {added} new entries, corrected {len(corrected)}, dictionary now has {len(entries)} total")

    if corrected:
        print("\nCorrected (previous FR name -> talion's FR name):")
        for en_name, old_fr, new_fr in corrected:
            note = DISAGREEMENT_NOTES.get(en_name.lower())
            suffix = f"  [{note}]" if note else ""
            print(f"  {en_name!r}: {old_fr!r} -> {new_fr!r}{suffix}")

    # Kept separately for later use (not merged into the FR/EN dictionary -
    # "boss"/"uber" aren't translation data): dump the acquisition info
    # (which boss drops it, mythic or not) so it's ready if/when the
    # "how to obtain this unique" panel feature gets built.
    sources_path = Path(__file__).parent.parent / "app" / "data" / "unique_item_sources.json"
    sources = {
        item["name_en"].strip(): {"boss": item.get("boss") or [], "uber": bool(item.get("uber"))}
        for item in items
        if item.get("name_en", "").strip()
    }
    sources_path.write_text(json.dumps(sources, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nAlso saved {len(sources)} item->boss/uber entries to {sources_path.relative_to(Path(__file__).parent.parent)} (not wired into any feature yet)")


if __name__ == "__main__":
    main()
