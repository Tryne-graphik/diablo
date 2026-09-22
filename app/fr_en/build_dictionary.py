"""Batch job that (re)generates app/data/fr_en_dictionary.json.

Crawls every build currently listed on InfinityBuilds' curated tier list
(one browser session, one EN+FR page visit per build - about 25 builds as
of writing, so ~50 page loads) and derives FR<->EN name pairs for gear,
legendary aspects and skills using app.fr_en.extractor.

This is NOT run on every API request (too slow, ~2-3 minutes, and polite
to InfinityBuilds' servers) - run it manually to refresh the dictionary:

    .venv\\Scripts\\python.exe -m app.fr_en.build_dictionary

Known limitation: only covers the vocabulary of the ~25 tier-list builds,
so it's a starting dictionary, not exhaustive - it grows as more builds
are crawled (a future version could crawl kami-labs' full build list
translated the other way, or accept manual additions).
"""

from __future__ import annotations

import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

from app.fr_en.extractor import GEAR_JS, SKILLS_JS, extract_pairs
from app.models import CLASS_LABELS_FR
from app.scrapers.infinitybuilds import InfinityBuildsScraper

OUTPUT_PATH = Path(__file__).parent.parent / "data" / "fr_en_dictionary.json"


def _slug_from_url(url: str) -> str:
    return url.rstrip("/").rsplit("/", 1)[-1]


def _fetch_locale_data(page, slug: str, locale: str) -> tuple[list[list[str]], list[str]]:
    page.goto(f"https://infinitybuilds.gg/{locale}/builds/{slug}", wait_until="load", timeout=45000)
    page.wait_for_timeout(1500)
    gear_raw = page.evaluate(GEAR_JS)
    skills_raw = page.evaluate(SKILLS_JS)
    return gear_raw, skills_raw


def build() -> dict:
    tier_list_builds = InfinityBuildsScraper().get_all_builds()
    slugs = sorted({_slug_from_url(b.url) for b in tier_list_builds})

    # (fr, en, kind) -> how many builds agreed on this pair, to surface
    # any disagreement (same FR text mapped to two different EN texts).
    counts: Counter[tuple[str, str, str]] = Counter()
    failures: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            page = browser.new_page()
            for slug in slugs:
                try:
                    en_gear, en_skills = _fetch_locale_data(page, slug, "en")
                    fr_gear, fr_skills = _fetch_locale_data(page, slug, "fr")
                except Exception as exc:  # noqa: BLE001 - one bad build shouldn't kill the batch
                    failures.append(f"{slug}: {exc}")
                    continue

                for en, fr, kind in extract_pairs(en_gear, fr_gear, en_skills, fr_skills):
                    counts[(fr, en, kind)] += 1
        finally:
            browser.close()

    entries = [
        {"fr": fr, "en": en, "kind": kind, "seen_in": n}
        for (fr, en, kind), n in sorted(counts.items())
    ]
    for class_id, label_fr in CLASS_LABELS_FR.items():
        entries.append({"fr": label_fr, "en": class_id, "kind": "class", "seen_in": 1})

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "builds_crawled": len(slugs),
        "failures": failures,
        "entries": entries,
    }


def main() -> None:
    data = build()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(data['entries'])} entries from {data['builds_crawled']} builds -> {OUTPUT_PATH}")
    if data["failures"]:
        print(f"{len(data['failures'])} builds failed:", *data["failures"], sep="\n  ")


if __name__ == "__main__":
    main()
