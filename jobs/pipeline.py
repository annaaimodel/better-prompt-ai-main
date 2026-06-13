#!/usr/bin/env python3
"""
Daily high-ticket opportunities pipeline.

Flow:  fetch (free job-board APIs)  +  inbox (gated-group posts)
       -> normalise -> dedupe against seen.json -> write today's NEW list
       -> update latest.html / history.csv / seen.json

Stdlib only (urllib) so it runs fast in GitHub Actions with no extra installs.
Every network source is wrapped in try/except: a flaky source never breaks the run.
"""
from __future__ import annotations
import csv, json, hashlib, datetime, os, re, sys, urllib.request, urllib.parse, urllib.error, html
import concurrent.futures as cf
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DAILY_DIR = ROOT / "daily"
STORE_FILE = ROOT / "store.json"      # persistent active-listings store
HISTORY = ROOT / "history.csv"
INBOX = ROOT / "inbox.csv"
LATEST_HTML = ROOT / "latest.html"    # /jobs    -> new today
ALL_HTML = ROOT / "all.html"          # /jobs/all -> all active, date order
TODAY = datetime.date.today().isoformat()
UA = "high-ticket-jobs-bot/1.0 (+personal daily digest; contact: annajtelfer@gmail.com)"

# --- What counts as a relevant opportunity -------------------------------
# Buckets, niche-agnostic (industry is never filtered — only the role).
CLOSER_KW = ["high ticket closer", "high-ticket closer", "sales closer",
             "inbound closer", "remote closer", "remote closing", "closing sales",
             "account executive", "inside sales", "sales representative",
             "sales rep", "closer"]
SETTER_KW = ["appointment setter", "appointment setting", "setter",
             "business development representative", "business development manager",
             "sales development representative", "sales development manager"]
SETTER_ACR = ["bdr", "bdm", "sdr", "sdm"]               # match as whole words only
# Success — matched on the JOB TITLE ONLY, and only these CSM-based terms.
SUCCESS_TITLE = ["customer success", "client success", "student success", "onboarding"]
SUCCESS_ACR = ["csm"]
# VA / Admin / Assistant — matched on the JOB TITLE ONLY, and REMOTE ONLY.
VA_TITLE = ["virtual assistant", "assistant", "admin"]
VA_ACR = ["va"]

# Remote detection: remote if the title/location says so, or it's a remote board.
REMOTE_KW = ["remote", "anywhere", "work from home", "work-from-home", "wfh",
             "worldwide", "telecommute", "distributed", "home based", "home-based"]
REMOTE_SOURCES = {"Remotive", "RemoteOK", "Jobicy"}

def _has(t, words):
    return any(w in t for w in words)

def _has_word(t, acrs):
    return any(re.search(r"\b" + re.escape(a) + r"\b", t) for a in acrs)

def is_remote(j) -> bool:
    if j.get("source") in REMOTE_SOURCES:
        return True
    hay = (str(j.get("title", "")) + " " + str(j.get("location", ""))).lower()
    return _has(hay, REMOTE_KW)

def categorise(j) -> str | None:
    title = str(j.get("title", "")).lower()
    text = title + " " + str(j.get("desc", "")).lower()
    # Success — TITLE only, CSM-based terms only
    if _has(title, SUCCESS_TITLE) or _has_word(title, SUCCESS_ACR):
        return "Success (CSM / customer / client / student)"
    # Closer / Setter — title + description
    if _has(text, CLOSER_KW):
        return "Closer"
    if _has(text, SETTER_KW) or _has_word(text, SETTER_ACR):
        return "Setter / BDM / BDR / SDM / SDR"
    # VA / Admin / Assistant — TITLE only, REMOTE only
    if (_has(title, VA_TITLE) or _has_word(title, VA_ACR)) and is_remote(j):
        return "VA / Admin / Assistant"
    return None

# --- Helpers -------------------------------------------------------------
def get_json(url: str, timeout: int = 25):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8", "replace"))

