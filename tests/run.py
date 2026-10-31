"""Tests HORS LIGNE des 6 scrapers : chacun tourne sur sa fixture, le resultat est compare a
tests/expected/<site>.json. Reseau interdit (httpx.get et Playwright sont remplaces).

  python -m tests.run            compare
  python -m tests.run --update   reecrit tests/expected/ (a RELIRE avant commit)
"""
import json
import sys
from contextlib import contextmanager
from dataclasses import asdict
from pathlib import Path

import httpx

from app.scrapers import d4builds, d4guides, infinitybuilds, kamilabs, maxroll, talion

ROOT = Path(__file__).resolve().parent
FIX, EXP = ROOT / "fixtures", ROOT / "expected"
CASES = {  # site -> (module, scraper, fichier de fixture)
    "maxroll": (maxroll, maxroll.MaxrollScraper, "page.html"),
    "d4builds": (d4builds, d4builds.D4BuildsScraper, "page.html"),
    "d4guides": (d4guides, d4guides.D4GuidesScraper, "api.json"),
    "kamilabs": (kamilabs, kamilabs.KamiLabsScraper, "api.json"),
    "talion": (talion, talion.TalionScraper, "api.json"),
    "infinitybuilds": (infinitybuilds, infinitybuilds.InfinityBuildsScraper, "dom_extract.json"),
}


class _Resp:
    def __init__(self, data: bytes):
        self.content, self.text = data, data.decode("utf-8")

    def raise_for_status(self):
        pass

    def json(self):
        return json.loads(self.text)



@contextmanager
def _offline(mod, fixture: Path):
    data = fixture.read_bytes()
    real_get, real_pw = httpx.get, getattr(mod, "sync_playwright", None)
    httpx.get = lambda *a, **k: _Resp(data)
    if real_pw:  # InfinityBuilds : le "navigateur" renvoie la liste DOM figee
        class _Page:
            def goto(s, *a, **k): pass
            def wait_for_selector(s, *a, **k): pass
            def wait_for_timeout(s, *a, **k): pass
            def eval_on_selector_all(s, *a, **k): return json.loads(data)
        class _Browser:
            def new_page(s): return _Page()
            def close(s): pass
        class _PW:
            chromium = type("C", (), {"launch": staticmethod(lambda *a, **k: _Browser())})
            def __enter__(s): return s
            def __exit__(s, *a): pass
        mod.sync_playwright = lambda: _PW()
    try:
        yield
    finally:
        httpx.get = real_get
        if real_pw:
            mod.sync_playwright = real_pw


def run_site(site: str) -> list[dict]:
    mod, cls, fname = CASES[site]
    with _offline(mod, FIX / site / fname):
        return [asdict(b) for b in cls()._fetch_all(15)]


def main() -> int:
    update, bad = "--update" in sys.argv, 0
    EXP.mkdir(exist_ok=True)
    for site, (_, _, fname) in CASES.items():
        if not (FIX / site / fname).exists():  # fixture trop lourde pour le depot public (kamilabs) : a regenerer par scripts/enregistrer_fixtures.py
            print(f"SKIP {site}: fixture absente")
            continue
        got = run_site(site)
        f = EXP / f"{site}.json"
        if update:
            f.write_text(json.dumps(got, indent=1, ensure_ascii=False), encoding="utf-8")
            print(f"{site}: {len(got)} builds ecrits")
            continue
        want = json.loads(f.read_text(encoding="utf-8"))
        ok = got == want and len(got) > 0
        bad += not ok
        print(f"{'OK  ' if ok else 'FAIL'} {site}: {len(got)} builds (attendu {len(want)})")
    print("VERT" if not bad else f"{bad} ECHEC(S)")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
