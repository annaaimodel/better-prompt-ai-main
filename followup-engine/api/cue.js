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

Your jobs, in priority order:
1. HANDLE OBJECTIONS (TOP PRIORITY) - the moment the prospect raises an objection, doubt, concern or hesitation, check the OBJECTION CARDS provided below. If one of them covers it, fire an "objection" cue with that card's response IN FULL, word for word - do NOT shorten, summarise, paraphrase, soften or improve it; the rep reads it aloud, so give the whole line. If NO objection card covers what they raised, do NOT give an objection cue and do NOT invent one - move to a good question instead. Objection handling comes ONLY from the objection cards, never from your own knowledge, the offer, or the methodology.
2. ANSWER A COVERED QUESTION - if they ask a factual question a Q&A or KNOWLEDGE card answers, you may share that answer as a "value" cue. This is answering a question, not handling an objection.
3. QUESTION NUDGES - when nothing above is on the table, suggest the next good question the rep should ask to move the conversation forward: surface their real problem, dig into what they just said, uncover the goal or the concern, and let them reach their own conclusion. Offer a fresh, relevant question whenever the conversation opens one. Keep questions short, one sentence.
4. NEXT STEP - when it's time, a short move toward the booking/next step (keep any [BRACKETS]).

Cue types: "objection" (the answer/approach for an objection or concern they raised), "value" (a knowledge/Q&A fact or offer detail to share), "ask" (a question to ask), "book" (next step).

DO NOT whisper the names of the products or supplements being sold, and do not read out product details. Those appear automatically for the rep in a separate Knowledge panel. Your job is questions and answers, not naming products.

CADENCE:
- If the prospect raised an objection an OBJECTION card covers, ALWAYS fire that card's line in full - do not skip it. If no objection card covers it, do NOT force an objection cue; ask a good question instead.
- Otherwise, lead with the next good QUESTION whenever one naturally fits, even if nothing is wrong, to keep the rep digging.
- Usually ONE cue per turn; send TWO only when both an objection/answer AND a question genuinely help. Never a stream.
- Do NOT re-send, rephrase, or nag the same point. If anything in RECENT CUES already covers it, pick a different angle or return an empty list. If genuinely nothing new fits, return an empty list.

NEVER DO:
- NEVER comment on the rep's talking, pace, tone, delivery, or behaviour. Do not say "stop talking", "slow down", "ask a question", "you're pitching", or anything about how they sound. No coaching, no corrections. This is banned.
- NEVER mention voicemails, calling back, or outreach. The prospect is on the line now.
- Consumer HEALTH sale: never cue a disease/cure/medical claim (use "support", never "treat/cure/heal/lower/get off meds"); the prospect's doctor owns medication decisions.
- Buyers are often older and on fixed income: never cue fear, urgency, scarcity or pressure. Hope and honesty only.
- Never invent facts, results, names, numbers or links. Use only the offer, assets, and KNOWLEDGE BASE provided.
- Never fabricate, guess or construct an objection response. An "objection" cue must be an approved line taken from an OBJECTION card. No matching objection card means NO objection cue - ask a question instead.
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
  if (o.booking) out.push("BOOKING / NEXT STEP (follow exactly, keep [BRACKETS]): " + clip(o.booking, 400));
  if (m.principles) out.push("METHOD: " + clip(m.principles, 1200));
  if (m.never) out.push("METHOD DON'TS: " + clip(m.never, 400));

  const assets = Array.isArray(body.assets) ? body.assets.filter(Boolean).slice(0, 12) : [];
  if (assets.length) {
    out.push("PROOF YOU MAY DROP (use only these, verbatim facts): " +
      assets.map((a) => `${clip(a.title, 100)}${a.result ? " (" + clip(a.result, 100) + ")" : ""}`).join(" | "));
  }

  // The user's knowledge base. Objection + Q&A responses are the rep's approved
  // lines to fire the moment a concern or question lands, so surface them
  // prominently and separately from general knowledge.
  const cards = Array.isArray(body.cards) ? body.cards.filter((x) => x && (x.name || x.info)).slice(0, 60) : [];
  if (cards.length) {
    const objqa = cards.filter((x) => x.kind === "objection" || x.kind === "qa");
    const know = cards.filter((x) => x.kind !== "objection" && x.kind !== "qa");
    if (objqa.length) out.push("\nOBJECTION + Q&A RESPONSES (fire the matching one IN FULL the MOMENT they raise that concern or ask that question - these are the rep's approved lines, quote them completely):\n" +
      objqa.map((x) => `"${clip(x.name, 90)}" -> ${clip(x.info, 700)}`).join("\n"));
    if (know.length) out.push("\nKNOWLEDGE (share the matching fact/answer when relevant; quote only from here):\n" +
      know.map((x) => `${clip(x.name, 80)}: ${clip(x.info, 220)}`).join("\n"));
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
  const userText = `${buildContext(body)}${scriptText}\n\nLIVE TRANSCRIPT (newest at the end):\n${transcript}\n\nGive the most useful cue(s) right now. If the prospect just raised an objection, doubt, concern or a question your OBJECTION/Q&A/KNOWLEDGE base or playbook covers, fire that answer first (a question can go alongside). Otherwise give the next good QUESTION for the rep to ask based on what the prospect just said. Return an empty list only if truly nothing new fits. Do not name the products/supplements${blocks.length ? ". Also give the current scriptIndex and a short scriptNote" : ""}. Also return any medications the prospect mentioned.`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 700,
      system: SYSTEM,
      messages: [{ role: "user", content: userText }],
    });
    const raw = (msg.content.find((b) => b.type === "text") || {}).text || "{}";
    const mt = raw.match(/\{[\s\S]*\}/);
    let parsed = {};
    try { parsed = JSON.parse(mt ? mt[0] : raw); } catch (e) { parsed = {}; }
    const cues = Array.isArray(parsed.cues)
      ? stripOutreachCues(parsed.cues.slice(0, 4).map((x) => ({ type: clip(x.type, 20).toLowerCase() || "ask", text: clip(x.text, 700) })).filter((x) => x.text)).slice(0, 3)
      : [];
    const scriptIndex = (typeof parsed.scriptIndex === "number" && parsed.scriptIndex >= 0) ? Math.floor(parsed.scriptIndex) : null;
    const meds = Array.isArray(parsed.meds) ? parsed.meds.slice(0, 20).map((x) => clip(x, 60).trim()).filter(Boolean) : [];
    res.status(200).json({ cues, scriptIndex, scriptNote: clip(parsed.scriptNote, 160), meds, usage: msg.usage });
  } catch (e) {
    res.status(e?.status || 500).json({ error: e?.message || "Cue failed." });
  }
}