def clean(s) -> str:
    if not s:
        return ""
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", str(s))).strip()

def job_key(j: dict) -> str:
    base = (j.get("company", "") + "|" + j.get("title", "")).lower().strip()
    base = re.sub(r"[^a-z0-9| ]", "", base)
    # fall back to link if title/company thin
    if len(base) < 6:
        base = j.get("link", "")
    return hashlib.sha1(base.encode()).hexdigest()[:16]

def mk(source, title, company, location, comp, link, desc=""):
    return {"source": source, "title": clean(title), "company": clean(company),
            "location": clean(location) or "Remote", "comp": clean(comp),
            "link": (link or "").strip(), "desc": clean(desc)}

# --- Link health: only ever list specific, working job URLs ---------------
# Goal: drop links that (a) point at a generic listing/search page rather than
# a specific posting, or (b) are dead (404 / "no longer available"). The static
# check runs everywhere (no network); the live check runs only where there is
# real outbound connectivity (e.g. GitHub Actions) and is deliberately
# conservative — anything inconclusive stays live so a flaky check never wipes
# still-good roles.
GENERIC_PATHS = {"", "/jobs", "/remote-jobs", "/remote", "/search", "/careers",
                 "/opportunities", "/sales", "/job", "/listings", "/positions"}
CHECK_LINKS = os.environ.get("CHECK_LINKS", "1") != "0"
LINK_TIMEOUT = int(os.environ.get("LINK_TIMEOUT", "15"))
BROWSER_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
DEAD_TEXT = ("no longer available", "no longer accepting", "this job has expired",
             "position has been filled", "job not found", "posting is closed",
             "this position is closed", "page not found", "job has been filled")

def is_generic_link(url: str) -> bool:
    """Pure-string check: True if the URL is a bare domain or a generic
    listing/search page rather than a specific posting."""
    try:
        p = urllib.parse.urlparse((url or "").strip())
        if not p.netloc:
            return True
        return p.path.rstrip("/").lower() in GENERIC_PATHS
    except Exception:
        return True

def _segs(url):
    return [s for s in urllib.parse.urlparse(url).path.split("/") if s]

def validate_link(url: str) -> str:
    """'ok' | 'dead' | 'generic' | 'unknown'. Only 'dead'/'generic' delist;
    'unknown' (timeout, 403/429, network error) is always kept."""
    if not url:
        return "dead"
    if is_generic_link(url):
        return "generic"
    req = urllib.request.Request(url, headers={"User-Agent": BROWSER_UA,
            "Accept": "text/html,application/xhtml+xml"})
    try:
        with urllib.request.urlopen(req, timeout=LINK_TIMEOUT) as r:
            final = r.geturl()
            body = r.read(6000).decode("utf-8", "replace").lower()
    except urllib.error.HTTPError as e:
        return "dead" if e.code in (404, 410) else "unknown"
    except Exception:
        return "unknown"
    if any(s in body for s in DEAD_TEXT):
        return "dead"
    if is_generic_link(final):
        return "generic"
    # redirected UP to a shallower listing (expired posting -> company board)
    if final.rstrip("/") != url.rstrip("/") and len(_segs(final)) <= 1 and len(_segs(url)) >= 2:
        return "generic"
    return "ok"

def _connectivity_ok() -> bool:
    """Skip live link-checking entirely when there's no outbound network
    (local runs, or a fully-blocked sandbox) so we never mass-delist."""
    for u in ("https://www.google.com", "https://example.com"):
        try:
            with urllib.request.urlopen(
                    urllib.request.Request(u, headers={"User-Agent": BROWSER_UA}), timeout=10):
                return True
        except Exception:
            continue
    return False

