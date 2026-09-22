"""One-off crawl: fetches every kami-labs.fr Diablo IV build page (all
classes, all seasons - glyph/board/item names don't change between
seasons, so old builds are still valid data for this) and caches the raw
HTML locally in app/data/kamilabs_cache/, so re-running the extraction
step later never needs to re-hit kami-labs' server.

Run with: .venv\\Scripts\\python.exe scripts\\crawl_kamilabs_icons.py
"""

from __future__ import annotations

import time
from pathlib import Path

import httpx
from bs4 import BeautifulSoup

AJAX_URL = "https://kami-labs.fr/wp-json/autoarticle/v1/d4/hub/builds-ajax"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; DiabloIVAssistant/0.1)"}
CACHE_DIR = Path(__file__).parent.parent / "app" / "data" / "kamilabs_cache"


def slug_from_url(url: str) -> str:
    return url.rstrip("/").rsplit("/", 1)[-1]


def main() -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    response = httpx.get(AJAX_URL, headers=HEADERS, timeout=20)
    response.raise_for_status()
    html = response.json()["builds_html"]
    soup = BeautifulSoup(html, "html.parser")

    urls: dict[str, str] = {}
    for card in soup.select("article.d4-hub-build-item"):
        link = card.select_one("a.build-link")
        if link and link.get("href"):
            urls[slug_from_url(link["href"])] = link["href"]

    print(f"{len(urls)} build pages found on kami-labs")

    fetched = 0
    skipped = 0
    failed = 0
    for i, (slug, url) in enumerate(urls.items(), 1):
        cache_path = CACHE_DIR / f"{slug}.html"
        if cache_path.exists():
            skipped += 1
            continue
        try:
            r = httpx.get(url, headers=HEADERS, timeout=20)
            r.raise_for_status()
            cache_path.write_text(r.text, encoding="utf-8")
            fetched += 1
        except Exception as e:  # noqa: BLE001 - best-effort crawl, keep going
            print(f"  FAILED {url}: {e}")
            failed += 1
        if i % 25 == 0:
            print(f"  ... {i}/{len(urls)} processed (fetched={fetched}, skipped={skipped}, failed={failed})")
        time.sleep(0.25)

    print(f"Done. fetched={fetched} skipped(cached)={skipped} failed={failed} total_cached={len(list(CACHE_DIR.glob('*.html')))}")


if __name__ == "__main__":
    main()
