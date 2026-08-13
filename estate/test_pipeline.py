#!/usr/bin/env python3
"""Tests for the parsing and derivation logic that cannot be eyeballed.

Run: python3 estate/test_pipeline.py
Stdlib unittest only - no dev dependencies, runs anywhere the pipeline runs.
"""
import json, sys, unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pipeline as P
import metrics as M


class TestNormalisation(unittest.TestCase):
    def test_postcode_forms(self):
        for raw in ("HG1 5HY", "hg15hy", "  HG1  5HY ", "12 Kings Rd, HG1 5HY"):
            self.assertEqual(P.norm_postcode(raw), "HG1 5HY", raw)
        self.assertEqual(P.norm_postcode("not a postcode"), "")

    def test_paon_from_address(self):
        self.assertEqual(P.paon_from_address("12 Cold Bath Road, Harrogate"), "12")
        self.assertEqual(P.paon_from_address("12A Cold Bath Road"), "12A")
        self.assertEqual(P.paon_from_address("The Old Rectory, Church Lane"), "THEOLDRECTORY")

    def test_prop_id_is_agent_independent(self):
        """Same dwelling via different agents must collapse to one property."""
        a = P.prop_id("HG1 5HY", "101")
        b = P.prop_id("hg15hy", " 101 ")
        self.assertEqual(a, b)

    def test_price_guards(self):
        self.assertEqual(P.parse_price("£485,000"), 485000)
        self.assertEqual(P.parse_price(485000), 485000)
        self.assertIsNone(P.parse_price("1200"))          # too small: sq ft, not a price
        self.assertIsNone(P.parse_price("07700900123"))   # phone number
        self.assertIsNone(P.parse_price(""))

    def test_status_vocabulary(self):
        self.assertEqual(P.norm_status("Sold STC"), "sstc")
        self.assertEqual(P.norm_status("Under offer"), "sstc")
        self.assertEqual(P.norm_status("Withdrawn"), "withdrawn")
        self.assertEqual(P.norm_status("For sale"), "available")


class TestPricePaidRow(unittest.TestCase):
    """Real HM Land Registry Price Paid column layout (headerless, 16 cols)."""

    def row(self, price="468000", date="2026-03-20 00:00", pc="HG2 0NA",
            paon="12", town="HARROGATE", cat="A"):
        return ["{GUID}", price, date, pc, "D", "N", "F", paon, "",
                "COLD BATH ROAD", "", town, "HARROGATE", "NORTH YORKSHIRE", cat, "A"]

    def test_in_area_by_postcode(self):
        rec = P.ppd_row(self.row(), {"HG1", "HG2"}, set())
        self.assertIsNotNone(rec)
        self.assertEqual(rec["price"], 468000)
        self.assertEqual(rec["date"], "2026-03-20")
        self.assertEqual(rec["postcode"], "HG2 0NA")

    def test_out_of_area_rejected(self):
        self.assertIsNone(P.ppd_row(self.row(pc="LS1 4AP", town="LEEDS"),
                                    {"HG1", "HG2"}, set()))

    def test_town_fallback_when_postcode_missing(self):
        rec = P.ppd_row(self.row(pc=""), set(), {"HARROGATE"})
        self.assertIsNone(rec, "no postcode means no joinable property key")

    def test_category_b_excluded(self):
        """Repossessions/auction transfers are not comparable to an agent sale."""
        self.assertIsNone(P.ppd_row(self.row(cat="B"), {"HG2"}, set()))
        self.assertIsNotNone(P.ppd_row(self.row(cat="A"), {"HG2"}, set()))

    def test_short_row_ignored(self):
        self.assertIsNone(P.ppd_row(["a", "b"], {"HG2"}, set()))


class TestJsonLd(unittest.TestCase):
    PAGE = """<html><head>
    <script type="application/ld+json">
    {"@context":"https://schema.org","@graph":[
      {"@type":"Residence","name":"3 bed semi",
       "url":"https://x.co.uk/p/1",
       "address":{"@type":"PostalAddress","streetAddress":"7 Duchy Avenue",
                  "addressLocality":"Harrogate","postalCode":"HG2 0LY"},
       "offers":{"@type":"Offer","price":"720000","priceCurrency":"GBP",
                 "availability":"https://schema.org/InStock"}},
      {"@type":"Residence","name":"2 bed flat - Sold STC",
       "address":{"@type":"PostalAddress","streetAddress":"44 Otley Road",
                  "postalCode":"HG2 0DP"},
       "offers":{"@type":"Offer","price":"325000"}},
      {"@type":"Organization","name":"Not a property"}
    ]}</script></head><body></body></html>"""

    def test_extracts_only_properties(self):
        items = P.extract_listings(self.PAGE)
        self.assertEqual(len(items), 2)
        first = items[0] if items[0]["postcode"] == "HG2 0LY" else items[1]
        self.assertEqual(first["price"], 720000)
        self.assertEqual(first["status"], "available")

    def test_reads_status_from_name(self):
        items = {i["postcode"]: i for i in P.extract_listings(self.PAGE)}
        self.assertEqual(items["HG2 0DP"]["status"], "sstc")

    def test_regex_fallback_without_jsonld(self):
        html = '<li><h2>9 Valley Drive, HG2 0JJ</h2><span>£875,000</span></li>'
        items = P.extract_listings(html)
        self.assertTrue(items)
        self.assertEqual(items[0]["postcode"], "HG2 0JJ")
        self.assertEqual(items[0]["price"], 875000)

    def test_malformed_json_does_not_raise(self):
        self.assertEqual(
            P.extract_listings('<script type="application/ld+json">{oops</script>'), [])


