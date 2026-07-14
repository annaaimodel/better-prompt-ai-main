# Live Headset Transcription

A one-page tool that turns speech from your headset into a **live, on-screen
transcript** — in real time, entirely in your browser. Nothing is recorded,
nothing is uploaded, and there's no account or API key.

The page is `transcribe.html`. Once the site is deployed it lives at
**`/transcribe`** (e.g. `https://your-site.vercel.app/transcribe`).

---

## What it does

- Listens to your microphone (your headset) and prints words as you speak.
- Shows an **interim** guess in grey, then commits each finished sentence.
- Live word count and elapsed timer.
- Optional **timestamps** on each line.
- **Copy**, **Download .txt**, and **Clear** buttons.
- Auto-restarts when the browser pauses on silence, so it keeps going for hours.

It uses the browser's built-in speech engine (the **Web Speech API**). That's
why there's no server and no cost — the recognition happens on your device /
through the browser vendor's engine, and the audio never touches this site.

---

## Use it (30 seconds, nothing to install)

1. Open **`/transcribe`** in **Google Chrome** or **Microsoft Edge** on a
   computer (Safari and Firefox don't support live transcription yet; Chrome on
   Android also works).
2. Plug in / connect your **headset**.
3. Pick your headset in the **Microphone** dropdown, and set the **language**.
4. Click **Start listening**. The first time, Chrome asks to use your
   microphone — click **Allow**.
5. Talk. Your words appear live. Hit **Stop** when done, then **Copy** or
   **Download .txt**.

> If the microphone list is empty or shows generic names, press **Start** once
> and allow access — the real device names appear after that.

---

## Capturing both sides of a call

The browser transcribes whatever your system **input** device hears. To catch
the other person too:

- Put the call on **speaker** and let your headset mic pick up the room, **or**
- Use a **loopback / "stereo mix"** input (Windows) or a virtual audio device
  like **BlackHole** (Mac) as the browser's input so it hears the call audio
  directly.

---

## For a brand-new Claude user: exactly how this was (and can be) created

You do **not** need to be a programmer. Here's the whole path from zero.

### Option A — just use it (no coding)
1. Get this project deployed (see Option B) or ask whoever owns the site for the
   `/transcribe` link.
2. Open it in Chrome, allow the mic, press **Start**. Done.

### Option B — build & publish it yourself with Claude Code
1. **Sign in** to Claude Code on the web at **claude.ai/code** (or install the
   Claude Code CLI / VS Code extension).
2. **Connect a GitHub repo** — either this one, or a brand-new empty repo.
   Claude works on a branch and pushes changes for you.
3. **Ask Claude**, in plain English:
   > "Create a single web page that listens to my headset and shows a live
   > transcript. Use the browser's Web Speech API so there's no server or API
   > key. Style it cleanly and add copy/download buttons."
4. Claude writes the file (`transcribe.html`), commits it, and pushes it to the
   branch. **Review** the change and merge it.
5. **Deploy for free** so it has a URL:
   - Go to **vercel.com**, sign in with GitHub, click **Add New → Project**,
     pick the repo, and hit **Deploy**. No settings needed — it's a static site.
   - Vercel gives you a link like `your-site.vercel.app`. Your tool is at
     `your-site.vercel.app/transcribe`.
6. Open that link in Chrome, allow the microphone, and start talking.

That's the entire process: **sign in → connect a repo → ask Claude to build it →
merge → deploy on Vercel → open in Chrome.** No installs on your machine, no
keys, no cost.

---

## Privacy

- No audio is stored or sent to this site — there is no backend for it.
- Recognition runs through the browser's own speech engine.
- The transcript lives only in the page until you copy, download, or clear it;
  reloading the page wipes it.

## Limits / good to know

- Needs an **internet connection** (Chrome streams audio to Google's speech
  engine to recognise it — that's the browser's engine, not this site).
- Accuracy depends on mic quality, accent, and background noise.
- Best on desktop Chrome/Edge. Not supported in Safari/Firefox yet.
