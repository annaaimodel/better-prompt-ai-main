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

# Run mode. Light runs (every hour) refresh the inbox + free APIs only, so Quick
# Add jobs appear fast. The HEAVY run (once a day, or any manual run) also pulls
# Adzuna/JSearch and validates links — keeping within Adzuna's free quota and not
# hammering external sites hourly. Heavy when it's HEAVY_HOUR (UTC) or FORCE_HEAVY.
HEAVY_HOUR = int(os.environ.get("HEAVY_HOUR", "6"))
IS_HEAVY = (os.environ.get("FORCE_HEAVY", "").strip().lower() in ("1", "true", "yes")
            or datetime.datetime.utcnow().hour == HEAVY_HOUR)

# --- What counts as a relevant opportunity -------------------------------
# Buckets, niche-agnostic (industry is never filtered — only the role).
CLOSER_KW = ["high ticket closer", "high-ticket closer", "sales closer",
             "inbound closer", "remote closer", "remote closing", "closing sales",
             "account executive", "inside sales", "sales representative",
             "sales rep", "closer"]
SETTER_KW = ["appointment setter", "appointment setting", "setter",
             "sales development representative", "sales development manager"]
SETTER_ACR = ["sdr", "sdm"]                             # match as whole words only
# Setter channel split (checked once a role is already a setter).
SETTER_DM_KW = ["dm setter", "dm setting", "instagram", "social media", "social selling",
                "social dm", "online chat", "chat setter", "direct message", "social media setter"]
SETTER_DM_ACR = ["dm", "dms", "ig"]
SETTER_PHONE_KW = ["phone setter", "phone setting", "cold call", "cold caller", "cold calling",
                   "dialer", "dialler", "telemarket", "telesales", "outbound call",
                   "phone sales", "calling leads", "over the phone", "outbound dialing"]
# Lead temperature — a cross-cutting dimension (applies to setters and closers alike).
LEAD_INBOUND_KW = ["inbound", "warm lead", "warm leads", "inbound lead", "booked appointment",
                   "scheduled call", "responding to", "inbound closer", "inbound setter",
                   "pre-qualified", "prequalified", "warm market"]
LEAD_COLD_KW = ["cold call", "cold calling", "cold caller", "cold outreach", "cold dm",
                "cold lead", "cold email", "outbound", "prospecting", "cold market", "lead generation"]
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
    hay = (str(j.get("title", "")) + " " + str(j.get("location", "")) + " "
           + str(j.get("desc", ""))).lower()
    return _has(hay, REMOTE_KW)

def categorise(j) -> str | None:
    if not j.get("inbox") and not is_remote(j):
        return None                       # auto sources are remote-only; inbox is trusted
    title = str(j.get("title", "")).lower()
    text = title + " " + str(j.get("desc", "")).lower()
    # Success — TITLE only, CSM-based terms only
    if _has(title, SUCCESS_TITLE) or _has_word(title, SUCCESS_ACR):
        return "Success (CSM / customer / client / student)"
    # Closer — title + description
    if _has(text, CLOSER_KW):
        return "Closer"
    # Setter — split into DM / Phone / generic (Business Development excluded)
    if _has(text, SETTER_KW) or _has_word(text, SETTER_ACR):
        if _has(text, SETTER_DM_KW) or _has_word(text, SETTER_DM_ACR):
            return "Setter — DM Setting"
        if _has(text, SETTER_PHONE_KW):
            return "Setter — Phone Setting"
        return "Setter / SDR"
    # VA / Admin / Assistant — TITLE only
    if _has(title, VA_TITLE) or _has_word(title, VA_ACR):
        return "VA / Admin / Assistant"
    return None

def lead_type(j) -> str:
    """Inbound vs Cold — a cross-cutting tag, '' when the listing doesn't say."""
    text = (str(j.get("title", "")) + " " + str(j.get("desc", ""))).lower()
    if _has(text, LEAD_INBOUND_KW):
        return "Inbound"
    if _has(text, LEAD_COLD_KW):
        return "Cold"
    return ""

