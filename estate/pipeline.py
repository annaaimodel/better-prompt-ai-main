#!/usr/bin/env python3
"""
Estate-agent market-share pipeline: COLLECTION.

Four independent sources feed one observation store (estate/store.json):

  1. snapshot  - reads each tracked agent's live listing pages (directly, or via
                 their own sitemap.xml) and records what is on the market TODAY.
                 Builds true first-party history from the day it starts running.
  2. wayback   - replays Internet Archive captures of those same pages through the
                 same extractor, reconstructing what an agent had listed, and at
                 what price, on the dates the Archive crawled. The only route to
                 historical listing data.
  3. ppd       - HM Land Registry Price Paid Data. Free, official, Open Government
                 Licence, and ALREADY PUBLISHED for Q1/Q2 2026. Verified sold price
                 and sold date, but no agent name - joined to listings by address.
  4. csv       - manual/exported backfill (estate/backfill.csv) for anything you
                 obtain elsewhere.

Collection is deliberately dumb: it records raw observations and never computes a
metric. All derivation lives in metrics.py, so improving the event logic re-reads
existing history instead of needing a re-scrape.

Stdlib only, matching jobs/pipeline.py. Every network source is wrapped so one
flaky source never breaks a run.
"""
from __future__ import annotations
import csv, io, json, datetime, os, re, sys, time
import urllib.request, urllib.parse, urllib.error, urllib.robotparser
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONFIG_FILE = ROOT / "config.json"
STORE_FILE = ROOT / "store.json"
BACKFILL_CSV = ROOT / "backfill.csv"
TODAY = datetime.date.today().isoformat()

# What to run this pass. Snapshot hits third-party sites, so it is opt-in per run;
# PPD is a cheap single file and refreshes monthly at source.
ONLY = {p.strip() for p in os.environ.get("ONLY", "").split(",") if p.strip()}


# Wayback is a one-off historical backfill, not a daily job: the past does not
# change, and re-walking the Archive every night would be pure waste. It runs only
# when asked for by name (ONLY=wayback).
ON_DEMAND = {"wayback"}


def want(stage: str) -> bool:
    return stage in ONLY if ONLY else stage not in ON_DEMAND


# --- Normalisation -------------------------------------------------------
# Everything joins on address, never on agent, so a property moving between
# agents stays a single tracked property (that switch is itself a useful signal).

POSTCODE_RE = re.compile(r"\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b", re.I)
PRICE_RE = re.compile(r"£\s?([\d,]{4,})")
LEADING_PAON_RE = re.compile(r"^\s*(\d+[A-Z]?)\b", re.I)


def norm_postcode(s: str) -> str:
    """'ab12cd' / 'AB1 2CD' -> 'AB1 2CD'. Empty string if not a postcode."""
    m = POSTCODE_RE.search(s or "")
    return f"{m.group(1).upper()} {m.group(2).upper()}" if m else ""


def postcode_prefix(pc: str) -> str:
    return pc.split(" ")[0] if pc else ""


def norm_paon(s: str) -> str:
    """Primary addressable object name -> comparable key ('12A' / 'THEOLDRECTORY')."""
    return re.sub(r"[^A-Z0-9]", "", (s or "").upper())


def paon_from_address(addr: str) -> str:
    """Pull the house number/name off the front of a free-text listing address."""
    first = (addr or "").split(",")[0].strip()
    m = LEADING_PAON_RE.match(first)
    return norm_paon(m.group(1) if m else first)


def prop_id(postcode: str, paon: str) -> str:
    """Stable per-property key. Postcode + house number identifies a UK dwelling."""
    return f"{norm_postcode(postcode).replace(' ', '')}|{norm_paon(paon)}"


