"""Data model shared by every site scraper and the comparator."""

from __future__ import annotations

from dataclasses import dataclass, field

# Canonical (English, lowercase) class ids used internally everywhere,
# so scrapers only need to normalize their site's class label to one of these.
CLASS_IDS = [
    "barbarian",
    "druid",
    "necromancer",
    "paladin",
    "rogue",
    "sorcerer",
    "spiritborn",
    "warlock",
]

# French label shown in the UI for each canonical class id.
CLASS_LABELS_FR = {
    "barbarian": "Barbare",
    "druid": "Druide",
    "necromancer": "Nécromancien",
    "paladin": "Paladin",
    "rogue": "Voleur",
    "sorcerer": "Sorcier",
    "spiritborn": "Sacresprit",
    "warlock": "Démoniste",
}

TIER_ORDER = {"S": 0, "A": 1, "B": 2, "C": 3, "D": 4}


@dataclass
class BuildResult:
    source: str  # e.g. "kamilabs", "infinitybuilds"
    title: str
    url: str
    game_class: str | None  # one of CLASS_IDS, or None if not detected
    tier: str | None  # "S" / "A" / "B" / "C" / "D", or None if not ranked
    season: str | None = None
    tags: list[str] = field(default_factory=list)
    author: str | None = None
    # Skill names actually used by this specific build, when the source's
    # own listing already carries them for free (D4Guides, D4Builds) - not
    # populated for sources that would need a second per-build fetch just
    # for this (kami-labs, Maxroll, talion.tv: known gap). InfinityBuilds
    # gets its skills separately, on demand, via app/build_analysis.py
    # rather than eagerly for every listed build (too slow at list-scrape
    # time - it needs a real browser page load per build).
    skills: list[str] = field(default_factory=list)
    # Site-internal identifiers needed to fetch this ONE build's full detail
    # on demand (gear per slot, etc.) from a source whose listing only gives
    # a summary - see app/build_analysis.py. None for sources that don't
    # need/support this.
    external_id: str | None = None
    external_class_id: int | None = None

    @property
    def tier_rank(self) -> int:
        """Lower is better; unranked builds sort last."""
        return TIER_ORDER.get((self.tier or "").upper(), 99)

    def to_dict(self) -> dict:
        return {
            "source": self.source,
            "title": self.title,
            "url": self.url,
            "game_class": self.game_class,
            "tier": self.tier,
            "season": self.season,
            "tags": self.tags,
            "author": self.author,
            "skills": self.skills,
            "external_id": self.external_id,
            "external_class_id": self.external_class_id,
        }