# English-only: drop titles carrying clear non-English (ES/PT/FR/DE/IT/NL) job
# words or accented letters. Checked on the title only (companies/locations may
# legitimately be foreign).
NON_EN_MARKERS = ["remoto", "remota", "administrativo", "administrativa", "auxiliar",
    "asistente", "assistente", "ventas", "vendas", "vendedor", "vendedora", "vendeur",
    "representante", "atencion", "atendimento", "gerente", "trabajo", "teletrabajo",
    "teletravail", "emploi", "empleo", "comercial", "negociateur", "teleconseiller",
    "vertrieb", "mitarbeiter", "kundenberater", "vertriebsmitarbeiter", "aussendienst",
    "innendienst", "medewerker", "verkoop", "klantenservice", "addetto", "vendite"]
NON_EN_CHARS = set("àáâãäåçèéêëìíîïñòóôõöùúûüýÿœæ")

def is_english(title: str) -> bool:
    t = (title or "").lower()
    if any(ch in NON_EN_CHARS for ch in t):
        return False
    return not any(m in t for m in NON_EN_MARKERS)

# Blocked terms — spam companies/keywords we never list. Matched against the
# company and title with spaces removed, so "Apex Focus Group" / "ApexFocusGroup"
# both match, and "survey" catches paid-survey / market-research-panel spam.
# Add more lowercase, de-spaced substrings here to block others.
BLOCKED_TERMS = ["apexfocusgroup", "survey"]

def is_blocked(j) -> bool:
    hay = (str(j.get("company", "")) + " " + str(j.get("title", ""))).lower().replace(" ", "")
    return any(b in hay for b in BLOCKED_TERMS)

# Country derivation. Adzuna results are stamped authoritatively (we query per
# country); everything else is best-effort from the location text.
ADZUNA_COUNTRY = {"us": "United States", "gb": "United Kingdom", "ca": "Canada",
                  "au": "Australia", "de": "Europe", "fr": "Europe", "nl": "Europe"}
US_STATES = {"al","ak","az","ar","ca","co","ct","de","fl","ga","hi","id","il","in","ia",
             "ks","ky","la","me","md","ma","mi","mn","ms","mo","mt","ne","nv","nh","nj",
             "nm","ny","nc","nd","oh","ok","or","pa","ri","sc","sd","tn","tx","ut","vt",
             "va","wa","wv","wi","wy"}
COUNTRY_ORDER = ["Worldwide / Anywhere", "United States", "United Kingdom",
                 "Canada", "Australia", "Europe", "Latin America", "Other"]

def country_of(loc) -> str:
    t = " " + str(loc or "").lower().replace(",", " ") + " "
    def has(*ws): return any(w in t for w in ws)
    if has(" uk ", "united kingdom", " england", " scotland", " wales", " london", " britain"):
        return "United Kingdom"
    if has(" canada", " ontario", " toronto", " vancouver", " quebec", " montreal"):
        return "Canada"
    if has(" australia", " sydney", " melbourne", " brisbane", " perth"):
        return "Australia"
    if has(" latam", "latin america", " mexico", " brazil", " argentina", " colombia"):
        return "Latin America"
    if has(" europe", " emea", " germany", " france", " spain", " netherlands", " poland",
           " portugal", " ireland", " italy", " sweden", " berlin", " amsterdam", " madrid", " paris"):
        return "Europe"
    toks = t.split()
    if has(" united states", " usa ", " us ", " u.s", " american") or (toks and toks[-1] in US_STATES):
        return "United States"
    if has(" worldwide", " anywhere", " global", " remote"):
        return "Worldwide / Anywhere"
    return "Other"

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
    if not IS_HEAVY:
        log("link check: skipped (light run)"); return
    if not CHECK_LINKS:
        log("link check: skipped (CHECK_LINKS=0)"); return
    if not _connectivity_ok():
        log("link check: skipped (no outbound connectivity)"); return
    # Don't link-validate inbox / Quick Add jobs — they're manually curated and
    # may legitimately have no apply link.
    actives = [(k, rec) for k, rec in store.items() if rec.get("active") and not rec.get("inbox")]
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
                "remote administrative assistant",
                "dm setter", "instagram appointment setter", "cold caller",
                "phone setter", "inbound sales representative"]

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
    if not IS_HEAVY:
        return [], False   # heavy source — only on the daily run (preserve Adzuna quota)
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
                    rec = mk("Adzuna", j.get("title"), (j.get("company") or {}).get("display_name"),
                             (j.get("location") or {}).get("display_name"), sal,
                             j.get("redirect_url"), j.get("description"))
                    rec["country"] = ADZUNA_COUNTRY.get(c, c.upper())   # authoritative per query
                    out.append(rec)
            except Exception as e:
                log(f"Adzuna/{c}/{what} failed: {e}")
    return out, ok