def parse_price(v) -> int | None:
    if isinstance(v, (int, float)) and v > 0:
        return int(v)
    s = str(v or "")
    m = PRICE_RE.search(s) or re.search(r"([\d,]{4,})", s)
    if not m:
        return None
    try:
        n = int(m.group(1).replace(",", ""))
    except ValueError:
        return None
    # Guard against phone numbers / square footage masquerading as prices.
    return n if 10_000 <= n <= 100_000_000 else None


def clean(s) -> str:
    return re.sub(r"\s+", " ", str(s or "")).strip()


def days_between(a: str, b: str) -> int:
    return (datetime.date.fromisoformat(b) - datetime.date.fromisoformat(a)).days


# --- Status vocabulary ---------------------------------------------------
SOLD_MARKERS = ("sold stc", "under offer", "sale agreed", "sstc", "sold subject")
GONE_MARKERS = ("withdrawn", "off market", "let agreed")


def norm_status(text: str) -> str:
    t = (text or "").lower()
    if any(m in t for m in SOLD_MARKERS):
        return "sstc"
    if "sold" in t:
        return "sold"
    if any(m in t for m in GONE_MARKERS):
        return "withdrawn"
    return "available"


# --- Store ---------------------------------------------------------------
def load_store() -> dict:
    if STORE_FILE.exists():
        try:
            return json.loads(STORE_FILE.read_text())
        except (json.JSONDecodeError, OSError) as e:
            print(f"  ! store.json unreadable ({e}); starting fresh", file=sys.stderr)
    return {"version": 1, "updated": "", "run_dates": [], "archive_dates": [],
            "properties": {}, "sold": {}}


def save_store(store: dict) -> None:
    store["updated"] = TODAY
    STORE_FILE.write_text(json.dumps(store, indent=1, sort_keys=True))


def record_observation(store: dict, *, pid: str, address: str, postcode: str,
                       agent: str, price: int | None, status: str, url: str,
                       date: str, gap_days: int,
                       observed_dates: list[str] | None = None) -> None:
    """Fold one sighting into the property's span history.

    A span is a contiguous run of days a property was on the market with one agent.
    Extending a span is the common case; a new span opens when the property has been
    absent long enough to count as genuinely off-market, or when the agent changes.

    `observed_dates` is when we actually looked. Absence must be OBSERVED, not
    inferred from a gap: with daily snapshots the two are equivalent, but archive
    coverage can be six weeks apart, and a property seen in January and again in
    April was most likely listed throughout rather than relisted. Pass None (CSV
    backfill, where dates are stated outright) to fall back to the gap alone.
    """
    props = store.setdefault("properties", {})
    p = props.setdefault(pid, {"address": address, "postcode": postcode,
                               "spans": [], "price_history": [], "urls": []})
    # Keep the longest address seen - later sightings are often truncated.
    if len(address) > len(p.get("address", "")):
        p["address"] = address
    if url and url not in p["urls"]:
        p["urls"].append(url)

    spans = p["spans"]
    cur = spans[-1] if spans else None
    long_gap = cur is not None and days_between(cur["end"], date) > gap_days
    if long_gap and observed_dates is not None:
        # Did we look between the last sighting and now and NOT find it?
        long_gap = any(cur["end"] < d < date for d in observed_dates)
    reopen = (
        cur is None
        or cur["agent"] != agent
        or cur["status"] in ("sold", "withdrawn")
        or long_gap
    )
    if reopen:
        spans.append({"start": date, "end": date, "agent": agent, "status": status,
                      "first_price": price, "last_price": price})
    else:
        cur["end"] = date
        cur["status"] = status
        if price:
            cur["last_price"] = price
            if cur.get("first_price") is None:
                cur["first_price"] = price

    if price:
        ph = p["price_history"]
        if not ph or ph[-1]["price"] != price:
            ph.append({"date": date, "price": price})


