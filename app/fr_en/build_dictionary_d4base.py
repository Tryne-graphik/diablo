"""Fetches d4base.fr's full item database (Uniques, Mythic Uniques,
Legendary Aspects, Paragon Glyphs/Boards - 612 entries) via its public
`items.php` API and extracts FR<->EN name pairs, merged into
app/data/fr_en_dictionary.json.

2026-09-22: user-provided source. d4base.fr ("Base de Données FR/EN") is a
purpose-built bilingual database - `nom_fr`/`nom_en` (also
`description_fr`/`description_en`, `type_fr`/`type_en`) are already paired
per item server-side, same quality as kami-labs/talion, no positional DOM
matching needed. Does NOT cover active skills (only 5 `type_fr` values
exist across the whole dataset: Aspect, Glyphe, Plateau, Unique, Unique
Mythique) - useful for topping up Uniques/Aspects/Paragon coverage, not the
skills gap.

API found via Playwright network recording on a real item page/class
filter (same method used for talion.tv's hidden build-detail endpoint):
`GET https://d4base.fr/api/items.php?sort=nom_fr&dir=asc&limit=500[&offset=N]`
- server caps each response at 500 regardless of a higher `limit`, so two
requests (offset 0 and 500) cover the full 612.

Run manually:
    .venv\\Scripts\\python.exe -m app.fr_en.build_dictionary_d4base
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import httpx

API_URL = "https://d4base.fr/api/items.php"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; DiabloIVAssistant/0.1)"}
OUTPUT_PATH = Path(__file__).parent.parent / "data" / "fr_en_dictionary_d4base.json"

# d4base's type_fr -> this project's existing `kind` taxonomy (see
# app/data/fr_en_dictionary.json's other entries for the convention).
KIND_MAP = {
    "Unique": "unique_item",
    "Unique Mythique": "unique_item",
    "Aspect": "item",
    "Glyphe": "paragon_glyph",
    "Plateau": "paragon_board",
}


def fetch_all_items(client: httpx.Client) -> list[dict]:
    items: list[dict] = []
    offset = 0
    while True:
        resp = client.get(API_URL, params={"sort": "nom_fr", "dir": "asc", "limit": 500, "offset": offset}, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        batch = data.get("items", [])
        items.extend(batch)
        if len(items) >= data.get("total", len(items)) or not batch:
            break
        offset += len(batch)
    return items


def build() -> dict:
    with httpx.Client() as client:
        items = fetch_all_items(client)

    seen: set[tuple[str, str, str]] = set()
    entries = []
    for it in items:
        fr = (it.get("nom_fr") or "").strip()
        en = (it.get("nom_en") or "").strip()
        kind = KIND_MAP.get(it.get("type_fr"), "unknown")
        if not fr or not en or fr == en:
            continue
        key = (fr.lower(), en.lower(), kind)
        if key in seen:
            continue
        seen.add(key)
        entries.append({"fr": fr, "en": en, "kind": kind, "seen_in": 1, "source": "d4base.fr"})

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "items_fetched": len(items),
        "entries": entries,
    }


def main() -> None:
    data = build()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(data['entries'])} entries from {data['items_fetched']} d4base.fr items -> {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
