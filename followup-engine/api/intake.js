// Cadence - smart lead intake.
//
// Paste a messy inbound lead notification (ad lead form, funnel email, booking
// confirmation, DM, etc.) and get back a clean, structured contact.
//
// POST { access_code, text }
// Returns { contact: { name, email, phone, company, offerInterest, source, notes }, usage }
//
// Stores/logs nothing - inputs are used in memory only.
//
// Env vars (set in Vercel):
//   ACCESS_CODE        (required)  unlocks the app
//   ANTHROPIC_API_KEY  (required)  your Anthropic API key
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

const PARSE_SYSTEM =
`Extract a single sales lead from the user's pasted text, which may be a messy ad lead-form notification, funnel/booking email, DM, or note. Return ONLY a JSON object with these string keys:
"name", "email", "phone", "company", "offerInterest", "source", "notes".
Rules:
- "name": the prospect's name if present, else "".
- "email": first valid email address, else "".
- "phone": first phone number, digits/spaces/+ preserved, else "".
- "company": their business/company if stated, else "".
- "offerInterest": one short phrase for what they want help with or opted in for (e.g. "scaling agency to 50k/mo"), else "".
- "source": where the lead came from if identifiable (e.g. "Facebook lead form", "Calendly booking", "webinar"), else "".
- "notes": anything else useful the prospect said about their situation, goals, pain or timeline - a short paragraph, else "".
Do not invent details that are not in the text. Output JSON only - no prose, no markdown fences.`;

function clip(v, n) { return (v == null ? "" : String(v)).slice(0, n); }

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  const body = req.body || {};

  if (!process.env.ACCESS_CODE) { res.status(503).json({ error: "Not configured: set ACCESS_CODE in Vercel." }); return; }
  const code = req.headers["x-access-code"] || body.access_code || "";
  if (code !== process.env.ACCESS_CODE) { res.status(401).json({ error: "Invalid access code." }); return; }

  if (!process.env.ANTHROPIC_API_KEY) { res.status(503).json({ error: "Not configured: ANTHROPIC_API_KEY is not set in Vercel." }); return; }

  const text = clip(body.text, 12000);
  if (text.trim().length < 8) { res.status(400).json({ error: "Paste the lead details first." }); return; }

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: PARSE_SYSTEM,
      messages: [{ role: "user", content: text }],
    });
    const raw = (msg.content.find((b) => b.type === "text") || {}).text || "{}";
    const m = raw.match(/\{[\s\S]*\}/);
    let c = {};
    try { c = JSON.parse(m ? m[0] : raw); } catch (e) { c = {}; }
    res.status(200).json({
      contact: {
        name: clip(c.name, 120),
        email: clip(c.email, 254),
        phone: clip(c.phone, 40),
        company: clip(c.company, 160),
        offerInterest: clip(c.offerInterest, 300),
        source: clip(c.source, 120),
        notes: clip(c.notes, 2000),
      },
      usage: msg.usage,
    });
  } catch (e) {
    res.status(e?.status || 500).json({ error: e?.message || "Couldn't read that - try again." });
  }
}
