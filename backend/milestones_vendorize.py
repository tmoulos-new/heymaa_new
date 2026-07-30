"""
Vendorize Babyspace milestone bullet checklists for HeyMaa Milestones UI + RAG.

Age taxonomy (matches babyspace.gr age nav):
  - Pregnancy weeks 1–40
  - Baby months 1–12
  - Toddler: 12–15, 15–18, 18–24, 24–36 months
  - Child years 4–12 (after 36 months → year 4; no separate year-3 band)

Refresh cadence: re-run about every 6 months.

Usage:
  .\\.venv\\Scripts\\python.exe backend\\milestones_vendorize.py
  .\\.venv\\Scripts\\python.exe backend\\milestones_vendorize.py --skip-translate
  .\\.venv\\Scripts\\python.exe backend\\milestones_vendorize.py --stage w20
"""
from __future__ import annotations

import argparse
import html as htmlmod
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from urllib.parse import unquote

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
load_dotenv(ROOT / ".env")
sys.path.insert(0, str(ROOT))

from url_acquire import acquire_url  # noqa: E402

OUT_DIR = REPO / "frontend" / "src" / "data" / "milestones"
CACHE_DIR = ROOT / "milestones_cache"
RAG_SEED_DIR = ROOT / "knowledge_seed" / "milestones"
URL_MAP_PATH = CACHE_DIR / "url_map.json"
CATALOG_EL_PATH = OUT_DIR / "catalog.el.json"
CATALOG_I18N_PATH = OUT_DIR / "catalog.i18n.json"
META_PATH = OUT_DIR / "meta.json"

TARGET_LANGS = [
    "el", "en", "ar", "zh", "es", "fr", "ro", "pl", "tr", "hi", "ur", "ja",
    "ru", "de", "pt", "it", "nl", "bn", "id", "sw", "fil", "mr", "te",
]

NAV_NOISE = {
    "η ζωή της εγκύου", "η εγκυμοσύνη ανά εβδομάδα", "μωρό η ζωή με το μωρό",
    "οδηγός ανάπτυξης", "οδηγός νέας μαμάς", "νήπιο", "συνταγές", "χυμοί",
    "σαλάτες", "τοστ", "babyspace pedia", "σχετικά άρθρα", "web design",
    "generation y", "καλωσήρθατε", "εγγραφή", "είσοδος",
}

SECTION_STOP = (
    "τι πρέπει να γνωρίζουμε",
    "τι πρέπει να γνωρίζεις",
    "σχετικά άρθρα",
    "οι υποστηρικτές μας",
    "δεν είσαι μέλος",
    "copyright babyspace",
)

