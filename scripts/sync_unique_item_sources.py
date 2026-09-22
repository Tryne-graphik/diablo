"""Embeds app/data/unique_item_sources.json (built by
build_talion_uniques_dictionary.py) into userscript/diablo4-assistant.user.js
as UNIQUE_ITEM_SOURCES, for the "hover an item name to see where it drops"
feature. Boss slugs are translated to the French labels talion.tv itself
uses in its admin filter dropdown (read straight out of their Angular
bundle - see HISTORIQUE.md, 2026-09-21).

Run with: .venv\\Scripts\\python.exe scripts\\sync_unique_item_sources.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path

SOURCES_PATH = Path(__file__).parent.parent / "app" / "data" / "unique_item_sources.json"
USERSCRIPT_PATH = Path(__file__).parent.parent / "userscript" / "diablo4-assistant.user.js"

BOSS_LABELS_FR = {
    "all": "Butin monde (n'importe quel boss/activité)",
    "andarielle": "Andariel",
    "astaroth": "Astaroth",
    "bartuc": "Bartuc",
    "butcher": "Le Boucher",
    "duriel": "Duriel",
    "grigoire": "Grigoire",
    "harbinger": "Messager de la Haine",
    "ice-beast": "Bête dans la glace",
    "urivar": "Urivar",
    "varshan": "Varshan",
    "zir": "Zir",
}

LINE_RE = re.compile(r"^(\s*const UNIQUE_ITEM_SOURCES = )\{.*\}(;\s*)$")


def main() -> None:
    sources = json.loads(SOURCES_PATH.read_text(encoding="utf-8"))

    out: dict[str, dict] = {}
    unknown_bosses: set[str] = set()
    for en_name, info in sources.items():
        boss_fr = []
        for slug in info.get("boss") or []:
            label = BOSS_LABELS_FR.get(slug)
            if label is None:
                unknown_bosses.add(slug)
                label = slug
            boss_fr.append(label)
        out[en_name] = {"bossFr": boss_fr, "uber": bool(info.get("uber"))}

    if unknown_bosses:
        print(f"Warning: unrecognized boss slug(s), used as-is: {sorted(unknown_bosses)}")

    array_js = json.dumps(out, ensure_ascii=False, separators=(", ", ": "))

    lines = USERSCRIPT_PATH.read_text(encoding="utf-8").splitlines(keepends=True)
    for i, line in enumerate(lines):
        m = LINE_RE.match(line)
        if m:
            lines[i] = f"{m.group(1)}{array_js}{m.group(2)}"
            USERSCRIPT_PATH.write_text("".join(lines), encoding="utf-8")
            print(f"UNIQUE_ITEM_SOURCES line updated with {len(out)} entries")
            return

    raise SystemExit("Could not find 'const UNIQUE_ITEM_SOURCES = {...}' line in the userscript - add the declaration first")


if __name__ == "__main__":
    main()
