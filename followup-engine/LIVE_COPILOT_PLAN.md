# Live Sales Copilot - Spec & Build Plan

> A hands-free, real-time assistant that listens to a live web call and surfaces
> your next move - driven entirely by your uploaded **Sales Dojo methodology**,
> **Playbook** (offer + voice) and **asset library**. No typing during the call.

Status: **planned** (Phase 2 - build after the core CRM is deployed & validated).

---

## 1. Core principle: capture audio, not the app

Companies use different systems (HubSpot / GoHighLevel dialers, web dialers, Zoom
app or Zoom-in-browser). This is **not** a blocker, because the prospect's voice
plays through the rep's computer regardless of the app. We capture at the **audio
layer**, so every source looks identical to us.

| Where the call runs | Capture method | Setup |
|---|---|---|
| Browser tab (HubSpot/HighLevel dialer, web dialers, Zoom-in-browser) | Chrome extension captures **tab audio** | None |
| Desktop app (Zoom app, desktop softphone) | **System audio** capture | One-time free virtual audio device (BlackHole on macOS / VB-CABLE on Windows) |

**Decision (confirmed): the rep uses the Zoom desktop app.** So v1 standardizes
on the **system-audio path**, because a virtual audio device captures *all*
computer audio uniformly - Zoom app, every dialer, and the browser - with one
method. Bonus: this likely removes the need for a Chrome extension entirely -
once a virtual audio device exists, a plain in-app **"Live" page** can read both
the rep's mic and the call audio via `getUserMedia` (two streams → two channels).

**One-time setup (not per-call):** install the free virtual audio device, then
create a "Multi-Output Device" so the rep still hears the call while we capture
it. ~5 minutes, once. After that every call - any app - just works.

## 2. Hands-free guarantee

The rep does **not** type during the call. Flow:
1. Before the call: click **Start** once, approve the tab-audio + mic prompt.
2. During the call: nothing required - cues appear automatically; the rep just
   talks and glances.
3. After hang-up: transcript auto-saves to the lead, Mask Read runs, call logged.

All in-call interaction (expand a cue, pin a testimonial) is **optional**.

## 3. Architecture

```
Chrome extension                Browser                 Vercel (serverless)
─────────────────               ───────                 ───────────────────
tab audio  ─┐
            ├─► 2-channel ─► Deepgram (live STT, ─► rolling transcript ─┐
mic audio  ─┘   stream        speaker-separated)                        │
                                                                        ▼
                                            every ~3-5s / on prospect pause:
                                            POST transcript + context ─► /api/cue
                                                                        │
                                            Claude (Sonnet) + Playbook  │
                                            + methodology + assets ─────┘
                                                     │
                                                     ▼
                                            1-3 glanceable cues ─► floating panel

on hang-up ─► save transcript to lead ─► /api/analyze (Mask Read) ─► log touch
```

- **Two channels** (mic = rep, tab = prospect) so we always know who said what -
  cues respond to the **prospect**. Deepgram multichannel handles this cleanly.
- **No always-on server / no WebSocket backend of our own.** Deepgram holds the
  audio stream browser-side; cues come from periodic POSTs to a normal Vercel
  function. Keeps us on the existing stack.

## 4. What the cues are (methodology → live prompts)

Every cue is generated from the loaded **Sales Dojo method** + Playbook + assets:

| Trigger on the call | Cue surfaced |
|---|---|
| Rep talking too much (talk-ratio) | "Ask, don't tell" + the next **question** (gospel vs garbage) |
| Prospect's language read | Their **mask** + the **sincere affirmation** to say now |
| Hesitation / objection detected | The **belief-diagnosis question** to trace it (never a rebuttal) |
| Prospect shares a goal | Cue to let them **feel the wish fulfilled** |
| Belief invalidated | Prompt to let them **plant the serving belief** |
| Proof would land | The exact **testimonial** to drop (from the asset library, no-repeat aware) |
| About to pitch hard / argue | A gentle **"don't"** flag (the method's hard rules) |

## 5. New pieces required

- **Chrome extension** (capture surface): tab audio + mic, Start/Stop, sends
  audio to Deepgram, renders the cue panel overlay.
- **Deepgram account** (live STT). ~$0.005/min; a 60-min call ≈ $0.26 + Claude.
- **`/api/cue`** (Vercel): rolling transcript + Playbook/method/assets → Claude →
  cues JSON. Low-latency, owner-gated like the other endpoints.
- **`/api/deepgram-token`** (Vercel): mints a short-lived Deepgram key so the
  browser can stream directly (no audio through our server).
- Reuse: `/api/analyze` (Mask Read) for the post-call read; the existing Playbook
  + asset library as the brain.

## 6. Build milestones (test as we go)

- **M1 - Capture proof:** extension captures tab+mic, shows a live raw transcript.
  *Test: a real Zoom/dialer call - confirm both sides transcribe cleanly.*
- **M2 - Cues:** transcript → `/api/cue` → cue panel, in your method.
  *Test: play a recorded sales call (e.g. YouTube) and watch cues fire.*
- **M3 - Live polish:** latency tuning, talk-ratio meter, auto-testimonial cues,
  post-call Mask Read + lead logging.
  *Test: a real, low-stakes call.*

## 7. Flags / decisions

- **Consent:** recording/transcribing calls is regulated in some regions
  (two-party consent). Add a simple per-call consent toggle/notice.
- **Privacy:** transcripts stay on the rep's own infra; audio streams
  browser→Deepgram, nothing stored by us beyond the saved transcript on the lead.
- **Resolved:** Zoom = desktop app → system-audio capture is the v1 primary path
  (universal across Zoom + dialers). Confirm rep's OS (macOS → BlackHole;
  Windows → VB-CABLE) for the exact one-time setup steps.

## 8. Dependencies

1. Core CRM deployed and validated (drafting quality + voice/method dialed in) -
   the same Playbook powers the copilot, so tuning it first pays off twice.
2. Deepgram API key.
3. Decision on capture surface: standalone Chrome extension (recommended for clean
   tab capture) vs in-app "Live" page using `getDisplayMedia`.
