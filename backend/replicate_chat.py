"""Chat completions via Replicate HTTP API (single token, unified billing)."""
from __future__ import annotations

import asyncio
import time
from typing import Any, Optional

import requests

REPLICATE_API = "https://api.replicate.com/v1"

# Official Replicate models for Heymaa chat (vision + multilingual text).
REPLICATE_CHAT_MODELS: tuple[dict[str, Any], ...] = (
    {"owner": "google", "name": "gemini-2.5-flash", "kind": "gemini", "vision": True},
    {"owner": "meta", "name": "meta-llama-3-70b-instruct", "kind": "llama", "vision": False},
)

# Gemini on Replicate can stop early; allow room for 2–3 full sentences in Greek.
DEFAULT_CHAT_MAX_OUTPUT_TOKENS = 1024


def looks_truncated_reply(text: str) -> bool:
    """Detect replies that end mid-word or mid-sentence (common Gemini/Replicate glitch)."""
    t = (text or "").strip()
    if not t:
        return True
    last = t[-1]
    # Greek questions often end with ; — treat as a complete sentence.
    if last in ".!?;…»\"')":
        return False
    if last in ",:(-–—":
        return True
    if last.isalpha() or last.isdigit():
        return True
    return False


def build_history_prompt(message: str, history: list | None, history_limit: int = 6) -> str:
    """Fold chat history into a single prompt (Replicate Gemini/Llama use prompt, not messages API)."""
    lines: list[str] = []
    limit = max(2, min(int(history_limit or 6), 64))
    for h in (history or [])[-limit:]:
        role = h.get("role", "user")
        content = (h.get("content") or "")[:1500].strip()
        if not content:
            continue
        label = "User" if role == "user" else "Assistant"
        lines.append(f"{label}: {content}")
    current = (message or "")[:2000].strip()
    if lines:
        block = "\n".join(lines)
        if current:
            return f"Conversation so far:\n{block}\n\nUser: {current}"
        return f"Conversation so far:\n{block}\n\nRespond to the latest user message."
    return current


def image_parts_to_data_urls(image_parts: list[dict] | None) -> list[str]:
    urls: list[str] = []
    for ip in image_parts or []:
        mime = ip.get("mime_type") or "image/jpeg"
        data = ip.get("data") or ""
        if not data:
            continue
        if data.startswith("data:"):
            urls.append(data)
        else:
            urls.append(f"data:{mime};base64,{data}")
    return urls[:10]


def extract_replicate_output(output: Any) -> str:
    if output is None:
        return ""
    if isinstance(output, list):
        parts: list[str] = []
        for item in output:
            if item is None:
                continue
            if isinstance(item, list):
                parts.append(extract_replicate_output(item))
            else:
                parts.append(str(item))
        return "".join(parts).strip()
    if isinstance(output, str):
        return output.strip()
    return str(output).strip()


def _gemini_input(
    prompt: str,
    system_prompt: str,
    image_parts: list[dict] | None,
    max_tokens: int,
) -> dict[str, Any]:
    inp: dict[str, Any] = {
        "prompt": prompt,
        "system_instruction": system_prompt or "",
        "temperature": 0.6,
        "max_output_tokens": max_tokens,
        "thinking_budget": 0,
        "dynamic_thinking": False,
    }
    imgs = image_parts_to_data_urls(image_parts)
    if imgs:
        inp["images"] = imgs
    return inp


def _llama_input(prompt: str, system_prompt: str, max_tokens: int) -> dict[str, Any]:
    return {
        "prompt": prompt,
        "system_prompt": system_prompt or "",
        "temperature": 0.6,
        "max_tokens": max_tokens,
        "top_p": 0.9,
    }


def _poll_prediction(get_url: str, api_token: str, *, deadline: float) -> dict[str, Any]:
    headers = {"Authorization": f"Bearer {api_token}"}
    payload: dict[str, Any] = {}
    while time.time() < deadline:
        r = requests.get(get_url, headers=headers, timeout=30)
        err_txt = (r.text or "")[:400]
        if r.status_code == 429:
            raise RuntimeError(f"429 rate limit: {err_txt}")
        if not r.ok:
            raise RuntimeError(f"poll HTTP {r.status_code}: {err_txt}")
        payload = r.json()
        status = payload.get("status")
        if status in ("succeeded", "failed", "canceled"):
            return payload
        time.sleep(0.75)
    return payload


