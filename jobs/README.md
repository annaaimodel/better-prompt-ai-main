# Daily High-Ticket Opportunities

Automated daily digest of **new** high-ticket sales (closer / setter) and
Customer/Client Success Manager (CSM) roles, deduped so you only ever see
what's new since yesterday.

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
- Runs daily via GitHub Actions (`.github/workflows/daily-jobs.yml`) and commits
  the results back to the repo.

## The inbox (capturing the gated groups)

Public APIs won't see jobs posted *inside* private Facebook/Skool/Discord groups.
To fold those in, drop them into **`jobs/inbox.csv`** — one row per job:

| title | company | comp | location | link | source | notes |
|-------|---------|------|----------|------|--------|-------|

Only `title` *or* `link` is required. Lines starting with `#` are ignored.

**Hands-off option:** instead of editing the CSV, keep your inbox in a Google
Sheet, `File → Share → Publish to web → CSV`, and set the published URL as a
repo **Variable** named `INBOX_CSV_URL`
(Settings → Secrets and variables → Actions → Variables). A Zapier/Make automation
on *your own* logged-in account can append rows to that sheet automatically.

## Running it

- **Daily, automatically:** merge this to your default branch — GitHub only runs
  scheduled workflows from the default branch. The timer then fires every day.
- **On demand:** Actions tab → "Daily high-ticket opportunities" → *Run workflow*.
- **Locally:** `python jobs/pipeline.py` (Python 3.9+, standard library only).

## Tuning

Edit the keyword lists (`SALES_KW`, `CSM_KW`) at the top of `pipeline.py` to widen
or narrow what counts as relevant. Change the `cron:` line in the workflow to move
the run time.

## Publishing the daily page

`jobs/latest.html` is a standalone page of today's new roles. It's served at
`/jobs` (see `vercel.json`) once the site is deployed, with a link back to the
communities directory at `/directory`.
