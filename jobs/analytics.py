#!/usr/bin/env python3
"""Fetch GoatCounter visitor stats and write a digest we can read in-repo.

Outputs:
  jobs/analytics.md    - human-readable digest (committed each run)
  jobs/analytics.json  - machine-readable snapshot incl. raw API payloads,
                         so field parsing can be refined against real data.

Env:
  GOATCOUNTER_SITE       site code, e.g. "aurum-hts" -> https://aurum-hts.goatcounter.com
  GOATCOUNTER_API_TOKEN  API token (repo secret)

Stdlib only. Never hard-fails: on missing config or any API error it still
writes a digest noting the state, so the commit step always has something to push.
"""
from __future__ import annotations
import os, json, datetime, urllib.request, urllib.parse, urllib.error, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT_MD = ROOT / "analytics.md"
OUT_JSON = ROOT / "analytics.json"

TODAY = datetime.date.today()
# Tracking went live on this date; "all-time" starts here.
TRACK_START = datetime.date(2026, 6, 16)

SITE = os.environ.get("GOATCOUNTER_SITE", "").strip() or "aurum-hts"
TOKEN = os.environ.get("GOATCOUNTER_API_TOKEN", "").strip()
BASE = f"https://{SITE}.goatcounter.com/api/v0" if SITE else ""
UA = "aurum-analytics/1.0 (+daily digest)"

def log(m): print(m, file=sys.stderr)

def api(path: str, params: dict | None = None):
    """GET an API path, with one retry. Returns (data, error_string)."""
    url = BASE + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    last = None
    for attempt in range(2):
        req = urllib.request.Request(url, headers={
            "Authorization": f"Bearer {TOKEN}", "Accept": "application/json",
            "Content-Type": "application/json", "User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8", "replace")), None
        except urllib.error.HTTPError as e:
            last = f"HTTP {e.code}: {e.read().decode('utf-8', 'replace')[:300]}"
        except Exception as e:
            last = str(e)
    return None, last

# Date ranges to report. GoatCounter's /stats/total takes start/end as ISO dates.
RANGES = [
    ("Today", TODAY, TODAY),
    ("Last 7 days", TODAY - datetime.timedelta(days=6), TODAY),
    ("Last 30 days", TODAY - datetime.timedelta(days=29), TODAY),
    ("All-time", TRACK_START, TODAY),
]

def _num(d: dict, *names):
    """First present numeric field among names (GoatCounter sometimes returns strings)."""
    for n in names:
        if isinstance(d, dict) and d.get(n) is not None:
            try:
                return int(d[n])
            except (TypeError, ValueError):
                return d[n]
    return None

def fetch_total(start, end):
    """GoatCounter /stats/total -> {"total": pageviews, ...}. No visitor field here."""
    d, err = api("/stats/total", {"start": start.isoformat(), "end": end.isoformat()})
    if err:
        return None, err, d
    return _num(d, "total", "count", "pageviews"), None, d

def fetch_top_pages(start, end, limit=10):
    # Try the known candidate endpoints; record whichever responds.
    for path in ("/pages", "/stats/hits"):
        d, err = api(path, {"start": start.isoformat(), "end": end.isoformat(), "limit": limit})
        if err:
            continue
        rows = d.get("pages") or d.get("hits") or d.get("stats") or []
        out = []
        for r in rows[:limit]:
            out.append({"path": r.get("path") or r.get("name") or r.get("id") or "?",
                        "pageviews": _num(r, "count", "count_total", "pageviews"),
                        "visitors": _num(r, "count_unique", "unique", "visitors")})
        return out, path, d
    return [], None, None

def main():
    snapshot = {"generated_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "site": SITE, "configured": bool(SITE and TOKEN), "ranges": {}, "raw": {}}
    lines = [f"# Site analytics — AURUM", "",
             f"_Generated {datetime.datetime.now(datetime.timezone.utc):%Y-%m-%d %H:%M UTC}"
             f" from GoatCounter (`{SITE or 'unset'}`)._", ""]

    if not (SITE and TOKEN):
        miss = ", ".join(n for n, v in
                         (("GOATCOUNTER_SITE", SITE), ("GOATCOUNTER_API_TOKEN", TOKEN)) if not v)
        lines += [f"> **Not configured yet** — missing: {miss}.",
                  "> Set the repo Variable `GOATCOUNTER_SITE` and secret `GOATCOUNTER_API_TOKEN`,",
                  "> then this digest will populate on the next run."]
        OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
        OUT_JSON.write_text(json.dumps(snapshot, indent=1), encoding="utf-8")
        log("analytics: not configured — wrote placeholder digest")
        return

    # Totals per range. GoatCounter's /stats/total returns pageviews only.
    lines += ["| Period | Pageviews |", "|--------|-----------|"]
    for label, start, end in RANGES:
        pv, err, raw = fetch_total(start, end)
        snapshot["ranges"][label] = {"start": start.isoformat(), "end": end.isoformat(),
                                     "pageviews": pv, "error": err}
        snapshot["raw"][f"total::{label}"] = raw
        if err:
            lines.append(f"| {label} | — _(error: {err})_ |")
            log(f"total {label}: {err}")
        else:
            lines.append(f"| {label} | {pv if pv is not None else '—'} |")
            log(f"total {label}: pageviews={pv}")

    # Top pages over last 30 days.
    start30 = TODAY - datetime.timedelta(days=29)
    pages, used, raw_pages = fetch_top_pages(start30, TODAY)
    snapshot["top_pages_30d"] = pages
    snapshot["raw"]["pages_endpoint"] = used
    snapshot["raw"]["pages"] = raw_pages
    if pages:
        lines += ["", "## Top pages (last 30 days)", "",
                  "| Page | Pageviews | Visitors |", "|------|-----------|----------|"]
        for p in pages:
            lines.append(f"| `{p['path']}` | {p['pageviews'] if p['pageviews'] is not None else '—'} "
                         f"| {p['visitors'] if p['visitors'] is not None else '—'} |")
    else:
        lines += ["", "_Top-pages endpoint returned nothing yet (no traffic, or endpoint "
                  "name needs refining — see analytics.json raw payloads)._"]

    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    OUT_JSON.write_text(json.dumps(snapshot, indent=1, ensure_ascii=False), encoding="utf-8")
    log("analytics: digest written")

if __name__ == "__main__":
    main()