def prune_dead_links(store: dict):
    """Validate every active link and deactivate the confidently bad ones."""
    if not CHECK_LINKS:
        log("link check: skipped (CHECK_LINKS=0)"); return
    if not _connectivity_ok():
        log("link check: skipped (no outbound connectivity)"); return
    actives = [(k, rec) for k, rec in store.items() if rec.get("active")]
    results = {}
    with cf.ThreadPoolExecutor(max_workers=12) as ex:
        fut = {ex.submit(validate_link, rec.get("link", "")): k for k, rec in actives}
        for f in cf.as_completed(fut):
            results[fut[f]] = f.result()
    dead = sum(1 for t in results.values() if t == "dead")
    generic = sum(1 for t in results.values() if t == "generic")
    for k, tag in results.items():
        if tag in ("dead", "generic"):
            store[k]["active"] = False
            store[k]["delisted"] = tag
    log(f"link check: {len(actives)} checked -> {dead+generic} delisted "
        f"({dead} dead, {generic} generic)")

# --- Sources (free, public, ToS-friendly APIs) ---------------------------
# Each returns (jobs, ok). ok=True if the source was actually reachable this run
# (even with 0 results) — so a transient outage never silently delists its jobs.
def src_remotive():
    out, ok = [], False
    for cat in ("sales", "customer-service"):
        try:
            data = get_json(f"https://remotive.com/api/remote-jobs?category={cat}&limit=200")
            ok = True
            for j in data.get("jobs", []):
                out.append(mk("Remotive", j.get("title"), j.get("company_name"),
                              j.get("candidate_required_location"), j.get("salary"),
                              j.get("url"), j.get("description")))
        except Exception as e:
            log(f"Remotive/{cat} failed: {e}")
    return out, ok

def src_remoteok():
    out, ok = [], False
    try:
        data = get_json("https://remoteok.com/api")
        ok = True
        for j in data:
            if not isinstance(j, dict) or "position" not in j:
                continue
            link = j.get("url") or (f"https://remoteok.com/l/{j.get('id')}" if j.get("id") else "")
            sal = ""
            if j.get("salary_min"):
                sal = f"${j.get('salary_min')}-{j.get('salary_max','')}".rstrip("-")
            out.append(mk("RemoteOK", j.get("position"), j.get("company"),
                          j.get("location"), sal, link,
                          " ".join(j.get("tags", [])) + " " + clean(j.get("description"))))
    except Exception as e:
        log(f"RemoteOK failed: {e}")
    return out, ok

def src_arbeitnow():
    out, ok = [], False
    try:
        data = get_json("https://www.arbeitnow.com/api/job-board-api")
        ok = True
        for j in data.get("data", []):
            out.append(mk("Arbeitnow", j.get("title"), j.get("company_name"),
                          ", ".join(j.get("location", []) if isinstance(j.get("location"), list) else [j.get("location","")]),
                          "", j.get("url"), j.get("description")))
    except Exception as e:
        log(f"Arbeitnow failed: {e}")
    return out, ok

def src_jobicy():
    out, ok = [], False
    for ind in ("sales", "supporting"):
        try:
            data = get_json(f"https://jobicy.com/api/v2/remote-jobs?count=100&industry={ind}")
            ok = True
            for j in data.get("jobs", []):
                out.append(mk("Jobicy", j.get("jobTitle"), j.get("companyName"),
                              j.get("jobGeo"), j.get("annualSalaryMax") and
                              f"to ${j.get('annualSalaryMax')}" or "",
                              j.get("url"), j.get("jobExcerpt")))
        except Exception as e:
            log(f"Jobicy/{ind} failed: {e}")
    return out, ok

def _first_env(*names):
    """Return the first non-empty environment variable among `names` (trimmed)."""
    for n in names:
        v = os.environ.get(n, "").strip()
        if v:
            return v
    return ""

# Search terms used by the keyword-search sources (Adzuna, JSearch). The
# categoriser still filters everything down to the role buckets (incl. VA).
SEARCH_TERMS = ["high ticket closer", "appointment setter", "sales closer",
                "remote closer", "sales development representative",
                "customer success manager", "onboarding specialist",
                "remote virtual assistant", "remote executive assistant",
                "remote administrative assistant"]

