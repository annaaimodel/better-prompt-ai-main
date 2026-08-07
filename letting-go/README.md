# The Pathway of Surrender

A guided inquiry and surrender practice, after Dr David R. Hawkins' *Letting Go: The Pathway of Surrender* and the Map of Consciousness — with a private, searchable record of what you felt, what caused it, and what you let go of.

## The process

Each session runs seven phases:

| Phase | What happens |
|---|---|
| **The difficulty** | You write what's going on. The guide reflects it back and moves off the story. |
| **The feeling** | Out of the thoughts and into the feeling, located physically in the body. |
| **I can't → I won't** | The pivot. "I can't let this go" said again as "I won't" — which hands the choice back and exposes what's behind it. |
| **Underneath** | Below the presenting emotion to the fear or the pride. Anger is usually fear in armour; pride is the fear of being nothing. |
| **The payoff** | What holding on actually gives you — being right, being wronged, the safety of not risking — and the belief keeping it in place. |
| **Letting go** | Allowing the feeling fully, without resisting, expressing, judging or changing it, until it runs out. Then: could you let it go, would you, and when. |
| **Closing** | Calibrate again and record what moved. |

You calibrate on the full Map of Consciousness before and after — Shame 20 through Enlightenment 700, with Courage 200 marked as the threshold between force and power.

## What gets recorded

Every session stores the situation, the trigger, the emotions named, the "I won't", the fear underneath, the payoff, the programme, what you surrendered, the level and intensity before and after, and the full conversation.

**Insights** turns that into: level over time, triggers ranked by how often they recur and how much each tends to shift, recurring feelings, repeated payoffs and programmes, and a running surrender log.

## Privacy

Everything is stored in your browser's `localStorage`, on your device. There is no account, no database and no server-side logging. **Export backup** writes a JSON file you own; **Import** merges one back in (by session ID, so re-importing is safe).

The one thing that leaves the device: while the AI guide is conducting a session, the text of that session is sent to the Anthropic API to be answered. The endpoint (`api/surrender.js`) is stateless and stores nothing. If you'd rather nothing left the device at all, deploy without `ANTHROPIC_API_KEY` and the app runs its built-in scripted flow instead — same seven phases, fixed wording, works with no network.

## Running it

Own Vercel project, root directory `letting-go/` (same shape as `slight-edge/` and `acs/`).

```
ANTHROPIC_API_KEY=sk-ant-…   # optional — without it the app uses the scripted flow
```

Locally: any static server for `index.html` (the `/api/surrender` call simply fails and the scripted flow takes over), or `vercel dev` to exercise the endpoint.

The endpoint uses `claude-opus-5` with structured outputs, so each turn returns both the next thing to say and the fields to file into your record. If a call fails at any point mid-session, the front-end falls back to the scripted flow rather than dead-ending you.

## A note on the method

This is a practice tool for personal use, not therapy, diagnosis or crisis support. If something bigger is going on, please talk to a person — a crisis line or someone you trust.
