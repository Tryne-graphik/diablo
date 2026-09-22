"""Finds the InfinityBuilds build that best matches a free-text title (and
optionally a class) - the "translate whatever page I'm looking at" trick
requested by the user 2026-09-20: rather than teaching the Tampermonkey
userscript how to read 6 different sites' gear/skill layouts, it only
needs to grab a build's TITLE (universal, one line of JS per site or even
just document.title), and the server finds the equivalent build on
InfinityBuilds - the one source we can already read reliably in full
(app/build_analysis.py) and that's properly localized into French.

Matching logic itself lives in app/title_match.py (factored out so
app/kamilabs_match.py can reuse it).
"""

from __future__ import annotations

from app.models import BuildResult
from app.scrapers.infinitybuilds import InfinityBuildsScraper
from app.title_match import find_best_title_match

_scraper = InfinityBuildsScraper()


def find_matching_build(title: str, game_class: str | None = None) -> BuildResult | None:
    return find_best_title_match(_scraper.get_all_builds(), title, game_class)