def src_themuse():
    # The Muse works WITHOUT a key (rate-limited); THEMUSE_API_KEY raises limits.
    out, ok = [], False
    key = os.environ.get("THEMUSE_API_KEY", "").strip()
    for page in range(1, 4):
        try:
            params = {"category": "Sales", "page": page}
            if key:
                params["api_key"] = key
            data = get_json("https://www.themuse.com/api/public/jobs?" + urllib.parse.urlencode(params))
            ok = True
            for j in data.get("results", []):
                locs = ", ".join(l.get("name", "") for l in j.get("locations", []))
                refs = j.get("refs") or {}
                out.append(mk("The Muse", j.get("name"), (j.get("company") or {}).get("name"),
                              locs, "", refs.get("landing_page"), j.get("contents")))
        except Exception as e:
            log(f"The Muse/p{page} failed: {e}")
    return out, ok

def src_adzuna():
    # Needs free ADZUNA_APP_ID + ADZUNA_APP_KEY (developer.adzuna.com).
    # Accepts common name variants (APP/API) to be forgiving of secret naming.
    # Unconfigured -> returns ok=False so it never delists / never errors.
    app_id = _first_env("ADZUNA_APP_ID", "ADZUNA_API_ID", "ADZUNA_ID", "ADZUNA_APPLICATION_ID")
    app_key = _first_env("ADZUNA_APP_KEY", "ADZUNA_API_KEY", "ADZUNA_KEY", "ADZUNA_APPLICATION_KEY")
    out, ok = [], False
    if not (app_id and app_key):
        log(f"Adzuna: not configured (app_id set: {bool(app_id)}, app_key set: {bool(app_key)})")
        return out, False
    countries = [c.strip() for c in (os.environ.get("ADZUNA_COUNTRIES") or "us,gb,ca,au").split(",") if c.strip()]
    for c in countries:
        for what in SEARCH_TERMS:
            try:
                q = urllib.parse.urlencode({"app_id": app_id, "app_key": app_key,
                                            "results_per_page": 50, "what": what})
                data = get_json(f"https://api.adzuna.com/v1/api/jobs/{c}/search/1?{q}")
                ok = True
                for j in data.get("results", []):
                    sal = ""
                    if j.get("salary_min"):
                        sal = f"${int(j['salary_min'])}" + (f"-${int(j['salary_max'])}" if j.get("salary_max") else "")
                    out.append(mk("Adzuna", j.get("title"), (j.get("company") or {}).get("display_name"),
                                  (j.get("location") or {}).get("display_name"), sal,
                                  j.get("redirect_url"), j.get("description")))
            except Exception as e:
                log(f"Adzuna/{c}/{what} failed: {e}")
    return out, ok

def src_jsearch():
    # Optional, feature-flagged: set JSEARCH_API_KEY (RapidAPI) to pull Google-for-
    # Jobs results (Indeed / LinkedIn / Glassdoor / ZipRecruiter). Off if unset.
    key = os.environ.get("JSEARCH_API_KEY", "").strip()
    out, ok = [], False
    if not key:
        return out, False
    queries = [t + " remote" for t in SEARCH_TERMS]
    for query in queries:
        try:
            url = "https://jsearch.p.rapidapi.com/search?" + urllib.parse.urlencode(
                {"query": query, "page": "1", "num_pages": "1"})
            req = urllib.request.Request(url, headers={
                "X-RapidAPI-Key": key, "X-RapidAPI-Host": "jsearch.p.rapidapi.com", "User-Agent": UA})
            with urllib.request.urlopen(req, timeout=25) as r:
                data = json.loads(r.read().decode("utf-8", "replace"))
            ok = True
            for j in data.get("data", []):
                loc = ", ".join(filter(None, [j.get("job_city"), j.get("job_state"), j.get("job_country")]))
                sal = ""
                if j.get("job_min_salary"):
                    sal = f"${int(j['job_min_salary'])}" + (f"-${int(j['job_max_salary'])}" if j.get("job_max_salary") else "")
                out.append(mk("JSearch", j.get("job_title"), j.get("employer_name"),
                              loc or ("Remote" if j.get("job_is_remote") else ""), sal,
                              j.get("job_apply_link"), j.get("job_description")))
        except Exception as e:
            log(f"JSearch/{query} failed: {e}")
    return out, ok

