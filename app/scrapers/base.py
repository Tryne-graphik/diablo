"""Common interface every site scraper implements, plus a tiny TTL cache
so the comparator doesn't hit the same site's servers on every search."""

from __future__ import annotations

import time
import unicodedata
from abc import ABC, abstractmethod

from app.config import CURRENT_SEASON
from app.models import BuildResult


def _fold(text: str) -> str:
    """Lowercase and strip accents so "fleches" matches "Flèches"."""
    decomposed = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in decomposed if not unicodedata.combining(c))

CACHE_TTL_SECONDS = 15 * 60


class Scraper(ABC):
    """One implementation per build-guide site."""

    #: short identifier used as BuildResult.source and in the UI
    name: str

    #: Whether this site keeps past seasons' builds accessible (and
    #: _fetch_all() accepts a `season` argument). Most of the sources here
    #: are a single "current season" live page/API with nothing to select
    #: an old season from - False for those, and search() for a
    #: non-current season returns [] rather than silently showing this
    #: season's data under the wrong label.
    SUPPORTS_SEASON_FILTER: bool = False

    def __init__(self) -> None:
        self._cache: dict[int, list[BuildResult]] = {}
        self._cached_at: dict[int, float] = {}

    @abstractmethod
    def _fetch_all(self, season: int) -> list[BuildResult]:
        """Fetch and parse every build this site currently lists for
        `season` (implementations that don't support picking a season -
        SUPPORTS_SEASON_FILTER = False - can ignore the argument, since
        search() only ever calls this with the current season for them)."""

    def get_all_builds(self, season: int = CURRENT_SEASON, force_refresh: bool = False) -> list[BuildResult]:
        now = time.monotonic()
        cached_at = self._cached_at.get(season, 0.0)
        if force_refresh or season not in self._cache or (now - cached_at) > CACHE_TTL_SECONDS:
            self._cache[season] = self._fetch_all(season)
            self._cached_at[season] = now
        return self._cache[season]

    def search(
        self,
        game_class: str | None = None,
        keyword: str | None = None,
        season: int = CURRENT_SEASON,
    ) -> list[BuildResult]:
        if season != CURRENT_SEASON and not self.SUPPORTS_SEASON_FILTER:
            return []
        results = self.get_all_builds(season=season)
        if game_class:
            results = [r for r in results if r.game_class == game_class]
        if keyword:
            kw = _fold(keyword)
            results = [
                r
                for r in results
                if kw in _fold(r.title) or any(kw in _fold(t) for t in r.tags)
            ]
        return sorted(results, key=lambda r: r.tier_rank)
