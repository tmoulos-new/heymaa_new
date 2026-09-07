import unittest

from replicate_chat import (
    build_history_prompt,
    extract_replicate_output,
    image_parts_to_data_urls,
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

    def test_image_parts_to_data_urls(self):
        urls = image_parts_to_data_urls([{"mime_type": "image/png", "data": "abc123"}])
        self.assertEqual(urls, ["data:image/png;base64,abc123"])


if __name__ == "__main__":
    unittest.main()
