"""Bulk-decodes every filter listed in diablofilter.com's sitemap-filters.xml
to find item-type and skill/affix ids missing from our own tables (see
2026-09-22 in HISTORIQUE.md for how this was used the first time).

v2 (2026-09-22, same day): each filter page embeds a clean JSON object,
`window.__PRELOADED_FILTER__ = {...}`, with the export `code` plus structured
metadata - `class` (ground truth class, e.g. "rogue") and `skill_icon` (a
machine-readable skill slug, e.g. "dance_of_knives") are far more reliable
than guessing from the URL slug (v1's approach). This version reads that JSON
directly instead of regex-scanning raw HTML for base64-looking strings.

Usage (from the repo root, with the venv active):
  1. curl -s https://diablofilter.com/sitemap-filters.xml -o /tmp/sitemap-filters.xml
     grep -o '<loc>[^<]*</loc>' /tmp/sitemap-filters.xml | sed 's/<loc>//;s#</loc>##' > /tmp/df_urls.txt
  2. Fetch each URL's HTML into a local folder (DF_FILTERS_DIR below) with curl
     - WebFetch does NOT surface window.__PRELOADED_FILTER__, curl does.
  3. python research/bulk_decode.py

Not re-run automatically / not scheduled - this is a manual research tool,
rerun it whenever we want a fresh cross-check against the live site.
"""
import base64, glob, re, struct, sys, os, json
from collections import defaultdict

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DF_FILTERS_DIR = os.environ.get("DF_FILTERS_DIR", os.path.join(REPO_ROOT, "..", "df_filters_cache"))
OUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "diablofilter-bulk-decode-latest.json")

sys.path.insert(0, REPO_ROOT)
from app.loot_filter.data import AFFIX_IDS, SKILL_AFFIX_IDS, GENERIC_SKILL_AFFIX_IDS

AFFIX_BY_ID = {v: k for k, v in AFFIX_IDS.items()}
KNOWN_SKILL_IDS = {}
for cls, table in SKILL_AFFIX_IDS.items():
    for name, sid in table.items():
        if sid is not None:
            KNOWN_SKILL_IDS[sid] = f"{cls}:{name}"
for name, sid in GENERIC_SKILL_AFFIX_IDS.items():
    KNOWN_SKILL_IDS[sid] = f"generic:{name}"

# Skill names our own table still has as `None` (unconfirmed), per class -
# used to print a "does this match a gap we have?" hint next to each finding.
UNCONFIRMED_SKILLS = {cls: [n for n, v in table.items() if v is None] for cls, table in SKILL_AFFIX_IDS.items()}

def read_varint(buf, i):
    result = 0; shift = 0
    while True:
        b = buf[i]; i += 1
        result |= (b & 0x7F) << shift
        if not (b & 0x80): break
        shift += 7
    return result, i

def read_field(buf, i):
    tag, i = read_varint(buf, i)
    field_no = tag >> 3
    wire_type = tag & 0x7
    if wire_type == 0:
        val, i = read_varint(buf, i)
        return field_no, wire_type, val, i
    elif wire_type == 5:
        val = struct.unpack_from("<I", buf, i)[0]; i += 4
        return field_no, wire_type, val, i
    elif wire_type == 2:
        length, i = read_varint(buf, i)
        val = buf[i:i+length]; i += length
        return field_no, wire_type, val, i
    else:
        raise ValueError(f"bad wire_type {wire_type}")

def parse_message(buf):
    i = 0; out = []
    while i < len(buf):
        field_no, wire_type, val, i = read_field(buf, i)
        out.append((field_no, wire_type, val))
    return out

def try_parse_filter(raw_bytes):
    try:
        top = parse_message(raw_bytes)
    except Exception:
        return None
    name = None; rule_count = None; rules_raw = []
    for fno, wt, val in top:
        if fno == 1 and wt == 2:
            rules_raw.append(val)
        elif fno == 2 and wt == 2:
            try:
                name = val.decode("utf-8")
            except Exception:
                return None
        elif fno == 3 and wt == 0:
            rule_count = val
    if name is None or not rules_raw:
        return None
    for rb in rules_raw:
        try:
            rfields = parse_message(rb)
        except Exception:
            return None
        kinds = {f for f, _, _ in rfields}
        if not ({1, 2} <= kinds):
            return None
    return name, rule_count, rules_raw

def decode_condition_ids(cond_bytes):
    fields = parse_message(cond_bytes)
    kind = None; ids = []; arg4 = None; arg6 = None
    for fno, wt, val in fields:
        if fno == 1: kind = val
        elif fno == 2: ids.append(val)
        elif fno == 4: arg4 = val
        elif fno == 6: arg6 = val
    return kind, ids, arg4, arg6

