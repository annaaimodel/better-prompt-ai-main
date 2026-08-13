# Estate agent insights

Per-agent, per-quarter market share for a chosen area:

| Metric | Meaning |
|---|---|
| **Listed** | New instructions that came to market |
| **Sold** | Completed sales, credited to the agent that listed them |
| **Relisted** | Properties returning to market after a genuine absence |
| **Avg list price** | Mean asking price at the point of listing |
| **Avg sold price** | Mean completed sale price (verified) |

## Read this first: what can and cannot be known

**Scraping cannot see the past.** A snapshot collector records what is on the
market *the day it runs*. Start it today and it builds real history from today —
it cannot tell you what an agent listed in January. There is no way around this;
the data simply was not recorded at the time.

That splits the five metrics into two very different groups:

| | Where it comes from | Historical quarters (Q1/Q2 2026) |
|---|---|---|
| Sold, Avg sold price | HM Land Registry Price Paid Data | **Available now.** Official, verified, free. |
| Listed, Relisted, Avg list price | Snapshots of agents' listing pages | **Not recoverable by scraping.** Backfill via CSV, or accrues from first run onward. |

So for Q1/Q2 2026 you can have verified sold counts and average sold prices
immediately, and the listing-side metrics only if you backfill them (see below).
From the first snapshot run onward, every quarter is complete.

**The report never prints a zero it cannot stand behind.** A quarter with no
underlying coverage renders `no data`, not `0` — because `0` is a claim that the
agent listed nothing, and that claim would be false.

## Setup

1. **Edit `config.json`** — it is the only file you need to touch.
   - `area.label`, `area.postcode_prefixes`, `area.towns` — the patch you care about.
     The postcode prefixes also stop the Land Registry importer downloading the
     whole country.
   - `agents[]` — one entry per agent. `id` is a stable slug, `name` is display,
     `aliases` help the CSV importer match messy source data.
   - `quarters` — which quarters the report covers.

2. **Add listing sources** to each agent's `sources` list:

   ```json
   { "type": "site",
     "url": "https://www.agent.co.uk/properties-for-sale",
     "paginate": "https://www.agent.co.uk/properties-for-sale?page={n}",
     "max_pages": 10 }
   ```

   Prefer **the agent's own website** over a portal. It is the same data, it is far
   more robust, and it does not breach a portal's terms of use. Portal terms
   (Rightmove, Zoopla, OnTheMarket) prohibit automated collection — pointing this
   tool at them is a decision to take that on, and they block aggressively.

   The collector reads **schema.org JSON-LD**, which property sites publish
   deliberately for search engines. That is a stable, intended machine-readable
   surface, unlike CSS selectors that break on every redesign. A regex fallback
   handles pages without it.

   `robots.txt` is always fetched and always honoured. Disallowed URLs are skipped
   and reported. This is deliberately not configurable — it is what keeps the tool
   defensible, and ignoring it gets you blocked anyway.

## Running

```bash
python3 estate/pipeline.py          # collect: snapshot + land registry + csv
python3 estate/metrics.py           # derive metrics -> quarters.json + report.html
python3 estate/test_pipeline.py     # 27 tests, stdlib only
```

Restrict to one source with `ONLY`:

```bash
ONLY=ppd      python3 estate/pipeline.py   # Land Registry only (no third-party requests)
ONLY=snapshot python3 estate/pipeline.py
ONLY=csv      python3 estate/pipeline.py
```

`.github/workflows/estate.yml` runs the whole thing daily and commits the results.

## Backfilling historical quarters

To get listing-side metrics for quarters that predate your first snapshot, copy
`backfill.example.csv` to `backfill.csv` and fill it in from whatever record you
have — your CRM, an exported portal report, a bought dataset, or manual research:

```csv
agent,address,postcode,listed_date,list_price,sold_date,sold_price,status
Hopkins & Ward,12 Cold Bath Road,HG2 0NA,2026-01-08,485000,2026-03-20,468000,sold
```

Two rows for the same address with listing dates far apart become a **relist**
automatically. `agent` matches on name, id or any alias in `config.json`.

The example file is illustrative only — the agents and addresses in it are
invented to exercise the tests. Replace it entirely with real data.

## How the numbers are derived

- **Properties are keyed by address, never by agent** (postcode + house number).
  A property moving between agents stays one tracked property, so an agent losing
  an instruction to a rival is visible rather than looking like two properties.
- **Spans.** Each contiguous run of days a property is on the market with one agent
  is a span. Extending a span is the normal case; a new span opens when the property
  has been absent longer than `metrics.relist_gap_days` (default 14) or the agent
  changes. Span 1 is a *listing*; spans 2+ are *relists*. The gap threshold stops a
  property that merely dropped out of one scrape from counting as a relist.
- **Pre-existing stock is excluded.** A property already on the market the first
  time the collector ever ran is not a new instruction, and counting it would
  inflate that agent's first quarter.
- **Sale attribution.** Land Registry records carry no agent name, so a sale is
  credited to the agent whose listing of that address most recently preceded it
  (within 550 days — completions lag listings). Sales at addresses never observed
  on a tracked agent's books appear in the area total and are reported as
  *unattributed*, never silently dropped.
- **Category B transfers are excluded** — repossessions and auction/non-open-market
  transfers are real sales but not comparable to an ordinary agent sale, and would
  drag the averages down.
- **Sample sizes are shown** next to every average (`n=3`). A mean of two sales is
  not a market rate, and the report does not pretend otherwise.

Collection never computes a metric; derivation is a pure function of `store.json`.
Improving the event logic re-reads existing history instead of needing a re-scrape.

## Files

| File | Role |
|---|---|
| `config.json` | The only file you edit |
| `pipeline.py` | Collection: snapshot, Land Registry, CSV → `store.json` |
| `metrics.py` | Derivation + report → `quarters.json`, `report.html` |
| `test_pipeline.py` | Tests for parsing and derivation |
| `store.json` | Raw observation history (generated, committed by CI) |
| `quarters.json` | Machine-readable metrics (generated) |
| `report.html` | Dashboard (generated) |

Contains HM Land Registry data © Crown copyright and database right, licensed
under the Open Government Licence v3.0. Land Registry sales register roughly 2–3
months after completion, so the most recent quarter fills in over time.
