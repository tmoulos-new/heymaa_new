import os
import re
import unittest

from cors_config import (
    DEFAULT_CORS_ORIGIN_REGEX,
    cors_allowed_origin_regex,
    cors_allowed_origins,
)


class CorsConfigTests(unittest.TestCase):
    def test_default_origins_include_cra_and_admin_dev_ports(self):
        origins = cors_allowed_origins()
        self.assertIn("http://localhost:3002", origins)
        self.assertIn("http://127.0.0.1:3002", origins)
        self.assertIn("http://localhost:5174", origins)

    def test_env_origins_still_include_local_dev_ports(self):
        os.environ["CORS_ALLOWED_ORIGINS"] = "https://www.heymaa.ai"
        self.addCleanup(os.environ.pop, "CORS_ALLOWED_ORIGINS", None)
        origins = cors_allowed_origins()
        self.assertIn("https://www.heymaa.ai", origins)
        self.assertIn("http://localhost:3002", origins)
        self.assertIsNotNone(cors_allowed_origin_regex())
        pattern = re.compile(cors_allowed_origin_regex() or DEFAULT_CORS_ORIGIN_REGEX)
        self.assertTrue(pattern.fullmatch("http://localhost:3002"))
        self.assertTrue(pattern.fullmatch("http://127.0.0.1:3002"))
        self.assertIsNone(pattern.fullmatch("https://evil.example"))


if __name__ == "__main__":
    unittest.main()
