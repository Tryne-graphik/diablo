"""Encoder for Diablo 4's native loot filter import format: a Protocol
Buffers message, base64-encoded, pasted directly into the game's
Loot Filter > Import screen. No wrapper, no header - just base64(bytes).

Ported line-for-line from the reverse-engineered JS reference,
Upsilon72/d4-filter-generator (https://github.com/Upsilon72/d4-filter-generator,
MIT-style credit: "Research and reverse-engineering by Upsilon72 with
Claude"). We didn't reverse-engineer this format ourselves - this module
is a Python port of their encoder so our own generated filters (see
generator.py) don't depend on a browser tool.

Message shapes (field numbers as found by Upsilon72's reverse-engineering,
not from any official schema):

Filter:
  repeated Rule rule = 1;   (each already length-delimited, just concatenated)
  string   name      = 2;
  varint   rule_count = 3;
  varint   unknown_flag = 4;   (always 1 in every observed export)

Rule:
  string  name       = 1;
  varint  visibility = 2;   (0=SHOW, 2=RECOLOR, 3=HIDE_ALL)
  fixed32 color      = 3;   (packed R|G<<8|B<<16|A<<24, little-endian bytes = RGBA)
  repeated Condition condition = 4;
  varint  unknown_flag = 5;   (always 1)

Condition (meaning of fields 4/6 depends on the condition `kind`, field 1):
  varint          kind = 1;   (0=ItemPowerRange, 1=Rarity, 2=ItemProperties/Ancestral,
                                3=Codex, 4=GreaterAffix, 5=ItemType, 6=RequiredAffixes,
                                7=OptionalAffixes, 8=SpecificUnique, 9=TalismanSetBonus)
  repeated fixed32 id  = 2;   (affix ids for kind=6/7, item-type ids for kind=5,
                                unique sno id for kind=8)
  varint          arg4 = 4;   (rarity bitmask for kind=1; item-properties mask for kind=2
                                - None=1, Ancestral=4; codex flag for kind=3;
                                greater-affix flag(always 1) for kind=4;
                                required-match-count for kind=6/7; item-power min for kind=0)
  varint          arg6 = 6;   (match count for kind=4 GreaterAffix; second codex flag
                                for kind=3)

2026-09-22 CORRECTION: kind 3 and 4 were swapped in every version of this file before
today (Codex was kind=4, GreaterAffix was kind=3 - a straight, uncaught port of
Upsilon72/d4-filter-generator's own numbering). Cross-checked against two independent
Season 13 reverse-engineering write-ups (a public gist by fnuecke, and
github.com/ThunderEagle/D4LootBench's docs/filter-format.md) which agree with each
other and, more convincingly, against a REAL filter a user pasted in - its kind=7
conditions carried valid affix ids from our own AFFIX_IDS table (matching the new
docs' "OptionalAffixes"), and its kind=2 conditions carried arg4=4 in 9 of 10 rules
(matching the new docs' "ItemProperties, Ancestral=4") - both meaningless/undefined
under Upsilon72's old numbering, both perfectly explained by the new one. Every filter
this project has ever generated therefore had its "Codex Upgrade" and "Greater Affix"
rules swapped in practice (green Codex-labeled rule was actually recoloring
GA items, cyan GA-labeled rule was actually flagging real Codex upgrades) - never
caught because both conditions happen to hit an overlapping, hard-to-visually-tell-
apart set of Legendary items. Not independently verified in-game by this project yet -
recommended next step is a tiny single-condition test filter, imported and visually
checked, same method Upsilon72's own README used for their affix ids.
"""

from __future__ import annotations

import base64
import struct

SHOW, RECOLOR, HIDE_ALL = 0, 2, 3

COMMON, MAGIC, RARE, LEGENDARY, UNIQUE, MYTHIC, TALISMAN = 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40
LEGENDARY_PLUS = LEGENDARY | UNIQUE | MYTHIC | TALISMAN
ALL_RARITIES = 0x7F

# 2026-09-22 CORRECTION: swapped (was CHARM=0x00237E80, SEAL=0x0022ED05) - the
# external ItemType table gives 0x0022ed05=Charm/0x00237e80=Horadric Seal, and a
# real user filter's rule literally named "Codex & Sceaux" (Codex & Seals) used
# 0x00237E80 for its ItemType condition, confirming which id is which. Harmless
# in practice everywhere both are passed together (e.g. "Legendary Talismans"),
# only matters if a Charm-only or Seal-only rule is ever built.
CHARM = 0x0022ED05
SEAL = 0x00237E80


def _encode_varint(value: int) -> bytes:
    out = bytearray()
    while True:
        byte = value & 0x7F
        value >>= 7
        if value:
            out.append(byte | 0x80)
        else:
            out.append(byte)
            return bytes(out)