def src_jsearch():
    # Optional, feature-flagged: set JSEARCH_API_KEY (RapidAPI) to pull Google-for-
    # Jobs results (Indeed / LinkedIn / Glassdoor / ZipRecruiter). Off if unset.
    key = os.environ.get("JSEARCH_API_KEY", "").strip()
    out, ok = [], False
    if not IS_HEAVY:
        return out, False   # heavy source — only on the daily run
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
    blocked = [k for k, v in store.items() if is_blocked(v)]
    for k in blocked:
        del store[k]
    if blocked:
        log(f"blocklist: purged {len(blocked)} existing entr{'y' if len(blocked)==1 else 'ies'}")

    log(f"run mode: {'HEAVY — all sources + link check' if IS_HEAVY else 'light — inbox + free APIs (hourly Quick Add refresh)'}")
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
        if is_blocked(j):
            continue   # spam (survey / Apex etc.) — never list, even from the inbox
        if not j.get("inbox"):
            # Auto-sourced jobs must be a specific, English posting. Inbox / Quick
            # Add jobs are manually curated, so we trust them — kept even with no
            # link or an odd one (group posts often have no clean apply URL).
            if is_generic_link(j.get("link", "")):
                continue
            if not is_english(j.get("title", "")):
                continue
        j.setdefault("country", country_of(j.get("location", "")))  # Adzuna pre-stamps; others derive
        j["lead_type"] = lead_type(j)
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
                  "category": j["category"], "country": j.get("country") or country_of(j.get("location", "")),
                  "lead_type": j.get("lead_type", ""), "inbox": bool(j.get("inbox"))}
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
    # "New today" = every active role first seen today (UTC), so it survives every
    # run of the day rather than only the roles that were brand-new in the latest run.
    today_jobs = sorted((rec for rec in active if rec.get("first_seen") == TODAY),
                        key=lambda x: (x["category"], x["company"].lower()))
    write_outputs(active, new_today, today_jobs, len(current))
    STORE_FILE.write_text(json.dumps(store, indent=1, ensure_ascii=False))
    log(f"active: {len(active)} | new today: {len(today_jobs)} | first-this-run: {len(new_today)} | store total: {len(store)}")

FIELDS = ["date_found", "category", "source", "title", "company", "location", "comp", "link"]

