// Cadence - scenario coach.
//
// Describe a sales situation and get a method-true game plan, built ONLY from the
// user's loaded Playbook, methodology, assets and (optionally) a lead's context
// and mask.
//
// POST { access_code, scenario, contact, mask, playbook, assets }
// Returns { text, usage }
//
// Stores/logs nothing.
//
// Env vars: ACCESS_CODE (required), ANTHROPIC_API_KEY (required)
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

const SYSTEM =
`You are an elite high-ticket sales COACH. A closer describes a real situation; you give a clear, practical game plan for how to handle it, using ONLY the user's loaded methodology and Playbook below. Coach them, do not do it for them.

Output these labelled sections, concise and specific to THIS scenario (no preamble, no fluff):
THE READ: what is most likely really going on beneath the surface (the real concern or limiting belief), in 1-3 lines.
THEIR LIKELY NEED: the dominant mask/need to affirm if it can be inferred (significance, acceptance, approval, intelligence, understanding, power); say "unclear" if there isn't enough to tell.
APPROACH: the stance to take, per the method (lead and connect, bring clarity, never pressure).
QUESTIONS TO ASK: 3-5 exact questions to ask them, phrased word-for-word (gospel vs garbage: surface their truth and let them reach their own conclusion).
BELIEF TO DISSOLVE: the limiting belief in play, plus the question(s) to trace or test it (never argue).
WHAT TO SAY / DELIVER: the value, reframe or proof to give. Use ONLY the Playbook and assets provided; if a specific testimonial fits, name it.
NEXT STEP: the concrete move to advance it. If a booking/next-step instruction is provided, follow it and keep any [BRACKETED] placeholders verbatim.
AVOID: the method don'ts for this situation.

Rules:
- Be specific to the offer and the scenario, not generic.
- Never invent facts, client results, names, dates, times, or links.
- Be honest: if the right move is to walk away or it is genuinely not a fit, say so.
- Default to UK English unless the tone says otherwise. Never use em dashes or en dashes; use a hyphen.`;

function clip(v, n) { return (v == null ? "" : String(v)).slice(0, n); }

function buildContext(body) {
  const c = body.contact || {}, p = body.playbook || {}, o = p.offer || {}, m = p.methodology || {}, t = p.tone || {}, mask = body.mask || {};
  const out = [];
  out.push("OFFER: " + (clip(o.name, 120) || "(unset)") + ". " + clip(o.summary, 700));
  if (o.whoFor) out.push("IDEAL CLIENT: " + clip(o.whoFor, 400));
  if (o.transformation) out.push("PROMISE: " + clip(o.transformation, 400));
  if (o.price) out.push("PRICE: " + clip(o.price, 300));
  if (o.guarantee) out.push("GUARANTEE: " + clip(o.guarantee, 300));
  if (o.objections) out.push("KNOWN OBJECTIONS + BEST RESPONSES: " + clip(o.objections, 1200));
  if (o.booking) out.push("BOOKING / NEXT STEP (follow exactly, keep [BRACKETS]): " + clip(o.booking, 400));
  if (m.principles) out.push("\nMETHOD (follow this): " + clip(m.principles, 2000));
  if (m.never) out.push("METHOD DON'TS: " + clip(m.never, 500));
  if (t.formality || t.slang) out.push("VOICE: " + clip([t.formality, t.energy, t.slang].filter(Boolean).join(", "), 300));

  const assets = Array.isArray(body.assets) ? body.assets.filter(Boolean).slice(0, 14) : [];
  if (assets.length) {
    out.push("\nPROOF YOU MAY REFERENCE (use only these, verbatim): " +
      assets.map((a) => `${clip(a.title, 120)}${a.result ? " (" + clip(a.result, 120) + ")" : ""}${(a.bestFor && a.bestFor.length) ? " [for: " + a.bestFor.slice(0, 4).join(",") + "]" : ""}`).join(" | "));
  }
  if (c && (c.name || c.offerInterest || c.notes)) {
    out.push("\nTHE LEAD: " + (clip(c.name, 80) || "(unknown)") + (c.offerInterest ? ", wants: " + clip(c.offerInterest, 200) : "") + (c.notes ? ". Notes: " + clip(c.notes, 800) : ""));
  }
  if (mask.mask) out.push("THEIR MASK (from a call read): " + clip(mask.mask, 30) + (mask.affirmation ? ". Affirm like: " + clip(mask.affirmation, 250) : ""));
  return out.join("\n");
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  const body = req.body || {};
  if (!process.env.ACCESS_CODE) { res.status(503).json({ error: "Not configured: set ACCESS_CODE in Vercel." }); return; }
  const code = req.headers["x-access-code"] || body.access_code || "";
  if (!String(process.env.ACCESS_CODE || "").split(",").map((s) => s.trim()).filter(Boolean).includes(code)) { res.status(401).json({ error: "Invalid access code." }); return; }
  if (!process.env.ANTHROPIC_API_KEY) { res.status(503).json({ error: "Not configured: ANTHROPIC_API_KEY is not set in Vercel." }); return; }

  const scenario = clip(body.scenario, 6000);
  if (scenario.trim().length < 15) { res.status(400).json({ error: "Describe the situation in a bit more detail first." }); return; }

  const userText = `${buildContext(body)}\n\nTHE SITUATION TO HANDLE:\n${scenario}\n\nGive the game plan.`;

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1400,
      system: SYSTEM,
      messages: [{ role: "user", content: userText }],
    });
    const text = (msg.content.find((b) => b.type === "text") || {}).text || "";
    res.status(200).json({ text, usage: msg.usage });
  } catch (e) {
    res.status(e?.status || 500).json({ error: e?.message || "Coaching failed - try again." });
  }
}
