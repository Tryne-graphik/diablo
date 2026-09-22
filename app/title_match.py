"""Generic fuzzy title matching used to find "the same build" across
sites, given only a free-text title (and optionally a class) - factored
out of app/infinitybuilds_match.py so app/kamilabs_match.py (added
2026-09-20 for the Tampermonkey userscript's kami-labs cross-reference)
can reuse the exact same logic instead of duplicating it.

Reuses the same title-similarity scheme already validated for cross-source
consensus grouping (app/consensus.py): precision over recall, so a weak/no
match returns None instead of guessing.
"""

from __future__ import annotations

from app.consensus import SIMILARITY_THRESHOLD, _signature, _similarity
from app.models import BuildResult


def find_best_title_match(
    candidates: list[BuildResult], title: str, game_class: str | None = None
) -> BuildResult | None:
    if game_class:
        # Exclude builds CONFIRMED to be a different class, but keep ones
        # whose class the scraper couldn't detect (e.g. InfinityBuilds'
        # opaque URL slugs) rather than dropping them outright - excluding
        # those too was hiding the correct match entirely for some builds.
        with_class = [b for b in candidates if b.game_class in (game_class, None)]
        if with_class:
            candidates = with_class

    query_sig = _signature(title)
    best_build, best_score = None, SIMILARITY_THRESHOLD
    for build in candidates:
        score = _similarity(query_sig, _signature(build.title))
        if score >= best_score:
            best_build, best_score = build, score
    return best_build
