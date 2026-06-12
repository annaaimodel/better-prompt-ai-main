# CV → Job Match + Cover Letter — Build Spec (v1)

**Status:** Draft for approval · **Date:** 2026-06-12
**Decisions locked:** Free & public (no accounts) · In-browser matching · Claude **Sonnet 4.6** · **Nothing about a CV is ever stored**

---

## 1. What it does (user's view)

1. User lands on a new page, e.g. **`/cv`** (linked from the main site + jobs board).
2. They paste their CV, or upload a **PDF/DOCX** — parsed **in their own browser**.
3. The page scores their CV against the **public live job list** (`jobs/store.json`) — **in the browser**. No server sees the CV at this stage.
4. It shows the jobs they fit **≥ 80%**, best first, with the match reasons.
5. For any fitting job, they click **"Write my cover letter"** → a tailored letter comes back in a few seconds.
6. They copy/download it. **Done — nothing saved anywhere.**

---

## 2. Privacy by design (the whole point)

| Step | Where the CV is | Stored? |
|---|---|---|
| Upload / paste | User's browser only | ❌ never |
| Parse PDF/DOCX → text | User's browser (JS libs) | ❌ never |
| Match vs jobs | User's browser | ❌ never |
| Cover-letter generation | Sent **once**, in-memory, to a stateless function → Claude → returned | ❌ never (no DB, no disk, no logs) |

- **No accounts, no database, no file storage, no request-body logging.**
- **Anthropic Zero-Data-Retention (ZDR):** Sonnet 4.6 supports it, so even Anthropic doesn't retain the prompt. (The API never trains on it regardless.) — *Requires enabling ZDR on the API org/key.*
- **One-paragraph privacy notice** on the page: "Your CV is processed in your browser and, only when you request a cover letter, sent in memory to generate it and immediately discarded. We store nothing."

**GDPR result:** no stored personal data → no CV breach surface, no retention policy, no data-subject access/erasure handling for CVs. Lightest possible footprint.

---

## 3. Architecture (bolts onto the existing static site)

```
 Browser (static page /cv)                         Vercel serverless fn
 ┌─────────────────────────────┐                  ┌──────────────────────────┐
 │ CV upload  → pdf.js/mammoth  │                  │ POST /api/cover-letter   │
 │ parse → text (in browser)    │                  │  • holds {cv, job} in RAM │
 │ fetch /jobs/store.json       │                  │  • Claude Sonnet 4.6 (ZDR)│
 │ score & rank (in browser)    │  only on click   │  • returns letter text    │
 │ show ≥80% matches            │ ───────────────► │  • logs/stores nothing    │
 │ "Write cover letter" button  │ ◄─────────────── │                          │
 └─────────────────────────────┘   letter text     └──────────────────────────┘
```

- **Frontend:** one self-contained HTML/JS page, matching the existing site style. Libs: `pdf.js` (PDF text), `mammoth.js` (DOCX). Both run client-side.
- **Job data:** serve `jobs/store.json` (already generated daily) as the match source. Add a `/api/jobs` or static `jobs/store.json` fetch.
- **Matching (in-browser):** skills/keyword overlap + role-category match (reuse the pipeline's Closer/Setter/Success buckets) + simple TF-IDF cosine on title+description. Output a 0–100 score and the top matching terms. **No AI, $0.**
- **Backend:** a single serverless function (`/api/cover-letter`). Python or Node — Python lets us reuse the Anthropic SDK pattern from the `claude-api` skill.

---

## 4. Cost model (Sonnet 4.6 — $3 / $15 per 1M in/out)

| Item | Cost |
|---|---|
| CV parsing + matching | **$0** (in browser) |
| One cover letter (~2k in + ~600 out) | **~$0.013** |
| 1,000 cover letters / month | **~$13** |
| Vercel | Hobby **free** now; **$20/mo** Pro when commercial |
| Database / storage | **$0** (there is none) |

**The big risk in a free public model isn't unit cost — it's abuse.** An open, unauthenticated endpoint that calls a paid AI API can be hammered to run up your bill. Required guards (cheap, standard):

- **Bot check** on the cover-letter call — Cloudflare Turnstile or hCaptcha (free).
- **Per-IP rate limit** (e.g. 5–10 letters/hour) via Upstash Redis or Vercel KV (free tier).
- **Input caps** — reject CVs/jobs over N characters.
- **Hard monthly spend cap** on the Anthropic key.

---

## 5. Build phases

**Phase 1 — Matcher (no AI, no cost):**
`/cv` page · PDF/DOCX/text parse in browser · fetch job list · score & show ≥80% matches with reasons. Fully usable on its own.

**Phase 2 — Cover letters:**
`/api/cover-letter` serverless fn (Sonnet 4.6, ZDR, zero logging) · "Write cover letter" button · copy/download · privacy notice.

**Phase 3 — Abuse protection + polish:**
Turnstile + per-IP rate limit + input caps + spend cap · link from main site & `/jobs` · light styling pass.

**Rough effort:** Phase 1 ~half a day · Phase 2 ~half a day · Phase 3 ~half a day.

---

## 6. Open items before / during build

- **Anthropic API key** with **ZDR enabled** (set as a Vercel env var — never in client code).
- Match threshold (default **80%**, easy to tune).
- Cover-letter tone/length defaults (e.g. ~250–350 words, confident, UK English).
- Page route name: `/cv` vs `/match` vs `/apply`.
- Later, if you ever want a paywall, it bolts on at the `/api` layer **without** changing the no-CV-storage design.
