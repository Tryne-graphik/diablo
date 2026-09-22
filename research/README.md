# research/

Ad-hoc reverse-engineering data for the loot filter format, kept separate from
`app/` (the actual product code) since this is source material, not code that
runs as part of the tool.

## d4lootbench-data-2026-09-22.json — the authoritative source, use this first

Snapshot of `src/D4LootBench.Core/Data/d4-data.json` from
github.com/ThunderEagle/D4LootBench (fetched 2026-09-22). A maintained,
purpose-built database for this exact filter format: 294 affixes, 224 skills,
27 item types, each with a `hash` and, for most entries, a `snoName` - the
actual internal game-engine identifier (e.g. `S04_CritChance`,
`X2_SkillRankBonus_Warlock_Core_BlazingScream`) - about as close to ground
truth as this project can get without datamining the game directly. See
`docs/d4-data-format.md` in that repo (not mirrored here) for the schema.

**This resolved essentially everything the earlier diablofilter.com pass
left open**, and additionally caught real errors in data this project had
long trusted:
- All 216 previously-`None` `SKILL_AFFIX_IDS` entries across Barbarian,
  Druid, Necromancer, Rogue, Sorcerer, Spiritborn, Paladin - every class now
  has a full skill table (Paladin's was completely empty before).
- 13 of the 27 `itemTypes` entries confirmed our ids (Helm/Pants/Boots/etc,
  Charm/Horadric Seal) exactly; the rest filled in a full weapon-type
  taxonomy we didn't have (Sword, Two-Handed variants, Polearm, Wand, Staff,
  Scythe, Focus, Totem, Shield, Hand Crossbow).
- **Found genuine errors in the ORIGINAL Upsilon72-sourced data**, using
  `snoName` as the tiebreaker: Willpower/Attack Speed/Critical Strike
  Chance/Critical Strike Damage Multiplier/All Damage Multiplier had each
  other's ids (a shuffled cluster), Resource Cost Reduction was off by 2,
  `GENERIC_SKILL_AFFIX_IDS["All Skills"]` was actually Warlock's "Tyrant's
  Grasp" id, and 9 of Warlock's original 13 skill entries had each other's
  ids too. All fixed - see `app/loot_filter/data.py`'s module docstring for
  the full list. **Every filter this project generated for a Warlock build,
  or that used Willpower/Attack Speed/Crit Chance/Crit Damage/All Damage
  Multiplier as a priority stat, was targeting the wrong condition until
  this fix.**
- 3 `ItemType` ids (from the diablofilter.com pass, kind=5, very high
  frequency - 170-230 filters each) are STILL unresolved - not in
  D4LootBench's 27-entry list either, so probably not an equipment slot at
  all (a Sigil type, a UI sentinel, something else). Not investigated
  further.
- 3 `AFFIX_IDS` values D4LootBench doesn't have a `snoName` for weren't
  independently re-verified (still trusted from the original source, no
  reason found to doubt them).

**Confidence note**: still "a maintained third-party database with
engine-internal names as backing evidence," not this project's own
single-affix-export verification (the method used for Helm/Pants). If
anything generated from these ever looks wrong in-game, that's the fully
reliable fallback: a real single-condition test filter, built in-game and
decoded.

## app/loot_filter/uniques.py — built from this same source

`d4-data.json`'s `uniques` section (771 entries, 335 usable names after
filtering 2 debug/placeholder rows) became `app/loot_filter/uniques.py`
(and its userscript mirror): name -> all known SNO id variants, used by
`build_unique_item_rules()`/`buildUniqueItemRules()` to add a "Specific
Unique" (kind=8) SHOW rule for any named Unique found in a build's own
scraped equipment list. **Not exhaustive** - e.g. "Grief" isn't in this
source at all, so it's silently skipped like any other unmatched name.

## diablofilter-bulk-decode-2026-09-22.json + bulk_decode.py

Earlier pass (same day, before the D4LootBench find): bulk-decoded all 213
filters listed in diablofilter.com's `sitemap-filters.xml` (168 decoded
successfully). Each filter page embeds `window.__PRELOADED_FILTER__` JSON
with the base64 export `code` plus `class` and `skill_icon` metadata - far
more reliable than guessing from the URL slug. Used to find 6 ids by
cross-filter correlation before D4LootBench was found (now superseded/
confirmed by it) and to reconfirm the Codex/GreaterAffix and CHARM/SEAL kind-
swap fixes at much larger scale (168 independent real filters, not just one).
`bulk_decode.py` still works if useful for something else (e.g. checking how
many real filters use a given condition kind, or hunting for the 3 still-
unresolved ItemType ids by other means) - see its own docstring to rerun.
