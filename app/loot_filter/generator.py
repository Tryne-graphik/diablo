"""Builds a ready-to-import D4 loot filter code for a chosen build.

Rule template (priority, highest first - i.e. LAST in the list passed to
make_filter, matching app/loot_filter/codec.py's convention) ported
directly from Upsilon72/d4-filter-generator's buildFilter():

  1. Show everything (catch-all)
  2. Recolor cyan  - any Greater Affix
  3. Recolor green - Legendary and above
  4. Recolor green - Codex upgrade
  5. Recolor gold  - Rare with >= gold_threshold of the build's core stats
  6. Recolor orange- Rare with >= 1 of any build-relevant affix
  7. Hide          - Common/Magic/Rare junk (rules 5/6 above already
                      recolored the Rares worth keeping before this hides
                      the rest - rule order/priority is what makes that work)
  8. Show          - Legendary Talismans/Charms (always kept regardless of
                      the above, since Talismans aren't build-specific)
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.loot_filter import codec
from app.loot_filter.data import AFFIX_IDS, GENERIC_SKILL_AFFIX_IDS, SKILL_AFFIX_IDS


@dataclass
class FilterResult:
    code: str
    unresolved_skills: list[str] = field(default_factory=list)
    resolved_affix_count: int = 0


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
            "Legendary Talismans", codec.SHOW,
            [codec.condition_rarity(codec.LEGENDARY_PLUS), codec.condition_item_types([codec.CHARM, codec.SEAL])],
        )
    )
    rules.append(
        codec.make_rule("Hide Junk", codec.HIDE_ALL, [codec.condition_rarity(codec.COMMON | codec.MAGIC | codec.RARE)])
    )
    if all_build_ids:
        rules.append(
            codec.make_rule(
                "Check Rare - Build Affix", codec.RECOLOR,
                [codec.condition_rarity(codec.RARE), codec.condition_affixes(all_build_ids, 1)],
                codec.COLOR_ORANGE,
            )
        )
    if len(core_ids) >= gold_threshold:
        rules.append(
            codec.make_rule(
                f"BiS Rare - {gold_threshold}+ Dmg Stats", codec.RECOLOR,
                [codec.condition_rarity(codec.RARE), codec.condition_affixes(core_ids, gold_threshold)],
                codec.COLOR_GOLD,
            )
        )
    rules.append(codec.make_rule("Codex Upgrade", codec.RECOLOR, [codec.condition_codex_upgrade()], codec.COLOR_GREEN))
    rules.append(codec.make_rule("Legendaries - Keep All", codec.RECOLOR, [codec.condition_rarity(codec.LEGENDARY_PLUS)], codec.COLOR_GREEN))
    rules.append(codec.make_rule("Greater Affix - Loot", codec.RECOLOR, [codec.condition_greater_affix(1)], codec.COLOR_CYAN))
    rules.append(codec.make_rule("Show All - Catch All", codec.SHOW, [codec.condition_rarity(codec.ALL_RARITIES)]))

    code = codec.make_filter(filter_name, rules)
    return FilterResult(code=code, unresolved_skills=unresolved_skills, resolved_affix_count=len(all_build_ids))
