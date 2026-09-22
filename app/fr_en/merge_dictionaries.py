"""Merges secondary FR<->EN dictionary crawls (kami-labs, d4base.fr, ...)
into app/data/fr_en_dictionary.json - the file dictionary.py and the
userscript's embedded FR_EN_DICTIONARY actually read from - keyed by
(fr, en, kind). Same EN term + kind seen with two DIFFERENT FR texts across
sources is a real disagreement, not just a duplicate, and is kept as a
SEPARATE entry rather than silently overwritten, since dictionary.py's
lookup is a substring scan (tolerates duplicates fine) and the userscript's
fallback path only ever uses the dictionary when the current page has no
better source, so an extra alternate spelling is harmless where blindly
dropping one that turns out to be the more common one would not be.

Run manually, after any of the build_dictionary_*.py crawlers, passing the
secondary file(s) to merge in:
    .venv\\Scripts\\python.exe -m app.fr_en.merge_dictionaries fr_en_dictionary_kamilabs.json
    .venv\\Scripts\\python.exe -m app.fr_en.merge_dictionaries fr_en_dictionary_d4base.json
(bare filenames resolve under app/data/; a full path also works.)
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
MAIN_PATH = DATA_DIR / "fr_en_dictionary.json"


def merge_one(main_data: dict, source_path: Path) -> int:
    source_data = json.loads(source_path.read_text(encoding="utf-8"))
    existing = main_data["entries"]
    existing_keys = {(e["fr"].strip().lower(), e["en"].strip().lower(), e["kind"]) for e in existing}

    added = 0
    for e in source_data["entries"]:
        key = (e["fr"].strip().lower(), e["en"].strip().lower(), e["kind"])
        if key in existing_keys:
            continue
        existing_keys.add(key)
        existing.append(e)
        added += 1

    print(f"  {source_path.name}: added {added} new / {len(source_data['entries'])} entries in that crawl")
    return added


def main() -> None:
    args = sys.argv[1:]
    if not args:
        raise SystemExit("Usage: python -m app.fr_en.merge_dictionaries <source1.json> [source2.json ...]")

    main_data = json.loads(MAIN_PATH.read_text(encoding="utf-8"))
    total_added = 0
    for arg in args:
        source_path = Path(arg)
        if not source_path.is_absolute() and not source_path.exists():
            source_path = DATA_DIR / arg
        total_added += merge_one(main_data, source_path)

    main_data["entries"].sort(key=lambda e: (e["kind"], e["fr"]))
    main_data["generated_at"] = datetime.now(timezone.utc).isoformat()
    MAIN_PATH.write_text(json.dumps(main_data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Total added: {total_added}. {MAIN_PATH} now has {len(main_data['entries'])} entries.")


if __name__ == "__main__":
    main()