# --- HTTP ----------------------------------------------------------------
class Fetcher:
    """Polite HTTP: honest identification, hard rate limit, robots.txt always obeyed.

    robots.txt compliance is intentionally not configurable. It is what keeps this
    tool defensible, and a scraper that ignores it gets the source blocked anyway.
    """

    def __init__(self, cfg: dict):
        c = cfg.get("collection", {})
        self.delay = float(c.get("delay_seconds", 5))
        self.timeout = int(c.get("timeout_seconds", 25))
        contact = c.get("contact_email", "")
        self.ua = f"estate-insights-bot/1.0 (+market research; contact: {contact})"
        self._robots: dict[str, urllib.robotparser.RobotFileParser | None] = {}
        self._last = 0.0

    def _allowed(self, url: str) -> bool:
        parts = urllib.parse.urlsplit(url)
        base = f"{parts.scheme}://{parts.netloc}"
        if base not in self._robots:
            rp = urllib.robotparser.RobotFileParser()
            rp.set_url(f"{base}/robots.txt")
            try:
                rp.read()
            except Exception:
                # No reachable robots.txt: treat as no restrictions stated.
                rp = None
            self._robots[base] = rp
        rp = self._robots[base]
        return True if rp is None else rp.can_fetch(self.ua, url)

    def get(self, url: str) -> str | None:
        if not self._allowed(url):
            print(f"  - robots.txt disallows, skipping: {url}")
            return None
        wait = self.delay - (time.time() - self._last)
        if wait > 0:
            time.sleep(wait)
        self._last = time.time()
        req = urllib.request.Request(url, headers={
            "User-Agent": self.ua,
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "en-GB,en;q=0.9",
        })
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                raw = r.read()
                charset = r.headers.get_content_charset() or "utf-8"
            return raw.decode(charset, errors="replace")
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as e:
            print(f"  ! fetch failed {url}: {e}", file=sys.stderr)
            return None


# --- JSON-LD extraction --------------------------------------------------
# Property sites publish schema.org JSON-LD deliberately, for search engines. It is
# the stable, intended machine-readable surface - far better than CSS selectors that
# break on every redesign.

class LdParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self._in = False
        self.blocks: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag == "script" and dict(attrs).get("type", "").strip().lower() == "application/ld+json":
            self._in = True

    def handle_endtag(self, tag):
        if tag == "script":
            self._in = False

    def handle_data(self, data):
        if self._in and data.strip():
            self.blocks.append(data)


def iter_ld_nodes(html_text: str):
    """Yield every dict in every JSON-LD block, flattening @graph and arrays."""
    p = LdParser()
    try:
        p.feed(html_text)
    except Exception:
        return
    for block in p.blocks:
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            continue
        stack = [data]
        while stack:
            node = stack.pop()
            if isinstance(node, list):
                stack.extend(node)
            elif isinstance(node, dict):
                yield node
                for key in ("@graph", "itemListElement", "item", "offers", "mainEntity"):
                    if key in node:
                        stack.append(node[key])


PROPERTY_TYPES = {"residence", "singlefamilyresidence", "apartment", "house",
                  "product", "offer", "realestatelisting", "accommodation"}


def ld_to_listing(node: dict) -> dict | None:
    """Map one JSON-LD node to {address, postcode, price, status, url} if it looks
    like a property listing."""
    types = node.get("@type") or ""
    types = [types] if isinstance(types, str) else types
    if not any(str(t).lower().replace(" ", "") in PROPERTY_TYPES for t in types):
        return None

    addr = node.get("address")
    postcode = street = locality = ""
    if isinstance(addr, dict):
        postcode = clean(addr.get("postalCode"))
        street = clean(addr.get("streetAddress"))
        locality = clean(addr.get("addressLocality"))
    elif isinstance(addr, str):
        street = clean(addr)
    text = ", ".join(x for x in (street, locality, postcode) if x)
    postcode = norm_postcode(postcode) or norm_postcode(text)
    if not postcode:
        return None  # without a postcode we cannot key or join the property

    price = None
    offers = node.get("offers")
    if isinstance(offers, list):
        offers = offers[0] if offers else None
    if isinstance(offers, dict):
        price = parse_price(offers.get("price") or offers.get("lowPrice"))
        avail = clean(offers.get("availability"))
    else:
        avail = ""
    if price is None:
        price = parse_price(node.get("price"))

    status_text = " ".join([avail, clean(node.get("name")), clean(node.get("description"))])
    return {"address": text or street, "postcode": postcode, "price": price,
            "status": norm_status(status_text), "url": clean(node.get("url"))}


