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
import csv, json, hashlib, datetime, os, re, sys, urllib.request, urllib.parse, html
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DAILY_DIR = ROOT / "daily"
SEEN_FILE = ROOT / "seen.json"
HISTORY = ROOT / "history.csv"
INBOX = ROOT / "inbox.csv"
LATEST_HTML = ROOT / "latest.html"
TODAY = datetime.date.today().isoformat()
UA = "high-ticket-jobs-bot/1.0 (+personal daily digest; contact: annajtelfer@gmail.com)"

# --- What counts as a relevant opportunity -------------------------------
SALES_KW = ["high ticket", "high-ticket", "remote closer", "remote closing",
            "sales closer", "appointment setter", "high ticket closer",
            "high-ticket closer", "inbound closer", "sales representative",
            "account executive", "sdr", "business development representative",
            "inside sales"]
CSM_KW = ["customer success manager", "client success manager",
          "customer success", "client success", "csm", "account manager",
          "onboarding specialist", "implementation specialist"]
# Strong signals that keep precision high (at least one must appear)
CORE_KW = SALES_KW + CSM_KW

def categorise(text: str) -> str | None:
    t = text.lower()
    if any(k in t for k in CSM_KW):
        return "Customer Success (CSM)"
    if any(k in t for k in SALES_KW):
        return "Sales (closer / setter)"
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

# --- Sources (free, public, ToS-friendly APIs) ---------------------------
def src_remotive():
    out = []
    for cat in ("sales", "customer-service"):
        try:
            data = get_json(f"https://remotive.com/api/remote-jobs?category={cat}&limit=200")
            for j in data.get("jobs", []):
                out.append(mk("Remotive", j.get("title"), j.get("company_name"),
                              j.get("candidate_required_location"), j.get("salary"),
                              j.get("url"), j.get("description")))
        except Exception as e:
            log(f"Remotive/{cat} failed: {e}")
    return out

def src_remoteok():
    out = []
    try:
        data = get_json("https://remoteok.com/api")
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
    return out

def src_arbeitnow():
    out = []
    try:
        data = get_json("https://www.arbeitnow.com/api/job-board-api")
        for j in data.get("data", []):
            out.append(mk("Arbeitnow", j.get("title"), j.get("company_name"),
                          ", ".join(j.get("location", []) if isinstance(j.get("location"), list) else [j.get("location","")]),
                          "", j.get("url"), j.get("description")))
    except Exception as e:
        log(f"Arbeitnow failed: {e}")
    return out

def src_jobicy():
    out = []
    for ind in ("sales", "supporting"):
        try:
            data = get_json(f"https://jobicy.com/api/v2/remote-jobs?count=100&industry={ind}")
            for j in data.get("jobs", []):
                out.append(mk("Jobicy", j.get("jobTitle"), j.get("companyName"),
                              j.get("jobGeo"), j.get("annualSalaryMax") and
                              f"to ${j.get('annualSalaryMax')}" or "",
                              j.get("url"), j.get("jobExcerpt")))
        except Exception as e:
            log(f"Jobicy/{ind} failed: {e}")
    return out

SOURCES = [src_remotive, src_remoteok, src_arbeitnow, src_jobicy]

# --- Inbox (gated-group posts: manual or Zapier-fed) ---------------------
def read_inbox():
    """Read inbox.csv (committed) and/or a published Google-Sheet CSV via INBOX_CSV_URL."""
    rows = []
    def parse_csv_text(text, origin):
        for d in csv.DictReader(text.splitlines()):
            d = {k.strip().lower(): (v or "").strip() for k, v in d.items() if k}
            title = d.get("title", "")
            if title.startswith("#"):       # comment line in the template
                continue
            if not title and not d.get("link"):
                continue
            rows.append(mk(d.get("source") or origin, d.get("title"), d.get("company"),
                           d.get("location"), d.get("comp") or d.get("salary"),
                           d.get("link"), d.get("notes") or d.get("description")))
    if INBOX.exists():
        try:
            parse_csv_text(INBOX.read_text(encoding="utf-8"), "Inbox")
        except Exception as e:
            log(f"inbox.csv failed: {e}")
    url = os.environ.get("INBOX_CSV_URL", "").strip()
    if url:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=25) as r:
                parse_csv_text(r.read().decode("utf-8", "replace"), "Inbox (Sheet)")
        except Exception as e:
            log(f"INBOX_CSV_URL failed: {e}")
    return rows

LOG: list[str] = []
def log(m): LOG.append(m); print(m, file=sys.stderr)

# --- Main ---------------------------------------------------------------
def main():
    DAILY_DIR.mkdir(exist_ok=True)
    seen = json.loads(SEEN_FILE.read_text()) if SEEN_FILE.exists() else {}

    raw = []
    for fn in SOURCES:
        got = fn()
        log(f"{fn.__name__}: {len(got)} raw")
        raw.extend(got)
    inbox_rows = read_inbox()
    log(f"inbox: {len(inbox_rows)} rows")
    raw.extend(inbox_rows)

    # filter to relevant + tag category; inbox rows are always kept
    candidates = []
    for j in raw:
        from_inbox = j["source"].startswith("Inbox")
        cat = categorise(j["title"] + " " + j["desc"])
        if from_inbox and not cat:
            cat = "From group (uncategorised)"
        if not cat:
            continue
        j["category"] = cat
        candidates.append(j)

    # dedupe within today + against all-time seen
    new_today, batch_keys = [], set()
    for j in candidates:
        k = job_key(j)
        if k in batch_keys:
            continue
        batch_keys.add(k)
        if k in seen:
            continue
        seen[k] = {"first_seen": TODAY, "title": j["title"], "company": j["company"],
                   "source": j["source"], "link": j["link"]}
        new_today.append(j)

    new_today.sort(key=lambda x: (x["category"], x["company"].lower()))
    write_outputs(new_today, len(candidates))
    SEEN_FILE.write_text(json.dumps(seen, indent=1, ensure_ascii=False))
    log(f"NEW today: {len(new_today)} (from {len(candidates)} relevant, {len(seen)} all-time)")

