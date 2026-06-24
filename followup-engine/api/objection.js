// Cadence - quick objection handler.
//
// The prospect just raised an objection; return 2-3 short, speakable lines to
// handle it the method's way (acknowledge, diagnose the belief with a question,
// reframe / drop proof). Built from the Playbook, method, assets and the lead's
// mask. Tuned for speed (Haiku) for live use.
//
// POST { access_code, objection, contact, mask, playbook, assets, transcript }
// Returns { lines: ["...", ...], usage }
//
// Stores/logs nothing.
//
// Env vars: ACCESS_CODE (required), ANTHROPIC_API_KEY (required)
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

const SYSTEM =
`You are a live high-ticket sales copilot. The prospect just raised an objection. Give the rep 2-3 VERY SHORT, speakable lines to handle it the method's way, in this order where it fits:
1) a sincere one-line acknowledgement (make them feel understood, never dismissive),
2) a belief-diagnosis QUESTION that traces or tests the real concern (surface what is really blocking them, let them conclude - never argue or pressure),
3) a reframe or a specific proof to drop (ONLY from the Playbook/assets provided).

Hard rules:
- Each line is short enough to say out loud on a call (max ~20 words). No preamble, no labels, no explanation.
- Honest and method-true: question the belief, do not battle it. No pressure, no false scarcity.
- Never invent client results, names, numbers, dates, or links. Use only what is provided.
- Never use em dashes or en dashes; use a simple hyphen.

Return ONLY JSON: {"lines":["...","..."]}. No markdown, no prose.`;

function clip(v, n) { return (v == null ? "" : String(v)).slice(0, n); }

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  const body = req.body || {};
  if (!process.env.ACCESS_CODE) { res.status(503).json({ error: "Not configured: set ACCESS_CODE in Vercel." }); return; }
  const code = req.headers["x-access-code"] || body.access_code || "";
  if (code !== process.env.ACCESS_CODE) { res.status(401).json({ error: "Invalid access code." }); return; }
  if (!process.env.ANTHROPIC_API_KEY) { res.status(503).json({ error: "Not configured: ANTHROPIC_API_KEY is not set in Vercel." }); return; }

  const objection = clip(body.objection, 400);
  if (objection.trim().length < 2) { res.status(400).json({ error: "No objection given." }); return; }

  const c = body.contact || {}, p = body.playbook || {}, o = p.offer || {}, m = p.methodology || {}, mask = body.mask || {};
  const ctx = [];
  ctx.push("OFFER: " + (clip(o.name, 120) || "(unset)") + ". " + clip(o.summary, 400));
  if (o.price) ctx.push("PRICE: " + clip(o.price, 200));
  if (o.guarantee) ctx.push("GUARANTEE: " + clip(o.guarantee, 300));
  if (o.objections) ctx.push("KNOWN OBJECTIONS + BEST RESPONSES: " + clip(o.objections, 1000));
  if (m.principles) ctx.push("METHOD: " + clip(m.principles, 1400));
  const assets = Array.isArray(body.assets) ? body.assets.filter(Boolean).slice(0, 12) : [];
  if (assets.length) ctx.push("PROOF YOU MAY DROP (verbatim only): " + assets.map((a) => `${clip(a.title, 100)}${a.result ? " (" + clip(a.result, 100) + ")" : ""}`).join(" | "));
  if (c.name || c.offerInterest) ctx.push("PROSPECT: " + (clip(c.name, 80) || "") + (c.offerInterest ? ", wants: " + clip(c.offerInterest, 200) : ""));
  if (mask.mask) ctx.push("THEIR MASK: " + clip(mask.mask, 30) + (mask.affirmation ? " (affirm like: " + clip(mask.affirmation, 200) + ")" : ""));
  const transcript = clip(body.transcript, 2500);
  if (transcript.trim()) ctx.push("\nRECENT CALL CONTEXT:\n" + transcript);

  const userText = `${ctx.join("\n")}\n\nTHE OBJECTION JUST RAISED: ${objection}\n\nGive the 2-3 lines to handle it now.`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 320,
      system: SYSTEM,
      messages: [{ role: "user", content: userText }],
    });
    const raw = (msg.content.find((b) => b.type === "text") || {}).text || "{}";
    const mt = raw.match(/\{[\s\S]*\}/);
    let parsed = {};
    try { parsed = JSON.parse(mt ? mt[0] : raw); } catch (e) { parsed = {}; }
    const lines = Array.isArray(parsed.lines) ? parsed.lines.slice(0, 3).map((x) => clip(x, 220)).filter(Boolean) : [];
    res.status(200).json({ lines, usage: msg.usage });
  } catch (e) {
    res.status(e?.status || 500).json({ error: e?.message || "Objection handling failed." });
  }
}
