#!/usr/bin/env python3
"""
Estate-agent market-share pipeline: DERIVATION + REPORT.

Reads estate/store.json (raw observations) and produces:
  estate/quarters.json  - machine-readable per-agent, per-quarter metrics
  estate/report.html    - self-contained dashboard

Per agent, per quarter:
  listed          new instructions that came to market
  sold            completed sales attributed to the agent that listed them
  relisted        properties returning to market after a genuine absence
  avg_list_price  mean asking price at the point of listing
  avg_sold_price  mean completed sale price (HM Land Registry, verified)

Derivation is a pure function of the store, so improving this logic re-reads
existing history rather than requiring a re-collection.

The report never prints a zero it cannot stand behind: a metric with no
underlying data coverage renders as "no data", not as 0. That distinction is
the whole point - a zero means "they listed nothing", which is a claim.
"""
from __future__ import annotations
import json, datetime, html, sys
from pathlib import Path
from statistics import mean

ROOT = Path(__file__).resolve().parent
CONFIG_FILE = ROOT / "config.json"
STORE_FILE = ROOT / "store.json"
OUT_JSON = ROOT / "quarters.json"
OUT_HTML = ROOT / "report.html"

# A completed sale can register with the Land Registry well over a year after the
# property was first listed. Attribute a sale to the most recent listing that
# started within this window.
SALE_LAG_DAYS = 550

# Validated categorical palette (dark surface #141312): all six checks pass.
# Fixed order, never cycled. Direct labels carry identity alongside colour.
SERIES = [("listed", "Listed", "#c98500"),
          ("sold", "Sold", "#199e70"),
          ("relisted", "Relisted", "#d95926")]


# --- Quarter helpers -----------------------------------------------------
def quarter_of(date: str) -> str:
    y, m = int(date[:4]), int(date[5:7])
    return f"{y}-Q{(m - 1) // 3 + 1}"


def quarter_bounds(q: str) -> tuple[str, str]:
    y, qn = int(q[:4]), int(q[-1])
    start_m = (qn - 1) * 3 + 1
    end_m = start_m + 2
    last_day = [31, 29 if y % 4 == 0 and (y % 100 or y % 400 == 0) else 28, 31, 30,
                31, 30, 31, 31, 30, 31, 30, 31][end_m - 1]
    return f"{y}-{start_m:02d}-01", f"{y}-{end_m:02d}-{last_day:02d}"


def days_between(a: str, b: str) -> int:
    return (datetime.date.fromisoformat(b) - datetime.date.fromisoformat(a)).days


# --- Derivation ----------------------------------------------------------
def derive_events(store: dict) -> list[dict]:
    """Turn span history into discrete listed / relisted events."""
    run_dates = sorted(store.get("run_dates", []))
    coverage_start = run_dates[0] if run_dates else None
    events = []

    for pid, p in store.get("properties", {}).items():
        for i, sp in enumerate(p.get("spans", [])):
            # A property already on the market the first time we ever looked is not
            # a new instruction - counting it would inflate that agent's Q1.
            pre_existing = (i == 0 and coverage_start is not None
                            and sp["start"] == coverage_start)
            events.append({
                "pid": pid, "agent": sp["agent"], "date": sp["start"],
                "kind": "relisted" if i > 0 else "listed",
                "price": sp.get("first_price"),
                "pre_existing": pre_existing,
                "address": p.get("address", ""), "postcode": p.get("postcode", ""),
            })
    return events


def attribute_sale(spans: list[dict], sold_date: str) -> str | None:
    """Credit a completed sale to the agent whose instruction it followed."""
    best = None
    for sp in spans:
        if sp["start"] <= sold_date and days_between(sp["start"], sold_date) <= SALE_LAG_DAYS:
            if best is None or sp["start"] > best["start"]:
                best = sp
    return best["agent"] if best else None


def derive_sales(store: dict) -> list[dict]:
    sales = []
    for pid, recs in store.get("sold", {}).items():
        spans = store.get("properties", {}).get(pid, {}).get("spans", [])
        for r in recs:
            agent = r.get("agent") or attribute_sale(spans, r["date"])
            sales.append({"pid": pid, "agent": agent, "date": r["date"],
                          "price": r["price"], "address": r.get("address", ""),
                          "postcode": r.get("postcode", ""), "source": r.get("source", "")})
    return sales