# Fallback for pages with no JSON-LD: pair each postcode with the nearest price.
CARD_SPLIT_RE = re.compile(r"<(?:li|article|div)\b[^>]*>", re.I)
TAG_RE = re.compile(r"<[^>]+>")


def regex_listings(html_text: str) -> list[dict]:
    out = []
    for chunk in CARD_SPLIT_RE.split(html_text):
        text = clean(TAG_RE.sub(" ", chunk))
        if len(text) > 600:
            continue
        pc = norm_postcode(text)
        if not pc:
            continue
        price = parse_price(text)
        out.append({"address": text[:200], "postcode": pc, "price": price,
                    "status": norm_status(text), "url": ""})
    return out


def extract_listings(html_text: str) -> list[dict]:
    found, seen = [], set()
    for node in iter_ld_nodes(html_text):
        item = ld_to_listing(node)
        if item:
            key = (item["postcode"], paon_from_address(item["address"]))
            if key not in seen:
                seen.add(key)
                found.append(item)
    if found:
        return found
    return regex_listings(html_text)


# --- Sitemaps ------------------------------------------------------------
# An agent's own site publishes /sitemap.xml listing every property page. That is
# far better than guessing pagination: no missed pages, no ?page=N convention to
# reverse-engineer, and it survives redesigns. Portals do not give you this.

SM_NS = "{http://www.sitemaps.org/schemas/sitemap/0.9}"


def parse_sitemap(xml_text: str) -> tuple[list[str], list[str]]:
    """-> (child sitemap URLs, page URLs). Handles both index and urlset files."""
    try:
        root = ET.fromstring(xml_text.strip())
    except ET.ParseError:
        return [], []
    tag = root.tag.replace(SM_NS, "")
    locs = [(e.findtext(f"{SM_NS}loc") or e.findtext("loc") or "").strip()
            for e in root]
    locs = [u for u in locs if u]
    return (locs, []) if tag == "sitemapindex" else ([], locs)


def sitemap_urls(fetcher: "Fetcher", root_url: str, match: str = "",
                 limit: int = 2000, max_children: int = 20) -> list[str]:
    """Walk a sitemap (following index files) and return matching page URLs."""
    pending, pages, seen = [root_url], [], set()
    while pending and len(pages) < limit and len(seen) < max_children:
        url = pending.pop(0)
        if url in seen:
            continue
        seen.add(url)
        body = fetcher.get(url)
        if not body:
            continue
        children, found = parse_sitemap(body)
        pending.extend(children)
        pages.extend(found)
    if match:
        pages = [u for u in pages if match in u]
    # De-duplicate, preserving discovery order.
    out, got = [], set()
    for u in pages:
        if u not in got:
            got.add(u)
            out.append(u)
    return out[:limit]


# --- Wayback Machine -----------------------------------------------------
# The one route that CAN see the past. The Internet Archive's CDX API lists every
# archived capture of a URL with a timestamp; replaying those captures through the
# same JSON-LD extractor reconstructs what an agent had on the market on that date,
# asking prices included.
#
# Honest limits: coverage is whatever the Archive happened to crawl. A well-known
# agent may be captured weekly, a small independent never. Sparse coverage gives a
# sound average list price (one capture is enough for a point-in-time reading) but
# only approximate listed/relisted counts, so these quarters are reported as
# "archive" rather than "measured" and the report says so.

CDX_API = "https://web.archive.org/cdx/search/cdx"
WB_REPLAY = "https://web.archive.org/web/{ts}id_/{url}"


