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

## 2. ✅ DONE — /hiring email alerts
Fixed 2026-06-26 by folding the email into the main sync Apps Script (emails on
type:"listing"), then deploying it as a fresh web app and pointing
`INBOX_SYNC_URL` at it. New roles now save AND email you.
Leftover cleanup (optional, no rush): the old standalone notifier, the
`LISTING_NOTIFY_URL` Vercel env var, and `docs/listing-notify.gs` are now unused
and can be deleted; old Apps Script deployments can be archived.

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