def coverage(store: dict, quarters: list[str], events: list[dict],
             sales: list[dict]) -> dict:
    """What can we honestly claim to have measured, per quarter?

    listing metrics need us to have been observing the market during the quarter;
    sold metrics need Land Registry data published through the quarter.
    """
    run_dates = set(store.get("run_dates", []))
    backfilled = {e["date"] for e in events if e["date"] not in run_dates}
    ppd_max = max((s["date"] for s in sales), default="")

    out = {}
    for q in quarters:
        qs, qe = quarter_bounds(q)
        has_runs = any(qs <= d <= qe for d in run_dates)
        has_backfill = any(qs <= d <= qe for d in backfilled)
        out[q] = {
            "listing": "measured" if has_runs else ("backfill" if has_backfill else "none"),
            "sold": "measured" if ppd_max and ppd_max >= qe else (
                "partial" if ppd_max and ppd_max >= qs else "none"),
            "ppd_max": ppd_max,
        }
    return out


def rollup(cfg: dict, store: dict) -> dict:
    quarters = cfg.get("quarters", [])
    agents = cfg.get("agents", [])
    events = derive_events(store)
    sales = derive_sales(store)
    cov = coverage(store, quarters, events, sales)

    blank = lambda: {"listed": 0, "sold": 0, "relisted": 0,
                     "list_prices": [], "sold_prices": []}
    per = {a["id"]: {q: blank() for q in quarters} for a in agents}
    area = {q: blank() for q in quarters}
    unattributed = {q: 0 for q in quarters}

    for e in events:
        q = quarter_of(e["date"])
        if q not in quarters or e["pre_existing"]:
            continue
        bucket = per.get(e["agent"], {}).get(q)
        if bucket is None:
            continue
        bucket[e["kind"]] += 1
        if e["kind"] == "listed" and e["price"]:
            bucket["list_prices"].append(e["price"])

    for s in sales:
        q = quarter_of(s["date"])
        if q not in quarters:
            continue
        area[q]["sold"] += 1
        area[q]["sold_prices"].append(s["price"])
        bucket = per.get(s["agent"], {}).get(q) if s["agent"] else None
        if bucket is None:
            unattributed[q] += 1
            continue
        bucket["sold"] += 1
        bucket["sold_prices"].append(s["price"])

    def finish(b: dict) -> dict:
        return {
            "listed": b["listed"], "sold": b["sold"], "relisted": b["relisted"],
            "avg_list_price": round(mean(b["list_prices"])) if b["list_prices"] else None,
            "avg_sold_price": round(mean(b["sold_prices"])) if b["sold_prices"] else None,
            "n_list_prices": len(b["list_prices"]), "n_sold_prices": len(b["sold_prices"]),
        }

    return {
        "generated": datetime.date.today().isoformat(),
        "area": cfg.get("area", {}),
        "quarters": quarters,
        "coverage": cov,
        "agents": [{"id": a["id"], "name": a["name"],
                    "quarters": {q: finish(per[a["id"]][q]) for q in quarters}}
                   for a in agents],
        "area_totals": {q: finish(area[q]) for q in quarters},
        "unattributed_sales": unattributed,
        "totals": {"properties": len(store.get("properties", {})),
                   "sold_records": sum(len(v) for v in store.get("sold", {}).values()),
                   "snapshot_days": len(store.get("run_dates", []))},
    }


# --- Report --------------------------------------------------------------
def money(v) -> str:
    return f"£{v:,.0f}" if v else "&mdash;"


def num(v, covered: bool) -> str:
    if not covered:
        return '<span class="nd" title="No data collected for this quarter">no data</span>'
    return f"{v:,}"


def bar_chart(agents: list[dict], q: str, cov: dict) -> str:
    """Grouped horizontal bars, direct-labelled. Rendered only where measured."""
    if cov["listing"] == "none" and cov["sold"] == "none":
        return ""
    rows = [a for a in agents if any(a["quarters"][q][k] for k, _, _ in SERIES)]
    if not rows:
        return ""
    peak = max(max(a["quarters"][q][k] for k, _, _ in SERIES) for a in rows) or 1

    out = ['<div class="chart">']
    out.append('<div class="legend">' + "".join(
        f'<span class="lg"><i style="background:{c}"></i>{lbl}</span>'
        for _, lbl, c in SERIES) + "</div>")
    for a in rows:
        out.append(f'<div class="crow"><div class="cname">{html.escape(a["name"])}</div><div class="cbars">')
        for key, lbl, colour in SERIES:
            v = a["quarters"][q][key]
            pct = (v / peak) * 100
            out.append(
                f'<div class="cbar" title="{lbl}: {v}">'
                f'<span class="cfill" style="width:{pct:.1f}%;background:{colour}"></span>'
                f'<span class="cval">{v}</span></div>')
        out.append("</div></div>")
    out.append("</div>")
    return "".join(out)