def _field_varint(field_no: int, value: int) -> bytes:
    return _encode_varint((field_no << 3) | 0) + _encode_varint(value)


def _field_fixed32(field_no: int, value: int) -> bytes:
    return _encode_varint((field_no << 3) | 5) + struct.pack("<I", value & 0xFFFFFFFF)


def _field_bytes(field_no: int, data: bytes) -> bytes:
    return _encode_varint((field_no << 3) | 2) + _encode_varint(len(data)) + data


def _field_string(field_no: int, value: str) -> bytes:
    return _field_bytes(field_no, value.encode("utf-8"))


def make_color(r: int, g: int, b: int, a: int = 255) -> int:
    return ((a << 24) | (b << 16) | (g << 8) | r) & 0xFFFFFFFF


COLOR_DEFAULT = 0xFFFF0000
COLOR_CYAN = make_color(0, 255, 255)
COLOR_GREEN = make_color(0, 200, 0)
COLOR_ORANGE = make_color(255, 140, 0)
COLOR_GOLD = make_color(255, 215, 0)


def condition_rarity(mask: int) -> bytes:
    return _field_bytes(4, _field_varint(1, 1) + _field_varint(4, mask))


def condition_greater_affix(count: int) -> bytes:
    # kind=4 (was wrongly 3 - see module docstring's 2026-09-22 correction).
    return _field_bytes(4, _field_varint(1, 4) + _field_varint(4, 1) + _field_varint(6, count))


def condition_codex_upgrade() -> bytes:
    # kind=3 (was wrongly 4 - see module docstring's 2026-09-22 correction).
    return _field_bytes(4, _field_varint(1, 3) + _field_varint(6, 1))


def condition_affixes(affix_ids: list[int], required_count: int) -> bytes:
    inner = _field_varint(1, 6)
    for affix_id in affix_ids:
        inner += _field_fixed32(2, affix_id)
    inner += _field_varint(4, required_count)
    return _field_bytes(4, inner)


def condition_ancestral() -> bytes:
    """kind=2 (ItemProperties), arg4=4 (Ancestral bit) - new 2026-09-22, reverse-
    engineered from a real user filter (see module docstring)."""
    return _field_bytes(4, _field_varint(1, 2) + _field_varint(4, 4))


def condition_item_power_range(min_power: int, max_power: int | None = None) -> bytes:
    """kind=0 (ItemPowerRange), arg4=min, arg6=max (0 = no upper bound) - new
    2026-09-22, from the same two external write-ups as condition_ancestral()
    (not present in the one real filter sample, so unlike condition_ancestral()
    this has no independent corroboration yet - flagged as lower confidence)."""
    return _field_bytes(4, _field_varint(1, 0) + _field_varint(4, min_power) + _field_varint(6, max_power or 0))


def condition_item_types(type_ids: list[int]) -> bytes:
    inner = _field_varint(1, 5)
    for type_id in type_ids:
        inner += _field_fixed32(2, type_id)
    return _field_bytes(4, inner)


def condition_specific_unique(sno_ids: list[int]) -> bytes:
    """kind=8 (SpecificUnique), field2=repeated sno id - decoded from a real
    user filter (2026-09-22, their "Dance Of Knives" filter used this for 3
    slots with a single id each) and confirmed against the D4LootBench
    schema doc. `sno_ids` should be ALL known variant ids for one named
    unique (see app/loot_filter/uniques.py) - some uniques have multiple
    ids (seasonal reissues etc.), pooled the same way multi-subtype
    ItemType conditions already are elsewhere in this module."""
    inner = _field_varint(1, 8)
    for sno_id in sno_ids:
        inner += _field_fixed32(2, sno_id)
    return _field_bytes(4, inner)


def make_rule(name: str, visibility: int, conditions: list[bytes], color: int = COLOR_DEFAULT) -> bytes:
    # 2026-09-24: D4's in-game rule-name field shares the filter-name's real
    # 24-character cap (confirmed by decoding a user's own re-exported
    # filter - 2 rules with longer names had their name field completely
    # absent, silently dropped by the game on save). Truncate defensively
    # so no caller can hit this again.
    body = _field_string(1, (name or "")[:24]) + _field_varint(2, visibility) + _field_fixed32(3, color)
    for condition in conditions:
        body += condition
    body += _field_varint(5, 1)
    return _field_bytes(1, body)


def make_filter(name: str, rules: list[bytes]) -> str:
    """Returns the base64 import code for a filter made of `rules`
    (build each rule with make_rule(), highest priority LAST in the list -
    the game shows/evaluates them in the reverse of this order, matching
    Upsilon72's reference implementation)."""
    body = b"".join(rules)
    body += _field_string(2, name) + _field_varint(3, len(rules)) + _field_varint(4, 1)
    return base64.b64encode(body).decode("ascii")