DEVELOPMENT_MARKERS = (
    "κινητικ", "χέρια", "χερια", "αυτοβοήθ", "γλώσσα", "γλωσσα", "κοινων",
    "αντίληψ", "αντιληψ", "αισθητηρ", "γνωστικ", "συναισθ", "ανάπτυξ", "αναπτυξ",
    "έμβρυο", "εμβρυο", "αλλαγές στο έμβρυο", "τι να περιμένεις", "τι να περιμένουμε",
    "ορόσημ", "μπορεί να", "σωματικ", "ύπν", "διατροφ",
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def stage_defs() -> list[dict[str, Any]]:
    stages: list[dict[str, Any]] = []
    for w in range(1, 41):
        stages.append({
            "id": f"preg_w{w}",
            "kind": "pregnancy_week",
            "week": w,
            "label_el": f"{w}η εβδομάδα εγκυμοσύνης",
        })
    for m in range(1, 13):
        stages.append({
            "id": f"baby_m{m}",
            "kind": "baby_month",
            "month": m,
            "age_months_min": m - 1,
            "age_months_max": m,
            "label_el": f"{m}ος μήνας",
        })
    for a, b, slug in [
        (12, 15, "toddler_12_15"),
        (15, 18, "toddler_15_18"),
        (18, 24, "toddler_18_24"),
        (24, 36, "toddler_24_36"),
    ]:
        stages.append({
            "id": slug,
            "kind": "toddler_range",
            "age_months_min": a,
            "age_months_max": b,
            "label_el": f"{a}–{b} μηνών",
        })
    for y in range(4, 13):
        stages.append({
            "id": f"child_y{y}",
            "kind": "child_year",
            "year": y,
            "age_months_min": y * 12,
            "age_months_max": (y + 1) * 12,
            "label_el": f"{y}ο έτος",
        })
    return stages


def candidate_urls(stage: dict[str, Any]) -> list[str]:
    """Ordered URL candidates for a stage (best-first)."""
    kind = stage["kind"]
    base = "https://www.babyspace.gr/el/"
    if kind == "pregnancy_week":
        n = stage["week"]
        ord_n = f"{n}η"
        return [
            f"{base}{ord_n}-εβδομαδα-εγκυμοσυνης",
            f"{base}{ord_n}-εβδομάδα-εγκυμοσύνης",
            f"{base}η-{ord_n}-εβδομαδα-της-εγκυμοσυνης",
            f"{base}tags/{n}i-evdomada",
        ]
    if kind == "baby_month":
        n = stage["month"]
        known = {
            1: ["00-00protos-minas-zois"],
            2: ["η-αναπτυξη-τον-2o-μηνα"],
            3: ["00-00-tritos-minas"],
            5: ["anaptixi-pemto-mina"],
            6: ["ektos-minas"],
            7: ["00-endktos-minas"],
            8: ["η-αναπτυξη-τον-8ο-μηνα"],
            9: ["η-αναπτυξη-τον-9ο-μηνα"],
            10: ["η-αναπτυξη-τον-10ο-μηνα"],
        }
        urls = [base + s for s in known.get(n, [])]
        urls.append(f"{base}tags/{n}os-minas")
        return urls
    if kind == "toddler_range":
        mapping = {
            "toddler_12_15": ["η-αναπτυξη-απο-12-15-μηνων", "tags/12os-15os-minas"],
            "toddler_15_18": ["η-αναπτυξη-απο-15-18-μηνων", "tags/15os-18os-minas"],
            "toddler_18_24": ["anaptixi-minon", "tags/18os-24os-minas"],
            "toddler_24_36": ["anaptixi-24-minon", "anaprixi-nipio", "tags/24os-36os-minas"],
        }
        return [base + s for s in mapping[stage["id"]]]
    if kind == "child_year":
        y = stage["year"]
        urls = []
        if y == 4:
            urls.append(base + "anaptixi-pedi-4")
        if y == 8:
            urls.append(base + "anaptixi-pediou")
        urls.append(f"{base}tags/{y}o-etos")
        return urls
    return []


def score_doc(url: str, words: int) -> int:
    """Prefer real articles (~300–1800 words) over /tags/ listing hubs."""
    is_tag = "/tags/" in (url or "")
    if is_tag:
        # Tags are last-resort hubs full of related-article noise.
        return 100 + min(words, 800)
    # Sweet spot for single development/pregnancy articles
    if 250 <= words <= 2200:
        return 5000 + words
    if words > 2200:
        return 2000 + min(words, 3000)
    return words


def resolve_url(stage: dict[str, Any], *, cache: dict[str, Any], force: bool = False) -> Optional[dict[str, Any]]:
    sid = stage["id"]
    if not force and sid in cache and cache[sid] and cache[sid].get("url"):
        return cache[sid]
    best: Optional[tuple[int, dict[str, Any]]] = None
    for url in candidate_urls(stage):
        try:
            doc = acquire_url(url)
        except Exception:
            continue
        words = int(doc.get("metadata", {}).get("word_count") or 0)
        entry = {
            "url": doc.get("source_reference") or url,
            "title": doc.get("title") or "",
            "words": words,
        }
        sc = score_doc(url, words)
        if best is None or sc > best[0]:
            best = (sc, entry)
        # Early accept a clear article hit
        if "/tags/" not in url and 250 <= words <= 2200:
            best = (sc + 10000, entry)
            break
        time.sleep(0.12)
    if best:
        cache[sid] = best[1]
        return best[1]
    cache[sid] = None
    return None


def clean_text(s: str) -> str:
    s = htmlmod.unescape(s or "")
    s = re.sub(r"\s+", " ", s).strip(" .;,-–—\t")
    return s


def is_noise(text: str) -> bool:
    low = text.lower()
    if len(text) < 12 or len(text) > 200:
        return True
    if any(n in low for n in NAV_NOISE):
        return True
    if low.startswith("http") or "babyspace.gr" in low:
        return True
    if re.fullmatch(r"\d{1,2}-\d{1,2}-\d{4}", text):
        return True
    return False


def extract_dash_bullets(content: str) -> list[str]:
    lines = [ln.strip() for ln in content.replace("\r", "").split("\n") if ln.strip()]
    expanded: list[str] = []
    for ln in lines:
        low = ln.lower()
        if any(s in low for s in SECTION_STOP):
            break
        if ln.count(" -") >= 2 or (ln.startswith("-") and " -" in ln):
            parts = re.split(r"(?:(?<=\s)|^)-(?=\S)", ln)
            for p in parts:
                p = clean_text(p)
                if p:
                    expanded.append(p)
        elif re.match(r"^[-–—•·]\s*\S", ln):
            expanded.append(clean_text(re.sub(r"^[-–—•·]+\s*", "", ln)))
    out: list[str] = []
    seen: set[str] = set()
    for b in expanded:
        if is_noise(b):
            continue
        k = b.lower()
        if k in seen:
            continue
        seen.add(k)
        out.append(b)
    return out[:12]


def extract_prose_bullets(content: str, *, max_items: int = 8) -> list[str]:
    """Pull short factual sentences from development-oriented sections."""
    text = content
    # Prefer window after first development marker
    low = text.lower()
    start = 0
    for m in DEVELOPMENT_MARKERS:
        i = low.find(m)
        if i >= 0:
            start = max(0, i - 40)
            break
    window = text[start : start + 3500]
    for stop in SECTION_STOP:
        j = window.lower().find(stop)
        if j > 200:
            window = window[:j]
            break
    # Drop URLs / image noise lines
    lines = []
    for ln in window.splitlines():
        ln = ln.strip()
        if not ln or ln.startswith("http") or "s3.gy.digital" in ln:
            continue
        if re.match(r"^\d{1,2}-\d{1,2}-\d{4}$", ln):
            continue
        lines.append(ln)
    blob = " ".join(lines)
    sentences = re.split(r"(?<=[.!;])\s+", blob)
    out: list[str] = []
    seen: set[str] = set()
    for s in sentences:
        s = clean_text(s)
        if is_noise(s):
            continue
        # Prefer developmental / expectation wording
        sl = s.lower()
        if not any(
            k in sl
            for k in (
                "μπορεί", "αναπτ", "σχηματ", "κιν", "λέει", "κάθετ", "περπατ",
                "έμβρυο", "μωρό", "παιδί", "μήκος", "βάρος", "μέγεθος", "ορόσημ",
                "αναγνωρ", "χαμογελ", "τραβά", "δείχν", "παίζ",
            )
        ):
            continue
        if len(s) < 28 or len(s) > 160:
            continue
        k = s.lower()
        if k in seen:
            continue
        seen.add(k)
        out.append(s)
        if len(out) >= max_items:
            break
    return out


def gemini_distill_bullets(title: str, content: str, *, api_key: str) -> list[str]:
    """Ask Gemini to distill 5–8 checklist bullets (Greek)."""
    try:
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            import google.generativeai as genai
    except ImportError:
        return []
    genai.configure(api_key=api_key)
    excerpt = content[:5000]
    prompt = (
        "Είσαι επιμελητής περιεχομένου για εφαρμογή γονέων (HeyMaa).\n"
        "Από το παρακάτω άρθρο του Babyspace, βγάλε 5 έως 8 ΣΥΝΤΟΜΑ bullet points "
        "στα ελληνικά για checklist οροσήμων/«τι να περιμένεις».\n"
        "Κανόνες: μόνο γεγονότα ανάπτυξης από το κείμενο· όχι ιατρικές οδηγίες· "
        "όχι διαφημίσεις/σχετικά άρθρα· κάθε bullet μία φράση 8–22 λέξεις.\n"
        "Επίστρεψε ΜΟΝΟ JSON array από strings.\n\n"
        f"Τίτλος: {title}\n\nΚείμενο:\n{excerpt}"
    )
    last_err: Optional[Exception] = None
    for model_name in ("gemini-2.0-flash", "gemini-flash-latest", "gemini-2.5-flash"):
        try:
            model = genai.GenerativeModel(model_name)
            resp = model.generate_content(prompt)
            text = (getattr(resp, "text", None) or "").strip()
            m = re.search(r"\[[\s\S]*\]", text)
            if not m:
                continue
            data = json.loads(m.group(0))
            if not isinstance(data, list):
                continue
            out = []
            for item in data:
                s = clean_text(str(item))
                if not is_noise(s):
                    out.append(s)
            return out[:10]
        except Exception as e:
            last_err = e
            continue
    if last_err:
        print(f"  gemini distill failed: {last_err}")
    return []


def gemini_translate_batch(
    bullets_el: list[str],
    target_lang: str,
    *,
    api_key: str,
) -> list[str]:
    if target_lang == "el":
        return list(bullets_el)
    try:
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            import google.generativeai as genai
    except ImportError:
        return list(bullets_el)
    genai.configure(api_key=api_key)
    lang_name = {
        "en": "English", "ar": "Arabic", "zh": "Simplified Chinese", "es": "Spanish",
        "fr": "French", "ro": "Romanian", "pl": "Polish", "tr": "Turkish",
        "hi": "Hindi", "ur": "Urdu", "ja": "Japanese", "ru": "Russian",
        "de": "German", "pt": "Portuguese", "it": "Italian", "nl": "Dutch",
        "bn": "Bengali", "id": "Indonesian", "sw": "Swahili", "fil": "Filipino",
        "mr": "Marathi", "te": "Telugu",
    }.get(target_lang, target_lang)
    payload = json.dumps(bullets_el, ensure_ascii=False)
    prompt = (
        f"Translate each string in this JSON array into {lang_name}. "
        "Keep the same number of items, same order, parenting/checklist tone, concise. "
        "Return ONLY a JSON array of strings.\n\n"
        f"{payload}"
    )
    for model_name in ("gemini-2.0-flash", "gemini-flash-latest", "gemini-2.5-flash"):
        try:
            model = genai.GenerativeModel(model_name)
            resp = model.generate_content(prompt)
            text = (getattr(resp, "text", None) or "").strip()
            m = re.search(r"\[[\s\S]*\]", text)
            if not m:
                continue
            data = json.loads(m.group(0))
            if isinstance(data, list) and len(data) == len(bullets_el):
                return [clean_text(str(x)) for x in data]
        except Exception:
            continue
    return list(bullets_el)


def build_stage_bullets(
    stage: dict[str, Any],
    resolved: dict[str, Any],
    *,
    api_key: str,
    use_gemini: bool,
) -> dict[str, Any]:
    url = resolved["url"]
    doc = acquire_url(url)
    content = doc.get("content") or ""
    title = doc.get("title") or resolved.get("title") or stage["label_el"]

    bullets = extract_dash_bullets(content)
    method = "dash"
    if len(bullets) < 4:
        prose = extract_prose_bullets(content)
        if len(prose) > len(bullets):
            bullets = prose
            method = "prose"
    # Prefer Gemini when heuristic bullets look like nav/noise or are too few
    needs_gemini = len(bullets) < 5 or any(
        re.search(r"tweet|ανάπτυξη tweet|^\W*$|babyspace\.gr", b, re.I) for b in bullets
    ) or (method == "prose" and any(len(b) > 140 for b in bullets[:3]))
    if needs_gemini and use_gemini and api_key:
        distilled = gemini_distill_bullets(title, content, api_key=api_key)
        if len(distilled) >= 4:
            bullets = distilled
            method = "gemini"
        time.sleep(0.4)
    elif len(bullets) < 4 and use_gemini and api_key:
        distilled = gemini_distill_bullets(title, content, api_key=api_key)
        if len(distilled) >= 4:
            bullets = distilled
            method = "gemini"
        time.sleep(0.4)

    return {
        **stage,
        "source_url": unquote(url),
        "source_title": title,
        "extraction": method,
        "bullets": {"el": bullets},
        "fetched_at": _now_iso(),
        "word_count": doc.get("metadata", {}).get("word_count"),
    }


def _ordered_catalog(by_id: dict[str, Any]) -> list[dict[str, Any]]:
    order = [s["id"] for s in stage_defs()]
    out: list[dict[str, Any]] = []
    for sid in order:
        if sid in by_id:
            out.append(by_id[sid])
    # keep any unexpected extras
    for sid, row in by_id.items():
        if sid not in {s["id"] for s in out}:
            out.append(row)
    return out


def write_rag_seed(catalog: list[dict[str, Any]]) -> None:
    RAG_SEED_DIR.mkdir(parents=True, exist_ok=True)
    for stage in catalog:
        bullets = (stage.get("bullets") or {}).get("el") or []
        if not bullets:
            continue
        body = "\n".join(f"- {b}" for b in bullets)
        md = (
            f"---\n"
            f'source_key: "babyspace_milestones"\n'
            f'title: "{stage.get("label_el")}"\n'
            f'url: "{stage.get("source_url")}"\n'
            f'language: "el"\n'
            f'stage_id: "{stage.get("id")}"\n'
            f"---\n\n"
            f"# {stage.get('label_el')}\n\n"
            f"{body}\n"
        )
        (RAG_SEED_DIR / f"{stage['id']}.md").write_text(md, encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-translate", action="store_true")
    ap.add_argument("--no-gemini", action="store_true")
    ap.add_argument("--stage", action="append", default=[], help="Only these stage ids")
    ap.add_argument("--resolve-only", action="store_true")
    args = ap.parse_args()

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    api_key = (os.getenv("GEMINI_API_KEY") or "").strip()
    use_gemini = bool(api_key) and not args.no_gemini

    stages = stage_defs()
    if args.stage:
        want = set(args.stage)
        stages = [s for s in stages if s["id"] in want]

    url_cache: dict[str, Any] = {}
    if URL_MAP_PATH.exists():
        try:
            url_cache = json.loads(URL_MAP_PATH.read_text(encoding="utf-8"))
        except Exception:
            url_cache = {}

    print(f"Resolving URLs for {len(stages)} stages…")
    resolved_map: dict[str, Any] = {}
    for s in stages:
        r = resolve_url(s, cache=url_cache)
        resolved_map[s["id"]] = r
        status = (r or {}).get("url", "MISS")
        print(f"  {s['id']}: {status}")
        URL_MAP_PATH.write_text(json.dumps(url_cache, ensure_ascii=False, indent=2), encoding="utf-8")

    if args.resolve_only:
        print("Done (resolve-only).")
        return

    catalog: list[dict[str, Any]] = []
    # Resume partial EL catalog if present
    existing_by_id: dict[str, Any] = {}
    if CATALOG_EL_PATH.exists():
        try:
            prev = json.loads(CATALOG_EL_PATH.read_text(encoding="utf-8"))
            for row in prev.get("stages") or []:
                existing_by_id[row["id"]] = row
        except Exception:
            pass

    print(f"Extracting bullets (gemini={'on' if use_gemini else 'off'})…")
    updated_ids: set[str] = set()
    for s in stages:
        r = resolved_map.get(s["id"])
        if not r:
            print(f"  SKIP {s['id']} (no url)")
            continue
        if (
            s["id"] in existing_by_id
            and (existing_by_id[s["id"]].get("bullets") or {}).get("el")
            and existing_by_id[s["id"]].get("source_url") == r.get("url")
            and not args.stage
        ):
            print(f"  cache {s['id']} ({len(existing_by_id[s['id']]['bullets']['el'])} bullets)")
            updated_ids.add(s["id"])
            continue
        try:
            row = build_stage_bullets(s, r, api_key=api_key, use_gemini=use_gemini)
            existing_by_id[s["id"]] = row
            updated_ids.add(s["id"])
            n = len(row["bullets"]["el"])
            print(f"  {s['id']}: {n} bullets via {row['extraction']}")
        except Exception as e:
            print(f"  FAIL {s['id']}: {e}")
        time.sleep(0.2)
        # checkpoint full catalog (preserve stages not in this run)
        catalog = _ordered_catalog(existing_by_id)
        payload = {
            "version": 1,
            "source": "babyspace.gr",
            "generated_at": _now_iso(),
            "stages": catalog,
        }
        CATALOG_EL_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    catalog = _ordered_catalog(existing_by_id)
    CATALOG_EL_PATH.write_text(
        json.dumps(
            {
                "version": 1,
                "source": "babyspace.gr",
                "generated_at": _now_iso(),
                "stages": catalog,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    write_rag_seed(catalog)

    # i18n
    i18n: dict[str, dict[str, list[str]]] = {"el": {}}
    for row in catalog:
        i18n["el"][row["id"]] = list((row.get("bullets") or {}).get("el") or [])

    if CATALOG_I18N_PATH.exists():
        try:
            prev_i18n = json.loads(CATALOG_I18N_PATH.read_text(encoding="utf-8"))
            for lang, mapping in (prev_i18n.get("by_lang") or {}).items():
                i18n.setdefault(lang, {}).update(mapping)
        except Exception:
            pass

    if not args.skip_translate and use_gemini:
        print("Translating…")
        for lang in TARGET_LANGS:
            if lang == "el":
                continue
            i18n.setdefault(lang, {})
            for row in catalog:
                sid = row["id"]
                el_bullets = i18n["el"].get(sid) or []
                if not el_bullets:
                    continue
                if i18n[lang].get(sid) and len(i18n[lang][sid]) == len(el_bullets) and not args.stage:
                    continue
                translated = gemini_translate_batch(el_bullets, lang, api_key=api_key)
                i18n[lang][sid] = translated
                print(f"  {lang}/{sid}: {len(translated)}")
                time.sleep(0.35)
                CATALOG_I18N_PATH.write_text(
                    json.dumps(
                        {"version": 1, "generated_at": _now_iso(), "by_lang": i18n},
                        ensure_ascii=False,
                        indent=2,
                    ),
                    encoding="utf-8",
                )
    else:
        # Ensure at least EN fallback = EL until translated
        i18n.setdefault("en", dict(i18n["el"]))

    CATALOG_I18N_PATH.write_text(
        json.dumps({"version": 1, "generated_at": _now_iso(), "by_lang": i18n}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    META_PATH.write_text(
        json.dumps(
            {
                "version": 1,
                "source": "babyspace.gr",
                "generated_at": _now_iso(),
                "refresh_every_months": 6,
                "stage_count": len(catalog),
                "langs": sorted(i18n.keys()),
                "taxonomy": {
                    "pregnancy_weeks": "1-40",
                    "baby_months": "1-12",
                    "toddler_ranges": ["12-15", "15-18", "18-24", "24-36"],
                    "child_years": "4-12",
                    "note": "After 36 months, next band is year 4 (no year-3 stage).",
                },
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"Wrote {CATALOG_EL_PATH}")
    print(f"Wrote {CATALOG_I18N_PATH}")
    print(f"RAG seeds in {RAG_SEED_DIR}")


if __name__ == "__main__":
    main()
