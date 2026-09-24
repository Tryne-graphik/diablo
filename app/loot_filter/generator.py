"""Builds a ready-to-import D4 loot filter code for a chosen build.

2026-09-23 CORRECTION: every rule order in this module before today was
backwards. The game evaluates a filter's rules in LIST ORDER, top to
bottom, and stops at the FIRST match (simple first-match-wins) - not
"reverse order" and not "a later specific rule overrides an earlier
Hide" as this module's original docstring (ported from
Upsilon72/d4-filter-generator without independent verification) claimed.
Confirmed 2026-09-23 with a minimal real in-game test: a filter with
Hide(Legendary|Unique) placed BEFORE a Recolor(Legendary|Unique) rule
hid the item and the later Recolor never applied - proving Hide, once
matched, wins outright regardless of what comes after it. Every rule
this module ever generated had its Rare-recolor rules placed AFTER
"Hide Junk" (whose rarity mask includes Rare), so they were very
likely dead code the entire time: a Rare that should have been
recolored orange/gold instead just got hidden by "Hide Junk" first.
Cross-checked against the user's own hand-built, actually-working
filters, which all follow this same pattern: every specific
show/recolor rule first, the broad "hide everything else" rule dead
last, and no trailing catch-all SHOW after it (an item matching no
rule at all displays in its normal, unstyled state by default - a
final catch-all is redundant, not needed).

Rule order now (first match wins, so more specific / better tiers go
before looser ones that could also match the same item):
  1. Show   - Legendary Talismans/Charms (always kept, not build-specific)
  2. Recolor gold  - Rare with >= gold_threshold of the build's core stats
  3. Recolor orange- Rare with >= 1 of any build-relevant affix
  4. Recolor green - Codex upgrade
  5. Recolor green - Legendary and above
  6. Recolor cyan  - any Greater Affix
  7. Hide          - Common/Magic/Rare junk (last: only reached by an
                      item that matched none of the keep rules above it)
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.loot_filter import codec
from app.loot_filter.data import AFFIX_IDS, GENERIC_SKILL_AFFIX_IDS, SKILL_AFFIX_IDS
from app.loot_filter.uniques import UNIQUE_ITEM_IDS_BY_LOWER_NAME, UNIQUE_ITEM_IDS


@dataclass
class FilterResult:
    code: str
    unresolved_skills: list[str] = field(default_factory=list)
    resolved_affix_count: int = 0


def build_unique_item_rules(item_names: list[str], color: int = codec.COLOR_GOLD) -> tuple[list[bytes], list[str]]:
    """2026-09-22: one SHOW rule per named Unique/Mythic item found in
    `item_names` (typically a build's own scraped equipment list) that
    matches app.loot_filter.uniques.UNIQUE_ITEM_IDS - names that don't
    match (most of a build's list won't: Legendaries get an auto-generated
    flavor name, not a fixed Unique name) are silently skipped, same as
    unresolved skills elsewhere in this module. Returns (rules, matched_names).
    """
    rules: list[bytes] = []
    matched: list[str] = []
    seen_lower: set[str] = set()
    for raw_name in item_names:
        canonical = UNIQUE_ITEM_IDS_BY_LOWER_NAME.get(raw_name.strip().lower())
        if canonical is None or canonical.lower() in seen_lower:
            continue
        seen_lower.add(canonical.lower())
        matched.append(canonical)
        rules.append(
            codec.make_rule(
                f"Garder - {canonical}", codec.SHOW,
                [codec.condition_specific_unique(UNIQUE_ITEM_IDS[canonical])], color,
            )
        )
    return rules, matched


def _resolve_skill_ids(game_class: str, skill_names: list[str]) -> tuple[list[int], list[str]]:
    class_skills = SKILL_AFFIX_IDS.get(game_class, {})
    ids: list[int] = []
    unresolved: list[str] = []
    for name in skill_names:
        skill_id = class_skills.get(name)
        if skill_id is None:
            skill_id = GENERIC_SKILL_AFFIX_IDS.get(name)
        if skill_id is not None:
            ids.append(skill_id)
        else:
            unresolved.append(name)
    return ids, unresolved


def generate_filter_code(
    filter_name: str,
    game_class: str,
    core_stats: list[str],
    secondary_stats: list[str],
    skill_names: list[str],
    gold_threshold: int = 2,
) -> FilterResult:
    core_ids = [AFFIX_IDS[name] for name in core_stats if name in AFFIX_IDS]
    secondary_ids = [AFFIX_IDS[name] for name in secondary_stats if name in AFFIX_IDS]
    skill_ids, unresolved_skills = _resolve_skill_ids(game_class, skill_names)

    all_build_ids = core_ids + secondary_ids + skill_ids

    rules: list[bytes] = []

    rules.append(
        codec.make_rule(
            "Talismans Légendaires", codec.SHOW,
            [codec.condition_rarity(codec.LEGENDARY_PLUS), codec.condition_item_types([codec.CHARM, codec.SEAL])],
        )
    )
    if len(core_ids) >= gold_threshold:
        rules.append(
            codec.make_rule(
                f"Rare {gold_threshold}+ Stats (BiS)", codec.RECOLOR,
                [codec.condition_rarity(codec.RARE), codec.condition_affixes(core_ids, gold_threshold)],
                codec.COLOR_GOLD,
            )
        )
    if all_build_ids:
        rules.append(
            codec.make_rule(
                "Rare 1+ Affixe", codec.RECOLOR,
                [codec.condition_rarity(codec.RARE), codec.condition_affixes(all_build_ids, 1)],
                codec.COLOR_ORANGE,
            )
        )
    rules.append(codec.make_rule("Codex : Mise à jour", codec.RECOLOR, [codec.condition_codex_upgrade()], codec.COLOR_GREEN))
    rules.append(codec.make_rule("Légendaires - Garder", codec.RECOLOR, [codec.condition_rarity(codec.LEGENDARY_PLUS)], codec.COLOR_GREEN))
    rules.append(codec.make_rule("Affixe Majeur - Butin", codec.RECOLOR, [codec.condition_greater_affix(1)], codec.COLOR_CYAN))
    rules.append(
        codec.make_rule("Cacher Détritus", codec.HIDE_ALL, [codec.condition_rarity(codec.COMMON | codec.MAGIC | codec.RARE)])
    )

    code = codec.make_filter(filter_name, rules)
    return FilterResult(code=code, unresolved_skills=unresolved_skills, resolved_affix_count=len(all_build_ids))
