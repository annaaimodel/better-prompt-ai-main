# Cadence — your value-first follow-up engine

A standalone follow-up system for high-ticket coaching/consulting. It keeps you
on top of every inbound lead across **text, email and call**, and makes sure
**every single touch delivers value** — so prospects are glad to hear from you
even before they buy.

It is fully self-contained (its own folder, its own `package.json`, its own
Vercel config) and shares **zero code** with the rest of this repo, so it can be
lifted into its own repository at any time with no rework.

---

## What it does

- **Today view** — tells you exactly *who* to follow up with, on *which* channel,
  and *what value* to lead with. Overdue leads float to the top.
- **A built-in value-rotating cadence** — speed-to-lead first, then a persistent
  multi-channel sequence (call → text → email …) that rotates the value angle
  **insight → proof → resource → intro** so you never send two hollow touches in
  a row. After the sequence, leads roll into a long-term nurture (a value drop
  every 14 days).
- **One-click AI drafting** (`/api/draft`) — writes a ready-to-send text, email,
  or call-prep script tailored to that lead, their stage, your prior touches, and
  **your real case studies and resources**. It never invents results or links.
- **Smart intake** (`/api/intake`) — paste a messy ad/funnel lead notification
  and it parses into a clean contact.
- **Your data, your device** — everything lives in `localStorage` with JSON
  export/import. Nothing is stored server-side; the API functions log nothing.

## The default cadence

| # | Wait | Channel | Value | Purpose |
|---|------|---------|-------|---------|
| 1 | now | Call | Insight | Speed-to-lead (connect <5 min) |
| 2 | ~12 min | Text | Insight | Intro — reference what they opted in for |
| 3 | 3 h | Email | Resource | Welcome + a useful resource |
| 4 | ~1 day | Call | Insight | Second attempt |
| 5 | +2 d | Text | Proof | A quick win from someone like them |
| 6 | +3 d | Email | Insight | Tailored insight + soft invite |
| 7 | +4 d | Call | Proof | Value call, lead with a result |
| 8 | +4 d | Text | Intro | Relevant intro / timely opportunity |
| 9 | +5 d | Email | Proof | Case study + clear invitation |
| 10 | +7 d | Text | Insight | Human check-in, no pitch |
| 11 | +10 d | Email | Resource | Move to nurture + parting resource |
| … | every 14 d | rotates | rotates | Long-term nurture |

Edit the sequence in `app.js` (`CAD` / `NURTURE_ROT`).

## Setup

1. **Env vars** (copy `.env.example` → `.env`, or set in Vercel):
   - `ACCESS_CODE` — any strong string; unlocks the app and the AI endpoints.
   - `ANTHROPIC_API_KEY` — your Anthropic API key.
2. **Deploy** to Vercel with this folder as the project root. The `api/`
   functions deploy automatically as serverless endpoints; the front-end is
   static.
3. **Open the app → Settings**:
   - Enter your `ACCESS_CODE`.
   - Fill in your **offer profile** — offer, ideal client, real client results
     (one per line), and shareable resources (`Title — URL`). This is what makes
     the follow-ups land; the AI uses *only* what you provide.
4. **Add a lead** (paste an inbound, or type it) → it appears in **Today** at the
   speed-to-lead step. Hit **Draft ✦**, copy, send, then **Done ▸** to advance.

## Local development

```bash
cd followup-engine
npm install
npx vercel dev    # serves the static front-end + the /api functions
```

## Tech

Plain HTML/CSS/JS front-end (no build step) + Vercel serverless functions using
`@anthropic-ai/sdk` (`claude-sonnet-4-6`). Matches the conventions of the parent
repo's `/api` functions (owner-gated by `ACCESS_CODE`, nothing persisted server
side).

## Upgrade path (when it becomes a product)

- Swap `localStorage` for a real datastore (Postgres/Supabase/KV) keyed per user.
- Add an authenticated `/api/intake` **webhook** so your ad platform / funnel /
  Zapier posts leads in automatically (the parser already returns the right shape).
- Add per-user auth instead of a single shared `ACCESS_CODE`.
- Optional: SMS/email send integrations (Twilio / a mail provider) to send and
  log touches without leaving the app.
