"""Loads app/data/fr_en_dictionary.json (built by build_dictionary.py) and
exposes keyword translation used to let a search work in either language.

Matching is accent-insensitive ("fleches" must match "Flèches") since users
type French search terms without bothering with accents.
"""

from __future__ import annotations

import json
import unicodedata
from functools import lru_cache
from pathlib import Path

DICTIONARY_PATH = Path(__file__).parent.parent / "data" / "fr_en_dictionary.json"


def _fold(text: str) -> str:
    """Lowercase and strip accents, e.g. "Flèches" -> "fleches"."""
    decomposed = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in decomposed if not unicodedata.combining(c))


@lru_cache
def _entries() -> list[dict]:
    if not DICTIONARY_PATH.exists():
        return []
    return json.loads(DICTIONARY_PATH.read_text(encoding="utf-8"))["entries"]


def translate_keyword(keyword: str) -> list[str]:
    """Given a free-text keyword, returns dictionary names in the *other*
    language wherever the keyword matches a known FR or EN entry - so
    typing a French skill name also finds English-only sources and vice
    versa. Case/accent-insensitive."""
    kw = _fold(keyword)
    if not kw:
        return []
    matches: set[str] = set()
    for entry in _entries():
        if kw in _fold(entry["fr"]):
            matches.add(entry["en"])
        if kw in _fold(entry["en"]):
            matches.add(entry["fr"])
    return sorted(matches)