# name -> fetcher. The name is also the `source` stamped on each job.
SOURCES = [("Remotive", src_remotive), ("RemoteOK", src_remoteok),
           ("Arbeitnow", src_arbeitnow), ("Jobicy", src_jobicy),
           ("The Muse", src_themuse), ("Adzuna", src_adzuna), ("JSearch", src_jsearch)]
API_SOURCES = {name for name, _ in SOURCES}

# --- Inbox (gated-group posts: manual or Zapier-fed) ---------------------
def read_inbox():
    """Read inbox.csv (committed) and/or a published Google-Sheet CSV via INBOX_CSV_URL."""
    rows, ok = [], False
    def parse_csv_text(text, origin):
        for d in csv.DictReader(text.splitlines()):
            d = {k.strip().lower(): (v or "").strip() for k, v in d.items() if k}
            title = d.get("title", "")
            if title.startswith("#"):       # comment line in the template
                continue
            if not title and not d.get("link"):
                continue
            row = mk(d.get("source") or origin, d.get("title"), d.get("company"),
                     d.get("location"), d.get("comp") or d.get("salary"),
                     d.get("link"), d.get("notes") or d.get("description"))
            row["inbox"] = True            # manual entries persist until removed from the inbox
            rows.append(row)
    if INBOX.exists():
        try:
            parse_csv_text(INBOX.read_text(encoding="utf-8"), "Inbox")
            ok = True
        except Exception as e:
            log(f"inbox.csv failed: {e}")
    else:
        ok = True                      # no local inbox is a valid (empty) state
    url = os.environ.get("INBOX_CSV_URL", "").strip()
    if url:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=25) as r:
                parse_csv_text(r.read().decode("utf-8", "replace"), "Inbox (Sheet)")
        except Exception as e:
            ok = False                 # a configured sheet failed -> don't delist manual jobs
            log(f"INBOX_CSV_URL failed: {e}")
    return rows, ok

LOG: list[str] = []
def log(m): LOG.append(m); print(m, file=sys.stderr)

# --- Main ---------------------------------------------------------------
def main():
    DAILY_DIR.mkdir(exist_ok=True)
    store = json.loads(STORE_FILE.read_text()) if STORE_FILE.exists() else {}

    raw, healthy = [], set()
    for name, fn in SOURCES:
        got, ok = fn()
        if ok:
            healthy.add(name)
        log(f"{name}: {len(got)} raw{'' if ok else ' (UNREACHABLE)'}")
        raw.extend(got)
    inbox_rows, inbox_ok = read_inbox()
    log(f"inbox: {len(inbox_rows)} rows{'' if inbox_ok else ' (read failed)'}")
    raw.extend(inbox_rows)

    # filter to relevant + tag category; inbox rows are always kept.
    # `current` = everything live across all sources this run (deduped).
    current = {}
    for j in raw:
        if is_generic_link(j.get("link", "")):
            continue   # only ever list a specific posting, never a search/listing page
        cat = categorise(j)
        if not cat:
            if j.get("inbox"):
                cat = "From inbox (uncategorised)"
            else:
                continue
        j["category"] = cat
        k = job_key(j)
        if k not in current:
            current[k] = j

    # Upsert into the persistent store. A listing stays active as long as it keeps
    # appearing in its source; once it drops out, it's marked inactive (delisted).
    new_today = []
    for k, j in current.items():
        fields = {"title": j["title"], "company": j["company"], "location": j["location"],
                  "comp": j["comp"], "link": j["link"], "source": j["source"],
                  "category": j["category"]}
        if k in store:
            store[k].update(fields); store[k]["last_seen"] = TODAY; store[k]["active"] = True
        else:
            store[k] = {**fields, "first_seen": TODAY, "last_seen": TODAY, "active": True}
            new_today.append(store[k])
    # Mark a stored job inactive only when the channel that supplies it ran
    # successfully this time but no longer returned it (a genuine delisting).
    # If its source was unreachable, leave it untouched so an outage never
    # wipes still-live roles.
    for k, rec in store.items():
        if k in current:
            continue
        src = rec.get("source", "")
        reachable = (src in healthy) if src in API_SOURCES else inbox_ok
        if reachable:
            rec["active"] = False

    # Validate the surviving links and drop dead / generic ones (network-gated;
    # conservative — inconclusive checks are kept).
    prune_dead_links(store)

    active = [rec for rec in store.values() if rec.get("active")]
    new_today.sort(key=lambda x: (x["category"], x["company"].lower()))
    write_outputs(active, new_today, len(current))
    STORE_FILE.write_text(json.dumps(store, indent=1, ensure_ascii=False))
    log(f"active: {len(active)} | new today: {len(new_today)} | store total: {len(store)}")

