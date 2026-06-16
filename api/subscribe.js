// Public email-signup endpoint for the AURUM landing page.
// Appends the email to your Google Sheet (via the same Apps Script /exec URL
// already used for saved jobs) with type:"subscribe", so it lands in a
// separate "Subscribers" tab. No access code — this is meant to be public.
//
// Env var (already set in Vercel):
//   INBOX_SYNC_URL  your Google Sheet Apps Script /exec URL
//
// Basic anti-abuse: honeypot field + email validation + length caps.

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  const body = req.body || {};

  // Honeypot: real users never fill this. Pretend success, write nothing.
  if (body.hp) { res.status(200).json({ ok: true }); return; }

  const email = String(body.email || "").trim().slice(0, 254).toLowerCase();
  if (!EMAIL_RE.test(email)) { res.status(400).json({ error: "Please enter a valid email." }); return; }

  if (!process.env.INBOX_SYNC_URL) {
    res.status(503).json({ error: "Signups aren't connected yet. Please try again soon." });
    return;
  }

  const source = String(body.source || "home").slice(0, 40);
  const payload = {
    type: "subscribe",
    email,
    source,
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
    res.status(502).json({ error: "Couldn't reach the list — please try again." });
  }
}
