"""Scraper for d4builds.gg's "Meta Builds" endgame list.

Server-rendered HTML, no Playwright needed (confirmed by fetching the
homepage with plain httpx and finding all 77 build cards already present).

Unlike the other sources, this site has no S/A/B letter-tier ranking -
builds are just listed under one "Meta Builds" heading, already sorted by
the Pit ("Tower") level the author reached with it. We keep that ordering
and expose the pit level as a tag instead of inventing a letter tier the
site doesn't actually assign (tier is left None).

No per-build season field either, and none needed: the homepage is
d4builds.gg's single live "Meta Builds" list for the current season, not
an archive of every past one - same situation as Maxroll.
"""

from __future__ import annotations

import httpx
from bs4 import BeautifulSoup

from app.models import CLASS_IDS, BuildResult
from app.scrapers.base import Scraper

HOMEPAGE_URL = "https://d4builds.gg/"
BASE_URL = "https://d4builds.gg"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; DiabloIVAssistant/0.1)"}


class D4BuildsScraper(Scraper):
    name = "d4builds"

    def _fetch_all(self, season: int) -> list[BuildResult]:  # noqa: ARG002 - single live page, no history
        response = httpx.get(HOMEPAGE_URL, headers=HEADERS, timeout=20, follow_redirects=True)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        results: list[BuildResult] = []
        for card in soup.select("a.build"):
            href = card.get("href", "")
            title_el = card.select_one("h2")
            if not href or not title_el:
                continue

            icon = card.select_one("img.build__icon")
            game_class = None
            if icon:
                for cls in icon.get("class", []):
                    if cls.lower() in CLASS_IDS:
                        game_class = cls.lower()
                        break

            pit = card.select_one("div.build__pit")
            tags = []
            if pit:
                pit_text = pit.get_text(" ", strip=True)  # e.g. "Tower 150"
                tags.append(pit_text.lower().replace(" ", "-"))

            skills = [
                img.get("alt", "").strip()
                for img in card.select("img.build__skill__icon")
                if img.get("alt")
            ]

            results.append(
                BuildResult(
                    source=self.name,
                    title=title_el.get_text(strip=True),
                    url=href if href.startswith("http") else BASE_URL + href,
                    game_class=game_class,
                    tier=None,
                    season=None,
                    tags=tags,
                    author=None,
                    skills=skills,
                )
            )
        return results