FIELDS = ["date_found", "category", "source", "title", "company", "location", "comp", "link"]

def write_outputs(active, new_today, scanned):
    # daily CSV (just today's new roles)
    with (DAILY_DIR / f"{TODAY}.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS); w.writeheader()
        for j in new_today:
            w.writerow({"date_found": TODAY, "category": j["category"], "source": j["source"],
                        "title": j["title"], "company": j["company"], "location": j["location"],
                        "comp": j["comp"], "link": j["link"]})
    # all-time history (append today's new roles)
    new_hist = not HISTORY.exists()
    with HISTORY.open("a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        if new_hist:
            w.writeheader()
        for j in new_today:
            w.writerow({"date_found": TODAY, "category": j["category"], "source": j["source"],
                        "title": j["title"], "company": j["company"], "location": j["location"],
                        "comp": j["comp"], "link": j["link"]})
    # daily markdown digest (today's new roles)
    md = [f"# New high-ticket opportunities - {TODAY}", "",
          f"_{len(new_today)} new role(s); {len(active)} active total; scanned {scanned} live listings._", ""]
    cur = None
    for j in new_today:
        if j["category"] != cur:
            cur = j["category"]; md += ["", f"## {cur}", ""]
        link = f"[apply]({j['link']})" if j["link"] else ""
        md.append(f"- **{j['title']}** - {j['company']} ({j['location']}) "
                  f"{('- ' + j['comp']) if j['comp'] else ''} {link}  _via {j['source']}_")
    if not new_today:
        md.append("_No new roles today._")
    (DAILY_DIR / f"{TODAY}.md").write_text("\n".join(md), encoding="utf-8")
    write_latest_html(new_today, len(active), scanned)
    write_all_html(active, len(new_today))

PAGE_CSS = """
:root{--bg:#0f1420;--card:#171e2e;--line:#2a3348;--txt:#e8edf6;--mut:#9aa7bd;--accent:#5b8cff;--new:#2ecc71}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;line-height:1.45}
header{padding:28px 20px 8px;text-align:center;background:radial-gradient(900px 300px at 50% -40%,#22304d,transparent)}
h1{margin:0 0 4px;font-size:24px}.sub{color:var(--mut);font-size:14px;margin:0}
.nav{text-align:center;margin:10px 0 0;display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.nav a{color:var(--mut);font-size:13px;text-decoration:none;border:1px solid var(--line);padding:5px 11px;border-radius:8px}
.nav a:hover{border-color:var(--accent);color:var(--txt)}.nav a.on{color:#fff;background:var(--accent);border-color:var(--accent)}
.wrap{max-width:1040px;margin:0 auto;padding:10px 16px 60px}
h2{margin:24px 0 10px;font-size:17px}.n{font-size:12px;color:var(--mut)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:13px 15px;display:flex;flex-direction:column;gap:6px}
.card:hover{border-color:var(--accent)}.t{font-weight:700;font-size:15px}.c{color:var(--mut);font-size:13px;flex:1}
.f{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px}
.pill{font-size:12px;background:#15303a;color:#7fd7ff;padding:2px 9px;border-radius:999px}
.tag{font-size:11px;background:#222a3d;color:#9fb4dd;padding:2px 8px;border-radius:999px}
.new{font-size:10px;font-weight:800;background:var(--new);color:#06210f;padding:1px 6px;border-radius:5px;margin-right:6px;vertical-align:middle}
.src{font-size:11px;color:var(--mut);flex:1}
.controls{position:sticky;top:0;z-index:5;background:rgba(15,20,32,.94);backdrop-filter:blur(8px);padding:12px 0;margin-bottom:4px;border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:8px;align-items:center}
.controls input{width:100%;max-width:460px;padding:10px 13px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--txt);font-size:15px;outline:none}
.controls input:focus{border-color:var(--accent)}
.fchips{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.fchip{padding:6px 12px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--mut);cursor:pointer;font-size:13px;font-weight:600}
.fchip:hover{color:var(--txt)}.fchip.on{background:var(--accent);border-color:var(--accent);color:#fff}
.fcount{color:var(--mut);font-size:12px}
a.visit{font-size:13px;font-weight:700;color:#fff;background:var(--accent);padding:6px 11px;border-radius:8px;text-decoration:none}
.nl{font-size:12px;color:var(--mut)}.empty{text-align:center;color:var(--mut);padding:50px 0}
footer{text-align:center;color:var(--mut);font-size:12px;padding:24px}
"""

def _nav(active):
    def a(href, label, key):
        return f'<a class="{"on" if key==active else ""}" href="{href}">{label}</a>'
    return ('<div class="nav">' + a("/jobs", "New today", "new") + a("/jobs/all", "All active", "all")
            + a("/jobs/boards", "&starf; Boards", "boards") + a("/cv", "CV match", "cv")
            + a("/directory", "Communities", "dir") + '</div>')

def _bucket_code(cat):
    c = cat.lower()
    if "success" in c:
        return "success"
    if "assistant" in c or "admin" in c or c.startswith("va "):
        return "va"
    if "setter" in c or "bdr" in c or "sdr" in c or "bd" in c:
        return "setter"
    if "closer" in c:
        return "closer"
    return "other"

def _card(j, tag=False, badge=False, code=None):
    link = (f'<a class="visit" href="{html.escape(j["link"])}" target="_blank" rel="noopener">Apply &rarr;</a>'
            if j.get("link") else '<span class="nl">no link</span>')
    comp = f'<span class="pill">{html.escape(j["comp"])}</span>' if j.get("comp") else ""
    tagh = f'<span class="tag">{html.escape(j["category"])}</span>' if tag else ""
    badgeh = '<span class="new">NEW</span>' if badge and j.get("first_seen") == TODAY else ""
    attrs = ""
    if code:
        s = f'{j["title"]} {j["company"]} {j["location"]} {j["source"]} {j["category"]}'.lower()
        attrs = f' data-b="{code}" data-s="{html.escape(s, quote=True)}"'
    return (f'<div class="card"{attrs}><div class="t">{badgeh}{html.escape(j["title"])}</div>'
            f'<div class="c">{html.escape(j["company"])} &middot; {html.escape(j["location"])}</div>'
            f'<div class="f">{tagh}{comp}<span class="src">via {html.escape(j["source"])}</span>{link}</div></div>')

def _doc(title, sub, nav_key, body):
    return (f'<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}</title>'
            f'<style>{PAGE_CSS}</style></head><body>'
            f'<header><h1>{title}</h1><p class="sub">{sub}</p>{_nav(nav_key)}</header>'
            f'<div class="wrap">{body}</div>'
            f'<footer>Auto-generated from public job-board APIs + your inbox. '
            f'Listings stay live until they drop off their source. Verify before applying.</footer>'
            f'</body></html>')

def write_latest_html(jobs, active_count, scanned):
    groups = {}
    for j in jobs:
        groups.setdefault(j["category"], []).append(j)
    body = ""
    for cat, items in groups.items():
        body += f'<h2>{html.escape(cat)} <span class="n">{len(items)}</span></h2><div class="grid">'
        body += "".join(_card(j) for j in items) + "</div>"
    if not jobs:
        body = ('<p class="empty">No new roles pulled today.<br>'
                'See every live listing on the <a href="/jobs/all">All active</a> page.</p>')
    sub = f"{TODAY} &middot; {len(jobs)} new today &middot; {active_count} active in total"
    LATEST_HTML.write_text(_doc("New High-Ticket Opportunities", sub, "new", body), encoding="utf-8")

FILTER_JS = """<script>
(function(){
 var q=document.getElementById('q'),fcount=document.getElementById('fcount'),
     chips=[].slice.call(document.querySelectorAll('.fchip')),f='all';
 function apply(){
  var t=(q.value||'').trim().toLowerCase(),n=0;
  [].forEach.call(document.querySelectorAll('section.dgroup'),function(sec){
   var vis=0;
   [].forEach.call(sec.querySelectorAll('.card'),function(c){
    var okB=(f==='all')||c.getAttribute('data-b')===f,
        okT=!t||(c.getAttribute('data-s')||'').indexOf(t)>-1,
        show=okB&&okT;
    c.style.display=show?'':'none'; if(show){vis++;n++;}
   });
   sec.style.display=vis?'':'none';
  });
  fcount.textContent=n+' shown';
 }
 chips.forEach(function(ch){ch.onclick=function(){chips.forEach(function(x){x.classList.remove('on');});ch.classList.add('on');f=ch.getAttribute('data-f');apply();};});
 q.addEventListener('input',apply); apply();
})();
</script>"""

def write_all_html(active, new_count):
    controls = ('<div class="controls">'
                '<input id="q" type="search" placeholder="Search title, company, source…">'
                '<div class="fchips">'
                '<button class="fchip on" data-f="all">All</button>'
                '<button class="fchip" data-f="closer">Closer</button>'
                '<button class="fchip" data-f="setter">Setter / BD</button>'
                '<button class="fchip" data-f="success">Success</button>'
                '<button class="fchip" data-f="va">VA / Admin</button>'
                '</div><div class="fcount" id="fcount"></div></div>')
    # group by date added (first_seen), newest day first
    by_date = {}
    for j in active:
        by_date.setdefault(j.get("first_seen", "—"), []).append(j)
    groups = ""
    for d in sorted(by_date, reverse=True):
        items = sorted(by_date[d], key=lambda x: (x["category"], x["company"].lower()))
        try:
            label = datetime.date.fromisoformat(d).strftime("%d %b %Y")
        except ValueError:
            label = d
        groups += (f'<section class="dgroup"><h2>{label} <span class="n">{len(items)} added</span></h2>'
                   f'<div class="grid">'
                   + "".join(_card(j, tag=True, badge=True, code=_bucket_code(j["category"])) for j in items)
                   + "</div></section>")
    if not active:
        body = '<p class="empty">No active listings yet. The next run will populate this page.</p>'
    else:
        body = controls + groups + FILTER_JS
    sub = f"{len(active)} active roles &middot; {new_count} new today &middot; updated {TODAY}"
    ALL_HTML.write_text(_doc("All Active High-Ticket Opportunities", sub, "all", body), encoding="utf-8")

if __name__ == "__main__":
    main()