def parse_cdx(body: str) -> list[tuple[str, str]]:
    """CDX JSON -> [(timestamp, original_url)]. First row is a header."""
    try:
        rows = json.loads(body)
    except json.JSONDecodeError:
        return []
    if not rows or len(rows) < 2:
        return []
    head = [c.lower() for c in rows[0]]
    try:
        ti, oi = head.index("timestamp"), head.index("original")
    except ValueError:
        return []
    out = []
    for r in rows[1:]:
        if len(r) > max(ti, oi) and len(r[ti]) >= 8:
            out.append((r[ti], r[oi]))
    return sorted(set(out))


def cdx_snapshots(fetcher: "Fetcher", url: str, frm: str, to: str,
                  collapse: str, limit: int) -> list[tuple[str, str]]:
    q = urllib.parse.urlencode({
        "url": url, "output": "json", "fl": "timestamp,original",
        "filter": "statuscode:200", "collapse": collapse,
        "from": (frm or "").replace("-", ""), "to": (to or "").replace("-", ""),
        "limit": str(limit),
    })
    body = fetcher.get(f"{CDX_API}?{q}")
    return parse_cdx(body) if body else []


def run_wayback(cfg: dict, store: dict) -> int:
    fetcher = Fetcher(cfg)
    gap = int(cfg.get("metrics", {}).get("relist_gap_days", 14))
    archive_dates = set(store.setdefault("archive_dates", []))
    total = 0

    for agent in cfg.get("agents", []):
        for src in agent.get("sources", []):
            if src.get("type") != "wayback":
                continue
            snaps = cdx_snapshots(fetcher, src["url"], src.get("from", ""),
                                  src.get("to", ""),
                                  src.get("collapse", "timestamp:6"),
                                  int(src.get("max_snapshots", 40)))
            if not snaps:
                print(f"  - {agent['name']}: no archive captures for {src['url']}")
                continue
            print(f"  . {agent['name']}: {len(snaps)} captures of {src['url']}")
            looked: list[str] = []           # capture dates processed, chronological
            for ts, original in snaps:
                date = f"{ts[0:4]}-{ts[4:6]}-{ts[6:8]}"
                body = fetcher.get(WB_REPLAY.format(ts=ts, url=original))
                if not body:
                    continue
                items = extract_listings(body)
                for it in items:
                    pid = prop_id(it["postcode"], paon_from_address(it["address"]))
                    record_observation(
                        store, pid=pid, address=it["address"], postcode=it["postcode"],
                        agent=agent["id"], price=it["price"], status=it["status"],
                        url=original, date=date, gap_days=gap, observed_dates=looked)
                    total += 1
                looked.append(date)
                archive_dates.add(date)
                print(f"    {date}: {len(items)} listings")

    store["archive_dates"] = sorted(archive_dates)
    return total


