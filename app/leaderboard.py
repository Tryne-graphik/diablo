"""Reads Diablo 4's OFFICIAL Tower leaderboard (top-ranked real players'
actual equipped skills) via helltides.com, a well-established community
site that mirrors it - not a build-guide's opinion, but what the actual
best-ranked players are really running.

There is no direct Battle.net/Blizzard web page for this (confirmed by
research - the leaderboard is in-game only, "press Y then Leaderboards").
helltides.com is where the community already goes to view it online, and
its own front-end loads the full board from a plain, unauthenticated
Nuxt.js data cache embedded in the page (`window.__NUXT__.data.<hash>`) -
found using the same "record the page's network/state while it loads"
approach as for talion.tv, no login or special access needed.

That hash key name is a Nuxt build artifact that can change on their next
deploy, so this searches `window.__NUXT__.data` for the value that LOOKS
like the leaderboard (a list of dicts with a "skillDetails" field) instead
of hardcoding the key - more robust to their next redeploy than assuming
the key stays "dcOCFfOHFf" forever.
"""

from __future__ import annotations

import time

from playwright.sync_api import sync_playwright

TOWER_URL = "https://helltides.com/tower"
CACHE_TTL_SECONDS = 30 * 60

_FIND_LEADERBOARD_JS = """() => {
    const data = (window.__NUXT__ && window.__NUXT__.data) || {};
    for (const value of Object.values(data)) {
        if (Array.isArray(value) && value.length && value[0] && value[0].skillDetails) {
            return value;
        }
    }
    return [];
}"""

_cache: list[dict] | None = None
_cached_at: float = 0.0


def _fetch_leaderboard() -> list[dict]:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            page = browser.new_page()
            page.goto(TOWER_URL, wait_until="load", timeout=45000)
            page.wait_for_timeout(3000)
            return page.evaluate(_FIND_LEADERBOARD_JS)
        finally:
            browser.close()


def get_leaderboard(force_refresh: bool = False) -> list[dict]:
    global _cache, _cached_at
    now = time.monotonic()
    if force_refresh or _cache is None or (now - _cached_at) > CACHE_TTL_SECONDS:
        _cache = _fetch_leaderboard()
        _cached_at = now
    return _cache


#  Originally this was meant to isolate "build-defining" skills from
# universal utility ones by keeping only Core/Ultimate-type skills. Found
# while building the official-tier-list feature that this is wrong for
# some archetypes: Rogue's "Dance of Knives" - a real, distinct build,
# confirmed independently by /api/leaderboard/search - is typed "Agility",
# not Core/Ultimate, so core_only silently zeroed it out of every
# leaderboard cross-check even when it was genuinely someone's main skill.
BUILD_DEFINING_TYPES = {"Core", "Ultimate"}

# The opposite problem, also found empirically: skill types that are
# shared across almost every build of a class regardless of its identity,
# so including them causes false "confirmations" in app/consensus.py's
# title cross-check. Concretely: nearly every top Rogue slots a "Poison
# Imbuement" (type Imbuement) and defensive Subterfuge skills (Concealment,
# Dark Shroud...) no matter which build they're actually playing - a guide
# site's "Poison Rain of Arrows" or "Poison Penetrating Shot" title then
# matched on the word "poison" alone via any random player who happened to
# use Poison Imbuement, not because they were actually playing that build.
# Excluded by default; app.consensus still isn't perfect about this for
# single generic words within an allowed type (e.g. "Dash") - see its
# module docstring.
GENERIC_UTILITY_TYPES = {"Imbuement", "Subterfuge"}


def top_skill_names(
    game_class: str,
    limit: int = 20,
    core_only: bool = False,
    exclude_generic: bool = True,
) -> list[set[str]]:
    """Returns the set of skill names each of the top `limit` real players
    of this class currently uses, best rank first - one set per player."""
    runs = [r for r in get_leaderboard() if r.get("class") == game_class]
    runs.sort(key=lambda r: r.get("rank", 10**9))
    result = []
    for run in runs[:limit]:
        skills = run.get("skillDetails", [])
        if core_only:
            skills = [s for s in skills if s.get("type") in BUILD_DEFINING_TYPES]
        if exclude_generic:
            skills = [s for s in skills if s.get("type") not in GENERIC_UTILITY_TYPES]
        result.append({s["name"] for s in skills if s})
    return result


ARCHETYPE_SIMILARITY_THRESHOLD = 0.6

