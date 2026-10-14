"""SSE helpers and Grok streaming for /chat/stream."""
from __future__ import annotations

import json
import os
from typing import Any, AsyncIterator, Optional

import httpx

GROK_CHAT_URL = "https://api.x.ai/v1/chat/completions"


def _grok_stream_models() -> tuple[str, ...]:
    pinned = (
        os.getenv("GROK_CHAT_MODEL")
        or os.getenv("GROK_MODEL")
        or os.getenv("XAI_CHAT_MODEL")
        or ""
    ).strip()
    if pinned:
        if pinned == "grok-2-latest":
            return (pinned,)
        return (pinned, "grok-2-latest")
    # One primary + one fallback — sequential 4-model tries burn TTFT.
    return ("grok-4.3", "grok-2-latest")


GROK_STREAM_MODELS = _grok_stream_models()


def format_sse(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _model_retryable(err_txt: str) -> bool:
    low = (err_txt or "").lower()
    return any(
        x in low
        for x in (
            "404",
            "not found",
            "does not exist",
            "decommission",
            "no longer supported",
            "invalid",
            "429",
            "quota",
            "rate limit",
        )
    )


async def iter_grok_chat_deltas(
    *,
    message: str,
    history: list,
    system_prompt: str,
    api_key: str,
    history_limit: int = 6,
    max_tokens: int = 1024,
    history_max: int = 40,
) -> AsyncIterator[str]:
    """Yield text deltas from xAI Grok (OpenAI-compatible SSE)."""
    limit = max(2, min(int(history_limit or 6), history_max))
    messages = [{"role": "system", "content": system_prompt}]
    for h in (history or [])[-limit:]:
        messages.append(
            {"role": h["role"], "content": (h.get("content") or "")[:1500]}
        )
    messages.append({"role": "user", "content": (message or "")[:2000]})
    token_budget = max(int(max_tokens or 1024), 256)
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
    }

    last_err: Optional[BaseException] = None
    async with httpx.AsyncClient(timeout=httpx.Timeout(90.0, connect=20.0)) as client:
        for model_name in _grok_stream_models():
            body = {
                "model": model_name,
                "messages": messages,
                "max_tokens": token_budget,
                "temperature": 0.6,
                "stream": True,
            }
            try:
                async with client.stream(
                    "POST", GROK_CHAT_URL, headers=headers, json=body
                ) as resp:
                    if resp.status_code >= 400:
                        err_txt = (await resp.aread()).decode("utf-8", errors="replace")[
                            :300
                        ]
                        last_err = RuntimeError(f"{model_name}: {err_txt}")
                        if _model_retryable(err_txt):
                            continue
                        raise last_err

                    yielded = False
                    async for line in resp.aiter_lines():
                        if not line:
                            continue
                        if line.startswith(":"):
                            continue
                        if not line.startswith("data:"):
                            continue
                        data = line[5:].strip()
                        if not data or data == "[DONE]":
                            continue
                        try:
                            payload = json.loads(data)
                        except json.JSONDecodeError:
                            continue
                        choice0 = (payload.get("choices") or [{}])[0]
                        delta = choice0.get("delta") or {}
                        piece = delta.get("content") or ""
                        if piece:
                            yielded = True
                            yield piece
                    if yielded:
                        return
                    last_err = RuntimeError(f"{model_name}: empty stream")
            except Exception as e:
                last_err = e
                if _model_retryable(str(e)):
                    continue
                raise
    raise RuntimeError(f"xAI Grok stream failed: {last_err}")
