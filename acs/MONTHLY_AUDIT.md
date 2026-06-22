# GasPass — Monthly currency audit (playbook)

GasPass content must stay current with UK gas standards, building regulations and
the law affecting engineers. We review **monthly**. This file is the standing
instruction — point a **scheduled trigger** (Claude Code on the web) at it, or paste
the prompt below into a session, and it runs end-to-end.

## How to schedule it (hands-off, monthly)

Claude Code on the web supports **scheduled triggers** that run a prompt on a cron
schedule (these persist — unlike the in-session timer, which expires after ~7 days).

1. Open the project in **Claude Code on the web** → environment/automation settings.
2. Create a **scheduled trigger**, cadence **monthly** (e.g. 06:00 on the 1st).
3. Set the prompt to: **"Run the GasPass monthly audit per `acs/MONTHLY_AUDIT.md`."**
4. Make sure the environment has **network access** (for web research) and the repo's
   `ANTHROPIC_API_KEY` set (already configured for the app).

Docs: https://code.claude.com/docs/en/claude-code-on-the-web

> Fallback (no trigger): just message me **"run the monthly gas update"** and I'll do
> the whole thing in one go.

## The audit prompt (what the run should do)

> Run the monthly GasPass UK gas-standards & legal audit and keep the app current.
>
> 1. **Research (deep, current month):** check the current status of every standard /
>    regulation the app references — GSIUR / ACOP L56, BS 6798, BS 6891, BS 5440-1/-2,
>    BS 7593, BS 7967, BS 5871, BS 6172, BS 669-1, BS EN 50291 / 50292, BS 7671,
>    IGEM/UP/1B, IGEM/G/11, IGEM/G/13, IGEM/G/1, Boiler Plus, Approved Documents
>    L / J / G / P / F, the Future Homes Standard, GSMR and RIDDOR — **plus** any new
>    Gas Safe Technical Bulletins / Industry Standard Updates and **any law that applies
>    to gas engineers directly**. Flag anything **changed** or newly **upcoming** with
>    dates and an official source. Never invent a figure — flag uncertainty instead.
> 2. **Apply changes:** update `acs/data.js` and `acs/howto-data.js`, and **prepend**
>    any new items to `acs/updates-data.js` (newest first), bumping `lastReviewed` to
>    today's date. Add an official source link to each new item.
> 3. **Validate & deploy:** confirm the JS parses, then commit (git author
>    `noreply@anthropic.com`) and push the feature branch, and fast-forward/merge into
>    `master` and `main` (the live site `gaspass-uk.vercel.app` deploys from there).
> 4. **Report:** reply with a concise summary of exactly what changed this month, or
>    "No changes — all current" if nothing did. Only raise a question if a change needs
>    a judgement call (e.g. exam-relevant content).

## Where the content lives (single sources of truth)

- `acs/updates-data.js` — the **Recent Updates** feed (prepend new items; bump `lastReviewed`).
- `acs/data.js` — revision library, flashcards, mock-exam questions.
- `acs/howto-data.js` — How-Tos knowledge base + standards quick-reference.

## Audit log

- **2026-06-22** — Full four-stream audit completed. Brought tightness testing to
  IGEM/UP/1B Ed 4, GIUSP to IGEM/G/11 Ed 2 (July 2025), added the Future Homes
  Standard (in force 24 Mar 2027), CO-alarm law scope (ADJ 2022), BS 7593:2019+A1:2024,
  BS EN 50292:2023, IGEM/G/13, IGEM/G/1 Ed 3, BS 7671 A3:2024/A4, GSMR 2023, Scotland
  New Build Heat Standard, Clean Heat Market Mechanism. Built the Recent Updates page.
