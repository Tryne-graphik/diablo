"""Scraper for d4guides.gg's build database.

Best case of all the sources so far: the page's own front-end calls a
plain JSON API (found by reading the site's builds-list.js, which calls
`api.get('builds.php', params)` against `<origin>/api/v1/`) - a single
request returns every build for a given season with a real S/A/B/C tier
rating, structured class info and even an EN/DE title, no HTML parsing or
Playwright needed at all. Their `season` param is confirmed to work for
past seasons too (checked season=14 directly), so this is one of the few
sources that CAN answer "show me last season's builds"
(SUPPORTS_SEASON_FILTER = True).
"""

from __future__ import annotations

import httpx

from app.models import CLASS_IDS, BuildResult
from app.scrapers.base import Scraper

API_URL = "https://d4guides.gg/api/v1/builds.php"
BUILD_URL = "https://d4guides.gg/en/build/{slug}"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; DiabloIVAssistant/0.1)", "Accept": "application/json"}


class D4GuidesScraper(Scraper):
    name = "d4guides"
    SUPPORTS_SEASON_FILTER = True

    def _fetch_all(self, season: int) -> list[BuildResult]:
        params = {"limit": 200, "offset": 0, "sort": "tier", "season": season}
        response = httpx.get(API_URL, params=params, headers=HEADERS, timeout=20)
        response.raise_for_status()
        payload = response.json()

        results: list[BuildResult] = []
        for build in payload.get("data", {}).get("builds", []):
            game_class = build.get("class_slug")
            if game_class not in CLASS_IDS:
                game_class = None

            skills = [s["name"] for s in (build.get("skill_slot_icons") or []) if s.get("name")]
            # canonical_slug is what the site's own URLs resolve to - the
            # season-suffixed `slug` field 301-redirects there anyway, so
            # using it directly skips that extra hop.
            slug = build.get("canonical_slug") or build["slug"]

            results.append(
                BuildResult(
                    source=self.name,
                    title=build.get("title_en") or build.get("title", ""),
                    url=BUILD_URL.format(slug=slug),
                    game_class=game_class,
                    tier=build.get("tier_rating"),
                    season=f"S{build.get('season')}" if build.get("season") else None,
                    tags=[build.get("build_type")] if build.get("build_type") else [],
                    author=build.get("display_name") or build.get("username"),
                    skills=skills,
                    external_id=build.get("id"),
                    external_class_id=build.get("class_id"),
                )
            )
        return results
