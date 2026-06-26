# ⏰ Do these when you're on a computer

Quick, prioritised list of the things that need your logins/credentials (so I
can't do them for you). Ping me here once you're at a desk — say *"I'm on my
computer"* — and I'll walk you through each, live.

_Last updated: 2026-06-26._

---

## 1. ✅ DONE — external pinger
Set up 2026-06-26: cron-job.org pings the workflow hourly (verified 204 +
dispatched run `93a01a8`). The board now refreshes itself, and the 00:00 & 14:00
UTC heavy pulls fire automatically. No more manual hard-runs needed.

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
