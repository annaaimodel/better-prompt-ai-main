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
`You are a calm LIVE sales-call copilot whispering to a closer DURING the call. You read a rolling transcript (rep and prospect mixed, newest at the end) and, only when it genuinely helps, output a SHORT cue the rep can glance at. Less is more.

You do exactly three jobs, nothing else:
1. SHARE KNOWLEDGE (your most valuable job) - the moment the prospect mentions a condition, symptom, need, question, doubt, or objection that any KNOWLEDGE BASE card (product, objection, Q&A, or knowledge) or the offer covers, fire a short cue with the matching fact or answer so the rep can say it. Do this proactively, this is the main reason you exist. Pull the specific card content, do not be vague.
2. QUESTION NUDGES - suggest the next good question to ask (surface their real problem/goal, let them conclude).
3. NEXT STEP - when it's time, a short move toward the booking/next step (keep any [BRACKETS]).

Cue types: "ask" (a question to ask), "value" (a fact, offer detail, proof, or knowledge-base answer to share), "objection" (the answer/approach for an objection they raised, from the knowledge base or method), "book" (next step).

CADENCE - THIS IS CRITICAL:
- Prefer an EMPTY list. Only fire when there is something genuinely new and useful RIGHT NOW that the rep is not already doing.
- At most ONE cue per turn. Two only if truly needed. Never a stream.
- Let key information sit. Do NOT re-send, rephrase, or nag the same point. If anything in RECENT CUES already covers it, return an empty list.

NEVER DO:
- NEVER comment on the rep's talking, pace, tone, delivery, or behaviour. Do not say "stop talking", "slow down", "ask a question", "you're pitching", or anything about how they sound. No coaching, no corrections. This is banned.
- NEVER mention voicemails, calling back, or outreach. The prospect is on the line now.
- Consumer HEALTH sale: never cue a disease/cure/medical claim (use "support", never "treat/cure/heal/lower/get off meds"); the prospect's doctor owns medication decisions.
- Buyers are often older and on fixed income: never cue fear, urgency, scarcity or pressure. Hope and honesty only.
- Never invent facts, results, names, numbers or links. Use only the offer, assets, and KNOWLEDGE BASE provided.
- Never use em dashes or en dashes; use a simple hyphen.

SCRIPT FOLLOWING: if numbered SCRIPT BLOCKS are provided, work out which block the rep should be on RIGHT NOW and return its number as "scriptIndex" (0-based), plus a one-line "scriptNote" (e.g. "Move to discovery", "They raised price, handle it here"). If no script is provided, set scriptIndex to null and scriptNote to "".

MEDICATIONS: also return "meds", a list of the names of any medications, prescriptions, or drugs the PROSPECT mentions they take (brand or generic, e.g. metformin, lisinopril, insulin, Ozempic, warfarin). Names only, no dosages or advice. Do NOT include the supplements being sold. Empty list if none mentioned.

Return ONLY a JSON object: {"cues":[{"type":"ask|value|objection|book","text":"<short line>"}],"scriptIndex":<number or null>,"scriptNote":"<short or empty>","meds":["..."]}. No markdown, no prose.`;

function clip(v, n) { return (v == null ? "" : String(v)).slice(0, n); }

// Hard filter: the prospect is live on the line, so cues about outreach tactics
// (voicemails, calling back, reaching multiple prospects) are always noise and
// the model occasionally emits them anyway. Drop them deterministically.
const OUTREACH_RE = /voice ?mail|call(?:ing)? ?back|call them back|stop (?:calling|leaving|reaching|texting|emailing|messaging)|reach(?:ing|ed)? out|leave (?:a|them) (?:message|voicemail)|other prospects|different prospects|wait for (?:them|the prospect) to (?:call|respond|reply|reach)/i;
function stripOutreachCues(cues) { return cues.filter((c) => c && c.text && !OUTREACH_RE.test(c.text)); }

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

  // The user's knowledge base: products, objections, Q&A and extra knowledge.
  // Surface the matching one when the prospect raises that topic/need/question.
  const cards = Array.isArray(body.cards) ? body.cards.filter((x) => x && (x.name || x.info)).slice(0, 40) : [];
  if (cards.length) {
    out.push("\nKNOWLEDGE BASE (share the matching fact/answer when relevant; quote only from here):\n" +
      cards.map((x) => `[${clip(x.kind, 10) || "product"}] ${clip(x.name, 70)}: ${clip(x.info, 200)}`).join("\n"));
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
  if (!String(process.env.ACCESS_CODE || "").split(",").map((s) => s.trim()).filter(Boolean).includes(code)) { res.status(401).json({ error: "Invalid access code." }); return; }
  if (!process.env.ANTHROPIC_API_KEY) { res.status(503).json({ error: "Not configured: ANTHROPIC_API_KEY is not set in Vercel." }); return; }

  const transcript = clip(body.transcript, 6000);
  if (transcript.trim().length < 20) { res.status(200).json({ cues: [], scriptIndex: null, scriptNote: "" }); return; }

  const blocks = Array.isArray(body.scriptBlocks) ? body.scriptBlocks.slice(0, 60).map((b, i) => `[${i}] ${clip(b, 400)}`) : [];
  const scriptText = blocks.length ? `\n\nSCRIPT BLOCKS (the rep's plan, numbered):\n${blocks.join("\n")}` : "";
  const userText = `${buildContext(body)}${scriptText}\n\nLIVE TRANSCRIPT (newest at the end):\n${transcript}\n\nGive the single most useful cue right now (prefer an empty list if nothing new, especially any knowledge-base fact or answer that fits what they just said)${blocks.length ? ", plus the current scriptIndex and a short scriptNote" : ""}. Also return any medications the prospect mentioned.`;

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
      ? stripOutreachCues(parsed.cues.slice(0, 4).map((x) => ({ type: clip(x.type, 20).toLowerCase() || "ask", text: clip(x.text, 200) })).filter((x) => x.text)).slice(0, 3)
      : [];
    const scriptIndex = (typeof parsed.scriptIndex === "number" && parsed.scriptIndex >= 0) ? Math.floor(parsed.scriptIndex) : null;
    const meds = Array.isArray(parsed.meds) ? parsed.meds.slice(0, 20).map((x) => clip(x, 60).trim()).filter(Boolean) : [];
    res.status(200).json({ cues, scriptIndex, scriptNote: clip(parsed.scriptNote, 160), meds, usage: msg.usage });
  } catch (e) {
    res.status(e?.status || 500).json({ error: e?.message || "Cue failed." });
  }
}
