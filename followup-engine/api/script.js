// Cadence - call script builder.
//
// Builds a ready-to-follow call script from the Playbook's offer knowledge +
// sales methodology + voice. Output is split into blank-line sections so it
// feeds straight into the Live teleprompter.
//
// POST { access_code, kind, notes, playbook, assets }
//   kind: "discovery" | "closing" | "setter" | "followup" | "custom"
// Returns { text, usage }
//
// Stores/logs nothing.
//
// Env vars: ACCESS_CODE (required), ANTHROPIC_API_KEY (required)
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

const KINDS = {
  discovery: "a DISCOVERY / qualification call - understand their situation deeply and set up the close",
  closing: "a CLOSING call - present the offer and guide them to a decision",
  setter: "a SETTER call - qualify and book them onto the closer's call",
  followup: "a FOLLOW-UP call - reconnect after a prior conversation and move it forward",
  custom: "a call as described in the notes",
};

const SYSTEM =
`You write a practical CALL SCRIPT for a high-ticket closer, built from their loaded OFFER knowledge and their SALES METHODOLOGY, in their voice. The script is a plan the rep follows live, so structure matters.

Hard rules:
- Organise the script into clear SECTIONS separated by a BLANK LINE (so each section is a followable block). Start each section with a short heading line (e.g. "OPEN", "DISCOVERY", "SURFACE THE PROBLEM", "PRESENT", "PRICE", "OBJECTIONS", "CLOSE / BOOK", "NEXT STEP").
- Follow the user's METHODOLOGY for the flow and the moves (e.g. question-led discovery, surface the real problem, let them feel the outcome, lead not pressure, diagnose beliefs rather than argue). Do not impose a generic framework if theirs differs.
- Use a mix of: verbatim lines the rep can say, and the key QUESTIONS to ask. Keep lines natural and speakable.
- Use ONLY facts from the offer. Never invent prices, guarantees, client results, names, or links. If a booking/next-step instruction is given, follow it and keep any [BRACKETED] placeholders (e.g. "[DAY] at [TIME]") for the rep to fill.
- Match the user's voice/tone. Default to UK English unless the tone says otherwise.
- Never use em dashes or en dashes; use a simple hyphen. Output only the script.`;

function clip(v, n) { return (v == null ? "" : String(v)).slice(0, n); }

function buildContext(body) {
  const p = body.playbook || {}, o = p.offer || {}, m = p.methodology || {}, t = p.tone || {};
  const out = [];
  out.push("OFFER: " + (clip(o.name, 140) || "(unset)") + ". " + clip(o.summary, 700));
  if (o.whoFor) out.push("WHO IT'S FOR: " + clip(o.whoFor, 400));
  if (o.transformation) out.push("PROMISE: " + clip(o.transformation, 500));
  if (o.deliverables) out.push("DELIVERABLES: " + clip(o.deliverables, 800));
  if (o.price) out.push("PRICE: " + clip(o.price, 400));
  if (o.guarantee) out.push("GUARANTEE: " + clip(o.guarantee, 400));
  if (o.differentiators) out.push("WHY US: " + clip(o.differentiators, 500));
  if (o.objections) out.push("COMMON OBJECTIONS + RESPONSES: " + clip(o.objections, 1500));
  if (o.booking) out.push("BOOKING / NEXT STEP (follow exactly, keep [BRACKETS]): " + clip(o.booking, 500));
  if (m.principles) out.push("\nSALES METHODOLOGY (drives the flow): " + clip(m.principles, 2500));
  if (m.callStructure) out.push("HOW CALLS SHOULD BE BUILT: " + clip(m.callStructure, 1200));
  if (m.never) out.push("METHOD DON'TS: " + clip(m.never, 500));
  const voice = [t.formality, t.energy, t.sentenceLength, t.slang, t.signature].filter(Boolean).join("; ");
  if (voice) out.push("VOICE: " + clip(voice, 400));
  const assets = Array.isArray(body.assets) ? body.assets.filter(Boolean).slice(0, 10) : [];
  if (assets.length) out.push("PROOF YOU MAY REFERENCE (verbatim only): " + assets.map((a) => `${clip(a.title, 100)}${a.result ? " (" + clip(a.result, 100) + ")" : ""}`).join(" | "));
  return out.join("\n");
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  const body = req.body || {};
  if (!process.env.ACCESS_CODE) { res.status(503).json({ error: "Not configured: set ACCESS_CODE in Vercel." }); return; }
  const code = req.headers["x-access-code"] || body.access_code || "";
  if (code !== process.env.ACCESS_CODE) { res.status(401).json({ error: "Invalid access code." }); return; }
  if (!process.env.ANTHROPIC_API_KEY) { res.status(503).json({ error: "Not configured: ANTHROPIC_API_KEY is not set in Vercel." }); return; }

  const kind = KINDS[body.kind] ? body.kind : "discovery";
  const notes = clip(body.notes, 600);
  const userText = `${buildContext(body)}\n\nWRITE: ${KINDS[kind]}.${notes ? "\nFocus / context: " + notes : ""}\n\nBuild the call script now, in clear blank-line-separated sections.`;

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2200,
      system: SYSTEM,
      messages: [{ role: "user", content: userText }],
    });
    const text = (msg.content.find((b) => b.type === "text") || {}).text || "";
    res.status(200).json({ text, usage: msg.usage });
  } catch (e) {
    res.status(e?.status || 500).json({ error: e?.message || "Script generation failed - try again." });
  }
}
