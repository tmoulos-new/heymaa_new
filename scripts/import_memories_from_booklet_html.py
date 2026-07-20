"""Extract SyncMemory[] from a HeyMaa memories booklet HTML export."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

PATTERN = re.compile(
    r'<h2 class="section-title"><span>[^<]*</span>\s*([^<]+)</h2>\s*'
    r'<article class="memory[^"]*">.*?'
    r'<img class="memory-img" src="(data:image/[^"]+)"[^>]*>.*?'
    r'<div class="memory-date">([^<]+)</div>',
    re.DOTALL,
)


def parse_booklet_html(html: str) -> list[dict]:
    memories: list[dict] = []
    for i, m in enumerate(PATTERN.finditer(html)):
        ref_name = m.group(1).strip()
        img = m.group(2)
        date = m.group(3).strip()
        memories.append(
            {
                "emoji": "📷",
                "text": "📷",
                "date": date,
                "img": img,
                "ref": ref_name,
                "createdAt": f"2026-07-16T{12 + i:02d}:00:00.000Z",
            }
        )
    return memories


def main() -> None:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    if not src or not src.is_file():
        print("Usage: python import_memories_from_booklet_html.py <booklet.html> [output.json]")
        sys.exit(1)
    out = (
        Path(sys.argv[2])
        if len(sys.argv) > 2
        else Path(__file__).resolve().parents[1] / "frontend" / "public" / "recovered-memories-export.json"
    )
    html = src.read_text(encoding="utf-8")
    memories = parse_booklet_html(html)
    payload = {"memories": memories, "source": src.name}
    out.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"memories: {len(memories)}")
    for mem in memories:
        ref = mem["ref"].encode("ascii", "backslashreplace").decode()
        print(f"  - {ref} ({mem['date']}) img={len(mem.get('img', ''))} chars")
    print(f"written: {out} ({out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
