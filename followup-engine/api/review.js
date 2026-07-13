// Cadence - Call Review. Diagnoses a finished sales call against everything the
// CRM knows: the rep's script, the methodology, the offer, the product/objection
// cards, the live cues that fired, and the prospect's mask. Returns where the
// call was won or lost and specific, method-true coaching to improve.
//
// POST { access_code, transcript, playbook, script, cards, cues, contact, mask }
// Returns { review: {...}, usage }
//
// Stores/logs nothing - inputs are used in memory only.
//
// Env vars (set in Vercel): ACCESS_CODE (required), ANTHROPIC_API_KEY (required)
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

const SYSTEM =
`You are an elite sales coach reviewing a recorded sales call for the rep (the salesperson, not the prospect). You are given the call transcript plus the rep's own playbook: their offer, their sales methodology, the call script they intended to follow, their product and objection/Q&A cards, the live cues the copilot suggested during the call, and the prospect's mask if known. Use ALL of it to judge the call the rep's own method's way - not generic advice.

Your job: tell the rep exactly where the call was won or lost and how to do better, honestly and specifically. Be direct but constructive. Praise what genuinely worked; do not invent positives.

Rules:
- Ground every point in the transcript. Quote short phrases (a few words) as evidence. Never invent quotes, numbers, or outcomes.
- Judge methodology adherence against the METHOD provided (discovery before pitch, surfacing the real concern, mask-true affirmation, no pressure, honest framing, no medical claims for health products, etc.). If they broke the method, name the moment.
- "lostAt" is the single pivotal moment momentum or the sale slipped - the objection that wasn't resolved, the question not asked, the rushed close. Pin it to a quote/point. If the call genuinely went well, set it to "" and say so in outcome.
- For objections: list each objection/concern the prospect raised, how well the rep handled it (well | partly | poorly | missed), and the better line to use next time - drawn from their objection cards and method where possible.
- "improve" must be concrete and actionable (a specific thing to say or do differently), not vague ("build more rapport" is bad; "after they said 'I need to ask my wife', ask what her main worry would be" is good).
- Never use em dashes or en dashes anywhere; use a simple hyphen or comma.

Return ONLY a JSON object (no markdown, no prose):
{
  "score": "<n/10, where 10 is a flawless method-true call>",
  "outcome": "<one honest line: where the call landed and why>",
  "lostAt": "<the pivotal moment it slipped, with a short quote; \"\" if it went well>",
  "wentWell": ["<specific thing the rep did well, with evidence>", ...],
  "missed": ["<a missed opportunity, unasked question, or dropped thread>", ...],
  "objections": [{"objection":"<what they raised>","handling":"well|partly|poorly|missed","better":"<the stronger line/approach>"}],
  "method": "<2-4 sentences on how well the rep followed THEIR methodology, naming specific moments>",
  "improve": ["<concrete, do-this-next-time coaching point>", ...],
  "nextStep": "<the single best follow-up move now, given how it ended>"
}`;

