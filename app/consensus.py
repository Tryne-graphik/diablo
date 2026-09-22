"""Cross-source consensus ranking: groups builds that look like the same
build across the 6 sources, then ranks groups by how many sources see it
and how highly they rank it.

Why this instead of votes/comments: checked what each site actually
exposes (see HISTORIQUE.md, 2026-09-20) - kami-labs has a 1-5 star vote
system but only 0-5 votes per build six days into the season, D4Guides has
view/favorite counts but favorites are similarly thin. Too sparse this
early in a season to trust. Six independent sites already assigning their
own S/A/B/C tier to overlapping builds is the strongest signal available
right now: a build ranked S by several sources independently is a much
safer bet than one only one site has opinions on.

Matching builds across sources is inherently approximate (titles are
free text, sometimes in French, sometimes English variants like "Cold
Rain of Arrows" vs "Poison Rain of Arrows" that are real, different
builds and must NOT be merged). This errs toward precision over recall:
under-grouping just shows near-duplicates as separate rows (safe), while
over-grouping would misreport consensus on unrelated builds (actively
misleading) - so the similarity threshold is deliberately conservative
and damage-type words (cold/poison/fire/...) are never stripped as noise.

On top of that, each group is cross-checked against Diablo 4's OFFICIAL
Tower leaderboard (app/leaderboard.py: what the current top-ranked real
players actually have equipped, not a guide site's opinion) - a group
whose title mentions a Core/Ultimate skill that shows up among the top 20
real players of that class gets an extra confidence flag and a ranking
boost, since that's proof the build isn't just theorized by guide authors
but is winning in practice.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.comparator import expand_keywords
from app.config import CURRENT_SEASON
from app.fr_en.dictionary import _entries, _fold
from app.leaderboard import top_skill_names
from app.models import BuildResult
from app.scrapers import ALL_SCRAPERS

TIER_POINTS = {"S": 4, "A": 3, "B": 2, "C": 1, "D": 0}

# Deliberately only structural/meta words - never a damage type or skill
# modifier, since those distinguish genuinely different builds.
NOISE_WORDS = {
    "build", "builds", "endgame", "guide", "guides", "season", "saison",
    "new", "meta", "speed", "farm", "speedfarm", "leveling", "budget",
    "pit", "push", "tower", "polyvalent", "transition", "midgame",
    "one", "button", "onebutton", "variant", "starter", "gameplay",
    "barbarian", "barbare", "druid", "druide", "necromancer", "necromancien",
    "paladin", "rogue", "voleur", "voleuse", "sorcerer", "sorcier", "sorciere",
    "spiritborn", "sacresprit", "warlock", "demoniste",
    # Zero discriminating value in any build title, always safe to strip -
    # found 2026-09-20 building the Tampermonkey userscript's standalone
    # title matcher: a site's raw <title> tag (e.g. Maxroll's, always
    # phrased "... for Diablo IV Season N - <theme>") diluted similarity
    # scores below the threshold without these.
    "diablo", "for",
} | {f"s{n}" for n in range(1, 20)}

_WORD_RE = re.compile(r"[a-z']+")

SIMILARITY_THRESHOLD = 0.5


def _signature(title: str) -> frozenset[str]:
    folded = f" {_fold(title)} "
    for entry in _entries():
        fr_folded = _fold(entry["fr"])
        if len(fr_folded) > 3 and fr_folded in folded:
            folded = folded.replace(fr_folded, f" {_fold(entry['en'])} ")
    words = {w for w in _WORD_RE.findall(folded) if w not in NOISE_WORDS and len(w) > 2}
    return frozenset(words)


def _similarity(a: frozenset, b: frozenset) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def _skill_tokens(skill_name: str) -> frozenset[str]:
    return frozenset(w for w in _WORD_RE.findall(_fold(skill_name)) if len(w) > 2)


def _leaderboard_confirmations(signature: frozenset, player_skill_sets: list[set[str]]) -> int:
    """How many of the top real players have a skill whose full name is
    contained in this group's title signature - a subset check (not mere
    overlap) so a single shared generic word can't count as a match."""
    count = 0
    for skills in player_skill_sets:
        if any(_skill_tokens(name) and _skill_tokens(name) <= signature for name in skills):
            count += 1
    return count


