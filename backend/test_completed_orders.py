"""Tests for the ERP completed-orders feed."""
import os
import unittest
from datetime import datetime, timezone

import completed_orders as co


class CompletedOrdersTests(unittest.TestCase):
    def test_parse_after_zulu(self):
        dt = co.parse_after_param("2026-05-31T23:48:04Z")
        self.assertEqual(dt.tzinfo, timezone.utc)
        self.assertEqual(dt.year, 2026)
        self.assertEqual(dt.month, 5)
        self.assertEqual(dt.day, 31)

    def test_parse_limit_caps_and_defaults(self):
        self.assertEqual(co.parse_limit_param(None), 60)
        self.assertEqual(co.parse_limit_param("60"), 60)
        self.assertEqual(co.parse_limit_param(1000), 200)
        self.assertEqual(co.parse_limit_param(0), 1)

    def test_vat_split_24_percent(self):
        net, vat = co.split_vat(1900, 0.24)
        self.assertEqual(net + vat, 1900)
        self.assertEqual(net, 1532)
        self.assertEqual(vat, 368)

    def test_order_from_viva_tx(self):
        order = co.order_from_viva_tx(
            {
                "transactionId": "tx-1",
                "orderCode": 123456,
                "statusId": "F",
                "amount": 19.0,
                "email": "mom@example.com",
                "fullName": "Maria Papadaki",
                "insDate": "2026-09-10T12:00:00Z",
                "currencyCode": 978,
                "merchantTrns": "heymaa:starter:user-1",
                "customerTrns": "Starter — €19/μήνα",
            }
        )
        self.assertIsNotNone(order)
        self.assertEqual(order["id"], "tx-1")
        self.assertEqual(order["plan"], "starter")
        self.assertEqual(order["product"], "HeyMaa Starter")
        self.assertEqual(order["amount"], 19.0)
        self.assertEqual(order["amountCents"], 1900)
        self.assertEqual(order["email"], "mom@example.com")
        self.assertEqual(order["userId"], "user-1")
        self.assertEqual(order["status"], "completed")

    def test_ignores_failed_and_foreign_merchant(self):
        failed = co.order_from_viva_tx(
            {
                "transactionId": "tx-fail",
                "statusId": "E",
                "amount": 19.0,
                "merchantTrns": "heymaa:starter",
                "insDate": "2026-09-10T12:00:00Z",
            }
        )
        foreign = co.order_from_viva_tx(
            {
                "transactionId": "tx-other",
                "statusId": "F",
                "amount": 19.0,
                "merchantTrns": "babysong:monthly",
                "insDate": "2026-09-10T12:00:00Z",
            }
        )
        self.assertIsNone(failed)
        self.assertIsNone(foreign)

    def test_row_roundtrip(self):
        order = co.order_from_viva_tx(
            {
                "transactionId": "tx-2",
                "orderCode": "999",
                "statusId": "C",
                "amount": 3900,
                "email": "a@b.com",
                "fullName": "Ann",
                "insDate": "2026-09-01T00:00:00Z",
                "merchantTrns": "heymaa:premium",
                "customerTrns": "Premium — €39/month",
            }
        )
        back = co.row_to_order(co.order_to_row(order))
        self.assertEqual(back["transactionId"], "tx-2")
        self.assertEqual(back["plan"], "premium")
        self.assertEqual(back["amountCents"], 3900)
        self.assertEqual(back["amount"], 39.0)

    def test_erp_key_optional_until_configured(self):
        os.environ.pop("ERP_ORDERS_API_KEY", None)
        os.environ.pop("COMPLETED_ORDERS_API_KEY", None)
        os.environ["VERCEL"] = "1"
        self.addCleanup(os.environ.pop, "VERCEL", None)
        self.assertTrue(co.erp_key_authorized(""))
        os.environ["ERP_ORDERS_API_KEY"] = "secret-erp"
        self.addCleanup(os.environ.pop, "ERP_ORDERS_API_KEY", None)
        self.assertTrue(co.erp_key_authorized("secret-erp"))
        self.assertFalse(co.erp_key_authorized("nope"))
        self.assertFalse(co.erp_key_authorized(""))

    def test_provided_key_from_query_and_headers(self):
        self.assertEqual(co.provided_erp_key({}, "abc"), "abc")
        self.assertEqual(
            co.provided_erp_key({"X-Api-Key": "from-header"}, None),
            "from-header",
        )
        self.assertEqual(
            co.provided_erp_key({"Authorization": "Bearer tok"}, None),
            "tok",
        )

    def test_merge_prefers_enriched_fields(self):
        merged = co.merge_orders(
            [
                {
                    "id": "tx-1",
                    "completedAt": "2026-09-10T12:00:00.000Z",
                    "email": None,
                    "address": {"city": None, "country": "GR"},
                }
            ],
            [
                {
                    "id": "tx-1",
                    "completedAt": "2026-09-10T12:00:00.000Z",
                    "email": "mom@example.com",
                    "address": {"city": "Athens", "country": "GR"},
                }
            ],
        )
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["email"], "mom@example.com")
        self.assertEqual(merged[0]["address"]["city"], "Athens")


if __name__ == "__main__":
    unittest.main()
