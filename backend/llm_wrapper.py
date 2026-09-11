"""
LLMWrapper — single entry point for every LLM API call.

All chat / embed providers go through `LLMWrapper.invoke` (or the module-level
helpers). Each call writes one row to `llm_transactions` with the estimated
cost for that transaction, and updates the running Usage aggregates.
"""

from __future__ import annotations

import asyncio
import inspect
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Optional, Union

try:
    from .llm_usage import (
        COST_PER_CALL_USD,
        classify_llm_error,
        estimate_event_cost,
        load_credits_state,
        apply_usage_event,
        save_credits_state,
        notify_admins_if_needed,
        take_embed_calls,
    )
except ImportError:
    from llm_usage import (
        COST_PER_CALL_USD,
        classify_llm_error,
        estimate_event_cost,
        load_credits_state,
        apply_usage_event,
        save_credits_state,
        notify_admins_if_needed,
        take_embed_calls,
    )

CallFn = Callable[..., Union[Any, Awaitable[Any]]]


@dataclass
class LLMCallResult:
    """Normalized result of one wrapped LLM API call."""

    text: str = ""
    provider: str = ""
    model: str = ""
    ok: bool = True
    cost_usd: float = 0.0
    latency_ms: float = 0.0
    predict_time_s: Optional[float] = None
    transaction_id: Optional[str] = None
    purpose: str = "chat"
    meta: dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None
    raw: Any = None


def _normalize_raw(raw: Any) -> tuple[str, str, dict[str, Any]]:
    """Accept str | (text, model, meta) | (text, model) shapes from providers."""
    if raw is None:
        return "", "", {}
    if isinstance(raw, str):
        return raw, "", {}
    if isinstance(raw, tuple):
        if len(raw) >= 3:
            text, model, meta = raw[0], raw[1], raw[2]
            return str(text or ""), str(model or ""), dict(meta or {}) if isinstance(meta, dict) else {}
        if len(raw) == 2:
            text, model = raw[0], raw[1]
            if isinstance(model, dict):
                return str(text or ""), "", dict(model)
            return str(text or ""), str(model or ""), {}
        if len(raw) == 1:
            return str(raw[0] or ""), "", {}
    return str(raw), "", {}


def insert_llm_transaction(
    sb,
    *,
    purpose: str,
    provider: str,
    model: str = "",
    ok: bool = True,
    cost_usd: float = 0.0,
    latency_ms: Optional[float] = None,
    predict_time_s: Optional[float] = None,
    input_chars: Optional[int] = None,
    output_chars: Optional[int] = None,
    user_id: Optional[str] = None,
    request_id: Optional[str] = None,
    error_kind: Optional[str] = None,
    error_msg: Optional[str] = None,
    meta: Optional[dict[str, Any]] = None,
    transaction_id: Optional[str] = None,
) -> Optional[str]:
    """Insert one row into llm_transactions. Returns the row id, or None on failure."""
    if not sb:
        return None
    tid = transaction_id or str(uuid.uuid4())
    row: dict[str, Any] = {
        "id": tid,
        "purpose": purpose or "chat",
        "provider": provider,
        "model": model or None,
        "ok": bool(ok),
        "cost_usd": round(float(cost_usd or 0), 6),
        "latency_ms": int(round(latency_ms)) if latency_ms is not None else None,
        "predict_time_ms": int(round(float(predict_time_s) * 1000)) if predict_time_s else None,
        "input_chars": int(input_chars) if input_chars is not None else None,
        "output_chars": int(output_chars) if output_chars is not None else None,
        "user_id": user_id or None,
        "request_id": request_id or None,
        "error_kind": error_kind,
        "error_msg": (error_msg or "")[:500] or None,
        "meta": meta or {},
    }
    try:
        sb.table("llm_transactions").insert(row).execute()
        try:
            _bump_plan_tx_stats(sb, user_id=user_id, cost_usd=float(cost_usd or 0))
        except Exception:
            pass
        return tid
    except Exception:
        # Table missing or RLS — best-effort; aggregates still update.
        return None


