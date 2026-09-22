"""Derives FR<->EN name pairs (gear/aspects and skills) from a single
InfinityBuilds build page fetched in both locales.

Why DOM-scoped extraction, not a whole-page text diff: an earlier version
zipped the two locales' full-page `innerText` line by line, relying on
both languages producing the exact same number of lines. That breaks as
soon as a build has an author-written overview/notes paragraph, because a
translated sentence can split into a different number of text nodes than
the original - which silently shifts every line after it by one, pairing
the wrong strings together (found by cross-checking a real build: "Aspect
of Falling Feathers" ended up paired with an empty string). Scoping
extraction to specific, repeated UI components (one query per gear slot,
one query for the skills block) sidesteps this entirely: each component is
self-contained, so a paragraph elsewhere on the page can never desync it.

`extract_gear_page_data` / `extract_skills_page_data` run *inside the
browser* (see build_dictionary.py) and return plain lists per locale;
`extract_pairs` below is the pure, browser-free pairing logic so it can be
tested against fixture data.
"""

from __future__ import annotations

import re

# À-Ÿ covers accented uppercase Latin letters (É, È, Ô, ...) - without this
# range, a French header like "SPÉCIALISATION" doesn't match, so the skill
# block never stops there and swallows the next tab's contents too (found
# 2026-09-20 testing the Tampermonkey FR display: the English page's
# header, "SPECIALIZATION", has no accents and always matched fine, which
# is why this went unnoticed until FR extraction was used for something
# other than the dictionary's positional zip, which silently truncated to
# the shorter EN list and hid the tail).
HEADER_RE = re.compile(r"^[A-ZÀ-Ÿ0-9 '\-]{2,25}$")

# Run inside the page via page.evaluate(). One tile per gear slot
# (".gear-paperdoll-tile"); a tile's raw text lines are always
# [SLOT_LABEL, "", ITEM_NAME, "", ITEM_TYPE] when a named item/aspect is
# shown, or shorter when the slot only shows a type restriction (nothing
# equipped/named) - see build_dictionary.py's GEAR_JS docstring for a
# real example of both shapes.
GEAR_JS = """() => {
    const tiles = Array.from(document.querySelectorAll('.gear-paperdoll-tile'));
    return tiles.map(t => t.innerText.split(String.fromCharCode(10)));
}"""

# The skills block header shares one exact Tailwind class with exactly one
# other tab header ("Spirit Hall", Spiritborn-only) - taking the FIRST
# match is language-independent (no need to know the translated word for
# "Skills") and stable across the two builds tested.
SKILLS_JS = """() => {
    const cls = "text-[10px] font-semibold uppercase tracking-wider text-[#b7b0a6]";
    const header = Array.from(document.querySelectorAll('p')).find(e => e.className === cls);
    if (!header) return [];
    let node = header;
    for (let i = 0; i < 3; i++) node = node.parentElement;
    return node.innerText.split(String.fromCharCode(10));
}"""


def _gear_names(tiles_raw: list[list[str]]) -> list[str | None]:
    names = []
    for lines in tiles_raw:
        if len(lines) >= 5 and lines[1] == "" and lines[3] == "" and lines[2]:
            names.append(lines[2])
        else:
            names.append(None)
    return names


def _skill_names(block_lines: list[str]) -> list[str]:
    names = []
    # lines[0] is the header itself ("SKILLS"/"COMPÉTENCES"), lines[1] blank.
    for line in block_lines[2:]:
        text = line.strip()
        if text == "" or text.isdigit():
            continue
        if HEADER_RE.match(text):
            break  # reached the next tab section (e.g. "SPIRIT HALL")
        names.append(text)
    return names


def extract_pairs(
    en_gear_raw: list[list[str]],
    fr_gear_raw: list[list[str]],
    en_skills_raw: list[str],
    fr_skills_raw: list[str],
) -> list[tuple[str, str, str]]:
    """Returns (english, french, kind) triples, kind being "item" or "skill".

    Identical-string pairs are dropped (untranslated names - a real quirk
    observed on the site, e.g. a companion name left in English on the FR
    page).
    """
    pairs: list[tuple[str, str, str]] = []

    en_items = _gear_names(en_gear_raw)
    fr_items = _gear_names(fr_gear_raw)
    for en_name, fr_name in zip(en_items, fr_items):
        if en_name and fr_name and en_name != fr_name:
            pairs.append((en_name, fr_name, "item"))

    en_skills = _skill_names(en_skills_raw)
    fr_skills = _skill_names(fr_skills_raw)
    for en_name, fr_name in zip(en_skills, fr_skills):
        if en_name and fr_name and en_name != fr_name:
            pairs.append((en_name, fr_name, "skill"))

    return pairs
