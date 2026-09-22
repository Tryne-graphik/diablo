"""Finds the kami-labs build that best matches a free-text title (and
optionally a class) - added 2026-09-20 as a second cross-reference for the
Tampermonkey userscript, alongside InfinityBuilds: kami-labs' ~400 builds
are written in French by the community itself (not machine-translated),
so surfacing a matching kami-labs build lets the user sanity-check the
"termes exacts" InfinityBuilds gives against how French players actually
name things.

kami-labs has no per-build detail API found yet (see
app/build_analysis.py's docstring) - only used here to find a URL to link
to, not to fetch gear/skills.

Matching logic lives in app/title_match.py, shared with
app/infinitybuilds_match.py.
"""

from __future__ import annotations

from app.models import BuildResult
from app.scrapers.kamilabs import KamiLabsScraper
from app.title_match import find_best_title_match

_scraper = KamiLabsScraper()


def find_matching_build(title: str, game_class: str | None = None) -> BuildResult | None:
    return find_best_title_match(_scraper.get_all_builds(), title, game_class)
