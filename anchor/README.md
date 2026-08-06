# Anchor

A private, single-file workbook for working on **appearance-contingent self-worth** — the habit
of needing someone else to say you're okay before you can believe it.

It is one `index.html` with no dependencies, no build step, no network calls and no account.
Everything you write is stored in that browser's `localStorage` under the key `anchor.v1`.
Open the file directly (`file://`) or deploy the folder as its own Vercel project — both work
identically, because nothing ever leaves the device.

## The six screens

| Screen | What it's for |
| --- | --- |
| **Right now** | The in-the-moment tool. A five-step pass over a live urge: what set it off → the exact words you want to hear → *how long would they hold?* → the need underneath the compliment → what you'll do instead. Includes a 90-second urge-surfing timer with a paced-breathing cue, and a three-line self-kindness script. Ends by re-rating the intensity so you see the wave drop. |
| **Reframe** | A thought record aimed at the **rule** under the thought, not the mood on top of it — "if I'm this size, I'm not allowed to ___" — then tested against someone you love who breaks that rule and is obviously still worth loving. |
| **Experiments** | Behavioural experiments. Predict the outcome and rate expected distress *before* skipping one piece of reassurance-seeking, then record what actually happened and how bad it really was. The running average of predicted vs. actual distress is the point: the correction comes from your own data, not from being talked out of it. |
| **Worth** | A worth portfolio. Sliders for how much your sense of being okay currently rests on each domain, with appearance's share of the total surfaced as a percentage and tracked over time. Plus an evidence log for the non-appearance columns, and a daily "one thing my body *did* for me" prompt (function, not looks). |
| **Patterns** | Counts, average intensity drop, top triggers, busiest hour, the needs that keep recurring underneath, prediction-vs-reality gap, and a sparkline of appearance's share of self-worth. |
| **Data** | Export/import a JSON backup, or erase everything. |

## Why these mechanisms

- **Contingent self-worth** concentrated in one domain is fragile by construction; the Worth screen
  is about diversifying the base rather than caring less about your body.
- **Reassurance-seeking** is a safety behaviour — it relieves distress in the short term and so
  prevents the fear from ever being disconfirmed. The Experiments screen exists to reintroduce
  the disconfirmation, via explicit prediction error.
- **Urge surfing** treats the urge as a wave with a peak and a fall rather than a command; 90 seconds
  is usually past the crest.
- **Self-compassion** (mindfulness → common humanity → self-kindness) is the script's three beats.
- **Body functionality** writing — what the body *does* rather than how it appears — is the daily prompt.

## Backups

Local storage is per-browser and gets wiped by "clear browsing data". Use **Data → Export backup**
periodically; the file re-imports on any device.

## Not treatment

This is a self-help workbook. It isn't therapy, and it isn't built for disordered eating or for
thoughts of self-harm — a GP or a therapist is the right tool for those.