FIELDS = ["date_found", "category", "source", "title", "company", "location", "comp", "link"]

def write_outputs(jobs, scanned):
    # daily CSV
    with (DAILY_DIR / f"{TODAY}.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS); w.writeheader()
        for j in jobs:
            w.writerow({"date_found": TODAY, "category": j["category"], "source": j["source"],
                        "title": j["title"], "company": j["company"], "location": j["location"],
                        "comp": j["comp"], "link": j["link"]})
    # all-time history (append)
    new_hist = not HISTORY.exists()
    with HISTORY.open("a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        if new_hist:
            w.writeheader()
        for j in jobs:
            w.writerow({"date_found": TODAY, "category": j["category"], "source": j["source"],
                        "title": j["title"], "company": j["company"], "location": j["location"],
                        "comp": j["comp"], "link": j["link"]})
    # daily markdown digest
    md = [f"# New high-ticket opportunities - {TODAY}", "",
          f"_{len(jobs)} new role(s); scanned {scanned} relevant listings across job boards + inbox._", ""]
    cur = None
    for j in jobs:
        if j["category"] != cur:
            cur = j["category"]; md += ["", f"## {cur}", ""]
        link = f"[apply]({j['link']})" if j["link"] else ""
        md.append(f"- **{j['title']}** - {j['company']} ({j['location']}) "
                  f"{('- ' + j['comp']) if j['comp'] else ''} {link}  _via {j['source']}_")
    if not jobs:
        md.append("_No new roles today._")
    (DAILY_DIR / f"{TODAY}.md").write_text("\n".join(md), encoding="utf-8")
    write_latest_html(jobs, scanned)

def write_latest_html(jobs, scanned):
    groups = {}
    for j in jobs:
        groups.setdefault(j["category"], []).append(j)
    cards = ""
    for cat, items in groups.items():
        cards += f'<h2>{html.escape(cat)} <span class="n">{len(items)}</span></h2><div class="grid">'
        for j in items:
            link = (f'<a class="visit" href="{html.escape(j["link"])}" target="_blank" rel="noopener">Apply &rarr;</a>'
                    if j["link"] else '<span class="nl">no link</span>')
            comp = f'<span class="pill">{html.escape(j["comp"])}</span>' if j["comp"] else ""
            cards += (f'<div class="card"><div class="t">{html.escape(j["title"])}</div>'
                      f'<div class="c">{html.escape(j["company"])} &middot; {html.escape(j["location"])}</div>'
                      f'<div class="f">{comp}<span class="src">via {html.escape(j["source"])}</span>{link}</div></div>')
        cards += "</div>"
    if not jobs:
        cards = '<p class="empty">No new roles found today. Check back tomorrow.</p>'
    doc = f"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>New High-Ticket Opportunities - {TODAY}</title><style>
:root{{--bg:#0f1420;--card:#171e2e;--line:#2a3348;--txt:#e8edf6;--mut:#9aa7bd;--accent:#5b8cff}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--txt);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;line-height:1.45}}
header{{padding:30px 20px 10px;text-align:center;background:radial-gradient(900px 300px at 50% -40%,#22304d,transparent)}}
h1{{margin:0 0 4px;font-size:24px}}.sub{{color:var(--mut);font-size:14px;margin:0}}
.wrap{{max-width:1040px;margin:0 auto;padding:10px 16px 60px}}
h2{{margin:26px 0 10px;font-size:17px}}.n{{font-size:12px;color:var(--mut)}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:13px 15px;display:flex;flex-direction:column;gap:6px}}
.card:hover{{border-color:var(--accent)}}.t{{font-weight:700;font-size:15px}}.c{{color:var(--mut);font-size:13px;flex:1}}
.f{{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px}}
.pill{{font-size:12px;background:#15303a;color:#7fd7ff;padding:2px 9px;border-radius:999px}}
.src{{font-size:11px;color:var(--mut);flex:1}}
a.visit{{font-size:13px;font-weight:700;color:#fff;background:var(--accent);padding:6px 11px;border-radius:8px;text-decoration:none}}
.nl{{font-size:12px;color:var(--mut)}}.empty{{text-align:center;color:var(--mut);padding:50px 0}}
.bar{{text-align:center;margin:6px 0 0}}.bar a{{color:var(--accent);font-size:13px;text-decoration:none}}
footer{{text-align:center;color:var(--mut);font-size:12px;padding:24px}}
</style></head><body>
<header><h1>New High-Ticket Opportunities</h1>
<p class="sub">{TODAY} &middot; {len(jobs)} new role(s) &middot; scanned {scanned} relevant listings</p>
<div class="bar"><a href="/directory">&larr; Communities directory</a></div></header>
<div class="wrap">{cards}</div>
<footer>Auto-generated daily from public job-board APIs + your inbox. Deduped against all-time history. Verify before applying.</footer>
</body></html>"""
    LATEST_HTML.write_text(doc, encoding="utf-8")

if __name__ == "__main__":
    main()
