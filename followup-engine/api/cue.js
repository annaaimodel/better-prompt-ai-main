// Cadence - live call copilot cue engine.
//
// Given a rolling transcript of a live call, returns 1-3 short, glanceable cues
// the rep can act on RIGHT NOW - built from the user's Playbook, method, assets
// and the prospect's mask. Tuned for low latency (Haiku) and called every few
// seconds during a call.
//
// POST { access_code, transcript, contact, playbook, assets, mask, recentCues }
// Returns { cues: [{ type, text }], usage }
//
// Stores/logs nothing.
//
// Env vars: ACCESS_CODE (required), ANTHROPIC_API_KEY (required)
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

const SYSTEM =
`You are a LIVE sales-call copilot whispering to a high-ticket closer DURING the call. You read a rolling transcript (rep and prospect mixed, newest at the end) and output 1-3 VERY SHORT cues the rep can glance at and act on immediately. Run the user's method and Playbook below.

Hard rules:
- This is a LIVE call - the prospect is on the line right now. Every cue is something to SAY or DO in THIS conversation, in this moment.
- NEVER coach the rep on their outreach process or channels. Do not tell them to stop (or start) calling, texting, emailing, or leaving voicemails. Calling and leaving voicemails are a normal, intended part of their job - never flag them as mistakes. Cues are about the conversation, not the strategy of reaching people.
- Terse and glanceable. Each cue is ONE short line (max ~14 words) the rep can act on instantly. No preamble, no explanation, no quotes around it.
- React to what the PROSPECT most recently said. If nothing new or actionable, return an empty list.
- Choose the most useful 1-3 cue types:
  - "ask": the next question to ask (lead with their world, surface the real problem, let them conclude).
  - "objection": when they hesitate, a question that traces or tests the limiting belief (never argue).
  - "mask": a short, sincere affirmation of their dominant need (only if a mask is given).
  - "value": a specific proof/testimonial or fact to drop (ONLY from the assets/Playbook provided).
  - "nudge": an IN-CALL delivery correction only, e.g. "You're talking too much - ask a question", "Slow down, let them speak", "Stop pitching, get curious". Never about outreach tactics or channels.
  - "book": move toward the booking/next step (follow the booking instruction; keep any [BRACKETS]).
- Do NOT repeat anything in RECENT CUES.
- Never invent facts, client results, names, dates, times, or links. Use only what is provided.
- Never use em dashes or en dashes; use a simple hyphen.

SCRIPT FOLLOWING: if numbered SCRIPT BLOCKS are provided, also work out which block the rep should be on RIGHT NOW based on the conversation so far, and return its number as "scriptIndex" (0-based), plus a one-line "scriptNote" directing what to do with the script next (e.g. "Move to discovery", "They raised price - jump to ROI block", "Stay here, dig deeper"). The script is the rep's plan; your cues adapt it live with the method. If no script is provided, set scriptIndex to null and scriptNote to "".

Return ONLY a JSON object: {"cues":[{"type":"ask|objection|mask|value|nudge|book","text":"<short line>"}],"scriptIndex":<number or null>,"scriptNote":"<short or empty>"}. No markdown, no prose.`;

function clip(v, n) { return (v == null ? "" : String(v)).slice(0, n); }

function buildContext(body) {
  const c = body.contact || {}, p = body.playbook || {}, o = p.offer || {}, m = p.methodology || {}, mask = body.mask || {};
  const out = [];
  out.push("OFFER: " + (clip(o.name, 120) || "(unset)") + ". " + clip(o.summary, 500));
  if (o.transformation) out.push("PROMISE: " + clip(o.transformation, 300));
  if (o.price) out.push("PRICE: " + clip(o.price, 200));
  if (o.objections) out.push("KNOWN OBJECTIONS + RESPONSES: " + clip(o.objections, 800));
  if (o.booking) out.push("BOOKING / NEXT STEP (follow exactly, keep [BRACKETS]): " + clip(o.booking, 400));
  if (m.principles) out.push("METHOD: " + clip(m.principles, 1200));
  if (m.never) out.push("METHOD DON'TS: " + clip(m.never, 400));

  const assets = Array.isArray(body.assets) ? body.assets.filter(Boolean).slice(0, 12) : [];
  if (assets.length) {
    out.push("PROOF YOU MAY DROP (use only these, verbatim facts): " +
      assets.map((a) => `${clip(a.title, 100)}${a.result ? " (" + clip(a.result, 100) + ")" : ""}`).join(" | "));
  }

  out.push("\nTHE PROSPECT: " + (clip(c.name, 80) || "(unknown)") + (c.offerInterest ? ", wants: " + clip(c.offerInterest, 200) : "") + (c.notes ? ". Notes: " + clip(c.notes, 600) : ""));
  if (mask.mask) {
    out.push("THEIR MASK / DOMINANT NEED: " + clip(mask.mask, 30) + (mask.affirmation ? ". Affirm like: " + clip(mask.affirmation, 250) : ""));
  }
  const recent = Array.isArray(body.recentCues) ? body.recentCues.filter(Boolean).slice(-10) : [];
  out.push("\nRECENT CUES (do not repeat): " + (recent.length ? recent.map((r) => clip(r, 120)).join(" | ") : "(none yet)"));
  return out.join("\n");
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  const body = req.body || {};
  if (!process.env.ACCESS_CODE) { res.status(503).json({ error: "Not configured: set ACCESS_CODE in Vercel." }); return; }
  const code = req.headers["x-access-code"] || body.access_code || "";
  if (code !== process.env.ACCESS_CODE) { res.status(401).json({ error: "Invalid access code." }); return; }
  if (!process.env.ANTHROPIC_API_KEY) { res.status(503).json({ error: "Not configured: ANTHROPIC_API_KEY is not set in Vercel." }); return; }

  const transcript = clip(body.transcript, 6000);
  if (transcript.trim().length < 20) { res.status(200).json({ cues: [], scriptIndex: null, scriptNote: "" }); return; }

  const blocks = Array.isArray(body.scriptBlocks) ? body.scriptBlocks.slice(0, 60).map((b, i) => `[${i}] ${clip(b, 400)}`) : [];
  const scriptText = blocks.length ? `\n\nSCRIPT BLOCKS (the rep's plan, numbered):\n${blocks.join("\n")}` : "";
  const userText = `${buildContext(body)}${scriptText}\n\nLIVE TRANSCRIPT (newest at the end):\n${transcript}\n\nGive the 1-3 most useful cues right now (or an empty list if nothing new)${blocks.length ? ", plus the current scriptIndex and a short scriptNote" : ""}.`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 360,
      system: SYSTEM,
      messages: [{ role: "user", content: userText }],
    });
    const raw = (msg.content.find((b) => b.type === "text") || {}).text || "{}";
    const mt = raw.match(/\{[\s\S]*\}/);
    let parsed = {};
    try { parsed = JSON.parse(mt ? mt[0] : raw); } catch (e) { parsed = {}; }
    const cues = Array.isArray(parsed.cues)
      ? parsed.cues.slice(0, 3).map((x) => ({ type: clip(x.type, 20).toLowerCase() || "ask", text: clip(x.text, 200) })).filter((x) => x.text)
      : [];
    const scriptIndex = (typeof parsed.scriptIndex === "number" && parsed.scriptIndex >= 0) ? Math.floor(parsed.scriptIndex) : null;
    res.status(200).json({ cues, scriptIndex, scriptNote: clip(parsed.scriptNote, 160), usage: msg.usage });
  } catch (e) {
    res.status(e?.status || 500).json({ error: e?.message || "Cue failed." });
  }
}
