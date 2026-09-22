"""Scraper for talion.tv's Diablo 4 builds (French).

The site itself is an Angular SPA with nothing useful in the static HTML
(confirmed earlier - see HISTORIQUE.md, 2026-09-19). Found the real data
source by recording the page's network requests with Playwright while it
loaded: `https://api.talion.tv/api/builds/front` returns plain JSON, no
auth needed, no Playwright needed to consume it.

That endpoint mixes builds from every game talion.tv covers (not just
Diablo 4 - it also lists other Blizzard games under similarly-named
classes), so results are filtered to `game.slug == "diablo-4"`. Diablo 4's
8 classes are exposed there with their French slugs (e.g. "demoniste"),
mapped to our canonical English ids below.

Unlike kami-labs or d4guides, this API has NO season field at all (checked
every key on a build object - only id/slug/author/dates/tags/title/game/
class/img). talion.tv appears to maintain one living page per build across
seasons rather than publishing a new one each time, so there's nothing to
match against CURRENT_SEASON directly. Approximated instead with
`updated_at >= CURRENT_SEASON_START`: of 32 D4 builds, 20 had been touched
since the season 15 start estimate and 12 hadn't (oldest untouched one
dated back to 2025-04) - a reasonable, if imperfect, proxy for "still
actively maintained this season".
"""

from __future__ import annotations

import httpx

from app.config import CURRENT_SEASON_START
from app.models import BuildResult
from app.scrapers.base import Scraper

API_URL = "https://api.talion.tv/api/builds/front"
BUILD_URL = "https://www.talion.tv/diablo-4/builds/{slug}"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; DiabloIVAssistant/0.1)", "Accept": "application/json"}

CLASS_SLUG_FR_TO_EN = {
    "barbare": "barbarian",
    "druide": "druid",
    "necromancien": "necromancer",
    "paladin": "paladin",
    "voleur": "rogue",
    "sorcier": "sorcerer",
    "sacresprit": "spiritborn",
    "demoniste": "warlock",
}

VALID_TIERS = {"S", "A", "B", "C", "D"}


class TalionScraper(Scraper):
    name = "talion"

    def _fetch_all(self, season: int) -> list[BuildResult]:  # noqa: ARG002 - no per-build season field, see module docstring
        response = httpx.get(API_URL, headers=HEADERS, timeout=20)
        response.raise_for_status()
        payload = response.json()

        results: list[BuildResult] = []
        for build in payload:
            if build.get("game", {}).get("slug") != "diablo-4":
                continue
            if (build.get("updated_at") or "") < CURRENT_SEASON_START:
                continue

            class_slug_fr = build.get("class", {}).get("slug")
            game_class = CLASS_SLUG_FR_TO_EN.get(class_slug_fr)

            tier = None
            tags: list[str] = []
            for tag in build.get("tags", []):
                label = (tag.get("label") or "").strip()
                if tag.get("category", {}).get("label") == "Push Tier" and label in VALID_TIERS:
                    tier = label
                elif label:
                    tags.append(label.lower())

            results.append(
                BuildResult(
                    source=self.name,
                    title=build.get("title", ""),
                    url=BUILD_URL.format(slug=build["slug"]),
                    game_class=game_class,
                    tier=tier,
                    season=None,
                    tags=tags,
                    author=build.get("author", {}).get("username"),
                )
            )
        return results
