"""Local web app: small FastAPI server + static HTML/JS front-end.

Run with: .venv\\Scripts\\python.exe -m app.main
Then open http://127.0.0.1:8000 (done automatically on launch).
"""

from __future__ import annotations

import webbrowser
from pathlib import Path
from threading import Timer

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app.build_analysis import SUPPORTED_ON_DEMAND, fetch_build_details
from app.comparator import compare
from app.config import AVAILABLE_SEASONS, CURRENT_SEASON
from app.consensus import rank_builds
from app.infinitybuilds_match import find_matching_build
from app.kamilabs_match import find_matching_build as find_matching_kamilabs_build
from app.leaderboard import get_leaderboard, official_tier_list, search_runs
from app.loot_filter.data import AFFIX_IDS, CORE_STAT_GROUPS, GENERIC_SKILL_AFFIX_IDS, SKILL_AFFIX_IDS
from app.loot_filter.generator import generate_filter_code
from app.models import CLASS_IDS, CLASS_LABELS_FR

APP_DIR = Path(__file__).parent
HOST = "127.0.0.1"
PORT = 8000

app = FastAPI(title="Diablo IV Assistant - Comparateur de builds")

# The Tampermonkey userscript (userscript/diablo4-assistant.user.js) calls
# this server with plain fetch() from whatever build-guide site the user is
# actually on (maxroll.gg, d4builds.gg, ...) - a different origin every
# time, so the API has to allow all of them. Safe here: this server only
# ever binds to 127.0.0.1 (see main() below), never reachable off this
# machine, so there's no real cross-origin data to protect against.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.middleware("http")
async def allow_private_network_access(request, call_next):
    # Chrome's "Private Network Access" check is a separate gate on top of
    # CORS: even with allow_origins=["*"] above, an HTTPS site's plain
    # fetch() to 127.0.0.1 still gets blocked ("Permission was denied for
    # this request to access the `loopback` address space" - found while
    # testing the userscript against a real build page) unless this
    # response header is present. The userscript itself uses
    # GM_xmlhttpRequest, which isn't subject to this browser-level check at
    # all, but this is added anyway so a plain fetch() works too as a
    # fallback / for easier testing.
    response = await call_next(request)
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response


@app.get("/api/classes")
def get_classes():
    return [{"id": c, "label": CLASS_LABELS_FR[c]} for c in CLASS_IDS]


@app.get("/api/seasons")
def get_seasons():
    return [{"season": s, "label": f"Saison {s}" + (" (actuelle)" if s == CURRENT_SEASON else "")} for s in AVAILABLE_SEASONS]


@app.get("/api/compare")
def api_compare(game_class: str | None = None, keyword: str | None = None, season: int = CURRENT_SEASON):
    results = compare(game_class=game_class, keyword=keyword, season=season)
    return {source: [b.to_dict() for b in builds] for source, builds in results.items()}


@app.get("/api/consensus")
def api_consensus(game_class: str, keyword: str | None = None, season: int = CURRENT_SEASON):
    groups = rank_builds(game_class, keyword=keyword, season=season)
    return [g.to_dict() for g in groups]


@app.get("/api/leaderboard/search")
def api_leaderboard_search(game_class: str, skill: str):
    return search_runs(game_class, skill)


@app.get("/api/leaderboard/tierlist")
def api_leaderboard_tierlist(game_class: str):
    return official_tier_list(game_class)


@app.post("/api/leaderboard/refresh")
def api_leaderboard_refresh():
    runs = get_leaderboard(force_refresh=True)
    return {"runs_loaded": len(runs)}


@app.get("/api/analyze-build")
def api_analyze_build(source: str, url: str, external_id: str | None = None, external_class_id: int | None = None):
    if source not in SUPPORTED_ON_DEMAND:
        return {"supported": False, "skills": [], "items": []}
    details = fetch_build_details(source, url, external_id=external_id, external_class_id=external_class_id)
    if details is None:
        return {"supported": False, "skills": [], "items": []}
    return {"supported": True, "skills": details.skills, "items": details.items}


@app.get("/api/loot-filter/options")
def api_loot_filter_options(game_class: str):
    class_skills = SKILL_AFFIX_IDS.get(game_class, {})
    skills = [{"name": name, "confirmed": skill_id is not None} for name, skill_id in class_skills.items()]
    skills += [{"name": name, "confirmed": True} for name in GENERIC_SKILL_AFFIX_IDS]
    return {
        "stat_groups": CORE_STAT_GROUPS,
        "all_stats": sorted(AFFIX_IDS),
        "skills": skills,
    }


class LootFilterRequest(BaseModel):
    filter_name: str = "My Loot Filter"
    game_class: str
    core_stats: list[str] = []
    secondary_stats: list[str] = []
    skills: list[str] = []
    gold_threshold: int = 2


@app.post("/api/loot-filter/generate")
def api_loot_filter_generate(req: LootFilterRequest):
    result = generate_filter_code(
        filter_name=req.filter_name,
        game_class=req.game_class,
        core_stats=req.core_stats,
        secondary_stats=req.secondary_stats,
        skill_names=req.skills,
        gold_threshold=req.gold_threshold,
    )
    return {
        "code": result.code,
        "unresolved_skills": result.unresolved_skills,
        "resolved_affix_count": result.resolved_affix_count,
    }


@app.get("/api/tampermonkey/translate")
def api_tampermonkey_translate(title: str, game_class: str | None = None):
    """One-shot endpoint for the userscript: given a build's title (read
    straight off whichever site the user is browsing) and optionally its
    class, finds the equivalent build on InfinityBuilds, pulls its gear/
    skills, and generates a loot filter from just the skills (no stat
    priorities - the userscript has no UI for picking those, unlike the
    full generator on our own page).

    The filter itself is built from the ENGLISH skill names (that's what
    SKILL_AFFIX_IDS/AFFIX_IDS - app/loot_filter/data.py - are keyed on),
    but the response shows FRENCH names ("les thermes exats de Diablo IV"
    requested 2026-09-20): the user plays on the FR client, so an English
    skill/item name in the panel wouldn't actually mean anything in-game.
    A matching kami-labs build (French community-written, not machine
    translated) is surfaced too as a second opinion on terminology, when
    one is found."""
    match = find_matching_build(title, game_class)
    if match is None:
        return {"matched": False}

    resolved_class = match.game_class or game_class
    details = fetch_build_details("infinitybuilds", match.url)
    skills_en = details.skills if details else []
    skills_fr = details.skills_fr if details else []
    items_fr = details.items_fr if details else []

    filter_result = generate_filter_code(
        filter_name=match.title[:30],
        game_class=resolved_class or "",
        core_stats=[],
        secondary_stats=[],
        skill_names=skills_en,
    )

    kamilabs_match = find_matching_kamilabs_build(match.title, resolved_class)

    return {
        "matched": True,
        "matched_title": match.title,
        "matched_url": match.url,
        "game_class": resolved_class,
        "skills": skills_fr,
        "items": items_fr,
        "filter_code": filter_result.code,
        "unresolved_skills": filter_result.unresolved_skills,
        "kamilabs_title": kamilabs_match.title if kamilabs_match else None,
        "kamilabs_url": kamilabs_match.url if kamilabs_match else None,
    }


app.mount("/", StaticFiles(directory=APP_DIR / "static", html=True), name="static")


def _open_browser() -> None:
    webbrowser.open(f"http://{HOST}:{PORT}")


def main() -> None:
    Timer(1.0, _open_browser).start()
    uvicorn.run(app, host=HOST, port=PORT)


if __name__ == "__main__":
    main()