def write_outputs(active, new_today, today_jobs, scanned):
    # daily CSV — every role first seen today (rewritten each run, so it reflects
    # the whole day no matter how many runs happen)
    with (DAILY_DIR / f"{TODAY}.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS); w.writeheader()
        for j in today_jobs:
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
    # daily markdown digest (everything first seen today)
    md = [f"# Fresh in the Vault - {TODAY}", "",
          f"_{len(today_jobs)} new role(s) today; {len(active)} active total; scanned {scanned} live listings._", ""]
    cur = None
    for j in today_jobs:
        if j["category"] != cur:
            cur = j["category"]; md += ["", f"## {cur}", ""]
        link = f"[apply]({j['link']})" if j["link"] else ""
        md.append(f"- **{j['title']}** - {j['company']} ({j['location']}) "
                  f"{('- ' + j['comp']) if j['comp'] else ''} {link}  _via {j['source']}_")
    if not today_jobs:
        md.append("_No new roles today._")
    (DAILY_DIR / f"{TODAY}.md").write_text("\n".join(md), encoding="utf-8")
    write_latest_html(today_jobs, len(active), scanned)
    write_all_html(active, len(today_jobs))

PAGE_CSS = """
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700;800&display=swap');
:root{--bg:#0a0a0b;--card:#141312;--line:rgba(201,156,56,.14);--line2:#262320;--txt:#f3efe6;--mut:#9a948a;--gold:#c99c38;--gold2:#f2dd88;--goldd:#a47a26;--accent:#c99c38;--new:#c99c38}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;line-height:1.5;-webkit-font-smoothing:antialiased}
header{padding:40px 20px 16px;text-align:center;background:radial-gradient(1000px 380px at 50% -140px,rgba(201,156,56,.17),transparent 70%);border-bottom:1px solid var(--line2)}
.brand{display:inline-flex;align-items:center;gap:11px;text-decoration:none;margin:0 0 16px}.brand img{display:block}
.wm{font-family:"Playfair Display",Georgia,serif;font-weight:700;font-size:23px;letter-spacing:.18em;padding-left:.18em;background:linear-gradient(180deg,#f6e29a,#d9b24c 55%,#b8862f);-webkit-background-clip:text;background-clip:text;color:transparent}
h1{margin:0 0 6px;font-family:"Playfair Display",Georgia,serif;font-weight:500;font-style:italic;font-size:20px;letter-spacing:.005em;color:#e9e0cc}
h1 .au{background:linear-gradient(180deg,#f6e29a,#d9b24c 55%,#b8862f);-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{color:var(--mut);font-size:13.5px;margin:0;letter-spacing:.01em}
.nav{margin:16px 0 0;display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.nav a{color:var(--mut);font-size:12px;letter-spacing:.03em;text-decoration:none;border:1px solid var(--line);padding:7px 14px;border-radius:999px;transition:border-color .18s,color .18s,background .18s}
.nav a:hover{border-color:var(--gold);color:var(--txt)}.nav a.on{color:#0a0a0b;background:linear-gradient(175deg,#f6e29a 0%,#d9b24c 45%,#b8862f 100%);border-color:var(--gold);font-weight:600}
.wrap{max-width:1060px;margin:0 auto;padding:14px 16px 70px}
h2{margin:30px 0 12px;font-family:"Playfair Display",Georgia,serif;font-weight:600;font-size:19px;letter-spacing:-.01em;color:#f4eedd}.n{font-size:12px;color:var(--mut);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-weight:400}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.card{background:linear-gradient(180deg,#171513,#121110);border:1px solid var(--line);border-radius:14px;padding:16px 18px;display:flex;flex-direction:column;gap:7px;transition:transform .18s,border-color .18s,box-shadow .18s}
.card:hover{border-color:rgba(201,156,56,.55);transform:translateY(-2px);box-shadow:0 14px 34px -16px rgba(0,0,0,.8)}
.t{font-weight:700;font-size:15px;letter-spacing:-.01em;color:#f6f1e6}.c{color:var(--mut);font-size:13px;flex:1}
.f{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px}
.pill{font-size:12px;background:rgba(201,156,56,.10);color:var(--gold2);border:1px solid rgba(201,156,56,.24);padding:2px 10px;border-radius:999px;font-weight:600}
.tag{font-size:11px;background:#1b1916;color:#cdbf9c;border:1px solid var(--line2);padding:2px 9px;border-radius:999px}
.new{font-size:10px;font-weight:800;letter-spacing:.05em;background:linear-gradient(175deg,#f6e29a 0%,#d9b24c 45%,#b8862f 100%);color:#0a0a0b;padding:2px 7px;border-radius:5px;margin-right:7px;vertical-align:middle}
.src{font-size:11px;color:var(--mut);flex:1}
.controls{position:sticky;top:0;z-index:5;background:rgba(10,10,11,.85);backdrop-filter:blur(10px);padding:14px 0;margin-bottom:6px;border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:10px;align-items:center}
.controls input{width:100%;max-width:480px;padding:11px 15px;border-radius:11px;border:1px solid var(--line2);background:#141312;color:var(--txt);font-size:15px;outline:none}
.controls input:focus{border-color:var(--gold)}
.fchips{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.fchip{padding:7px 13px;border-radius:999px;border:1px solid var(--line);background:#141312;color:var(--mut);cursor:pointer;font-size:12.5px;font-weight:600;letter-spacing:.02em;transition:.16s}
.fchip:hover{color:var(--txt);border-color:rgba(201,156,56,.45)}.fchip.on{background:linear-gradient(175deg,#f6e29a 0%,#d9b24c 45%,#b8862f 100%);border-color:var(--gold);color:#0a0a0b}
.csel{padding:9px 13px;border-radius:10px;border:1px solid var(--line);background:#141312;color:var(--txt);font-size:13px;font-weight:600;outline:none;cursor:pointer}
.csel:focus{border-color:var(--gold)}
.fcount{color:var(--mut);font-size:12px;letter-spacing:.02em}
a.visit{font-size:13px;font-weight:700;color:#0a0a0b;background:linear-gradient(175deg,#f6e29a 0%,#d9b24c 45%,#b8862f 100%);padding:7px 13px;border-radius:9px;text-decoration:none;transition:filter .15s,box-shadow .15s}
a.visit:hover{filter:brightness(1.06);box-shadow:0 8px 20px -8px rgba(201,156,56,.5)}
.nl{font-size:12px;color:var(--mut)}.empty{text-align:center;color:var(--mut);padding:56px 0}
footer{text-align:center;color:var(--mut);font-size:12px;padding:30px 20px;border-top:1px solid var(--line2);margin-top:24px}footer a{color:var(--goldd)}
"""

TAGLINE = 'The <span class="au">Gold Standard</span> for Your High-Ticket Job Search'
OG_PATHS = {"new": "/jobs", "all": "/jobs/all"}

def _nav(active):
    def a(href, label, key):
        return f'<a class="{"on" if key==active else ""}" href="{href}">{label}</a>'
    return ('<div class="nav">' + a("/jobs", "Fresh today", "new") + a("/jobs/all", "The Vault", "all")
            + a("/jobs/boards", "&starf; Boards", "boards") + a("/directory", "Communities", "dir")
            + a("/cv", "CV match", "cv") + '</div>')

def _bucket_code(cat):
    c = cat.lower()
    if "success" in c:
        return "success"
    if "assistant" in c or "admin" in c or c.startswith("va "):
        return "va"
    if "setter" in c or "sdr" in c or "sdm" in c:
        if "dm setting" in c:
            return "setdm"
        if "phone setting" in c:
            return "setphone"
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
        ctry = j.get("country") or "Other"
        lead = j.get("lead_type") or ""
        s = f'{j["title"]} {j["company"]} {j["location"]} {j["source"]} {j["category"]} {ctry} {lead}'.lower()
        attrs = (f' data-b="{code}" data-c="{html.escape(ctry, quote=True)}"'
                 f' data-l="{html.escape(lead, quote=True)}"'
                 f' data-s="{html.escape(s, quote=True)}"')
    return (f'<div class="card"{attrs}><div class="t">{badgeh}{html.escape(j["title"])}</div>'
            f'<div class="c">{html.escape(j["company"])} &middot; {html.escape(j["location"])}</div>'
            f'<div class="f">{tagh}{comp}<span class="src">via {html.escape(j["source"])}</span>{link}</div></div>')

def _doc(heading, sub, nav_key, body, tab=None):
    return (f'<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>{tab or heading} · Aurum</title>'
            f'<link rel="icon" type="image/svg+xml" href="/favicon.svg">'
            f'<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">'
            f'<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">'
            f'<link rel="shortcut icon" href="/favicon.ico">'
            f'<link rel="apple-touch-icon" href="/apple-touch-icon.png">'
            f'<meta property="og:type" content="website">'
            f'<meta property="og:site_name" content="AURUM">'
            f'<meta property="og:title" content="AURUM · {tab or "High-Ticket Roles"}">'
            f'<meta property="og:description" content="Fresh remote high-ticket sales roles — closers, setters, SDRs, customer success &amp; VAs — refreshed hourly.">'
            f'<meta property="og:url" content="https://aurum-hts.vercel.app{OG_PATHS.get(nav_key, "")}">'
            f'<meta property="og:image" content="https://aurum-hts.vercel.app/og-image.png">'
            f'<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'
            f'<meta name="twitter:card" content="summary_large_image">'
            f'<meta name="twitter:image" content="https://aurum-hts.vercel.app/og-image.png">'
            f'<style>{PAGE_CSS}</style></head><body>'
            f'<header><a class="brand" href="/jobs"><img src="/favicon.svg" width="34" height="34" alt="Aurum">'
            f'<span class="wm">AURUM</span></a>'
            f'<h1>{heading}</h1><p class="sub">{sub}</p>{_nav(nav_key)}</header>'
            f'<div class="wrap">{body}</div>'
            f'<footer>Auto-generated from public job-board APIs + your inbox. '
            f'Listings stay live until they drop off their source. Verify before applying.</footer>'
            f'</body></html>')

def _controls(jobs):
    present = {j.get("country") or "Other" for j in jobs}
    ordered = [c for c in COUNTRY_ORDER if c in present] + sorted(present - set(COUNTRY_ORDER))
    copts = '<option value="all">All countries</option>' + "".join(
        f'<option value="{html.escape(c, quote=True)}">{html.escape(c)}</option>' for c in ordered)
    lopts = ('<option value="all">Any lead type</option>'
             '<option value="Inbound">Inbound leads</option>'
             '<option value="Cold">Cold leads</option>')
    return ('<div class="controls">'
            '<input id="q" type="search" placeholder="Search title, company, source…">'
            '<div class="fchips">'
            '<button class="fchip on" data-f="all">All</button>'
            '<button class="fchip" data-f="closer">Closer</button>'
            '<button class="fchip" data-f="setdm">DM Setting</button>'
            '<button class="fchip" data-f="setphone">Phone Setting</button>'
            '<button class="fchip" data-f="setter">Setter / SDR</button>'
            '<button class="fchip" data-f="success">Success</button>'
            '<button class="fchip" data-f="va">VA / Admin</button>'
            '</div>'
            f'<select id="country" class="csel" aria-label="Country">{copts}</select>'
            f'<select id="lead" class="csel" aria-label="Lead type">{lopts}</select>'
            '<div class="fcount" id="fcount"></div></div>')

def write_latest_html(jobs, active_count, scanned):
    if not jobs:
        body = ('<p class="empty">No new roles pulled today.<br>'
                'See every live listing in <a href="/jobs/all">The Vault</a>.</p>')
    else:
        groups = {}
        for j in jobs:
            groups.setdefault(j["category"], []).append(j)
        sections = ""
        for cat, items in groups.items():
            sections += (f'<section class="dgroup"><h2>{html.escape(cat)} <span class="n">{len(items)}</span></h2>'
                         f'<div class="grid">'
                         + "".join(_card(j, code=_bucket_code(cat)) for j in items)
                         + "</div></section>")
        body = _controls(jobs) + sections + FILTER_JS
    sub = f"{TODAY} &middot; {len(jobs)} new today &middot; {active_count} active in total"
    LATEST_HTML.write_text(_doc(TAGLINE, sub, "new", body, tab="Fresh in the Vault"), encoding="utf-8")

FILTER_JS = """<script>
(function(){
 var q=document.getElementById('q'),fcount=document.getElementById('fcount'),
     country=document.getElementById('country'),lead=document.getElementById('lead'),
     chips=[].slice.call(document.querySelectorAll('.fchip')),f='all';
 function apply(){
  var t=(q.value||'').trim().toLowerCase(),cc=country?country.value:'all',
      ll=lead?lead.value:'all',n=0;
  [].forEach.call(document.querySelectorAll('section.dgroup'),function(sec){
   var vis=0;
   [].forEach.call(sec.querySelectorAll('.card'),function(c){
    var okB=(f==='all')||c.getAttribute('data-b')===f,
        okC=(cc==='all')||c.getAttribute('data-c')===cc,
        okL=(ll==='all')||c.getAttribute('data-l')===ll,
        okT=!t||(c.getAttribute('data-s')||'').indexOf(t)>-1,
        show=okB&&okC&&okL&&okT;
    c.style.display=show?'':'none'; if(show){vis++;n++;}
   });
   sec.style.display=vis?'':'none';
  });
  fcount.textContent=n+' shown';
 }
 chips.forEach(function(ch){ch.onclick=function(){chips.forEach(function(x){x.classList.remove('on');});ch.classList.add('on');f=ch.getAttribute('data-f');apply();};});
 q.addEventListener('input',apply);
 if(country){country.addEventListener('change',apply);}
 if(lead){lead.addEventListener('change',apply);}
 apply();
})();
</script>"""

def write_all_html(active, new_count):
    controls = _controls(active)
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
    ALL_HTML.write_text(_doc(TAGLINE, sub, "all", body, tab="The Vault"), encoding="utf-8")

if __name__ == "__main__":
    main()
