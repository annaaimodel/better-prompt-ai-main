# Reliable hourly refresh — external pinger setup

GitHub's built-in `schedule:` is best-effort and silently drops most on-the-hour
triggers, so the job board can go stale for hours. This sets up a **free external
cron** that calls the workflow's `workflow_dispatch` API every hour — external
triggers are not throttled like `schedule` is, so refreshes land reliably.

The pinger fires a **light** run (inbox + free APIs). The pipeline still does its
HEAVY pull (Adzuna/JSearch + link validation) automatically at 00:00 and 14:00 UTC
via the hour check, so your paid-source quotas are never burned by the hourly ping.

You only need to do two things: make a token, and paste it into a cron service.

---

## Step 1 — Create a scoped GitHub token (2 min)

Use a **fine-grained** token locked to this one repo with the minimum permission.

1. Go to <https://github.com/settings/personal-access-tokens/new>
   (GitHub → Settings → Developer settings → Fine-grained tokens → Generate new).
2. **Token name:** `board-pinger`
3. **Expiration:** 1 year (set a calendar reminder to rotate it).
4. **Repository access:** *Only select repositories* → pick
   **`annaaimodel/better-prompt-ai-main`**.
5. **Permissions:** expand *Repository permissions*, find **Actions** →
   set to **Read and write**. (Leave everything else "No access". "Metadata: Read"
   is auto-selected — that's fine.)
6. **Generate token** and **copy it** (starts with `github_pat_…`). You won't see
   it again. This token can only run Actions on this one repo — it cannot read code
   or push commits.

> Security: this token lives inside the cron service. Because it's scoped to
> Actions-only on a single repo, the blast radius if it ever leaked is just
> "someone could trigger your job refresh" — no code, secrets, or other repos.

---

## Step 2 — Create the cron job at cron-job.org (free, no card)

1. Sign up at <https://console.cron-job.org/signup> and log in.
2. **Create cronjob** and set:

   - **Title:** `AURUM board refresh`
   - **URL:**
     ```
     https://api.github.com/repos/annaaimodel/better-prompt-ai-main/actions/workflows/daily-jobs.yml/dispatches
     ```
   - **Schedule:** Every hour (e.g. "Every 1 hour", at minute 0).
   - Expand **Advanced / Request settings**:
     - **Request method:** `POST`
     - **Headers** (add each as Key / Value):
       | Key | Value |
       |-----|-------|
       | `Accept` | `application/vnd.github+json` |
       | `Authorization` | `Bearer github_pat_YOUR_TOKEN_HERE` |
       | `X-GitHub-Api-Version` | `2022-11-28` |
       | `Content-Type` | `application/json` |
     - **Request body:**
       ```json
       {"ref":"master"}
       ```
3. **Save.**

A successful call returns **HTTP 204** (no content) — that's the "accepted" status.
cron-job.org will show the job as OK/204 in its execution history.

### Optional: trigger a HEAVY run on demand
Same setup, but body `{"ref":"master","inputs":{"heavy":"true"}}`. You rarely need
this — heavy already runs at 00:00 + 14:00 UTC.

---

## Step 3 — Verify

- In cron-job.org, hit **Test run** (or **Execute now**) → expect **204**.
- In GitHub → **Actions → High-ticket opportunities**, a new run tagged
  *workflow_dispatch* should appear within a minute and commit an
  "Opportunities refresh" if there's anything new.

If you get **401/403** from the API: the token is wrong, expired, or missing the
**Actions: Read and write** permission. **404** usually means the token can't see
the repo (check the *repository access* selection in Step 1).

---

## Notes

- The repo's own `schedule:` (now at `:23`) stays on as a backup, so you have two
  independent triggers. No harm if both occasionally fire — light runs are cheap
  and the pipeline de-dupes.
- To pause the pinger, just disable the job in cron-job.org. To rotate the token,
  regenerate it in GitHub and update the `Authorization` header.
