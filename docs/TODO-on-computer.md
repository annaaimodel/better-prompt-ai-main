# ⏰ Do these when you're on a computer

Quick, prioritised list of the things that need your logins/credentials (so I
can't do them for you). Ping me here once you're at a desk — say *"I'm on my
computer"* — and I'll walk you through each, live.

_Last updated: 2026-06-18._

---

## 1. 🔴 Set up the external pinger  — HIGHEST IMPACT
**Why:** GitHub keeps dropping the scheduled job-refresh runs. This is what made
the board look "light" (today's 00:00 heavy pull got skipped). The pinger fires
hourly from an external service, which **also** guarantees the 00:00 & 14:00 UTC
*heavy* pulls (Adzuna/Jooble) — so it fixes both reliability **and** freshness.

**Steps:** follow `docs/external-pinger.md` —
1. Create a fine-grained GitHub token (this repo only, **Actions: Read & write**).
2. Add it to a free **cron-job.org** job (hourly) per the guide.
Takes ~5 min. I'll verify it fired (HTTP 204 + a dispatched run) once you're done.

## 2. 🟡 Fix the "no email" on /hiring listings
Saving works now, but the email alert doesn't fire. Two likely causes:
- The **notifier Apps Script's "Who has access"** isn't set to **Anyone** (same
  issue we fixed on the sync) → it 403s silently. Fix in its Deploy → Manage
  deployments → ✏️ → Anyone.
- **`LISTING_NOTIFY_URL`** may be missing in the *live* Vercel project (the
  `…-ashy` one where saves now work).

**Bulletproof alternative (recommended):** paste your main sync Apps Script here
and I'll fold the email straight into it — no separate notifier, nothing to
mismatch.

## 3. 🟢 Put a custom domain on the site
A `vercel.app` URL converts worse and some FB groups flag it as spam. A clean
domain is the cheapest credibility upgrade before you push the community posts
(`docs/community-posts.md`). Add it in Vercel → Domains.

## 4. ⚪ (Optional) Tidy email signups out of the Job Inbox
The homepage email signups (`source: home`) land in the Job Inbox sheet. Harmless
(the board ignores them), just messy. If you want them in a separate
"Subscribers" tab, paste your sync script and I'll add the routing.

---

### Already done & live (no action needed)
- ✅ Board heavy-refreshed — **192 active roles, 18 new today**.
- ✅ AURUM logo links to home on all pages.
- ✅ `/hiring` listings save (403 fixed); "Test" row cleared.
- ✅ Sales Pipeline Pros featured; "Other" category rename.
- ✅ Analytics digest now shows a real **Last 24 hours** line.
- ✅ Community launch posts drafted (`docs/community-posts.md`).