function clip(v, n) { return (v == null ? "" : String(v)).slice(0, n); }

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  const body = req.body || {};
  if (!process.env.ACCESS_CODE) { res.status(503).json({ error: "Not configured: set ACCESS_CODE in Vercel." }); return; }
  const code = req.headers["x-access-code"] || body.access_code || "";
  if (!String(process.env.ACCESS_CODE || "").split(",").map((s) => s.trim()).filter(Boolean).includes(code)) { res.status(401).json({ error: "Invalid access code." }); return; }
  if (!process.env.ANTHROPIC_API_KEY) { res.status(503).json({ error: "Not configured: ANTHROPIC_API_KEY is not set in Vercel." }); return; }

  const transcript = clip(body.transcript, 18000);
  if (transcript.trim().length < 40) { res.status(400).json({ error: "Need a call transcript to review." }); return; }

  const p = body.playbook || {}, o = p.offer || {}, m = p.methodology || {}, mask = body.mask || {};
  const ctx = [];
  ctx.push("OFFER: " + (clip(o.name, 120) || "(unset)") + ". " + clip(o.summary, 500));
  if (o.price) ctx.push("PRICE: " + clip(o.price, 200));
  if (o.guarantee) ctx.push("GUARANTEE: " + clip(o.guarantee, 300));
  if (m.name) ctx.push("METHOD NAME: " + clip(m.name, 120));
  if (m.principles) ctx.push("METHOD PRINCIPLES: " + clip(m.principles, 2000));
  if (m.callStructure) ctx.push("INTENDED CALL STRUCTURE: " + clip(m.callStructure, 1200));
  if (m.never) ctx.push("NEVER DO: " + clip(m.never, 600));
  if (body.script) ctx.push("\nTHE SCRIPT THE REP MEANT TO FOLLOW:\n" + clip(body.script, 4000));

  const cards = Array.isArray(body.cards) ? body.cards.slice(0, 80) : [];
  const prods = cards.filter((c) => c && c.kind !== "objection");
  const objs = cards.filter((c) => c && c.kind === "objection");
  if (prods.length) ctx.push("\nPRODUCT CARDS AVAILABLE: " + prods.map((c) => `${clip(c.name, 80)}: ${clip(c.info, 200)}`).join(" | "));
  if (objs.length) ctx.push("\nOBJECTION / Q&A CARDS (the rep's best responses): " + objs.map((c) => `"${clip(c.name, 80)}" -> ${clip(c.info, 240)}`).join(" | "));

  const cues = Array.isArray(body.cues) ? body.cues.filter(Boolean).slice(-25) : [];
  if (cues.length) ctx.push("\nLIVE CUES THE COPILOT SUGGESTED DURING THE CALL: " + cues.map((c) => clip(c, 160)).join(" | "));

  const c = body.contact || {};
  if (c.name || c.offerInterest) ctx.push("\nPROSPECT: " + (clip(c.name, 80) || "") + (c.offerInterest ? ", wants: " + clip(c.offerInterest, 200) : ""));
  if (mask.mask) ctx.push("PROSPECT MASK: " + clip(mask.mask, 30) + (mask.affirmation ? " (affirm like: " + clip(mask.affirmation, 200) + ")" : ""));

  const userText = `${ctx.join("\n")}\n\n=== CALL TRANSCRIPT ===\n${transcript}\n\nReview this call.`;

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2200,
      system: SYSTEM,
      messages: [{ role: "user", content: userText }],
    });
    const raw = (msg.content.find((b) => b.type === "text") || {}).text || "{}";
    const mt = raw.match(/\{[\s\S]*\}/);
    let parsed = {};
    try { parsed = JSON.parse(mt ? mt[0] : raw); } catch (e) { parsed = {}; }
    const review = {
      score: clip(parsed.score, 30),
      outcome: clip(parsed.outcome, 600),
      lostAt: clip(parsed.lostAt, 800),
      wentWell: Array.isArray(parsed.wentWell) ? parsed.wentWell.slice(0, 8).map((x) => clip(x, 300)).filter(Boolean) : [],
      missed: Array.isArray(parsed.missed) ? parsed.missed.slice(0, 8).map((x) => clip(x, 300)).filter(Boolean) : [],
      objections: Array.isArray(parsed.objections) ? parsed.objections.slice(0, 10).map((x) => ({
        objection: clip(x.objection, 200), handling: clip(x.handling, 20), better: clip(x.better, 400),
      })).filter((x) => x.objection) : [],
      method: clip(parsed.method, 900),
      improve: Array.isArray(parsed.improve) ? parsed.improve.slice(0, 10).map((x) => clip(x, 350)).filter(Boolean) : [],
      nextStep: clip(parsed.nextStep, 500),
    };
    res.status(200).json({ review, usage: msg.usage });
  } catch (e) {
    res.status(e?.status || 500).json({ error: e?.message || "Review failed - try again." });
  }
}
