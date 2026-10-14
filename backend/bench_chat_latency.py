"""Offline latency budget checks for chat prepare-path (no live LLM calls)."""
from __future__ import annotations

import sys
import time


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    from main import (
        _CHAT_HISTORY_CHAR_BUDGET,
        _MAX_SYSTEM_PROMPT_CHARS,
        _RAG_CONTEXT_CHAR_CAP,
        _RUNTIME_REMINDERS,
        _grok_model_candidates,
        _soft_trim_system_prompt,
        build_system_prompt,
        get_system_prompt_content,
        trim_llm_history,
    )

    # Bust cache so trim settings apply after reloads in the same process.
    import main as m

    m._system_prompt_cache = None

    t0 = time.perf_counter()
    base = get_system_prompt_content()
    t_base = (time.perf_counter() - t0) * 1000

    t1 = time.perf_counter()
    prompt = build_system_prompt(
        "[Title]\n" + ("knowledge " * 80),
        "Name: Maria\nChild: Panos, 2 months",
        "\n".join([f"memory {i}" for i in range(12)]),
        "\n".join([f"doc {i}" for i in range(8)]),
        "",
        "\n".join([f"milestone {i}" for i in range(8)]),
    )
    t_prompt = (time.perf_counter() - t1) * 1000

    hist = []
    for i in range(40):
        hist.append({"role": "user", "content": f"question {i} " + ("x" * 400)})
        hist.append({"role": "assistant", "content": f"answer {i} " + ("y" * 800)})
    t2 = time.perf_counter()
    trimmed = trim_llm_history(hist, 64)
    t_hist = (time.perf_counter() - t2) * 1000
    hist_chars = sum(len(h.get("content") or "") for h in trimmed)

    print("CHAT LATENCY BUDGET")
    print(f"  max_system_prompt_chars={_MAX_SYSTEM_PROMPT_CHARS}")
    print(f"  base_chars={len(base)} load_ms={t_base:.1f}")
    print(f"  reminders_chars={len(_RUNTIME_REMINDERS)}")
    print(f"  built_prompt_chars={len(prompt)} build_ms={t_prompt:.1f}")
    print(f"  rag_context_cap={_RAG_CONTEXT_CHAR_CAP}")
    print(f"  history_budget={_CHAT_HISTORY_CHAR_BUDGET}")
    print(f"  trimmed_turns={len(trimmed)} trimmed_chars={hist_chars} trim_ms={t_hist:.1f}")
    print(f"  grok_models={_grok_model_candidates()}")

    sample = "A" * 14000
    soft = _soft_trim_system_prompt(sample, 9000)
    assert len(soft) <= 9010
    assert len(base) <= _MAX_SYSTEM_PROMPT_CHARS + 5
    assert len(prompt) < 16000, f"prompt still too large: {len(prompt)}"
    assert hist_chars <= _CHAT_HISTORY_CHAR_BUDGET
    print("OK budget checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