def run_replicate_prediction(
    owner: str,
    name: str,
    api_token: str,
    inp: dict[str, Any],
    *,
    wait_seconds: int = 60,
    timeout: int = 90,
) -> str:
    url = f"{REPLICATE_API}/models/{owner}/{name}/predictions"
    wait = min(max(int(wait_seconds), 1), 60)
    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json",
        "Prefer": f"wait={wait}",
        "Cancel-After": "120s",
    }
    r = requests.post(url, json={"input": inp}, headers=headers, timeout=timeout)
    err_txt = (r.text or "")[:400]
    if r.status_code == 429:
        raise RuntimeError(f"429 rate limit: {err_txt}")
    if not r.ok:
        raise RuntimeError(f"HTTP {r.status_code}: {err_txt}")
    payload = r.json()
    status = payload.get("status")
    if status in ("starting", "processing"):
        get_url = (payload.get("urls") or {}).get("get")
        if not get_url:
            raise RuntimeError(f"prediction timed out ({status}) without poll URL")
        payload = _poll_prediction(get_url, api_token, deadline=time.time() + max(timeout - wait, 15))
        status = payload.get("status")
    if status == "failed":
        detail = payload.get("error") or err_txt
        raise RuntimeError(f"prediction failed: {detail}")
    if status == "canceled":
        raise RuntimeError("prediction canceled")
    if status != "succeeded":
        raise RuntimeError(f"prediction incomplete ({status})")
    text = extract_replicate_output(payload.get("output"))
    if not text:
        raise RuntimeError("empty output")
    return text


def _model_specs(image_parts: list[dict] | None) -> list[dict[str, Any]]:
    if image_parts:
        vision = [m for m in REPLICATE_CHAT_MODELS if m.get("vision")]
        return vision or [REPLICATE_CHAT_MODELS[0]]
    return list(REPLICATE_CHAT_MODELS)


def call_replicate_chat_sync(
    message: str,
    history: list | None,
    system_prompt: str,
    api_token: str,
    *,
    image_parts: list[dict] | None = None,
    history_limit: int = 6,
    max_tokens: int = DEFAULT_CHAT_MAX_OUTPUT_TOKENS,
) -> tuple[str, str]:
    """Returns (reply_text, model_slug e.g. google/gemini-2.5-flash)."""
    prompt = build_history_prompt(message, history, history_limit)
    last_err: Optional[Exception] = None
    token_budgets = [max_tokens, min(max_tokens * 2, 2048)]
    for spec in _model_specs(image_parts):
        slug = f"{spec['owner']}/{spec['name']}"
        for budget in token_budgets:
            try:
                if spec["kind"] == "gemini":
                    inp = _gemini_input(prompt, system_prompt, image_parts, budget)
                else:
                    inp = _llama_input(prompt, system_prompt, budget)
                text = run_replicate_prediction(spec["owner"], spec["name"], api_token, inp)
                if looks_truncated_reply(text):
                    last_err = RuntimeError(f"{slug}: truncated reply ({text[-24:]!r})")
                    continue
                if text:
                    return text, slug
                last_err = RuntimeError(f"{slug}: empty reply")
            except Exception as e:
                last_err = e
                msg = str(e).lower()
                if any(x in msg for x in ("429", "rate limit", "404", "not found", "truncated")):
                    continue
                raise
    raise RuntimeError(f"replicate all models failed: {last_err}")


async def call_replicate_chat(
    message: str,
    history: list | None,
    system_prompt: str,
    api_token: str,
    *,
    image_parts: list[dict] | None = None,
    history_limit: int = 6,
    max_tokens: int = DEFAULT_CHAT_MAX_OUTPUT_TOKENS,
) -> tuple[str, str]:
    return await asyncio.to_thread(
        call_replicate_chat_sync,
        message,
        history,
        system_prompt,
        api_token,
        image_parts=image_parts,
        history_limit=history_limit,
        max_tokens=max_tokens,
    )


def probe_replicate_sync(api_token: str) -> None:
    run_replicate_prediction(
        "google",
        "gemini-2.5-flash",
        api_token,
        {
            "prompt": "Say hi in one word.",
            "system_instruction": "Reply briefly.",
            "max_output_tokens": 16,
            "thinking_budget": 0,
            "dynamic_thinking": False,
        },
        wait_seconds=30,
        timeout=45,
    )