def _bump_plan_tx_stats(sb, *, user_id: Optional[str], cost_usd: float) -> None:
    """Increment plans.tx_count / tx_cost_usd for the user's current plan_id."""
    if not sb or not user_id:
        return
    try:
        ures = (
            sb.table("users")
            .select("plan_id,plan")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        urow = (ures.data or [None])[0] or {}
        plan_id = (urow.get("plan_id") or urow.get("plan") or "trial")
        plan_id = str(plan_id).strip().lower() or "trial"
        if plan_id not in ("trial", "starter", "premium", "annual"):
            try:
                from .plan_entitlements import plan_id_from_name
            except ImportError:
                from plan_entitlements import plan_id_from_name
            plan_id = plan_id_from_name(plan_id)
        pres = (
            sb.table("plans")
            .select("tx_count,tx_cost_usd")
            .eq("id", plan_id)
            .limit(1)
            .execute()
        )
        if not pres.data:
            return
        prow = pres.data[0]
        next_count = int(prow.get("tx_count") or 0) + 1
        next_cost = round(float(prow.get("tx_cost_usd") or 0) + max(0.0, float(cost_usd or 0)), 6)
        from datetime import datetime, timezone

        sb.table("plans").update(
            {
                "tx_count": next_count,
                "tx_cost_usd": next_cost,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", plan_id).execute()
    except Exception:
        pass


def _apply_aggregates(
    sb,
    *,
    provider: str,
    ok: bool,
    model: str,
    cost_usd: float,
    error_msg: str = "",
    key_identity: Optional[dict[str, str]] = None,
    fold_pending_embeds: bool = False,
) -> dict[str, Any]:
    state = load_credits_state(sb, key_identity)
    kind = classify_llm_error(error_msg) if not ok else None
    state = apply_usage_event(
        state,
        provider=provider,
        ok=ok,
        cost_usd=cost_usd,
        model=model,
        error_kind=kind,
        error_msg=error_msg,
    )
    if fold_pending_embeds:
        n_embed = take_embed_calls()
        embed_cost = COST_PER_CALL_USD["gemini_embed"]
        for _ in range(max(0, n_embed)):
            state = apply_usage_event(
                state,
                provider="gemini_embed",
                ok=True,
                cost_usd=embed_cost,
            )
    try:
        save_credits_state(sb, state)
    except Exception:
        pass
    return state


class LLMWrapper:
    """Wraps provider callables so every API hit is timed, costed, and persisted."""

    def __init__(
        self,
        sb=None,
        *,
        key_identity_fn: Optional[Callable[[], dict[str, str]]] = None,
        on_call: Optional[Callable[[LLMCallResult], None]] = None,
        notify: bool = True,
        resend_api_key: str = "",
        resend_from: str = "",
        app_url: str = "",
    ):
        self.sb = sb
        self.key_identity_fn = key_identity_fn
        self.on_call = on_call
        self.notify = notify
        self.resend_api_key = resend_api_key
        self.resend_from = resend_from
        self.app_url = app_url

    def _identity(self) -> Optional[dict[str, str]]:
        if not self.key_identity_fn:
            return None
        try:
            return self.key_identity_fn()
        except Exception:
            return None

    async def invoke(
        self,
        provider: str,
        call: CallFn,
        *,
        model: str = "",
        purpose: str = "chat",
        user_id: Optional[str] = None,
        request_id: Optional[str] = None,
        input_chars: Optional[int] = None,
        default_model: str = "",
        fold_pending_embeds: bool = False,
        meta: Optional[dict[str, Any]] = None,
    ) -> LLMCallResult:
        """Run one LLM API call and record its transaction + cost."""
        t0 = time.perf_counter()
        tid = str(uuid.uuid4())
        err: Optional[str] = None
        raw: Any = None
        ok = False
        text = ""
        used_model = model or default_model
        call_meta: dict[str, Any] = dict(meta or {})
        predict_time_s: Optional[float] = None

        try:
            result = call()
            if inspect.isawaitable(result):
                raw = await result
            elif inspect.iscoroutinefunction(call):
                raw = await call()
            else:
                raw = await asyncio.to_thread(call)
            text, parsed_model, parsed_meta = _normalize_raw(raw)
            if parsed_model:
                used_model = parsed_model
            if parsed_meta:
                call_meta.update(parsed_meta)
                if parsed_meta.get("predict_time_s") is not None:
                    predict_time_s = float(parsed_meta["predict_time_s"])
            if not text and purpose == "chat":
                raise RuntimeError(f"{provider} returned empty reply")
            ok = True
        except Exception as e:
            err = str(e)
            ok = False

        latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        cost = estimate_event_cost(
            provider,
            model=used_model,
            predict_time_s=predict_time_s,
            ok=ok,
        )
        error_kind = classify_llm_error(err or "") if not ok else None

        tx_id = insert_llm_transaction(
            self.sb,
            purpose=purpose,
            provider=provider,
            model=used_model,
            ok=ok,
            cost_usd=cost,
            latency_ms=latency_ms,
            predict_time_s=predict_time_s,
            input_chars=input_chars,
            output_chars=len(text) if text else None,
            user_id=user_id,
            request_id=request_id,
            error_kind=error_kind,
            error_msg=err,
            meta={**call_meta, "wrapper": "llm_wrapper"},
            transaction_id=tid,
        )

        state = None
        try:
            state = _apply_aggregates(
                self.sb,
                provider=provider,
                ok=ok,
                model=used_model,
                cost_usd=cost,
                error_msg=err or "",
                key_identity=self._identity(),
                fold_pending_embeds=fold_pending_embeds,
            )
        except Exception:
            state = None

        if self.notify and state is not None and self.sb:
            try:
                notify_admins_if_needed(
                    self.sb,
                    state,
                    resend_api_key=self.resend_api_key,
                    resend_from=self.resend_from,
                    app_url=self.app_url,
                )
            except Exception:
                pass

        result = LLMCallResult(
            text=text if ok else "",
            provider=provider,
            model=used_model,
            ok=ok,
            cost_usd=cost,
            latency_ms=latency_ms,
            predict_time_s=predict_time_s,
            transaction_id=tx_id or tid,
            purpose=purpose,
            meta=call_meta,
            error=err,
            raw=raw if ok else None,
        )
        if self.on_call:
            try:
                self.on_call(result)
            except Exception:
                pass
        if not ok:
            raise RuntimeError(err or f"{provider} failed")
        return result

    async def chat(
        self,
        provider: str,
        call: CallFn,
        *,
        model: str = "",
        user_id: Optional[str] = None,
        request_id: Optional[str] = None,
        input_chars: Optional[int] = None,
        fold_pending_embeds: bool = False,
        **kwargs: Any,
    ) -> LLMCallResult:
        return await self.invoke(
            provider,
            call,
            model=model,
            purpose="chat",
            user_id=user_id,
            request_id=request_id,
            input_chars=input_chars,
            fold_pending_embeds=fold_pending_embeds,
            **kwargs,
        )

    def record_embed_sync(
        self,
        *,
        ok: bool,
        model: str = "gemini-embedding-001",
        provider: str = "gemini_embed",
        latency_ms: float = 0.0,
        input_chars: Optional[int] = None,
        output_dim: Optional[int] = None,
        user_id: Optional[str] = None,
        request_id: Optional[str] = None,
        error_msg: Optional[str] = None,
    ) -> LLMCallResult:
        """Sync path for embedding calls (used from threadpool RAG)."""
        cost = estimate_event_cost(provider, model=model, ok=ok)
        error_kind = classify_llm_error(error_msg or "") if not ok else None
        tid = str(uuid.uuid4())
        tx_id = insert_llm_transaction(
            self.sb,
            purpose="embed",
            provider=provider,
            model=model,
            ok=ok,
            cost_usd=cost,
            latency_ms=latency_ms,
            input_chars=input_chars,
            output_chars=output_dim,
            user_id=user_id,
            request_id=request_id,
            error_kind=error_kind,
            error_msg=error_msg,
            meta={"wrapper": "llm_wrapper"},
            transaction_id=tid,
        )
        try:
            _apply_aggregates(
                self.sb,
                provider=provider,
                ok=ok,
                model=model,
                cost_usd=cost,
                error_msg=error_msg or "",
                key_identity=self._identity(),
                fold_pending_embeds=False,
            )
        except Exception:
            pass
        return LLMCallResult(
            provider=provider,
            model=model,
            ok=ok,
            cost_usd=cost,
            latency_ms=latency_ms,
            transaction_id=tx_id or tid,
            purpose="embed",
            error=error_msg,
        )


# Module-level singleton set by main.py after Supabase / keys are ready.
_default_wrapper: Optional[LLMWrapper] = None


def set_default_wrapper(wrapper: LLMWrapper) -> None:
    global _default_wrapper
    _default_wrapper = wrapper


def get_wrapper() -> LLMWrapper:
    if _default_wrapper is None:
        return LLMWrapper(sb=None, notify=False)
    return _default_wrapper
