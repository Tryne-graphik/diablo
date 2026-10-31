"""Dictionnaire FR/EN unifie, avec un champ `forme` (decision 2026-10-31).

  python -m scripts.fusion_dictionnaires [--calc CHEMIN]

Ecrit app/data/dictionnaire_unifie.json : une entree par (en, fr, forme) ; forme = "libelle" (Assistant :
noms d'objets, competences, classes...) ou "fragment" (Calc : bout de phrase d'affixe, "de ...", "a la ...").
N'ecrit RIEN d'autre : les dictionnaires et leurs consommateurs ne sont pas modifies. Verifie 0 perte de paire.
"""
import argparse
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
CALC = Path(r"G:\DevProject\DiabloIV-DPS-Calculator")
OUT = HERE / "app" / "data" / "dictionnaire_unifie.json"


def jload(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--calc", default=str(CALC))
    calc = Path(ap.parse_args().calc)

    sources = []  # (forme, [(en, fr, extra)])
    for f in sorted((HERE / "app" / "data").glob("fr_en_dictionary*.json")):
        for e in jload(f).get("entries", []):
            sources.append(("libelle", e["en"], e["fr"], {"kind": e.get("kind", "unknown"), "source": e.get("source", f.stem)}))
    for e in jload(calc / "data" / "affixes_en_fr.json"):
        sources.append(("fragment", e["en"], e["fr"], {"kind": "affix", "id_sno": e.get("id_sno", ""), "source": "calc"}))

    uni = {}
    for forme, en, fr, extra in sources:
        k = (forme, en.strip().lower(), fr.strip().lower())
        cur = uni.setdefault(k, {"en": en.strip(), "fr": fr.strip(), "forme": forme, "kind": extra["kind"], "sources": []})
        if extra["source"] not in cur["sources"]:
            cur["sources"].append(extra["source"])
        if extra.get("id_sno"):
            cur["id_sno"] = extra["id_sno"]

    entries = sorted(uni.values(), key=lambda e: (e["en"].lower(), e["forme"]))
    # controle : aucune paire (forme, en, fr) de la source ne manque
    manque = {(f, e.strip().lower(), r.strip().lower()) for f, e, r, _ in sources} - set(uni)
    assert not manque, f"{len(manque)} paires perdues"
    OUT.write_text(json.dumps({"forme": ["libelle", "fragment"], "entries": entries}, ensure_ascii=False, indent=1), encoding="utf-8")
    n_l = sum(e["forme"] == "libelle" for e in entries)
    print(f"{len(sources)} paires source -> {len(entries)} entrees ({n_l} libelles, {len(entries) - n_l} fragments), 0 perte -> {OUT.name}")


if __name__ == "__main__":
    main()
