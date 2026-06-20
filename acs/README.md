# GasPass — ACS Revision for UK Heating Engineers

A standalone revision app for UK domestic gas engineers preparing for (or renewing)
their ACS assessments. Quick to digest, easy to search, with an AI tutor for any question.

**Scope:** CCN1 (Core Domestic Gas Safety) + the main domestic modules —
CENWAT (boilers & water heaters), CKR1 (cookers), HTR1 (fires & space heaters)
and MET1 (metering). Designed to be extended later (commercial, LPG, etc.).

## Features

- **📖 Reference library** — bite-size, searchable notes per topic, each citing the
  relevant standard (GSIUR, BS 6891, BS 5440-1/-2, IGEM/UP/1B, Boiler Plus…).
- **🃏 Flashcards** — rapid recall on the facts and figures examiners ask, filter by
  category, shuffle, keyboard-driven (←/→ to move, space to flip).
- **📝 Mock exams** — multiple-choice practice per category, marked instantly with an
  explanation for every answer, a score and a review screen.
- **💬 AI gas tutor** — ask anything in plain English. Answers are *grounded* in the
  app's own vetted notes (sent from the browser) so the model stays anchored to
  reviewed content.

## Important — this is a revision aid

GasPass is a study tool drafted from UK gas regulations and British/IGEM standards.
**It is not a substitute for accredited ACS training, assessment, the official
documents, or manufacturer instructions.** Standards change — always verify
safety-critical figures (clearances, allowable tightness-test drops, gas rates,
ventilation free areas) against the *current* editions before relying on them.
Only carry out gas work you are registered (Gas Safe) and competent to do.

## Tech & layout

Static front-end + a single Vercel serverless function. No build step.

```
acs/
  index.html        Home / hub
  reference.html    Searchable reference library
  flashcards.html   Flashcards
  quiz.html         Mock exams
  tutor.html        AI gas tutor (chat)
  data.js           Single source of truth: topics, flashcards, quiz questions
  style.css         Shared mobile-first styles
  api/ask.js        AI tutor endpoint (@anthropic-ai/sdk, model claude-sonnet-4-6)
  vercel.json       Clean-URL rewrites
```

All content lives in **`data.js`** — add or edit topics/flashcards/quiz questions there
and every surface (library, cards, exams, and the tutor's grounding) updates together.

## Running / deploying

It's built to deploy on **Vercel** exactly like the rest of this repo.

- Set the env var **`ANTHROPIC_API_KEY`** in the Vercel project (required for the tutor).
- Deploy with the `acs/` directory as the project root (it has its own `package.json`
  and `vercel.json`), or wire a route to it.
- The library, flashcards and exams work fully offline/static; only the AI tutor needs
  the API key.

## Roadmap ideas

- Spaced-repetition scheduling for flashcards (track what you keep getting wrong).
- Timed full mock papers and a pass/fail threshold per category.
- Expand scope to commercial (COCN1) and LPG.
- Save progress (local storage or a login).
