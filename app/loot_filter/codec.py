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
  varint          kind = 1;   (1=Rarity, 3=GreaterAffix, 4=Codex, 5=ItemType, 6=Affix)
  repeated fixed32 id  = 2;   (affix ids for kind=6, item-type ids for kind=5)
  varint          arg4 = 4;   (rarity bitmask for kind=1; codex flag for kind=4;
                                required-match-count for kind=6)
  varint          arg6 = 6;   (match count for kind=3 GreaterAffix; second codex flag for kind=4)
"""

from __future__ import annotations

import base64
import struct

SHOW, RECOLOR, HIDE_ALL = 0, 2, 3

COMMON, MAGIC, RARE, LEGENDARY, UNIQUE, MYTHIC, TALISMAN = 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40
LEGENDARY_PLUS = LEGENDARY | UNIQUE | MYTHIC | TALISMAN
ALL_RARITIES = 0x7F

CHARM = 0x00237E80
SEAL = 0x0022ED05


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
    return _field_bytes(4, _field_varint(1, 3) + _field_varint(6, count))


def condition_codex_upgrade() -> bytes:
    return _field_bytes(4, _field_varint(1, 4) + _field_varint(4, 1) + _field_varint(6, 1))


def condition_affixes(affix_ids: list[int], required_count: int) -> bytes:
    inner = _field_varint(1, 6)
    for affix_id in affix_ids:
        inner += _field_fixed32(2, affix_id)
    inner += _field_varint(4, required_count)
    return _field_bytes(4, inner)


def condition_item_types(type_ids: list[int]) -> bytes:
    inner = _field_varint(1, 5)
    for type_id in type_ids:
        inner += _field_fixed32(2, type_id)
    return _field_bytes(4, inner)


def make_rule(name: str, visibility: int, conditions: list[bytes], color: int = COLOR_DEFAULT) -> bytes:
    body = _field_string(1, name) + _field_varint(2, visibility) + _field_fixed32(3, color)
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
