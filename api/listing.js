// Public job-listing endpoint for the AURUM "Post a Role" page (/hiring).
// Appends the submitted role to your Google Sheet (same Apps Script /exec URL)
// with type:"listing", so it lands in a separate "Listings" tab. No access code
// — this is a public submission form. Paid tiers (Featured/Urgent) are activated
// manually after payment; Standard roles can be moved into the board inbox.
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
  if (!EMAIL_RE.test(email)) { res.status(400).json({ error: "Please enter a valid email." }); return; }
  const title = clip(body.title, 300);
  if (!title) { res.status(400).json({ error: "Please add a role title." }); return; }

  if (!process.env.INBOX_SYNC_URL) {
    res.status(503).json({ error: "Listings aren't connected yet. Please try again soon." });
    return;
  }

  const payload = {
    type: "listing",
    company: clip(body.company, 200),
    name: clip(body.name, 120),
    email,
    title,
    role: clip(body.role, 120),
    comp: clip(body.comp, 200),
    location: clip(body.location, 200) || "Remote",
    link: clip(body.link, 600),
    tier: clip(body.tier, 60) || "Standard (Free)",
    details: clip(body.details, 4000),
    source: clip(body.source, 40) || "hiring",
    savedAt: new Date().toISOString(),
  };

  try {
    const upstream = await fetch(process.env.INBOX_SYNC_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload),
    });
    // Surface a failed save instead of reporting a false success: if the Apps
    // Script returns a non-2xx, the row almost certainly didn't land.
    if (!upstream.ok) {
      console.error("listing sync failed:", upstream.status, await upstream.text().catch(() => ""));
      res.status(502).json({ error: "Couldn't submit — please try again." });
      return;
    }
    // Best-effort email alert via a separate standalone Apps Script (see
    // docs/listing-notify.gs). Never let a notification failure break the
    // submission — the row is already saved at this point.
    if (process.env.LISTING_NOTIFY_URL) {
      try {
        await fetch(process.env.LISTING_NOTIFY_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify(payload),
        });
      } catch (e) {
        console.error("listing notify error:", e);
      }
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("listing sync error:", e);
    res.status(502).json({ error: "Couldn't submit — please try again." });
  }
}
