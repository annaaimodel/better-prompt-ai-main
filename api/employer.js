// Public employer-lead endpoint for the AURUM "Hiring" page (/hiring).
// Appends the brief to your Google Sheet (same Apps Script /exec URL) with
// type:"employer", so it lands in a separate "Employers" tab. No access code —
// this is a public lead form.
//
// Env var (already set in Vercel): INBOX_SYNC_URL

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const clip = (v, n) => (v == null ? "" : String(v)).slice(0, n);

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  const body = req.body || {};

  // Honeypot: bots fill this; pretend success, write nothing.
  if (body.hp) { res.status(200).json({ ok: true }); return; }

  const email = clip(body.email, 254).trim().toLowerCase();
  if (!EMAIL_RE.test(email)) { res.status(400).json({ error: "Please enter a valid work email." }); return; }

  if (!process.env.INBOX_SYNC_URL) {
    res.status(503).json({ error: "Briefs aren't connected yet. Please try again soon." });
    return;
  }

  const payload = {
    type: "employer",
    company: clip(body.company, 200),
    name: clip(body.name, 120),
    email,
    role: clip(body.role, 120),
    comp: clip(body.comp, 200),
    details: clip(body.details, 4000),
    source: clip(body.source, 40) || "hiring",
    savedAt: new Date().toISOString(),
  };

  try {
    await fetch(process.env.INBOX_SYNC_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload),
    });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: "Couldn't submit — please try again." });
  }
}
