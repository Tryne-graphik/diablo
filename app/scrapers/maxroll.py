"""Scraper for maxroll.gg's Diablo 4 endgame tier list.

Unlike InfinityBuilds, Maxroll's tier list is server-rendered - the tier
groups, build titles, class icons and links are all in the plain HTML
response, no Playwright needed (confirmed by fetching the page with plain
httpx and finding the build links already present).

The site's CSS class names carry a build-tool hash suffix that can change
on redeploy (e.g. "_Tierlist__tierItem_cxko4_112"), so matching is done on
the stable prefix before that hash rather than the full class name.

No per-build season field to filter on, and none needed: this URL is
Maxroll's single live "endgame tier list" page, always showing the current
season's ranking (old seasons aren't kept mixed in) - unlike kami-labs,
which archives every season's posts in one feed.
"""

from __future__ import annotations

import re

import httpx
from bs4 import BeautifulSoup, Tag

from app.models import CLASS_IDS, BuildResult
from app.scrapers.base import Scraper

TIER_LIST_URL = "https://maxroll.gg/d4/tierlists/endgame-tier-list"
BASE_URL = "https://maxroll.gg"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; DiabloIVAssistant/0.1)"}

TIER_PREFIX = "_Tierlist__tier_"
ITEM_PREFIX = "_Tierlist__tierItem_"
ITEM_TEXT_PREFIX = "_Tierlist__tierItemText_"

# Maxroll's class icon filenames don't always spell the class name in full
# (e.g. the sorcerer icon file is "UPDATED-SORC-COLORED-ICON.webp").
ICON_CLASS_HINTS = {
    "sorc": "sorcerer",
}


def _has_class_prefix(tag: Tag, prefix: str) -> bool:
    return any(c.startswith(prefix) for c in (tag.get("class") or []))


def _detect_class(icon_url: str) -> str | None:
    icon_lower = icon_url.lower()
    for class_id in CLASS_IDS:
        if class_id in icon_lower:
            return class_id
    for hint, class_id in ICON_CLASS_HINTS.items():
        if hint in icon_lower:
            return class_id
    return None


class MaxrollScraper(Scraper):
    name = "maxroll"

    def _fetch_all(self, season: int) -> list[BuildResult]:  # noqa: ARG002 - single live page, no history
        response = httpx.get(TIER_LIST_URL, headers=HEADERS, timeout=20, follow_redirects=True)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        results: list[BuildResult] = []
        for tier_div in soup.find_all("div"):
            if not _has_class_prefix(tier_div, TIER_PREFIX):
                continue
            header = tier_div.find("h3")
            if not header:
                continue
            match = re.match(r"([A-Z])Tier", header.get_text(strip=True))
            tier = match.group(1) if match else None

            for link in tier_div.find_all("a"):
                if not _has_class_prefix(link, ITEM_PREFIX):
                    continue
                href = link.get("href", "")
                if not href:
                    continue
                title_el = next(
                    (s for s in link.find_all("span") if _has_class_prefix(s, ITEM_TEXT_PREFIX)),
                    None,
                )
                title = title_el.get_text(strip=True) if title_el else link.get_text(strip=True)
                icon = link.find("img")
                icon_src = icon.get("src", "") if icon else ""

                results.append(
                    BuildResult(
                        source=self.name,
                        title=title,
                        url=href if href.startswith("http") else BASE_URL + href,
                        game_class=_detect_class(icon_src),
                        tier=tier,
                        season=None,
                        tags=[],
                        author=None,
                    )
                )
        return results
