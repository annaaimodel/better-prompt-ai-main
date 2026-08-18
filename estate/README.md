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

**Live scraping cannot see the past.** A snapshot records what is on the market
*the day it runs*. Start it today and it builds real history from today — it cannot
tell you what an agent listed in January.

There are two ways round that, and between them the historical picture is largely
recoverable:

| | Where it comes from | Historical quarters (Q1/Q2 2026) |
|---|---|---|
| Sold, Avg sold price | HM Land Registry Price Paid Data | **Available now.** Official, verified, free. |
| Avg list price | Internet Archive captures of the agent's own site | **Recoverable.** One capture reads the asking price directly. |
| Listed, Relisted | Internet Archive captures | **Lower bounds.** Anything listed *and* sold between two captures was never archived. |
| All listing metrics | Live snapshots | **Complete from first run onward.** |

The report labels archive-derived quarters `archive` rather than `measured`, and
states on the page that the counts are lower bounds. It does not launder a sample
into a census.

### Why the agents' own sites, not the portals

Their own sites are better on every axis that matters here:

- **Sitemaps.** `sitemap.xml` enumerates every property page, so there is no
  pagination convention to reverse-engineer and no page silently missed.
- **Archive coverage.** Small sites are captured by the Internet Archive far more
  usefully than deep portal search-result URLs, which are query-string-driven and
  rarely archived in a replayable form.
- **Terms.** Reading an agent's own public site does not breach a portal's terms of
  use, and it is the agent's own shop window.
- **Structure.** Agent sites publish schema.org JSON-LD for search engines — a
  stable, intended machine-readable surface, unlike CSS selectors that break on
  every redesign.

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

2. **Add sources** to each agent's `sources` list. Three types, and an agent can
   have several:

   ```json
   { "type": "sitemap",
     "url": "https://www.agent.co.uk/sitemap.xml",
     "match": "/property/" }
   ```
   Best default for an agent's own site — enumerates every property page. Sitemap
   index files are followed automatically.

   ```json
   { "type": "site",
     "url": "https://www.agent.co.uk/properties-for-sale",
     "paginate": "https://www.agent.co.uk/properties-for-sale?page={n}",
     "max_pages": 10 }
   ```
   For sites without a usable sitemap. Omit `paginate` for a single page.

   ```json
   { "type": "wayback",
     "url": "https://www.agent.co.uk/properties-for-sale",
     "from": "2026-01-01", "to": "2026-06-30",
     "collapse": "timestamp:6" }
   ```
   Reconstructs history. `collapse` of `timestamp:6` takes one capture per month,
   `timestamp:8` one per day. Point it at the **listing results page**, which the
   Archive captures far more often than individual property pages.

   Portal terms (Rightmove, Zoopla, OnTheMarket) prohibit automated collection —
   pointing this tool at them is a decision to take that on, and they block
   aggressively. `robots.txt` is always fetched and always honoured; disallowed URLs
   are skipped and reported. That is deliberately not configurable.

## Running

```bash
python3 estate/pipeline.py          # collect: snapshot + land registry + csv
python3 estate/metrics.py           # derive metrics -> quarters.json + report.html
python3 estate/test_pipeline.py     # 37 tests, stdlib only
```

Restrict to one source with `ONLY`:

```bash
ONLY=ppd      python3 estate/pipeline.py   # Land Registry only (no third-party requests)
ONLY=snapshot python3 estate/pipeline.py
ONLY=csv      python3 estate/pipeline.py
ONLY=wayback  python3 estate/pipeline.py   # historical backfill from the Archive
```

**Run `ONLY=wayback` once**, when you first set the agents up (and again only if you
add an agent or widen the date range). The past does not change, so it is excluded
from the default run rather than re-walking the Archive nightly.

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
  changes. Span 1 is a *listing*; spans 2+ are *relists*.
- **Absence must be observed, not inferred.** A relist requires a collection date
  between the two sightings on which the property was looked for and *not found*.
  With daily snapshots that is the same as a date gap, but archive captures can be
  six weeks apart, and a property seen in January and again in April was most likely
  listed throughout. Inferring a relist from the gap alone would invent churn that
  never happened. CSV backfill states its dates outright and so uses the gap alone.
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
