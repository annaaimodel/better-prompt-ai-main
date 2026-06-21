# Turning GasPass into an app

GasPass is already a web app. There are two levels of "app", and step 1 is done.

## ✅ Step 1 — Installable app (PWA) — DONE, live now

The site is now a Progressive Web App:

- **Add to Home Screen** on iPhone/Android gives a real **app icon** (the flame), a
  full-screen launch with no browser bars, and an **offline** Reference library,
  Flashcards and Mock Exams. (The AI Tutor and How-Tos need a connection.)
- Files: `manifest.webmanifest`, `sw.js` (offline service worker), `pwa.js`,
  `icons/` (generated app icons), plus iOS meta tags in every page's `<head>`.

**How a user installs it (iPhone):** open `gaspass-uk.vercel.app` in **Safari** →
Share button → **Add to Home Screen**. Done — it behaves like an app, free, no store.

This costs nothing and needs no Apple account. For many users it's all you need.

## ▶ Step 2 — Apple App Store listing (when you're ready)

To be in the actual App Store you need two things there's no way around:

1. **Apple Developer Program — $99/year** (`developer.apple.com`).
2. An entry in **App Store Connect** (app name, screenshots, privacy info).

You do **not** need a Mac — we build iOS in the cloud. Recommended setup:

- **Wrapper:** [Capacitor](https://capacitorjs.com) wraps these exact web files into a
  native iOS app. The static screens are bundled for offline; the AI features call the
  live `gaspass-uk.vercel.app` API.
- **Cloud build (no Mac):** [Codemagic](https://codemagic.io) builds the iOS app on a
  hosted Mac and uploads it straight to App Store Connect using an App Store Connect API
  key. (Alternatives: Expo EAS Build, GitHub Actions macOS runners.)
- **App icon:** `icons/appstore-1024.png` (1024×1024, no transparency) is ready to use.

### What to watch (Apple review)

- **Guideline 4.2 "minimum functionality":** Apple rejects apps that are just a website
  in a shell. GasPass passes because content is bundled and works offline with native
  navigation — keep it that way (don't switch the wrapper to just load the URL).
- **Paid app / subscription:** if you ever charge, Apple requires their in-app purchase
  system (≈15–30% cut). Free needs none of this.
- **Privacy:** you'll declare data use. GasPass stores nothing server-side; the AI
  endpoints send the question to Anthropic to generate an answer — disclose that.

### When you're ready, ask and I'll scaffold:

- the Capacitor project (`capacitor.config`, bundling, absolute API URL),
- a Codemagic workflow (`codemagic.yaml`) that builds + submits with no Mac,
- a step-by-step for the Apple Developer + App Store Connect screens and screenshots.

> Tip: there are also no-code "web-to-app" services (e.g. Median.co) that do the wrap +
> build from a dashboard for a monthly fee — easiest if you'd rather not touch any
> config. You'd still need the $99 Apple Developer account.