def render(data: dict) -> str:
    a_label = html.escape(data["area"].get("label", ""))
    parts = []

    for q in data["quarters"]:
        cov = data["coverage"][q]
        lc = cov["listing"] != "none"
        sc = cov["sold"] != "none"
        qs, qe = quarter_bounds(q)

        notes = []
        if not lc:
            notes.append("No listing observations cover this quarter, so listed / "
                         "relisted / average list price cannot be reported. "
                         "Snapshots only see the market from the day they start; "
                         "backfill these via <code>estate/backfill.csv</code>.")
        if cov["sold"] == "partial":
            notes.append(f"Land Registry data currently extends to {cov['ppd_max']}, "
                         "so this quarter is incomplete. Sales register with a lag "
                         "of roughly 2&ndash;3 months.")
        if not sc:
            notes.append("No Land Registry sold data for this quarter yet.")
        if data["unattributed_sales"].get(q):
            notes.append(f"{data['unattributed_sales'][q]:,} sales in the area could "
                         "not be attributed to a tracked agent (no matching listing "
                         "observation for that address).")

        rows = []
        for a in data["agents"]:
            m = a["quarters"][q]
            # Sample size sits beside each average: a mean of 2 sales is not a market rate.
            ln = " n={}".format(m["n_list_prices"]) if m["n_list_prices"] else ""
            sn = " n={}".format(m["n_sold_prices"]) if m["n_sold_prices"] else ""
            list_cell = money(m["avg_list_price"]) if lc else num(0, False)
            sold_cell = money(m["avg_sold_price"]) if sc else num(0, False)
            rows.append(
                f'<tr><td class="ag">{html.escape(a["name"])}</td>'
                f'<td>{num(m["listed"], lc)}</td>'
                f'<td>{num(m["sold"], sc)}</td>'
                f'<td>{num(m["relisted"], lc)}</td>'
                f'<td>{list_cell}<small>{ln}</small></td>'
                f'<td>{sold_cell}<small>{sn}</small></td></tr>')

        at = data["area_totals"][q]
        rows.append(
            f'<tr class="tot"><td class="ag">Whole area ({a_label})</td>'
            f'<td>&mdash;</td><td>{num(at["sold"], sc)}</td><td>&mdash;</td>'
            f'<td>&mdash;</td><td>{money(at["avg_sold_price"]) if sc else num(0, False)}</td></tr>')

        parts.append(f"""
  <section class="q">
    <h2>{q} <small>{qs} to {qe}</small></h2>
    {"".join(f'<p class="note">{n}</p>' for n in notes)}
    <div class="tw"><table>
      <thead><tr><th>Agent</th><th>Listed</th><th>Sold</th><th>Relisted</th>
      <th>Avg list price</th><th>Avg sold price</th></tr></thead>
      <tbody>{"".join(rows)}</tbody>
    </table></div>
    {bar_chart(data["agents"], q, cov)}
  </section>""")

    t = data["totals"]
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Estate agent insights &mdash; {a_label}</title>
<style>
:root{{--bg:#0a0a0b;--card:#141312;--line:rgba(201,156,56,.14);--line2:#262320;
--txt:#f3efe6;--mut:#9a948a;--gold:#c99c38;--gold2:#f2dd88}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--txt);line-height:1.55;
font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
-webkit-font-smoothing:antialiased}}
.wrap{{max-width:1080px;margin:0 auto;padding:40px 20px 70px}}
h1{{font-family:"Playfair Display",Georgia,serif;font-weight:600;
font-size:clamp(26px,5vw,40px);margin:0 0 6px;color:#f6f1e4}}
.kicker{{font-size:11.5px;font-weight:700;letter-spacing:.3em;text-transform:uppercase;
color:var(--gold);margin:0 0 10px}}
.sub{{color:var(--mut);font-size:14px;margin:0 0 26px}}
.prov{{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--gold);
border-radius:12px;padding:16px 18px;margin:0 0 30px;font-size:13.5px;color:#d9d3c6}}
.prov h3{{margin:0 0 8px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;
color:var(--gold2)}}
.prov ul{{margin:8px 0 0;padding-left:18px}} .prov li{{margin:4px 0}}
.q{{margin:0 0 44px}}
h2{{font-family:"Playfair Display",Georgia,serif;font-weight:600;font-size:23px;
color:#f4eedd;margin:0 0 12px;border-bottom:1px solid var(--line2);padding-bottom:8px}}
h2 small{{font-weight:400;font-size:13px;color:var(--mut);letter-spacing:normal;margin-left:8px}}
.note{{font-size:13px;color:var(--mut);background:rgba(201,156,56,.05);
border:1px solid var(--line);border-radius:9px;padding:9px 12px;margin:0 0 10px}}
.note code{{color:var(--gold2);font-size:12px}}
.tw{{overflow-x:auto;-webkit-overflow-scrolling:touch}}
table{{width:100%;border-collapse:collapse;font-size:14px;min-width:640px}}
th{{text-align:right;font-size:11px;letter-spacing:.1em;text-transform:uppercase;
color:var(--mut);font-weight:700;padding:8px 10px;border-bottom:1px solid var(--line2)}}
th:first-child{{text-align:left}}
td{{text-align:right;padding:10px;border-bottom:1px solid rgba(38,35,32,.7);
font-variant-numeric:tabular-nums}}
td.ag{{text-align:left;font-weight:600;color:#f6f1e6}}
td small{{color:var(--mut);font-size:11px;font-variant-numeric:tabular-nums}}
tr.tot td{{border-top:1px solid var(--line);color:var(--gold2);font-weight:600}}
.nd{{color:#6f6a62;font-style:italic;font-size:12.5px}}
.chart{{margin:22px 0 0;background:var(--card);border:1px solid var(--line);
border-radius:12px;padding:18px}}
.legend{{display:flex;gap:16px;flex-wrap:wrap;margin:0 0 14px}}
.lg{{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--mut)}}
.lg i{{width:10px;height:10px;border-radius:3px;display:block}}
.crow{{display:grid;grid-template-columns:minmax(90px,150px) 1fr;gap:14px;
align-items:center;margin:0 0 12px}}
.cname{{font-size:13px;color:#e8e2d5;font-weight:600;overflow-wrap:anywhere}}
.cbars{{display:flex;flex-direction:column;gap:2px}}
.cbar{{display:flex;align-items:center;gap:8px;height:14px}}
.cfill{{height:10px;border-radius:0 4px 4px 0;min-width:2px;transition:width .2s}}
.cval{{font-size:11px;color:var(--mut);font-variant-numeric:tabular-nums}}
footer{{margin-top:40px;padding-top:18px;border-top:1px solid var(--line2);
color:var(--mut);font-size:12.5px}}
@media(max-width:640px){{.crow{{grid-template-columns:1fr;gap:4px}}}}
</style></head>
<body><div class="wrap">
  <p class="kicker">Market intelligence</p>
  <h1>Estate agent insights</h1>
  <p class="sub">{a_label} &middot; generated {data["generated"]} &middot;
  {t["properties"]:,} properties tracked &middot; {t["sold_records"]:,} verified sales &middot;
  {t["snapshot_days"]:,} snapshot days</p>

  <div class="prov">
    <h3>Where these numbers come from</h3>
    <ul>
      <li><strong>Sold count &amp; average sold price</strong> &mdash; HM Land Registry
      Price Paid Data. Official, verified completions under the Open Government
      Licence. Registers ~2&ndash;3 months after completion.</li>
      <li><strong>Listed, relisted &amp; average list price</strong> &mdash; observed from
      agents' own listing pages, one snapshot per run. These build real history from
      the first run onward and <em>cannot see the market before that date</em>.</li>
      <li><strong>Agent attribution of sales</strong> &mdash; Land Registry records carry no
      agent name. A sale is credited to the agent whose listing of that address most
      recently preceded it. Addresses never observed on a tracked agent's books show
      in the area total but not against any agent.</li>
    </ul>
  </div>
{"".join(parts)}
  <footer>Contains HM Land Registry data &copy; Crown copyright and database right.
  Licensed under the Open Government Licence v3.0.</footer>
</div></body></html>
"""


def main() -> int:
    if not CONFIG_FILE.exists() or not STORE_FILE.exists():
        print("run estate/pipeline.py first (need config.json + store.json)", file=sys.stderr)
        return 1
    cfg = json.loads(CONFIG_FILE.read_text())
    store = json.loads(STORE_FILE.read_text())

    data = rollup(cfg, store)
    OUT_JSON.write_text(json.dumps(data, indent=1))
    OUT_HTML.write_text(render(data))

    print(f"quarters: {', '.join(data['quarters'])}")
    for a in data["agents"]:
        for q in data["quarters"]:
            m = a["quarters"][q]
            print(f"  {a['name'][:28]:<28} {q}  listed={m['listed']:<4} "
                  f"sold={m['sold']:<4} relisted={m['relisted']:<4} "
                  f"avgList={m['avg_list_price']} avgSold={m['avg_sold_price']}")
    print(f"\nwrote {OUT_JSON.name} + {OUT_HTML.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
