"""Tests for LLMWrapper + llm_transactions recording."""

import unittest
from unittest.mock import MagicMock

from llm_wrapper import LLMWrapper, LLMCallResult, insert_llm_transaction, _normalize_raw
from llm_usage import estimate_event_cost


class NormalizeRawTests(unittest.TestCase):
    def test_str(self):
        self.assertEqual(_normalize_raw("hi"), ("hi", "", {}))

    def test_triple(self):
        text, model, meta = _normalize_raw(("hello", "meta/llama", {"predict_time_s": 1.2}))
        self.assertEqual(text, "hello")
        self.assertEqual(model, "meta/llama")
        self.assertEqual(meta["predict_time_s"], 1.2)


class InsertTransactionTests(unittest.TestCase):
    def test_inserts_row(self):
        sb = MagicMock()
        table = MagicMock()
        sb.table.return_value = table
        table.insert.return_value = table
        table.execute.return_value = MagicMock()

        tid = insert_llm_transaction(
            sb,
            purpose="chat",
            provider="replicate",
            model="meta/meta-llama-3-70b-instruct",
            ok=True,
            cost_usd=0.0123,
            latency_ms=450,
            predict_time_s=1.5,
            input_chars=40,
            output_chars=120,
            request_id="req-1",
        )
        self.assertIsNotNone(tid)
        sb.table.assert_called_with("llm_transactions")
        row = table.insert.call_args[0][0]
        self.assertEqual(row["provider"], "replicate")
        self.assertEqual(row["cost_usd"], 0.0123)
        self.assertEqual(row["purpose"], "chat")
        self.assertEqual(row["predict_time_ms"], 1500)

    def test_no_sb_returns_none(self):
        self.assertIsNone(insert_llm_transaction(None, purpose="chat", provider="groq"))


class WrapperInvokeTests(unittest.IsolatedAsyncioTestCase):
    async def test_success_records_cost(self):
        sb = MagicMock()
        # load/save credits will fail soft; inserts should still be attempted
        sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[]
        )
        sb.table.return_value.insert.return_value.execute.return_value = MagicMock()
        sb.table.return_value.upsert.return_value.execute.return_value = MagicMock()

        seen = []

        def on_call(r: LLMCallResult):
            seen.append(r)

        wrapper = LLMWrapper(sb=sb, notify=False, on_call=on_call)

        async def _call():
            return "ok reply", "meta/meta-llama-3-70b-instruct", {"predict_time_s": 2.0}

        result = await wrapper.chat("replicate", _call, request_id="r1", input_chars=10)
        self.assertTrue(result.ok)
        self.assertEqual(result.text, "ok reply")
        self.assertGreater(result.cost_usd, 0)
        expected = estimate_event_cost(
            "replicate", model="meta/meta-llama-3-70b-instruct", predict_time_s=2.0, ok=True
        )
        self.assertEqual(result.cost_usd, expected)
        self.assertEqual(len(seen), 1)
        # llm_transactions insert happened
        self.assertTrue(any(c.args and c.args[0] == "llm_transactions" for c in sb.table.call_args_list))

    async def test_failure_still_writes_transaction(self):
        sb = MagicMock()
        sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[]
        )
        sb.table.return_value.insert.return_value.execute.return_value = MagicMock()
        sb.table.return_value.upsert.return_value.execute.return_value = MagicMock()

        wrapper = LLMWrapper(sb=sb, notify=False)

        async def _boom():
            raise RuntimeError("429 rate limit")

        with self.assertRaises(RuntimeError):
            await wrapper.chat("groq", _boom)
        self.assertTrue(any(c.args and c.args[0] == "llm_transactions" for c in sb.table.call_args_list))

    def test_record_embed_sync(self):
        sb = MagicMock()
        sb.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
            data=[]
        )
        sb.table.return_value.insert.return_value.execute.return_value = MagicMock()
        sb.table.return_value.upsert.return_value.execute.return_value = MagicMock()

        wrapper = LLMWrapper(sb=sb, notify=False)
        r = wrapper.record_embed_sync(ok=True, latency_ms=12.0, input_chars=20, output_dim=768)
        self.assertTrue(r.ok)
        self.assertEqual(r.purpose, "embed")
        self.assertEqual(r.cost_usd, estimate_event_cost("gemini_embed", ok=True))


if __name__ == "__main__":
    unittest.main()
