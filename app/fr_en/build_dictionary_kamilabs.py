"""Batch job that crawls kami-labs.fr's full build archive (~400 builds,
every season since S5) to extract FR<->EN name pairs for gear/aspects/
skills, merged into app/data/fr_en_dictionary.json alongside the existing
InfinityBuilds crawl (app/fr_en/build_dictionary.py).

2026-09-22: added specifically to close the translation coverage gap found
that day (only 67% of Unique items / 22% of skills had a FR translation,
since the InfinityBuilds crawl only covers its ~25 curated tier-list
builds). kami-labs has ~400 builds across every season, so a much wider
vocabulary - and, unlike InfinityBuilds, needs no browser automation at
all: kami-labs server-renders the build id in the page HTML
(`id="esrd-equipment-iframe" ... data-build-id="BUILD-XXXXX"`), and its
`equipment-grid.html?embed=1` embed returns a `window.ESRD_STATE_V3` JSON
blob with EN+FR names ALREADY paired per field (`name_en`/`name_fr` for
skills, `name`/`nameFr` for items, `aspectName`/`aspectNameFr` for
Legendary aspects) - no positional DOM-matching fragility like
extractor.py needs for InfinityBuilds, just a couple of httpx GETs per
build. Runs concurrently (bounded) rather than one page at a time.

Run manually:
    .venv\\Scripts\\python.exe -m app.fr_en.build_dictionary_kamilabs

Writes app/data/fr_en_dictionary_kamilabs.json standalone (NOT merged into
the main fr_en_dictionary.json automatically - see merge_dictionaries.py
to combine the two into the file the userscript/API actually reads).
"""

from __future__ import annotations

import asyncio
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import httpx

AJAX_URL = "https://kami-labs.fr/wp-json/autoarticle/v1/d4/hub/builds-ajax"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; DiabloIVAssistant/0.1)"}
OUTPUT_PATH = Path(__file__).parent.parent / "data" / "fr_en_dictionary_kamilabs.json"

BUILD_LINK_RE = re.compile(
    r'<a href="(https://kami-labs\.fr/diablo-4/builds/[^"]+)"[^>]*class="build-link"'
)
BUILD_ID_RE = re.compile(r'id="esrd-equipment-iframe"[^>]*data-build-id="([^"]+)"')

CONCURRENCY = 8


async def fetch_build_urls(client: httpx.AsyncClient) -> list[str]:
    resp = await client.get(AJAX_URL, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    html = resp.json()["builds_html"]
    return sorted(set(BUILD_LINK_RE.findall(html)))


async def fetch_build_id(client: httpx.AsyncClient, build_url: str) -> str | None:
    resp = await client.get(build_url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    m = BUILD_ID_RE.search(resp.text)
    return m.group(1) if m else None


def _extract_state_json(html: str) -> dict | None:
    idx = html.find("window.ESRD_STATE_V3")
    if idx == -1:
        return None
    start = html.find("{", idx)
    if start == -1:
        return None
    decoder = json.JSONDecoder()
    try:
        obj, _ = decoder.raw_decode(html, start)
    except json.JSONDecodeError:
        return None
    return obj


async def fetch_pairs_for_build(client: httpx.AsyncClient, build_id: str) -> list[tuple[str, str, str]]:
    url = f"https://kami-labs.fr/wp-content/uploads/d4-builds/{build_id}/equipment-grid.html?embed=1"
    resp = await client.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    state = _extract_state_json(resp.text)
    if not state or not state.get("steps"):
        return []
    step = state["steps"][-1]  # most endgame-complete variant, same convention as the userscript

    pairs: list[tuple[str, str, str]] = []
    for s in step.get("skills") or []:
        en, fr = (s or {}).get("name_en"), (s or {}).get("name_fr")
        if en and fr and en != fr:
            pairs.append((en, fr, "skill"))

    for slot in (step.get("slots") or {}).values():
        if not slot:
            continue
        en, fr = slot.get("name"), slot.get("nameFr")
        if en and fr and en != fr:
            pairs.append((en, fr, "item"))
        a_en, a_fr = slot.get("aspectName"), slot.get("aspectNameFr")
        if a_en and a_fr and a_en != a_fr:
            pairs.append((a_en, a_fr, "item"))

    return pairs


async def crawl_one(client: httpx.AsyncClient, sem: asyncio.Semaphore, build_url: str, counts: Counter, failures: list[str]) -> None:
    async with sem:
        try:
            build_id = await fetch_build_id(client, build_url)
            if not build_id:
                failures.append(f"{build_url}: no build id found")
                return
            for en, fr, kind in await fetch_pairs_for_build(client, build_id):
                counts[(fr, en, kind)] += 1
        except Exception as exc:  # noqa: BLE001 - one bad build shouldn't kill the batch
            failures.append(f"{build_url}: {exc}")


async def build() -> dict:
    counts: Counter[tuple[str, str, str]] = Counter()
    failures: list[str] = []
    sem = asyncio.Semaphore(CONCURRENCY)

    async with httpx.AsyncClient() as client:
        urls = await fetch_build_urls(client)
        await asyncio.gather(*(crawl_one(client, sem, url, counts, failures) for url in urls))

    entries = [
        {"fr": fr, "en": en, "kind": kind, "seen_in": n, "source": "kamilabs"}
        for (fr, en, kind), n in sorted(counts.items())
    ]
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "builds_crawled": len(urls),
        "failures": failures,
        "entries": entries,
    }


def main() -> None:
    data = asyncio.run(build())
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(data['entries'])} entries from {data['builds_crawled']} builds -> {OUTPUT_PATH}")
    if data["failures"]:
        print(f"{len(data['failures'])} builds failed (first 10):", *data["failures"][:10], sep="\n  ")


if __name__ == "__main__":
    main()
