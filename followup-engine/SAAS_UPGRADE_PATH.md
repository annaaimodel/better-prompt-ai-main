# Cadence - MVP Tool → Multi-Tenant SaaS Upgrade Path

> How the current single-user MVP becomes a real, sellable, multi-customer SaaS
> business. Do this only AFTER the tool is validated (used by you + one pilot
> community) - building this layer before product-market fit is wasted effort.

## Where we are now (MVP)
- Single user, owner-gated by one shared `ACCESS_CODE`.
- Data lives in the **browser** (localStorage) - per-device, not shared, not
  backed up centrally.
- Vercel serverless functions + Anthropic API. No accounts, no database, no
  billing. **This is a great tool; it is not yet a SaaS *business*.**

## Where we're going (multi-tenant SaaS)
Many customers served from one codebase, each with isolated data, self-serve
signup, and automated recurring billing - plus white-label "orgs" for
communities.

## The 7 pieces to add

### 1. Accounts & auth
- Sign up / log in, password reset, sessions. Replace the single `ACCESS_CODE`.
- **Recommendation:** Supabase Auth or Clerk (fastest); both handle email/OAuth.

### 2. Database (multi-tenant)
- Move leads, playbook, assets, touches from localStorage → a shared DB, every
  row keyed by `org_id` + `user_id` so tenants are isolated.
- **Recommendation:** Postgres via Supabase or Neon (cheap, scales, easy).
- Migration: the current JSON shapes map almost 1:1 to tables - low friction.

### 3. Org / team model (enables white-label)
- `Org` (a community/coach) → has many `Users` (members) → has its own
  **Playbook + methodology + assets + branding**.
- Roles: `owner/admin` (community owner) vs `member` (closer). This is what makes
  the white-label model work: each org loads *its own* method.

### 4. Billing (Stripe)
- Subscriptions (per-seat and/or flat platform plans), the one-time **setup fee**
  as a Stripe invoice, trials, upgrades/downgrades, failed-payment dunning.
- Stripe webhooks → provision/suspend access. **Stripe Billing** handles most of
  this off-the-shelf.

### 5. Usage metering & limits (CRITICAL - because of copilot COGS)
- The live copilot costs ~$0.50-$3/call (STT + LLM), and it **scales with usage**
  - so a flat seat price can go underwater on heavy users.
- Track per-org/per-user **live-call minutes & cue calls**; enforce **fair-use
  caps** and/or **usage-based overages** (Stripe metered billing).
- This is the difference between healthy margins and losing money on power users.

### 6. White-label layer
- Per-org branding (logo, colours, name), optional custom subdomain
  (`closers.theircommunity.com`), and "powered by"-off for premium tiers.
- Org admin loads their methodology once; every member inherits it.

### 7. The realtime copilot infra (separate track)
- Per `LIVE_COPILOT_PLAN.md`: audio capture + Deepgram + `/api/cue`. The SaaS
  layer above (auth, org, billing, metering) is what makes the copilot
  *sellable* to many orgs.

## Suggested tech stack (lean)
- **Supabase** = Postgres + Auth + Storage in one (covers #1, #2, partly #3).
- **Stripe Billing** = subscriptions + metered usage (#4, #5).
- Keep the existing **vanilla front-end + Vercel functions**; just point them at
  the DB/auth instead of localStorage.

## Rough sequencing
1. Auth + DB + migrate current data model off localStorage (turns it
   multi-user).
2. Org/team model + roles (turns it multi-tenant / white-label-ready).
3. Stripe subscriptions + the setup-fee invoice (turns it into revenue).
4. Usage metering + caps (protects margin once the copilot ships).
5. White-label branding polish.

## Honest note
This is real engineering (days-to-weeks, not hours) and ongoing maintenance
(support, security, billing edge cases, uptime). It's the right investment
*only* once the value is proven. Until then, the current MVP already delivers the
core ROI: **closing more of your own deals.**