@dataclass
class ConsensusGroup:
    builds: list[BuildResult]
    signature: frozenset = field(default_factory=frozenset)
    leaderboard_confirmations: int = 0

    @property
    def sources(self) -> list[str]:
        return sorted({b.source for b in self.builds})

    @property
    def source_count(self) -> int:
        return len(self.sources)

    @property
    def tier_summary(self) -> dict[str, int]:
        counts: dict[str, int] = {}
        for b in self.builds:
            if b.tier:
                counts[b.tier] = counts.get(b.tier, 0) + 1
        return counts

    @property
    def avg_tier_points(self) -> float | None:
        points = [TIER_POINTS[b.tier] for b in self.builds if b.tier in TIER_POINTS]
        return sum(points) / len(points) if points else None

    @property
    def tier_counts(self) -> tuple[int, int, int, int, int]:
        """(nb S, nb A, nb B, nb C, nb D) - a "note" in the same spirit as an
        Olympic medal table: how many sources rank this build S, then how
        many A, etc. Compared lexicographically in sort_key, so a single S
        outranks any number of A's - deliberate, matches how the user
        described wanting this ("on trie par le plus de S") rather than an
        average, which would let e.g. 4×A (avg 3.0) tie or beat 1×S+1×D
        (avg 2.0) despite the S being the stronger individual signal."""
        counts = self.tier_summary
        return tuple(counts.get(t, 0) for t in ("S", "A", "B", "C", "D"))

    @property
    def note_label(self) -> str:
        counts = self.tier_summary
        parts = [f"{counts[t]}×{t}" for t in ("S", "A", "B", "C", "D") if counts.get(t)]
        return " · ".join(parts) if parts else "non classé"

    @property
    def sort_key(self) -> tuple:
        avg = self.avg_tier_points
        # Real leaderboard evidence ranks ABOVE how many guide sites cover
        # a build, not below it - found while testing this on Rogue:
        # "Rain of Arrows" had more site coverage (5 sources) than
        # "Penetrating Shot" (4 sources), but only 2/20 real top-Tower
        # players were actually running it, versus 18/20 for Penetrating
        # Shot. Guide sites can lag a patch or copy each other; real top
        # players' equipped skills can't. When the leaderboard fetch fails
        # or a build has zero confirmations, this naturally falls back to
        # tier_counts instead (nothing here breaks without it).
        # tier_counts (see its docstring) then decides ties/non-leaderboard
        # cases by "most S wins" rather than a plain average, per the user's
        # request (2026-09-22) - source_count and avg_tier_points are only
        # left in as a final tiebreak for the rare exact tier_counts tie.
        return (self.leaderboard_confirmations, self.tier_counts, self.source_count, avg if avg is not None else -1)

    def to_dict(self) -> dict:
        # Prefer a representative title in French if kami-labs/talion saw
        # it, else whatever the first source called it.
        by_source = {b.source: b for b in self.builds}
        representative = by_source.get("kamilabs") or by_source.get("talion") or self.builds[0]
        return {
            "title": representative.title,
            "game_class": representative.game_class,
            "source_count": self.source_count,
            "sources": self.sources,
            "tier_summary": self.tier_summary,
            "note_label": self.note_label,
            "leaderboard_confirmations": self.leaderboard_confirmations,
            "builds": [b.to_dict() for b in self.builds],
        }


def _group(builds: list[BuildResult]) -> list[ConsensusGroup]:
    groups: list[ConsensusGroup] = []
    for build in builds:
        sig = _signature(build.title)
        best_group, best_score = None, SIMILARITY_THRESHOLD
        for group in groups:
            score = _similarity(sig, group.signature)
            if score >= best_score:
                best_group, best_score = group, score
        if best_group is not None:
            best_group.builds.append(build)
            best_group.signature = best_group.signature | sig
        else:
            groups.append(ConsensusGroup(builds=[build], signature=sig))
    return groups


def rank_builds(
    game_class: str,
    keyword: str | None = None,
    season: int = CURRENT_SEASON,
) -> list[ConsensusGroup]:
    """keyword narrows this down to builds matching a search, same bilingual
    expansion as comparator.compare() - without it, a class-wide search for
    e.g. "Lightning Storm Druid" showed a "best builds" panel completely
    unrelated to what was actually searched, which is what prompted this."""
    keywords = expand_keywords(keyword)

    all_builds: list[BuildResult] = []
    for scraper in ALL_SCRAPERS:
        by_url: dict[str, BuildResult] = {}
        for kw in keywords:
            for build in scraper.search(game_class=game_class, keyword=kw, season=season):
                by_url[build.url] = build
        all_builds.extend(by_url.values())

    groups = _group(all_builds)

    try:
        # core_only=False: a Core/Ultimate-only filter would silently miss
        # real archetypes whose defining skill has a different type - e.g.
        # Rogue's "Dance of Knives" is typed "Agility" (found while
        # building the official tier list, see app/leaderboard.py).
        # exclude_generic=True (the default) drops Imbuement/Subterfuge
        # skills, which are shared by nearly every build of a class and
        # were producing false "confirmations" (a "Poison Rain of Arrows"
        # title matched via someone's unrelated Poison Imbuement pick).
        # Still imperfect for a generic single-word skill within an
        # allowed type (e.g. "Dash") matching a coincidentally similar
        # title - a known, accepted gap, not chased further here.
        player_skill_sets = top_skill_names(game_class, limit=20, core_only=False)
    except Exception:  # noqa: BLE001 - leaderboard is a bonus signal, never block the ranking
        player_skill_sets = []
    for group in groups:
        group.leaderboard_confirmations = _leaderboard_confirmations(group.signature, player_skill_sets)

    groups.sort(key=lambda g: g.sort_key, reverse=True)
    return groups
