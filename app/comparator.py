"""Cross-site comparison: queries every registered scraper for a class/
keyword and returns results grouped by source, each already tier-sorted.

Keyword search is bilingual: a French keyword also searches with its
English translation(s) from the FR<->EN dictionary (app/fr_en) and vice
versa, so e.g. searching "fleches" also matches Maxroll/InfinityBuilds'
"Rain of Arrows" even though nothing on those sites is in French. This
needs the dictionary to have seen the term (see
app/fr_en/build_dictionary.py) - unrecognized keywords just search as
typed, same as before.

MVP scope: this does NOT yet try to match "the same build" across sites
(e.g. recognizing that kami-labs' "Danse des Couteaux" and InfinityBuilds'
"Dance Of Knives" are the same build) as one unified row - that's a
reasonable next step now that the dictionary exists. For now the
comparison is: put each source's ranked list side by side and let the
user see where sources agree or disagree.
"""

from __future__ import annotations

from app.config import CURRENT_SEASON
from app.fr_en.dictionary import translate_keyword
from app.models import BuildResult
from app.scrapers import ALL_SCRAPERS


def expand_keywords(keyword: str | None) -> list[str | None]:
    """A keyword and its bilingual translation(s), or [None] if there's no
    keyword - shared with consensus.py so both respect the same search."""
    if not keyword:
        return [None]
    return [keyword] + translate_keyword(keyword)


def compare(
    game_class: str | None,
    keyword: str | None,
    season: int = CURRENT_SEASON,
) -> dict[str, list[BuildResult]]:
    keywords = expand_keywords(keyword)

    results: dict[str, list[BuildResult]] = {}
    for scraper in ALL_SCRAPERS:
        by_url: dict[str, BuildResult] = {}
        for kw in keywords:
            for build in scraper.search(game_class=game_class, keyword=kw, season=season):
                by_url[build.url] = build
        results[scraper.name] = sorted(by_url.values(), key=lambda r: r.tier_rank)
    return results