# --- Source 1: snapshot --------------------------------------------------
def run_snapshot(cfg: dict, store: dict) -> int:
    fetcher = Fetcher(cfg)
    gap = int(cfg.get("metrics", {}).get("relist_gap_days", 14))
    max_default = int(cfg.get("collection", {}).get("max_pages_per_source", 10))
    total = 0

    prior_runs = list(store.get("run_dates", []))

    for agent in cfg.get("agents", []):
        sources = [s for s in (agent.get("sources") or [])
                   if s.get("type", "site") in ("site", "sitemap")]
        if not sources:
            print(f"  - {agent['name']}: no live sources configured, skipping")
            continue
        for src in sources:
            if src.get("type") == "sitemap":
                # Let the agent's own sitemap enumerate the property pages.
                urls = sitemap_urls(fetcher, src["url"], src.get("match", ""),
                                    int(src.get("limit", 2000)))
                print(f"  . {agent['name']}: sitemap yielded {len(urls)} pages")
            elif src.get("paginate"):
                pages = int(src.get("max_pages", max_default))
                urls = [src["paginate"].replace("{n}", str(n)) for n in range(1, pages + 1)]
            else:
                urls = [src["url"]]
            # Running off the end of paginated results means stop. A sitemap is an
            # explicit list, so an unparseable page there is just one dud page.
            is_list = src.get("type") != "sitemap"
            empty_streak = 0
            for url in urls:
                html_text = fetcher.get(url)
                if not html_text:
                    if is_list:
                        break
                    continue
                items = extract_listings(html_text)
                if not items:
                    empty_streak += 1
                    if is_list and empty_streak >= 2:
                        break  # ran past the end of the agent's result pages
                    continue
                empty_streak = 0
                for it in items:
                    pid = prop_id(it["postcode"], paon_from_address(it["address"]))
                    record_observation(
                        store, pid=pid, address=it["address"], postcode=it["postcode"],
                        agent=agent["id"], price=it["price"], status=it["status"],
                        url=it["url"] or url, date=TODAY, gap_days=gap,
                        observed_dates=prior_runs)
                    total += 1
            print(f"  + {agent['name']}: {total} sightings so far")

    if total:
        runs = store.setdefault("run_dates", [])
        if TODAY not in runs:
            runs.append(TODAY)
            runs.sort()
    return total


# --- Source 2: HM Land Registry Price Paid Data --------------------------
# Columns (headerless): 0 id, 1 price, 2 date, 3 postcode, 4 type, 5 old/new,
# 6 duration, 7 PAON, 8 SAON, 9 street, 10 locality, 11 town, 12 district,
# 13 county, 14 PPD category, 15 record status.

def ppd_row(row: list[str], prefixes: set[str], towns: set[str]) -> dict | None:
    """Filter + map one Price Paid row to a sold record. None if out of area.

    Split out from the download so it can be tested without network access.
    """
    if len(row) < 15:
        return None
    postcode = norm_postcode(row[3])
    town = row[11].upper().strip()
    if prefixes and postcode_prefix(postcode) in prefixes:
        pass
    elif towns and town in towns:
        pass
    else:
        return None
    # Category B covers repossessions, buy-to-lets sold at auction and other
    # non-open-market transfers. They are real, but they are not comparable to an
    # agent's ordinary sale and would drag the average down.
    if row[14].upper() == "B":
        return None
    price = parse_price(row[1])
    if not price or not postcode:
        return None
    return {
        "date": row[2][:10], "price": price, "type": row[4],
        "address": clean(f"{row[7]} {row[9]}, {row[11]}"),
        "postcode": postcode, "paon": row[7], "source": "ppd",
    }


def run_ppd(cfg: dict, store: dict) -> int:
    lr = cfg.get("land_registry", {})
    if not lr.get("enabled"):
        print("  - land registry disabled in config")
        return 0

    prefixes = {p.upper() for p in cfg.get("area", {}).get("postcode_prefixes", [])}
    towns = {t.upper() for t in cfg.get("area", {}).get("towns", [])}
    if not prefixes and not towns:
        print("  ! no area postcode_prefixes or towns set; refusing to download the "
              "whole country. Set them in config.json.", file=sys.stderr)
        return 0

    years = sorted({q.split("-")[0] for q in cfg.get("quarters", [])})
    sold = store.setdefault("sold", {})
    added = 0

    for year in years:
        candidates = lr.get("year_urls", {}).get(year) or []
        if isinstance(candidates, str):
            candidates = [candidates]
        if not candidates:
            print(f"  - no Land Registry URL configured for {year}")
            continue
        print(f"  . Land Registry {year} -> filtering to {sorted(prefixes) or sorted(towns)}")

        got = False
        for url in candidates:
            req = urllib.request.Request(url, headers={"User-Agent": "estate-insights-bot/1.0"})
            try:
                with urllib.request.urlopen(req, timeout=300) as resp:
                    stream = io.TextIOWrapper(resp, encoding="utf-8", errors="replace")
                    for row in csv.reader(stream):
                        rec = ppd_row(row, prefixes, towns)
                        if not rec:
                            continue
                        pid = prop_id(rec["postcode"], rec.pop("paon"))
                        recs = sold.setdefault(pid, [])
                        if any(r["date"] == rec["date"] and r["price"] == rec["price"]
                               for r in recs):
                            continue
                        recs.append(rec)
                        added += 1
                got = True
                break
            except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as e:
                print(f"  ! {url} failed: {e}", file=sys.stderr)
                continue
        if got:
            print(f"  + {year}: {added} in-area sold records so far")
        else:
            print(f"  ! Land Registry {year}: every candidate URL failed. Check the "
                  f"current download link at "
                  f"https://www.gov.uk/guidance/about-the-price-paid-data", file=sys.stderr)
    return added


