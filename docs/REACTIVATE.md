# 🔌 How to bring AURUM back online

The site was taken **offline (paused)** on 2026-06-26. Nothing was deleted — all
code, data, and history are intact. Follow these steps to switch it all back on.

## 1. Bring the website back (Vercel)
Whatever you used to take it offline, reverse it:
- If you **Paused the project**: Vercel → the project → Settings → **Resume**.
- If you enabled **Deployment Protection**: Settings → Deployment Protection → set
  back to **"No protection"** (for production).
- If you **removed the production domain**: re-add it under Settings → Domains.

Do this for **every** project that serves the site (there may be more than one, e.g.
`better-prompt-ai-main` and the `…-ashy` one).

## 2. Re-enable the automatic job refresh (GitHub Actions)
In this repo, uncomment the `schedule:` blocks that were disabled:
- `.github/workflows/daily-jobs.yml` — uncomment the `schedule:` / `- cron: "23 * * * *"` lines.
- `.github/workflows/analytics.yml` — uncomment the `schedule:` / `- cron: "30 6 * * *"` lines.

(Or simply `git revert` the "take offline" commit, which restores both at once.)

## 3. Re-create the hourly pinger (optional but recommended)
The reliable hourly refresh needs the external pinger (see `docs/external-pinger.md`):
1. Create a fine-grained GitHub token — this repo only, **Actions: Read & write**.
2. Add it to a **cron-job.org** job hourly (URL/headers/body in `docs/external-pinger.md`).

## 4. Sanity check
- Visit the site — it should load again.
- Trigger one job refresh (cron-job.org "Test run", or GitHub → Actions → run the
  workflow) and confirm an "Opportunities refresh" commit appears.
- Post a test role at `/hiring` and confirm it saves + emails you.

---

### What was left running (harmless)
- `/hiring` form, email alerts, and the sync Apps Script still function on-demand,
  but no one reaches them while the site is paused.
- The `workflow_dispatch` (manual run) triggers remain — they only fire if
  explicitly invoked, so they cause nothing on their own.
