"""Fetches Maxroll's own EN/FR game-data dumps and extracts FR<->EN name
pairs, merged into app/data/fr_en_dictionary.json.

2026-09-26: found while investigating the Maxroll planner API for a
separate (userscript-side) DOM-scraping fix. `assets-ng.maxroll.gg/d4-tools/
game/data.<locale>.json` is public, unauthenticated, maintained by Maxroll,
and already partially used by the userscript's manual "Recherche" button
(`fetchMaxrollGameItems()`) - just never fed into the main dictionary.
Confirmed: its internal ids are the SAME id space as the in-game loot
filter protobuf format (e.g. `affixes["S04_CoreStat_Dexterity"]["id"]` ==
our own `AFFIX_IDS["Dexterity"]`), so this is authoritative, not a guess.

Two extraction passes, both from the SAME two files:

1. `items` dict (11678 entries: Uniques, Talisman/Charm set members,
   Lorebooks, ...) - a flat dict keyed by internal item id, each locale's
   entry has a `name` field. Pairing EN/FR by matching key is exact, no
   fuzzy matching needed. This is what resolved "Seal of the Diamond Mind"
   and "Berú of Spellbound Steel" during the same-day investigation.

2. `affixes` dict, `legendary_*`/`Legendary_*`-keyed entries only - these
   are Aspects, stored as a `prefix` OR `suffix` grammatical FRAGMENT (e.g.
   suffix "of Imitated Imbuement" EN / "d'imitation d'imprégnation" FR;
   prefix "Ranger's" EN / "de sentinelle" FR - confirmed both shapes occur
   for different aspects), not a clean standalone name. Stripped down to
   the bare form Maxroll's own UI displays ("Imitated Imbuement",
   "Ranger's") by removing the leading particle ("of "/"de "/"du "/"des "/
   "d'"). Deliberately NOT reconstructing a full "Aspect of X" form here -
   the existing d4base.fr-sourced entries already cover that shape and are
   the ones the userscript's ASPECT_PREFIX_RE/ASPECT_SUFFIX_RE fallback
   already matches against; this pass only needs to add the BARE form so
   findEmbeddedAspectPairs()'s direct/embedded match (no stripping needed)
   can find it too - a second, independent path to the same result.
   Generic (non-aspect) stat affixes are skipped this pass: their
   prefix/suffix fields are crafting-name fragments ("Adroit"/"of the
   Adroit"), not the canonical stat noun ("Dexterity") already covered by
   the existing d4base.fr/kami-labs sources - reconstructing THAT
   correctly would need real grammatical modeling, out of scope here.

FR text sometimes concatenates all 4 grammatical-gender forms with no
separator ("[ms]adroit[fs]adroite[mp]adroits[fp]adroites") - extracts just
the masculine-singular [ms] segment, same tradeoff already made by
`resolveStatPriorityText()`'s existing single-tag stripping in the
userscript, just generalized to the multi-form case.

Run manually:
    .venv\\Scripts\\python.exe -m app.fr_en.build_dictionary_maxroll
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

import httpx

EN_URL = "https://assets-ng.maxroll.gg/d4-tools/game/data.enus.json"
FR_URL = "https://assets-ng.maxroll.gg/d4-tools/game/data.frfr.json"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; DiabloIVAssistant/0.1)"}
OUTPUT_PATH = Path(__file__).parent.parent / "data" / "fr_en_dictionary_maxroll.json"

GENDER_MS_RE = re.compile(r"\[ms\]([^\[]*)")
GENDER_LEADING_RE = re.compile(r"^\[(?:mp|fp|ms|fs|m|f)\]\s*")
PARTICLE_EN_RE = re.compile(r"^of\s+", re.IGNORECASE)
PARTICLE_FR_RE = re.compile(r"^(de |du |des |d['’])", re.IGNORECASE)


def clean_gender_text(text: str) -> str:
    """Same tradeoff as the userscript's existing single-tag stripping,
    generalized to the "all 4 forms concatenated" case seen in `affixes`."""
    if not text:
        return text
    m = GENDER_MS_RE.search(text)
    if m:
        return m.group(1).strip()
    return GENDER_LEADING_RE.sub("", text).strip()


def fetch_json(client: httpx.Client, url: str) -> dict:
    resp = client.get(url, headers=HEADERS, timeout=60)
    resp.raise_for_status()
    return resp.json()


GEAR_SLOT_PREFIXES = (
    "Chest", "Gloves", "Boots", "Pants", "Helm", "1H", "2H", "Ring", "Amulet",
    "Focus", "Shield", "Wand", "Staff", "Bow", "Crossbow", "Totem", "Offhand",
    "Polearm", "Mace", "Axe", "Sword", "Dagger", "Scythe", "Glaive", "Flail",
    "Quarterstaff",
)

# `items` (11678 entries) mixes real gear/Unique/Talisman names with mounts
# ("mnt*"), quests ("QST*"), tempering-recipe descriptions ("Tempering*"),
# season-tagged strings ("S<n>*"), debug/test/internal placeholders (name ==
# key, e.g. "halo_season15_rankC"), and other clearly irrelevant content -
# none of that belongs on a build-guide page this project translates.
# Restricting to gear-slot/Unique/Talisman/ParagonGlyph key prefixes keeps
# only content actually relevant here; anything else is left out rather
# than risk polluting the dictionary with junk that could false-match page
# text (spot-checked a random sample of the excluded "other" bucket -
# confirmed a real mix of legit-but-irrelevant and outright junk).
def _is_allowed_item_key(key: str) -> bool:
    if key.startswith(GEAR_SLOT_PREFIXES):
        return True
    return key.startswith(("Talisman", "ParagonGlyph")) or "unique" in key.lower()


def extract_items(en_items: dict, fr_items: dict) -> list[dict]:
    entries = []
    for key, en_entry in en_items.items():
        if not _is_allowed_item_key(key):
            continue
        if not isinstance(en_entry, dict):
            continue
        en_name = (en_entry.get("name") or "").strip()
        if not en_name or en_name == key:
            continue
        fr_entry = fr_items.get(key)
        if not isinstance(fr_entry, dict):
            continue
        fr_name = clean_gender_text((fr_entry.get("name") or "").strip()).replace("’", "'")
        if not fr_name or fr_name.lower() == en_name.lower():
            continue
        kind = "talisman" if key.startswith("Talisman_Charm_Set") else "unknown"
        entries.append({"fr": fr_name, "en": en_name, "kind": kind, "seen_in": 1, "source": "maxroll_gamedata"})
    return entries


def extract_aspect_pair(en_entry: dict, fr_entry: dict) -> tuple[str, str] | None:
    for field in ("suffix", "prefix"):
        en_raw = en_entry.get(field)
        fr_raw = fr_entry.get(field)
        if not en_raw or not fr_raw:
            continue
        en_bare = PARTICLE_EN_RE.sub("", en_raw).strip()
        fr_bare = PARTICLE_FR_RE.sub("", clean_gender_text(fr_raw)).strip().replace("’", "'")
        if en_bare and fr_bare and en_bare.lower() != fr_bare.lower():
            return en_bare, fr_bare
    return None


def extract_aspects(en_affixes: dict, fr_affixes: dict) -> list[dict]:
    # Two DIFFERENT aspects can share the exact same bare display name
    # (confirmed: "Duelist's" is both a Spiritborn aspect -> "de duel" and
    # an unrelated Barbarian aspect -> "de duelliste") - a real in-game
    # naming collision, not a data error. A bare-name dictionary lookup has
    # no build/class context to disambiguate, and merge_dictionaries.py's
    # final alphabetical sort would make whichever FR text sorts first
    # silently win in lookupFr() - here that would SHADOW the already-
    # correct "duelliste" (from d4base.fr) with the unrelated "duel".
    # Collect every (en_bare -> fr_bare) seen per key first, then drop any
    # en_bare with more than one DISTINCT fr_bare instead of guessing.
    by_en: dict[str, set[str]] = {}
    pairs_by_en: dict[str, str] = {}
    for key, en_entry in en_affixes.items():
        if not key.lower().startswith("legendary"):
            continue
        if not isinstance(en_entry, dict):
            continue
        fr_entry = fr_affixes.get(key)
        if not isinstance(fr_entry, dict):
            continue
        pair = extract_aspect_pair(en_entry, fr_entry)
        if pair is None:
            continue
        en_bare, fr_bare = pair
        by_en.setdefault(en_bare.lower(), set()).add(fr_bare)
        pairs_by_en[en_bare.lower()] = (en_bare, fr_bare)

    entries = []
    skipped_ambiguous = []
    for en_lower, fr_variants in by_en.items():
        if len(fr_variants) > 1:
            skipped_ambiguous.append((pairs_by_en[en_lower][0], sorted(fr_variants)))
            continue
        en_bare, fr_bare = pairs_by_en[en_lower]
        entries.append({"fr": fr_bare, "en": en_bare, "kind": "item", "seen_in": 1, "source": "maxroll_gamedata"})

    if skipped_ambiguous:
        print(f"  {len(skipped_ambiguous)} nom(s) d'aspect ambigu(s) ignoré(s) (plusieurs traductions differentes pour le meme nom court) :")
        for en_bare, variants in skipped_ambiguous:
            print(f"    {en_bare!r} -> {variants}")

    return entries


def build() -> dict:
    with httpx.Client() as client:
        en_data = fetch_json(client, EN_URL)
        fr_data = fetch_json(client, FR_URL)

    seen: set[tuple[str, str, str]] = set()
    entries = []
    for batch in (
        extract_items(en_data.get("items", {}), fr_data.get("items", {})),
        extract_aspects(en_data.get("affixes", {}), fr_data.get("affixes", {})),
    ):
        for e in batch:
            key = (e["fr"].lower(), e["en"].lower(), e["kind"])
            if key in seen:
                continue
            seen.add(key)
            entries.append(e)

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "entries": entries,
    }


def main() -> None:
    data = build()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(data['entries'])} entries -> {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
