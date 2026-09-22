"""Regenerates the FR_EN_DICTIONARY array literal embedded in
userscript/diablo4-assistant.user.js from app/data/fr_en_dictionary.json,
so growing the dictionary no longer means hand-editing that huge line.

Only touches the single line holding `const FR_EN_DICTIONARY = [...]`;
PARAGON_DICTIONARY stays separate and untouched (see that file's comment
for why).

Keeps `kind` alongside `fr`/`en` - findEmbeddedAspectPairs() in the
userscript filters candidates by kind (item/unique_item/unknown only) to
avoid matching a skill or Paragon name by coincidence. A first version of
this script dropped `kind`, which silently made that filter always false
(every embedded entry's kind read as undefined) - found 2026-09-21 testing
findEmbeddedAspectPairs() against the real embedded array and getting no
matches at all despite entries that should have matched.

Run with: .venv\\Scripts\\python.exe scripts\\sync_userscript_dictionary.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path

DICTIONARY_PATH = Path(__file__).parent.parent / "app" / "data" / "fr_en_dictionary.json"
USERSCRIPT_PATH = Path(__file__).parent.parent / "userscript" / "diablo4-assistant.user.js"

LINE_RE = re.compile(r"^(\s*const FR_EN_DICTIONARY = )\[.*\](;\s*)$")


def main() -> None:
    dictionary = json.loads(DICTIONARY_PATH.read_text(encoding="utf-8"))
    pairs = [{"fr": e["fr"], "en": e["en"], "kind": e.get("kind", "unknown")} for e in dictionary["entries"]]
    array_js = json.dumps(pairs, ensure_ascii=False, separators=(", ", ": "))

    lines = USERSCRIPT_PATH.read_text(encoding="utf-8").splitlines(keepends=True)
    for i, line in enumerate(lines):
        m = LINE_RE.match(line)
        if m:
            lines[i] = f"{m.group(1)}{array_js}{m.group(2)}"
            USERSCRIPT_PATH.write_text("".join(lines), encoding="utf-8")
            print(f"FR_EN_DICTIONARY line updated with {len(pairs)} entries")
            return

    raise SystemExit("Could not find 'const FR_EN_DICTIONARY = [...]' line in the userscript")


if __name__ == "__main__":
    main()
