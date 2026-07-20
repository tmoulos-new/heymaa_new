"""Recover HeyMaa memories from Chrome/Edge LevelDB localStorage files.

Writes summary to stdout and best payload to frontend/public/recovered-memories.json
(only if memories with content are found). Does not print image base64.
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

DIRS = [
    Path(os.environ["LOCALAPPDATA"])
    / r"Google\Chrome\User Data\Default\Local Storage\leveldb",
    Path(os.environ["LOCALAPPDATA"])
    / r"Microsoft\Edge\User Data\Default\Local Storage\leveldb",
]

OUT = (
    Path(__file__).resolve().parents[1]
    / "frontend"
    / "public"
    / "recovered-memories.json"
)

KEY_RE = re.compile(r"hm_memories[_a-zA-Z0-9-]*")


def richness(m: dict) -> int:
    score = 1
    img = m.get("img") or ""
    if img:
        score += 10 + min(4, len(img) // 50_000)
    text = m.get("text") or ""
    if text and text != "📷":
        score += 2
    if m.get("createdAt"):
        score += 1
    if m.get("ref"):
        score += 1
    return score


def memory_key(m: dict) -> str:
    if m.get("createdAt"):
        return f"at:{m['createdAt']}"
    img = (m.get("img") or "")[:48]
    return f"c:{m.get('date')}|{m.get('text')}|{m.get('ref') or ''}|{img}"


def extract_arrays(text: str, source: str) -> list[tuple[str, list, str]]:
    found: list[tuple[str, list, str]] = []
    for m in KEY_RE.finditer(text):
        key = m.group(0)
        jstart = text.find("[", m.start(), m.start() + 500)
        if jstart < 0:
            continue
        depth = 0
        end = None
        # Cap scan to 8MB per array to avoid runaway
        limit = min(len(text), jstart + 8_000_000)
        for i in range(jstart, limit):
            ch = text[i]
            if ch == "[":
                depth += 1
            elif ch == "]":
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break
        if end is None:
            continue
        raw = text[jstart:end]
        try:
            arr = json.loads(raw)
        except Exception:
            continue
        if isinstance(arr, list) and arr:
            found.append((key, arr, source))
    return found


def main() -> None:
    candidates: list[tuple[int, int, str, list, str]] = []
    for d in DIRS:
        if not d.is_dir():
            print(f"MISS {d}")
            continue
        print(f"SCAN {d}")
        for path in sorted(d.iterdir()):
            if path.suffix not in {".ldb", ".log"}:
                continue
            try:
                data = path.read_bytes()
            except Exception as e:
                print(f"  skip {path.name}: {e}")
                continue
            for enc in ("utf-8", "utf-16-le"):
                try:
                    text = data.decode(enc, errors="ignore")
                except Exception:
                    continue
                for key, arr, src in extract_arrays(text, f"{path.name}:{enc}"):
                    imgs = sum(1 for x in arr if isinstance(x, dict) and x.get("img"))
                    score = sum(richness(x) for x in arr if isinstance(x, dict))
                    candidates.append((score, len(arr), key, arr, src))
                    print(
                        f"  HIT key={key} n={len(arr)} imgs={imgs} score={score} from={src}"
                    )

    if not candidates:
        print("NO_MEMORIES_FOUND")
        return

    # Merge all candidates by richness
    merged: dict[str, dict] = {}
    for _score, _n, _key, arr, _src in candidates:
        for m in arr:
            if not isinstance(m, dict):
                continue
            k = memory_key(m)
            prev = merged.get(k)
            if not prev or richness(m) >= richness(prev):
                merged[k] = {**prev, **m} if prev else m
                if prev and not merged[k].get("img") and m.get("img"):
                    merged[k]["img"] = m["img"]
            elif prev and not prev.get("img") and m.get("img"):
                prev["img"] = m["img"]

    out_list = sorted(
        merged.values(),
        key=lambda m: m.get("createdAt") or "",
        reverse=True,
    )
    imgs = sum(1 for m in out_list if m.get("img"))
    print(f"MERGED n={len(out_list)} imgs={imgs}")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    # Store without dumping huge base64 to console
    OUT.write_text(json.dumps(out_list, ensure_ascii=False), encoding="utf-8")
    print(f"WROTE {OUT} bytes={OUT.stat().st_size}")

    # Safe summary only
    for i, m in enumerate(out_list[:15]):
        text = (m.get("text") or "")[:40]
        print(
            f"  [{i}] date={m.get('date')} text={text!r} hasImg={bool(m.get('img'))} at={m.get('createdAt')}"
        )


if __name__ == "__main__":
    main()
