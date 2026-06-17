# Cadence - Product Roadmap (MVP → AI-native Sales CRM)

> From a single-user closing tool to a lean, AI-native, method-driven CRM for
> high-ticket sales teams - without the bloat of HubSpot/Salesforce.

## North star & positioning
We don't out-feature HubSpot; we beat it on being **lean, AI-native, and
method-driven** for **high-ticket closing teams**. The 20% of CRM that matters
(pipeline + follow-up cadences + AI drafting + auto-notes + booking), running the
team's *own* sales methodology, with the copilot HubSpot will never have.

---

## THE core principle: no back-and-forth

**If a rep already works in a CRM/dialer/inbox, forcing them to switch tools is
the #1 adoption killer.** Every decision below serves one rule: *meet the rep
where they already are.* That gives us **two surfaces on one engine:**

1. **Standalone CRM** - the team works entirely in Cadence (best for new / small
   teams with no entrenched CRM). One tool, so there's nothing to switch between.
2. **Overlay (browser extension / side-panel)** - Cadence's intelligence
   (cadence, AI drafts, assets, mask, copilot, auto-notes) appears *inside* their
   existing CRM, dialer, Gmail/Outlook, and Zoom. They never leave their tool;
   Cadence reads/writes to where they already are.

Same backend + same engine power both. **The overlay is what makes selling into
teams-with-a-CRM possible** - it removes the back-and-forth entirely.

### Anti-back-and-forth design rules
- Never make a rep enter the same data twice (two-way sync or capture-in-place).
- Bring the AI to the rep's current screen, not the rep to ours.
- One-click migration in (HubSpot/GHL CSV import) and full export out (no lock-in).
- The copilot/notes write *back* to wherever the team's source of truth lives.

---

## Phases (each builds on the last)

### Phase 0 - MVP (now) ✅
Single-user, browser-storage. Pipeline (Lead→Set→Call→Follow-up→Close→CSM),
value-rotating cadences, AI drafting from the Playbook + assets, Mask Read,
roles/assignment. **Goal: validate the engine on real deals (yours first).**

### Phase 1 - Multi-tenant backend (the gate)
Accounts/auth, multi-tenant database, orgs/teams, roles, Stripe billing + usage
metering. *(Detailed in `SAAS_UPGRADE_PATH.md`.)* Nothing below works without this
- integrations need per-user OAuth and shared data.

### Phase 2 - Integrations (kill the back-and-forth, in priority order)
1. **Calendly** - booking auto-creates/updates the lead, flips it to "Call set,"
   handles reschedules/no-shows. Pipeline moves itself.
2. **Email (Gmail / Microsoft 365)** - OAuth; AI drafts *and sends* in-thread,
   logs replies, tracks opens. No copy-paste.
3. **Auto-notes from calls** - transcribe → AI summary auto-appended to the lead,
   with extracted next-steps / objections / mask. (Post-call first; easier than
   live.)
4. **Zoom** - auto meeting links + pull recordings/transcripts (feeds notes +
   copilot).
5. **Phone** - click-to-call, auto-log, pull recordings (Aircall/JustCall/Close/
   Twilio - provider-dependent).
6. **Two-way CRM sync** (HubSpot / GoHighLevel) - for the overlay mode, so reps in
   their CRM never double-enter.

### Phase 3 - The overlay surface (browser extension)
A side-panel that rides on top of the team's CRM/dialer/Gmail/Zoom: shows the due
cadence, one-click AI drafts, assets, mask, and (later) live copilot - writing
back to their system of record. **This is the no-back-and-forth payoff** and the
key to selling into teams that won't leave their CRM. (Shares capture tech with
the copilot - see `LIVE_COPILOT_PLAN.md`.)

### Phase 4 - Team layer (makes it a *team* CRM, not a personal tool)
Manager dashboards & reporting (pipeline value, conversion by stage/rep,
cadence adherence, win rate), permissions, shared playbooks/assets per org,
seat management. Plus HubSpot/CSV import for fast migration.

### Phase 5 - Live copilot
Real-time in-call cues running the team's method (`LIVE_COPILOT_PLAN.md`). The
differentiator - built last, on top of a working, adopted CRM.

---

## Go-to-market modes (same product, three sales motions)
- **Standalone CRM** → new / small high-ticket teams with no entrenched CRM.
- **Overlay** → established teams already on HubSpot/GHL who won't switch.
- **White-label** → communities/coaches bundle it for members
  (`BUSINESS_CASE.md`).

## Dependencies & honest effort
- Phase 1 (backend) gates everything → weeks of focused build + ongoing upkeep.
- Each Phase-2 integration = OAuth + API + webhooks (days-weeks each).
- Phase 3 overlay = a real browser-extension build + sync logic.
- This is now a **software product** (months, with maintenance), not a weekend
  tool - but the clean Phase-0 data model is a genuine foundation, not a rewrite.

## Sequencing recommendation
1. **Validate Phase 0 on real deals first** (yours, then maybe your own team).
   Don't build heavy infra before the engine has closed deals.
2. Then **Phase 1 backend** → **Calendly + email + auto-notes** (the integrations
   that remove the most back-and-forth) → **overlay** → team layer → copilot.
3. Pick the first GTM mode by your first real customer: a new team (standalone)
   or an entrenched team (overlay).

> The biggest risk isn't capability - it's adoption friction. Build every phase
> around "the rep never has to leave where they work," and the back-and-forth
> downfall never happens.