# --- Source 3: CSV backfill ----------------------------------------------
# Columns: agent, address, postcode, listed_date, list_price, sold_date, sold_price, status
def run_csv(cfg: dict, store: dict) -> int:
    if not BACKFILL_CSV.exists():
        print("  - no backfill.csv present")
        return 0
    gap = int(cfg.get("metrics", {}).get("relist_gap_days", 14))
    by_name = {}
    for a in cfg.get("agents", []):
        by_name[a["name"].lower()] = a["id"]
        by_name[a["id"].lower()] = a["id"]
        for al in a.get("aliases", []):
            by_name[al.lower()] = a["id"]

    added = 0
    with BACKFILL_CSV.open(newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            postcode = norm_postcode(row.get("postcode") or row.get("address") or "")
            if not postcode:
                continue
            address = clean(row.get("address"))
            pid = prop_id(postcode, paon_from_address(address))
            agent_id = by_name.get(clean(row.get("agent")).lower(), clean(row.get("agent")))
            listed = clean(row.get("listed_date"))[:10]
            if listed:
                record_observation(
                    store, pid=pid, address=address, postcode=postcode, agent=agent_id,
                    price=parse_price(row.get("list_price")),
                    status=norm_status(row.get("status") or "available"),
                    url="", date=listed, gap_days=gap)
                added += 1
            sold_date = clean(row.get("sold_date"))[:10]
            sold_price = parse_price(row.get("sold_price"))
            if sold_date and sold_price:
                recs = store.setdefault("sold", {}).setdefault(pid, [])
                if not any(r["date"] == sold_date for r in recs):
                    recs.append({"date": sold_date, "price": sold_price, "type": "",
                                 "address": address, "postcode": postcode,
                                 "agent": agent_id, "source": "csv"})
                    added += 1
    return added


# --- Main ----------------------------------------------------------------
def main() -> int:
    if not CONFIG_FILE.exists():
        print("estate/config.json missing", file=sys.stderr)
        return 1
    cfg = json.loads(CONFIG_FILE.read_text())
    store = load_store()

    if want("snapshot"):
        print("SNAPSHOT (live agent listing pages)")
        n = run_snapshot(cfg, store)
        print(f"  = {n} sightings recorded")
    if want("wayback"):
        print("WAYBACK (archived captures - historical listing books)")
        n = run_wayback(cfg, store)
        print(f"  = {n} archived sightings recorded")
    if want("ppd"):
        print("LAND REGISTRY (historical sold prices)")
        n = run_ppd(cfg, store)
        print(f"  = {n} sold records added")
    if want("csv"):
        print("CSV BACKFILL")
        n = run_csv(cfg, store)
        print(f"  = {n} rows imported")

    save_store(store)
    print(f"\nstore: {len(store.get('properties', {}))} properties, "
          f"{sum(len(v) for v in store.get('sold', {}).values())} sold records, "
          f"{len(store.get('run_dates', []))} snapshot days")
    return 0


if __name__ == "__main__":
    sys.exit(main())