# How far below the class's single best Pit tier reached (by ANY archetype)
# an archetype's own best run can be and still count as that band - a
# relative gap rather than an absolute tier number, so it stays meaningful
# whether a class's ceiling this patch is Pit 150 or Pit 110.
#
# Deliberately scores by PERFORMANCE (best Pit tier reached), not raw
# popularity. First version sorted by player_count and got it backwards on
# real data: for Rogue, "Dance of Knives" had far more players (85, 44.7%)
# than "Penetrating Shot" (55, 28.9%) but a much worse best result (Pit 121
# vs Pit 145) - popularity mixes in casual/budget players at every skill
# level, while the best Pit tier reached is Diablo 4's own yardstick for
# "how strong is this build", not ours. player_count is still reported
# per archetype so a one-lucky-run outlier is easy to spot.
TIER_GAP_THRESHOLDS = [("S", 3), ("A", 10), ("B", 25), ("C", 10**9)]


def _run_signature(run: dict) -> frozenset[str]:
    return frozenset(s["name"] for s in (run.get("skillDetails") or []) if s)


def _jaccard(a: frozenset, b: frozenset) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def group_archetypes(game_class: str) -> list[dict]:
    """Clusters this class's ranked runs into build archetypes by skill-bar
    similarity (same idea as app/consensus.py's title matching, applied to
    real equipped skills instead of guide-site titles). Each run joins the
    first archetype it's similar enough to; a new archetype's signature is
    fixed at its founding run's skill bar (not widened on every merge) so
    it can't drift into vague near-matches after many merges.
    """
    runs = [r for r in get_leaderboard() if r.get("class") == game_class]
    runs.sort(key=lambda r: r.get("rank", 10**9))

    groups: list[dict] = []
    for run in runs:
        sig = _run_signature(run)
        best, best_score = None, ARCHETYPE_SIMILARITY_THRESHOLD
        for group in groups:
            score = _jaccard(sig, group["signature"])
            if score >= best_score:
                best, best_score = group, score
        if best is not None:
            best["runs"].append(run)
        else:
            groups.append({"signature": sig, "runs": [run]})
    return groups


def official_tier_list(game_class: str) -> list[dict]:
    """Ranks this class's real build archetypes by the best Pit tier any
    currently-ranked player has reached with each one - the closest thing
    to an "official" tier list, since it comes from actual equipped Tower
    leaderboard runs rather than a guide site's opinion. See
    TIER_GAP_THRESHOLDS for how S/A/B/C is assigned.
    """
    groups = group_archetypes(game_class)
    total_runs = sum(len(g["runs"]) for g in groups)
    if total_runs == 0:
        return []

    for group in groups:
        group["best_run"] = min(group["runs"], key=lambda r: r.get("rank", 10**9))
    groups.sort(key=lambda g: g["best_run"].get("tier", 0), reverse=True)

    class_max_tier = groups[0]["best_run"].get("tier", 0)

    result = []
    for group in groups:
        runs = group["runs"]
        best_run = group["best_run"]
        gap = class_max_tier - (best_run.get("tier") or 0)
        tier = next(t for t, max_gap in TIER_GAP_THRESHOLDS if gap <= max_gap)
        result.append(
            {
                "tier": tier,
                "skills": sorted(group["signature"]),
                "player_count": len(runs),
                "share_pct": round(100 * len(runs) / total_runs, 1),
                "best_rank": best_run.get("rank"),
                "best_tier_reached": best_run.get("tier"),
                "example_battle_tags": [r.get("battle_tag") for r in runs[:3]],
            }
        )
    return result


def search_runs(game_class: str, skill_query: str, limit: int = 20) -> list[dict]:
    """Finds real Tower runs of this class using a skill matching
    `skill_query` (case-insensitive substring, e.g. "dance of knives"),
    best rank first. Answers "who's the best <class> using <skill>?"."""
    query = skill_query.lower().strip()
    matches = []
    for run in get_leaderboard():
        if run.get("class") != game_class:
            continue
        skill_names = [s["name"] for s in (run.get("skillDetails") or []) if s]
        if any(query in name.lower() for name in skill_names):
            matches.append(
                {
                    "rank": run.get("rank"),
                    "battle_tag": run.get("battle_tag"),
                    "tier": run.get("tier"),
                    "run_time_ms": run.get("run_time_ms"),
                    "hardcore": run.get("hardcore"),
                    "ssf": run.get("ssf"),
                    "skills": skill_names,
                }
            )
    matches.sort(key=lambda m: m["rank"] if m["rank"] is not None else 10**9)
    return matches[:limit]