class TestSpanHistory(unittest.TestCase):
    def fresh(self):
        return {"properties": {}, "sold": {}, "run_dates": []}

    def obs(self, store, date, status="available", price=500000, agent="a1"):
        P.record_observation(store, pid="HG10AA|1", address="1 Test St",
                             postcode="HG1 0AA", agent=agent, price=price,
                             status=status, url="", date=date, gap_days=14)

    def test_daily_sightings_extend_one_span(self):
        s = self.fresh()
        for d in ("2026-01-01", "2026-01-02", "2026-01-09"):
            self.obs(s, d)
        spans = s["properties"]["HG10AA|1"]["spans"]
        self.assertEqual(len(spans), 1)
        self.assertEqual(spans[0]["end"], "2026-01-09")

    def test_absence_beyond_gap_opens_new_span(self):
        s = self.fresh()
        self.obs(s, "2026-01-01")
        self.obs(s, "2026-03-01")  # 59 days later -> genuine relist
        self.assertEqual(len(s["properties"]["HG10AA|1"]["spans"]), 2)

    def test_short_gap_is_not_a_relist(self):
        """A property missing from one scrape must not count as a relist."""
        s = self.fresh()
        self.obs(s, "2026-01-01")
        self.obs(s, "2026-01-10")  # 9 days < 14 day threshold
        self.assertEqual(len(s["properties"]["HG10AA|1"]["spans"]), 1)

    def test_agent_switch_opens_new_span(self):
        s = self.fresh()
        self.obs(s, "2026-01-01", agent="a1")
        self.obs(s, "2026-01-02", agent="a2")
        spans = s["properties"]["HG10AA|1"]["spans"]
        self.assertEqual([sp["agent"] for sp in spans], ["a1", "a2"])

    def test_price_history_records_only_changes(self):
        s = self.fresh()
        self.obs(s, "2026-01-01", price=500000)
        self.obs(s, "2026-01-02", price=500000)
        self.obs(s, "2026-01-03", price=475000)
        ph = s["properties"]["HG10AA|1"]["price_history"]
        self.assertEqual([p["price"] for p in ph], [500000, 475000])


class TestDerivation(unittest.TestCase):
    def test_preexisting_listing_not_counted_as_new(self):
        """Stock already on the market on day one is not a new instruction."""
        store = {"run_dates": ["2026-08-01"], "sold": {},
                 "properties": {"P1": {"address": "", "postcode": "", "spans": [
                     {"start": "2026-08-01", "end": "2026-08-01", "agent": "a1",
                      "status": "available", "first_price": 100000}]}}}
        ev = M.derive_events(store)
        self.assertTrue(ev[0]["pre_existing"])

    def test_sale_attributed_to_preceding_listing(self):
        spans = [{"start": "2026-01-10", "agent": "a1"},
                 {"start": "2026-05-01", "agent": "a2"}]
        self.assertEqual(M.attribute_sale(spans, "2026-03-20"), "a1")
        self.assertEqual(M.attribute_sale(spans, "2026-06-01"), "a2")

    def test_sale_long_after_listing_is_not_attributed(self):
        spans = [{"start": "2020-01-01", "agent": "a1"}]
        self.assertIsNone(M.attribute_sale(spans, "2026-03-20"))

    def test_sale_before_any_listing_is_not_attributed(self):
        spans = [{"start": "2026-05-01", "agent": "a1"}]
        self.assertIsNone(M.attribute_sale(spans, "2026-01-01"))

    def test_quarter_bucketing(self):
        self.assertEqual(M.quarter_of("2026-01-01"), "2026-Q1")
        self.assertEqual(M.quarter_of("2026-03-31"), "2026-Q1")
        self.assertEqual(M.quarter_of("2026-04-01"), "2026-Q2")
        self.assertEqual(M.quarter_of("2026-12-31"), "2026-Q4")

    def test_quarter_bounds(self):
        self.assertEqual(M.quarter_bounds("2026-Q1"), ("2026-01-01", "2026-03-31"))
        self.assertEqual(M.quarter_bounds("2026-Q2"), ("2026-04-01", "2026-06-30"))
        self.assertEqual(M.quarter_bounds("2024-Q1"), ("2024-01-01", "2024-03-31"))  # leap

    def test_coverage_reports_none_without_observations(self):
        """The critical honesty case: no data must not render as zero."""
        cov = M.coverage({"run_dates": []}, ["2026-Q1"], [], [])
        self.assertEqual(cov["2026-Q1"]["listing"], "none")
        self.assertEqual(cov["2026-Q1"]["sold"], "none")

    def test_coverage_partial_when_ppd_mid_quarter(self):
        sales = [{"date": "2026-05-15", "price": 1, "agent": None}]
        cov = M.coverage({"run_dates": []}, ["2026-Q2"], [], sales)
        self.assertEqual(cov["2026-Q2"]["sold"], "partial")


if __name__ == "__main__":
    unittest.main(verbosity=2)
