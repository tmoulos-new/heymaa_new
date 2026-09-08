import unittest

from replicate_chat import (
    build_history_prompt,
    extract_replicate_output,
    image_parts_to_data_urls,
    looks_truncated_reply,
    model_order,
    prediction_metrics,
)


class ReplicateChatTests(unittest.TestCase):
    def test_build_history_prompt_with_current_message(self):
        history = [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there!"},
        ]
        out = build_history_prompt("How are you?", history, history_limit=6)
        self.assertIn("User: Hello", out)
        self.assertIn("Assistant: Hi there!", out)
        self.assertIn("User: How are you?", out)

    def test_build_history_prompt_message_only(self):
        self.assertEqual(build_history_prompt("καλημέρα", [], 6), "καλημέρα")

    def test_extract_output_concatenates_array(self):
        self.assertEqual(extract_replicate_output(["Hello", " world"]), "Hello world")

    def test_extract_output_nested_arrays(self):
        self.assertEqual(extract_replicate_output(["Hello", [" ", "world"]]), "Helloworld")

    def test_truncated_reply_detection(self):
        self.assertTrue(looks_truncated_reply("βοηθήσω με ό,"))
        self.assertFalse(looks_truncated_reply("Καλή μέρα! Πώς είσαι;"))

    def test_image_parts_to_data_urls(self):
        urls = image_parts_to_data_urls([{"mime_type": "image/png", "data": "abc123"}])
        self.assertEqual(urls, ["data:image/png;base64,abc123"])

    def test_prediction_metrics_predict_time(self):
        meta = prediction_metrics({"id": "abc", "status": "succeeded", "metrics": {"predict_time": 1.5}})
        self.assertEqual(meta["prediction_id"], "abc")
        self.assertEqual(meta["predict_time_s"], 1.5)

    def test_model_order_default_prefers_llama(self):
        slugs = [f"{m['owner']}/{m['name']}" for m in model_order()]
        self.assertEqual(
            slugs,
            [
                "meta/meta-llama-3-70b-instruct",
                "google/gemini-2.5-flash",
                "anthropic/claude-4.5-haiku",
            ],
        )

    def test_model_order_quality_and_vision_match_legacy_cascade(self):
        quality = [f"{m['owner']}/{m['name']}" for m in model_order(prefer_quality=True)]
        vision = [f"{m['owner']}/{m['name']}" for m in model_order(vision=True)]
        self.assertEqual(
            quality,
            [
                "google/gemini-2.5-flash",
                "meta/meta-llama-3-70b-instruct",
                "anthropic/claude-4.5-haiku",
            ],
        )
        self.assertEqual(
            vision,
            [
                "google/gemini-2.5-flash",
                "anthropic/claude-4.5-haiku",
                "meta/meta-llama-3-70b-instruct",
            ],
        )


if __name__ == "__main__":
    unittest.main()
