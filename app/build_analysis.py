"""On-demand analysis for ONE specific build - used both to pre-fill the
loot filter generator and to show the build's actual content (gear per
slot, skills) natively in our own "Détail du build" panel instead of just
a link out to the source site.

Two sources support this:
- InfinityBuilds: no per-build API, so this drives a real browser
  (Playwright) to read the rendered page - see app/fr_en/extractor.py,
  already built for the FR<->EN dictionary and reused as-is here.
- D4Guides: has a genuine per-build detail API (`builds.php?id=...`,
  found by recording the site's own network requests while it loaded a
  build page) with full gear-per-slot data including item rarity - far
  richer than anything in its listing endpoint. httpx only, no browser.

kami-labs, Maxroll and talion.tv have no per-build data source found yet -
reported as unsupported rather than guessed at, so the UI can say so
plainly instead of showing nothing with no explanation. Maxroll in
particular was investigated at length (see HISTORIQUE.md, 2026-09-20) and
hit a real dead end: its planner only exposes skill names through a
tooltip that a script can't reliably read across all 6 skill slots in one
session.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import httpx
from playwright.sync_api import sync_playwright

from app.fr_en.extractor import GEAR_JS, SKILLS_JS, _gear_names, _skill_names

SUPPORTED_ON_DEMAND = {"infinitybuilds", "d4guides"}

D4GUIDES_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; DiabloIVAssistant/0.1)", "Accept": "application/json"}


@dataclass
class BuildDetails:
    # English names - what the loot filter generator needs (SKILL_AFFIX_IDS/
    # AFFIX_IDS keys in app/loot_filter/data.py are English), and what the
    # dashboard's filter checkboxes already match on exactly
    # (app/static/app.js applySkillsToFilterForm) - unchanged by the FR
    # addition below so that existing flow keeps working as-is.
    skills: list[str] = field(default_factory=list)
    items: list[str] = field(default_factory=list)
    # French names for DISPLAY - matching the in-game client's exact
    # wording, added 2026-09-20 for the Tampermonkey panel (the user plays
    # in French; the site being translated is usually English). Falls back
    # to the English list when no FR page/data exists, so callers always
    # have something to show rather than handling two cases.
    skills_fr: list[str] = field(default_factory=list)
    items_fr: list[str] = field(default_factory=list)


def _fetch_infinitybuilds_details(url: str) -> BuildDetails:
    # InfinityBuilds' tier list is English-only (TIER_LIST_URL in
    # scrapers/infinitybuilds.py), so every build URL starts as
    # "/en/builds/<slug>" - swapping that one segment gets the same build's
    # French page, the same trick already proven reliable for the FR<->EN
    # dictionary (app/fr_en/build_dictionary.py).
    fr_url = url.replace("/en/", "/fr/", 1) if "/en/" in url else None

    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            page = browser.new_page()

            page.goto(url, wait_until="load", timeout=45000)
            page.wait_for_timeout(1500)
            skills_en = _skill_names(page.evaluate(SKILLS_JS))
            items_en = [name for name in _gear_names(page.evaluate(GEAR_JS)) if name]

            skills_fr, items_fr = skills_en, items_en
            if fr_url:
                page.goto(fr_url, wait_until="load", timeout=45000)
                page.wait_for_timeout(1500)
                fetched_skills_fr = _skill_names(page.evaluate(SKILLS_JS))
                fetched_items_fr = [name for name in _gear_names(page.evaluate(GEAR_JS)) if name]
                if fetched_skills_fr:
                    skills_fr = fetched_skills_fr
                if fetched_items_fr:
                    items_fr = fetched_items_fr

            return BuildDetails(skills=skills_en, items=items_en, skills_fr=skills_fr, items_fr=items_fr)
        finally:
            browser.close()


# Small in-process caches for D4Guides' reference data (gear slot names are
# the same for every build; skill names only vary per class) - these change
# rarely, so refetching them on every single build analysis would be wasteful.
_d4guides_gear_slot_names: dict[int, str] | None = None
_d4guides_skill_names_by_class: dict[int, dict[int, str]] = {}


def _d4guides_gear_slot_map() -> dict[int, str]:
    global _d4guides_gear_slot_names
    if _d4guides_gear_slot_names is None:
        response = httpx.get("https://d4guides.gg/api/v1/gear-slots.php", params={"lang": "en"}, headers=D4GUIDES_HEADERS, timeout=20)
        response.raise_for_status()
        slots = response.json()["data"]["slots"]
        _d4guides_gear_slot_names = {slot["id"]: slot["name"] for slot in slots}
    return _d4guides_gear_slot_names


def _d4guides_skill_map(class_id: int) -> dict[int, str]:
    if class_id not in _d4guides_skill_names_by_class:
        response = httpx.get(
            "https://d4guides.gg/api/v1/skills.php", params={"class_id": class_id, "lang": "en"}, headers=D4GUIDES_HEADERS, timeout=20
        )
        response.raise_for_status()
        categories = response.json()["data"]
        mapping: dict[int, str] = {}
        for category in categories:
            for skill in category.get("skills", []):
                mapping[skill["id"]] = skill["name"]
        _d4guides_skill_names_by_class[class_id] = mapping
    return _d4guides_skill_names_by_class[class_id]


def _fetch_d4guides_details(external_id: str, class_id: int | None) -> BuildDetails:
    response = httpx.get(
        "https://d4guides.gg/api/v1/builds.php", params={"id": external_id, "lang": "en"}, headers=D4GUIDES_HEADERS, timeout=20
    )
    response.raise_for_status()
    build = response.json()["data"]

    slot_names = _d4guides_gear_slot_map()
    items = []
    for slot_id, slot_data in (build.get("gear_setup") or {}).items():
        item_name = slot_data.get("itemName")
        if not item_name:
            continue
        slot_name = slot_names.get(int(slot_id), f"Slot {slot_id}")
        items.append(f"{slot_name}: {item_name}")

    skills: list[str] = []
    if class_id is not None:
        skill_names = _d4guides_skill_map(class_id)
        skills = [skill_names[sid] for sid in (build.get("skill_slots") or []) if sid in skill_names]

    # No French variant fetched here (D4Guides isn't part of this feature's
    # scope - only InfinityBuilds is) - fr_ fields just mirror the English
    # ones so callers can rely on them always being populated.
    return BuildDetails(skills=skills, items=items, skills_fr=skills, items_fr=items)


def fetch_build_details(source: str, url: str, external_id: str | None = None, external_class_id: int | None = None) -> BuildDetails | None:
    """Returns this build's skills/items, or None if this source isn't
    supported for on-demand analysis (caller should tell the user rather
    than silently showing an empty result)."""
    if source == "infinitybuilds":
        return _fetch_infinitybuilds_details(url)
    if source == "d4guides" and external_id:
        return _fetch_d4guides_details(external_id, external_class_id)
    return None
