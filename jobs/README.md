# Daily High-Ticket Opportunities

Automated daily digest of **new** fully-remote opportunities across every niche,
sorted into three buckets — **Closer**, **Setter / BDM / BDR / SDM / SDR**, and
**Success (client / customer / student)** — and deduped so you only ever see
what's new since yesterday.

## 🔗 Live site

- **Jobs board:** https://better-prompt-ai-ashy.vercel.app/jobs
- **Where to find jobs (specialist boards):** https://better-prompt-ai-ashy.vercel.app/jobs/boards
- **Communities directory:** https://better-prompt-ai-ashy.vercel.app/directory

Runs daily at **06:00 UTC (7am UK)** and auto-redeploys to Vercel on each run.

## How it works

```
free job-board APIs  ┐
(Remotive, RemoteOK,  ├─► normalise ─► dedupe vs seen.json ─► today's NEW list
 Arbeitnow, Jobicy)  ┘                                         ├─ jobs/daily/<date>.csv
inbox (gated groups) ┘                                         ├─ jobs/daily/<date>.md
                                                               ├─ jobs/latest.html  (publishable)
                                                               └─ jobs/history.csv  (all-time)
```

- **Sources** are free, public, ToS-friendly job APIs — no keys, no scraping.
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

- **Daily, automatically:** active on the `master` branch at 06:00 UTC.
- **On demand:** Actions tab → "Daily high-ticket opportunities" → *Run workflow*.
- **Locally:** `python jobs/pipeline.py` (Python 3.9+, standard library only).

## Tuning

Edit the keyword lists (`CLOSER_KW`, `SETTER_KW` / `SETTER_ACR`, `SUCCESS_KW` /
`SUCCESS_ACR`) at the top of `pipeline.py` to widen or narrow what counts as
relevant. Change the `cron:` line in the workflow to move the run time.

## Publishing the daily page

`jobs/latest.html` is a standalone page of today's new roles, served at `/jobs`
(see `vercel.json`), with a link back to the communities directory at `/directory`.
