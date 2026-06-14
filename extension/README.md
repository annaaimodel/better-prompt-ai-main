# High-Ticket Job Saver — Chrome extension

A one-click **"Save this job"** button for your browser. On any job page it grabs
the title, company, location, comp and link, and saves it — locally always, and
(optionally) straight to your jobs board.

The puzzle-piece icon in Chrome's toolbar is the **Extensions** menu; this lives
there.

---

## 1. Install it (free, ~30 seconds)

1. Open **`chrome://extensions`** in Chrome (or Edge).
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select this **`extension`** folder.
4. Pin it: click the puzzle piece 🧩 in the toolbar → pin **High-Ticket Job Saver**.

That's it — open any job page, click the icon, tweak the fields if needed, and
hit **Save to board**. Saved jobs are listed in the popup; **Export CSV** downloads
them in the exact format of `jobs/inbox.csv`.

> Works on Chrome and Edge as-is. Firefox needs a tiny manifest tweak — ask if
> you want it.

---

## 2. Make saved jobs appear on the site automatically (optional)

Without this, "Save" stores jobs on your device and you add them to the board by
exporting the CSV into `jobs/inbox.csv`. To have them flow in automatically, wire
up a Google Sheet (this matches the board's existing `INBOX_CSV_URL` design):

1. Create a **Google Sheet**. In **row 1**, add these headers exactly:
   `title  company  comp  location  link  source  notes`
2. In the sheet: **Extensions → Apps Script**, paste **`apps-script.gs`** (in this
   folder), then **Deploy → New deployment → Web app** (Execute as **Me**, access
   **Anyone**). Copy the **/exec** URL.
3. In the extension popup → **⚙ Options** → paste that URL → **Save**.
4. Publish the sheet as CSV: **File → Share → Publish to web → CSV → Publish**,
   copy the URL.
5. In GitHub: repo **Settings → Secrets and variables → Actions → Variables → New
   variable** named **`INBOX_CSV_URL`**, value = the published CSV URL.

Now: click the extension on any job → **Save** → the row lands in your Sheet →
the next pipeline run (7am UK, or a manual run) shows it on the board, deduped
and categorised like everything else.

---

## Privacy & notes

- Saved jobs live in your browser (`chrome.storage.local`) until you remove them.
- The optional sync only sends the job fields you see to **your own** Google Sheet.
- No tracking, no analytics, no third-party servers.
- Field detection uses the page's structured data (schema.org `JobPosting`) when
  present, falling back to the page title — so you can always edit before saving.
