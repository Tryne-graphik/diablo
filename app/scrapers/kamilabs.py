"""Scraper for kami-labs.fr's Diablo 4 build hub.

The hub page (https://kami-labs.fr/diablo-4/builds/) loads its ~400 build
cards through a WordPress REST endpoint that returns one HTML blob with all
builds at once, each card carrying data-* attributes (class, tier, season,
tags). No pagination or per-class request needed - one fetch gets everything.

The feed mixes EVERY season since S5 (~400 posts, most now outdated) - one
season is picked out per call rather than showing everything at once,
since a stale S10 build wrongly shown as a live "S-tier" option would be
actively misleading. Found while verifying this: ~70 of the ~400 cards
carry no data-season attribute at all even though their (uncleaned) title
says e.g. "(S10)" - a data quality gap on kami-labs' side, not a bug here,
so they're correctly dropped too. Because it archives every season in one
feed, this is one of the few sources that CAN answer "show me last
season's builds" (SUPPORTS_SEASON_FILTER = True).
"""

from __future__ import annotations

import httpx
from bs4 import BeautifulSoup

from app.models import CLASS_IDS, BuildResult
from app.scrapers.base import Scraper

AJAX_URL = "https://kami-labs.fr/wp-json/autoarticle/v1/d4/hub/builds-ajax"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; DiabloIVAssistant/0.1)"}


class KamiLabsScraper(Scraper):
    name = "kamilabs"
    SUPPORTS_SEASON_FILTER = True

    def _fetch_all(self, season: int) -> list[BuildResult]:
        season_tag = f"S{season}"
        response = httpx.get(AJAX_URL, headers=HEADERS, timeout=20)
        response.raise_for_status()
        html = response.json()["builds_html"]
        soup = BeautifulSoup(html, "html.parser")

        results: list[BuildResult] = []
        for card in soup.select("article.d4-hub-build-item"):
            if card.get("data-season") != season_tag:
                continue

            link = card.select_one("a.build-link")
            title_el = card.select_one("h3.build-skill")
            if not link or not title_el:
                continue

            game_class = card.get("data-class") or None
            if game_class not in CLASS_IDS:
                game_class = None

            tier_raw = (card.get("data-tier") or "").strip()
            tier = tier_raw.replace("-TIER", "") if tier_raw else None

            tags_raw = card.get("data-tags") or ""
            tags = [t for t in tags_raw.split(",") if t]

            results.append(
                BuildResult(
                    source=self.name,
                    title=title_el.get_text(strip=True),
                    url=link.get("href", ""),
                    game_class=game_class,
                    tier=tier or None,
                    season=card.get("data-season") or None,
                    tags=tags,
                    author=None,
                )
            )
        return results
