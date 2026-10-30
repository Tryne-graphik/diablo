"""Inventaire des doublons Assistant / Calculateur PAR CONTENU (lecture seule).

  python -m scripts.inventaire_doublons [--calc CHEMIN] [--out rapport.md]

Compare : A) dictionnaires FR/EN, B) ids d'affixes, C) URLs lues par site_builds vs scrapers.
Cles communes / en conflit (meme cle, valeurs sans recouvrement) / propres a chaque cote.
Ecrit un .md + un .json (le json sert au test de la fusion). N'ecrit rien d'autre.
"""
import argparse
import importlib.util
import json
import re
import unicodedata
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
CALC = Path(r"G:\DevProject\DiabloIV-DPS-Calculator")


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s).lower().replace("\u2019", "'"))
    return re.sub(r"\s+", " ", "".join(c for c in s if not unicodedata.combining(c))).strip()


def jload(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


def diff(a: dict, b: dict) -> dict:
    """a, b : cle -> ensemble de valeurs normalisees."""
    common = a.keys() & b.keys()
    conflicts = {k: {"assistant": sorted(a[k]), "calc": sorted(b[k])} for k in common if not (a[k] & b[k])}
    partial = {k: {"assistant": sorted(a[k]), "calc": sorted(b[k])} for k in common if a[k] != b[k] and a[k] & b[k]}
    return {"n_assistant": len(a), "n_calc": len(b), "communes": len(common),
            "conflits": conflicts, "partiels": partial,
            "propres_assistant": sorted(a.keys() - b.keys()), "propres_calc": sorted(b.keys() - a.keys())}


def dict_assistant():
    """Toutes les sources app/data/fr_en_dictionary*.json -> {en_norm: {fr_norm}}."""
    en2fr, fr_names, en_names, ncell = {}, set(), set(), 0
    for f in sorted((HERE / "app" / "data").glob("fr_en_dictionary*.json")):
        for e in jload(f)["entries"]:
            en, fr = e.get("en"), e.get("fr")
            if not en or not fr:
                continue
            ncell += 1
            en2fr.setdefault(norm(en), set()).add(norm(fr))
            fr_names.add(norm(fr))
            en_names.add(norm(en))
    return en2fr, fr_names, en_names, ncell


def section_dicts(calc: Path) -> dict:
    a_en2fr, a_fr, a_en, ncell = dict_assistant()
    intra = {k: sorted(v) for k, v in a_en2fr.items() if len(v) > 1}
    c_en2fr = {}
    for r in jload(calc / "data" / "affixes_en_fr.json"):
        c_en2fr.setdefault(norm(r["en"]), set()).add(norm(r["fr"]))
    items = jload(calc / "data" / "item_names_fr.json")
    names = {norm(x) for x in items["items"]}
    desc = {norm(x) for x in items["descriptors"]}
    return {"affixes_en_fr": diff(a_en2fr, c_en2fr), "assistant_entrees": ncell, "assistant_cles_multi_fr": intra,
            "item_names_fr": {"note": "listes de NOMS sans paires EN/FR : pas de conflit possible, seulement recouvrement",
                              "items": len(names), "descriptors": len(desc),
                              "items_dans_assistant_fr": len(names & a_fr), "items_dans_assistant_en": len(names & a_en),
                              "items_hors_assistant": len(names - a_fr - a_en),
                              "descriptors_dans_assistant": len(desc & (a_fr | a_en))}}


def section_ids(calc: Path) -> dict:
    spec = importlib.util.spec_from_file_location("lf_data", HERE / "app" / "loot_filter" / "data.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    a = {}  # id -> {noms}
    tables = [m.AFFIX_IDS, m.GENERIC_SKILL_AFFIX_IDS, *m.SKILL_AFFIX_IDS.values()]
    for t in tables:
        for n, i in t.items():
            if i is not None:
                a.setdefault(str(i), set()).add(norm(n))
    c = {}
    for r in jload(calc / "data" / "affixes_en_fr.json"):
        for i in r["id_sno"].split(";"):
            c.setdefault(str(int(i)), set()).add(norm(r["en"]))
    mx = {str(v["id"]) for v in jload(calc / "data" / "cache" / "maxroll_data.min.json")["affixes"].values()
          if isinstance(v, dict) and "id" in v}
    return {"assistant_vs_calc_affixes_en_fr": diff(a, c),
            "assistant_ids_total": len(a), "assistant_ids_dans_maxroll": len(set(a) & mx),
            "assistant_ids_absents_maxroll": sorted(hex(int(i)) for i in set(a) - mx), "maxroll_ids_total": len(mx)}


def section_sources(calc: Path) -> dict:
    idx = (calc / "tests" / "fixtures" / "http" / "index.txt").read_text(encoding="utf-8").splitlines()
    calc_urls = {l.split("\t")[1].split("?")[0].rstrip("/") for l in idx if "\t" in l}
    out = {"calc_urls_figees": len(calc_urls), "sites": {}}
    for f in sorted((HERE / "tests" / "expected").glob("*.json")):
        urls = {b["url"].split("?")[0].rstrip("/") for b in jload(f)}
        out["sites"][f.stem] = {"urls_assistant": len(urls), "communes_avec_calc": sorted(urls & calc_urls)}
    out["note"] = ("Le Calc lit des PAGES DE BUILD (affixes chiffrees, planners) ; les scrapers Assistant lisent des "
                   "LISTES (tier list) : niveau de donnees different, aucune cle commune sauf l'URL.")
    return out


def md(r: dict) -> str:
    d = r["dictionnaires"]
    a = d["affixes_en_fr"]
    L = ["# Inventaire des doublons (par contenu)", "", "## A. Dictionnaires FR/EN",
         f"- Assistant : {d['assistant_entrees']} entrees ({a['n_assistant']} cles EN uniques).",
         f"- Calc affixes_en_fr : {a['n_calc']} cles EN uniques.",
         f"- Cles communes : {a['communes']} ; **conflits (aucune traduction FR en commun) : {len(a['conflits'])}** ; "
         f"partiels (FR differents mais recouvrement) : {len(a['partiels'])}.",
         f"- Propres Assistant : {len(a['propres_assistant'])} ; propres Calc : {len(a['propres_calc'])}.",
         f"- Cles EN a plusieurs FR DANS l'Assistant seul : {len(d['assistant_cles_multi_fr'])}.",
         f"- item_names_fr : {json.dumps(d['item_names_fr'], ensure_ascii=False)}", ""]
    L += [f"  - conflit `{k}` : assistant={v['assistant']} / calc={v['calc']}" for k, v in list(a["conflits"].items())[:15]]
    s = r["ids_affixes"]
    b = s["assistant_vs_calc_affixes_en_fr"]
    L += ["", "## B. Ids d'affixes (Assistant loot_filter/data.py vs Calc/Maxroll)",
          f"- Ids Assistant : {s['assistant_ids_total']} ; presents dans les ids Maxroll ({s['maxroll_ids_total']}) : {s['assistant_ids_dans_maxroll']}.",
          f"- Ids communs Assistant/Calc affixes_en_fr : {b['communes']} ; **conflits (meme id, noms sans recouvrement) : {len(b['conflits'])}** "
          f"(partiels : {len(b['partiels'])}) ; propres Assistant {len(b['propres_assistant'])} / propres Calc {len(b['propres_calc'])}.",
          f"- Ids Assistant absents de Maxroll (20 premiers) : {s['assistant_ids_absents_maxroll'][:20]}", ""]
    L += [f"  - id {k} : assistant={v['assistant']} / calc={v['calc']}" for k, v in list(b["conflits"].items())[:15]]
    c = r["sources"]
    L += ["", "## C. Lecture des sites", f"- {c['note']}"]
    L += [f"- {k} : {v['urls_assistant']} URLs, communes avec les pages figees du Calc : {v['communes_avec_calc']}"
          for k, v in c["sites"].items()]
    return "\n".join(L) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--calc", default=str(CALC))
    ap.add_argument("--out", default=str(HERE / "tests" / "RAPPORT_DOUBLONS.md"))
    ns = ap.parse_args()
    calc = Path(ns.calc)
    r = {"dictionnaires": section_dicts(calc), "ids_affixes": section_ids(calc), "sources": section_sources(calc)}
    out = Path(ns.out)
    out.write_text(md(r), encoding="utf-8")
    out.with_suffix(".json").write_text(json.dumps(r, indent=1, ensure_ascii=False), encoding="utf-8")
    print(md(r))


if __name__ == "__main__":
    main()
