"""Scraper for infinitybuilds.gg's curated endgame tier list.

Unlike kami-labs, the page has no JSON/REST endpoint - the tier list is
rendered client-side (Next.js/React), so a real browser (Playwright) is
needed to get the final DOM. There are far fewer builds here (curated by
the "INF" team, ~25 at a time) than on kami-labs (~400), which is exactly
why the user wants both sources compared rather than relying on this one.

Known limitation: the class isn't always in the build's URL slug (some
builds use an opaque short id, e.g. "/en/builds/_6EfxV8ono"). When it can't
be detected this way, game_class is left as None rather than guessed - a
build page visit per build would be needed to always know the class, which
is out of scope for this first version.

No per-build season field here either, and none needed: like Maxroll and
d4builds, this is the site's single live "endgame" tier list for the
current season, not an archive (spot-checked two builds' detail pages -
both showed "S15", not older seasons mixed in).
"""

from __future__ import annotations

from playwright.sync_api import sync_playwright

from app.models import CLASS_IDS, BuildResult
from app.scrapers.base import Scraper

TIER_LIST_URL = "https://infinitybuilds.gg/en/tier-list/endgame"
BASE_URL = "https://infinitybuilds.gg"

_EXTRACT_JS = """els => els.map(e => {
    const section = e.closest('section[aria-label]');
    const label = section ? section.getAttribute('aria-label') : '';
    const tierMatch = label.match(/Tier (\\w+)/i);
    const nameEl = e.querySelector('span, div') || e;
    return {
        href: e.getAttribute('href'),
        tier: tierMatch ? tierMatch[1] : null,
        title: e.innerText.split(String.fromCharCode(10))[0] || e.innerText,
    };
})"""


def _detect_class(slug: str) -> str | None:
    slug_lower = slug.lower()
    for class_id in CLASS_IDS:
        if class_id in slug_lower:
            return class_id
    return None


class InfinityBuildsScraper(Scraper):
    name = "infinitybuilds"

    def _fetch_all(self, season: int) -> list[BuildResult]:  # noqa: ARG002 - single live page, no history
        with sync_playwright() as p:
            browser = p.chromium.launch()
            try:
                page = browser.new_page()
                page.goto(TIER_LIST_URL, wait_until="load", timeout=45000)
                page.wait_for_selector("a[href*='/builds/']", timeout=15000)
                page.wait_for_timeout(1500)  # let tier sections finish hydrating
                raw = page.eval_on_selector_all(
                    "a[href*='/builds/']:not([href='/en/builds/new'])",
                    _EXTRACT_JS,
                )
            finally:
                browser.close()

        results: list[BuildResult] = []
        seen_urls: set[str] = set()
        for item in raw:
            href = item.get("href") or ""
            if not href or href in seen_urls:
                continue
            seen_urls.add(href)

            slug = href.rsplit("/", 1)[-1]
            results.append(
                BuildResult(
                    source=self.name,
                    title=(item.get("title") or slug).strip(),
                    url=BASE_URL + href,
                    game_class=_detect_class(slug),
                    tier=(item.get("tier") or "").upper() or None,
                    season=None,
                    tags=[],
                    author=None,
                )
            )
        return results
