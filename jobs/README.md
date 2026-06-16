# Daily High-Ticket Opportunities

Automated daily digest of **new** fully-remote opportunities across every niche,
sorted into three buckets — **Closer**, **Setter / BDM / BDR / SDM / SDR**, and
**Success (client / customer / student)** — and deduped so you only ever see
what's new since yesterday.

## 🔗 Live site

- **Jobs board:** https://better-prompt-ai-ashy.vercel.app/jobs
- **Where to find jobs (specialist boards):** https://better-prompt-ai-ashy.vercel.app/jobs/boards
- **Communities directory:** https://better-prompt-ai-ashy.vercel.app/directory

Refreshes **hourly** (light), with full HEAVY pulls at **00:00 and 14:00 UTC**
(UK morning + US morning), and auto-redeploys to Vercel on each run.

## How it works

```
free job-board APIs  ┐
(Remotive, RemoteOK,  ├─► normalise ─► dedupe vs seen.json ─► today's NEW list
 Arbeitnow, Jobicy)  ┘                                         ├─ jobs/daily/<date>.csv
inbox (gated groups) ┘                                         ├─ jobs/daily/<date>.md
                                                               ├─ jobs/latest.html  (publishable)
                                                               └─ jobs/history.csv  (all-time)
```

- **Sources** are free/affordable, ToS-friendly job APIs (no scraping). Some
  need a free key — see **Job sources & API keys** below. Any source whose key
  is unset is simply skipped; nothing breaks.
- **Dedupe** uses `seen.json` (an all-time record keyed by company+title), so a
  role is only ever reported on the first day it appears.
- **Link health** — only *useful* links are listed. Links that point at a
  generic search/listing page are dropped (static check, always on). During the
  Actions run, each live link is also checked and delisted if it's genuinely
  dead (404 / "no longer available") or redirects to a listing. The live check
  is conservative: timeouts and bot-blocks (403/429) count as "unknown" and are
  kept, so a flaky check never wipes still-live roles. It runs only where real
  network exists (auto-skips on local/offline runs); set `CHECK_LINKS=0` to turn
  it off.
- Runs daily via GitHub Actions (`.github/workflows/daily-jobs.yml`) and commits
  the results back to the repo.

## Job sources & API keys

Add keys under **Settings → Secrets and variables → Actions → Secrets** (the
country list goes under **Variables**). All are optional — an unset key just
disables that source.

| Source | Coverage | Key needed | Where to get it |
|--------|----------|-----------|-----------------|
| Remotive, RemoteOK, Arbeitnow, Jobicy | Remote (US-heavy) | none | built-in |
| **The Muse** | US-heavy sales/CS | none (optional `THEMUSE_API_KEY` for higher limits) | themuse.com/developers |
| **Adzuna** | US + UK + CA + AU; aggregates many boards | `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` (free) | developer.adzuna.com |
| **JSearch** *(optional)* | Indeed / LinkedIn / Glassdoor / ZipRecruiter via Google for Jobs | `JSEARCH_API_KEY` (RapidAPI, freemium) | rapidapi.com → JSearch |
| **Jooble** *(optional)* | Aggregates thousands of boards (high volume) | `JOOBLE_API_KEY` (free) | jooble.org/api/about |
| **Careerjet** *(optional)* | Aggregator across many boards | `CAREERJET_AFFID` (free affiliate id) | www.careerjet.com/partners/signup.html |

- `ADZUNA_COUNTRIES` (repo **Variable**) — comma-separated country codes; default
  `us,gb,ca,au`.
- `HEAVY_HOURS` (repo **Variable**) — comma-separated UTC hours that run in HEAVY
  mode (Adzuna/JSearch + link validation); default `0,14` (midnight + 14:00 UTC, i.e.
  fresh for UK morning and US morning). Other hours do a light inbox/free-API refresh.
- `JSEARCH_MAX_QUERIES` (repo **Variable**) — JSearch queries per heavy run; default
  `3`. JSearch's free RapidAPI tier is ~200 requests/month and each query costs one
  request, so 3/run × 2 heavy runs/day (~180/month) stays under the free limit. The
  search terms **rotate** each run (seeded by UTC day+hour) so all terms get covered
  over time without the two daily runs overlapping. Raise this if you run heavy fewer
  times a day or you're on a paid RapidAPI plan.
- The categoriser still filters every source down to Closer / Setter / Success
  roles, so adding a broad source won't flood the board with irrelevant jobs.

## The inbox (capturing the gated groups & socials)

Public APIs won't see jobs posted *inside* private Facebook/Skool/Discord groups
or on IG/X. To fold those in, drop them into **`jobs/inbox.csv`** — one row per job:

| title | company | comp | location | link | source | notes |
|-------|---------|------|----------|------|--------|-------|

Only `title` *or* `link` is required. Lines starting with `#` are ignored.

**Hands-off option:** instead of editing the CSV, keep your inbox in a Google
Sheet, `File → Share → Publish to web → CSV`, and set the published URL as a
repo **Variable** named `INBOX_CSV_URL`
(Settings → Secrets and variables → Actions → Variables). A Zapier/Make automation
(e.g. email job-alerts → sheet) or a one-click capture bookmarklet can append
rows automatically.

## Running it

- **Automatically:** active on the `master` branch — hourly light refresh, HEAVY at 00:00 & 14:00 UTC.
- **On demand:** Actions tab → "Daily high-ticket opportunities" → *Run workflow*.
- **Locally:** `python jobs/pipeline.py` (Python 3.9+, standard library only).

## Tuning

Edit the keyword lists (`CLOSER_KW`, `SETTER_KW` / `SETTER_ACR`, `SUCCESS_KW` /
`SUCCESS_ACR`) at the top of `pipeline.py` to widen or narrow what counts as
relevant. Change the `cron:` line in the workflow to move the run time.

## Publishing the daily page

`jobs/latest.html` is a standalone page of today's new roles, served at `/jobs`
(see `vercel.json`), with a link back to the communities directory at `/directory`.