def extract_preloaded_json(html):
    idx = html.find("window.__PRELOADED_FILTER__ = ")
    if idx == -1:
        return None
    start = idx + len("window.__PRELOADED_FILTER__ = ")
    end = html.find("};", start)
    if end == -1:
        return None
    end += 1
    try:
        return json.loads(html[start:end])
    except Exception:
        return None

results = []
# unknown_id -> {"kind": 5|6|7, "hits": [{"class":.., "skill_icon":.., "slug":..}, ...]}
unknown_affix_hits = defaultdict(list)
unknown_itemtype_hits = defaultdict(list)

KNOWN_ITEM_TYPES = {
    0x0022ED05, 0x00237E80, 0x0006d174, 0x0006d175, 0x0006d170,
    0x0006d171, 0x0006d16d, 0x0006d16e, 0x0006d16f, 0x0006d159,
    0x0006d151, 0x0006d167, 0x0006d169, 0x0006d14c,
}

files = sorted(glob.glob(os.path.join(DF_FILTERS_DIR, "*.html")))
print(f"Found {len(files)} html files")

no_json = 0
for path in files:
    slug = os.path.basename(path).replace(".html", "")
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            html = f.read()
    except Exception:
        continue

    meta = extract_preloaded_json(html)
    if not meta or "code" not in meta:
        no_json += 1
        continue

    try:
        raw = base64.b64decode(meta["code"])
    except Exception:
        continue
    parsed = try_parse_filter(raw)
    if not parsed:
        continue
    name, rule_count, rules_raw = parsed

    ctx = {"slug": slug, "class": meta.get("class"), "skill_icon": meta.get("skill_icon"), "title": meta.get("title")}
    results.append(ctx)

    for rb in rules_raw:
        rfields = parse_message(rb)
        for fno, wt, val in rfields:
            if fno != 4:
                continue
            kind, ids, arg4, arg6 = decode_condition_ids(val)
            if kind in (6, 7):
                for aid in ids:
                    if aid not in AFFIX_BY_ID and aid not in KNOWN_SKILL_IDS:
                        unknown_affix_hits[aid].append(ctx)
            elif kind == 5:
                for tid in ids:
                    if tid not in KNOWN_ITEM_TYPES:
                        unknown_itemtype_hits[tid].append(ctx)

print(f"\nPages with __PRELOADED_FILTER__ + valid code: {len(results)} / {len(files)} (no usable JSON: {no_json})")

def summarize(hits):
    classes = sorted({h["class"] for h in hits if h["class"]})
    icons = sorted({h["skill_icon"] for h in hits if h["skill_icon"]})
    return classes, icons

print(f"\n=== Unknown ItemType ids (kind=5): {len(unknown_itemtype_hits)} ===")
for tid, hits in sorted(unknown_itemtype_hits.items(), key=lambda kv: -len(kv[1])):
    classes, icons = summarize(hits)
    print(f"  0x{tid:08X}  n={len(hits)}  classes={classes}  skill_icons={icons[:6]}")

print(f"\n=== Unknown skill/affix ids (kind=6/7): {len(unknown_affix_hits)} ===")
for aid, hits in sorted(unknown_affix_hits.items(), key=lambda kv: -len(kv[1])):
    classes, icons = summarize(hits)
    # High-confidence flag: single class AND single skill_icon across every hit.
    confident = len(classes) == 1 and len(icons) == 1 and len(hits) >= 2
    flag = "  <-- SINGLE CLASS+SKILL, MULTIPLE HITS" if confident else ""
    print(f"  0x{aid:08X}  n={len(hits)}  classes={classes}  skill_icons={icons[:8]}{flag}")

def compact(hits):
    # Store just slugs here (results[] already has the full class/skill_icon/
    # title per slug) - keeps the file an order of magnitude smaller than
    # repeating that context on every hit.
    return sorted({h["slug"] for h in hits})

with open(OUT_PATH, "w") as f:
    json.dump({
        "results": {r["slug"]: {k: v for k, v in r.items() if k != "slug"} for r in results},
        "unknown_affix_hits": {f"0x{k:08X}": compact(v) for k, v in unknown_affix_hits.items()},
        "unknown_itemtype_hits": {f"0x{k:08X}": compact(v) for k, v in unknown_itemtype_hits.items()},
    }, f, indent=2)
print(f"\nSaved full results to {OUT_PATH}")

print("\n=== Unconfirmed skills per class still in our own table (for cross-reference) ===")
for cls, names in UNCONFIRMED_SKILLS.items():
    if names:
        print(f"  {cls}: {names}")
